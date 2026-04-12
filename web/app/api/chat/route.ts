import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { extractText } from "@/lib/extract";
import { extractTagsFromDocs, generateDecision } from "@/lib/openai";
import {
  getAllTags,
  getArticlesForTags,
  getConflictsForTags,
  getRegulationsForTags,
} from "@/lib/neo4j";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are LegalIQ, an AI legal compliance assistant specialising in data privacy law — GDPR, CCPA, DPPA, EU AI Act, and the ePrivacy Directive — with a deep focus on vehicle identity data (VRM/VIN).

You have access to a Neo4j legal knowledge graph containing tagged articles from these regulations. When answering:
- Reference specific articles by name (e.g. "GDPR Article 17", "CCPA §1798.105")
- Use the regulation context provided to ground your answers
- Highlight conflicts between applicable rules when they exist
- Be direct and actionable — compliance officers need clear guidance, not hedged legalese
- Use markdown: headers, bullet lists, bold for key terms

When the user uploads documents you will receive a structured compliance analysis. Use it to anchor follow-up answers.`;

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  // ── Branch A: files attached → run full analysis, return JSON ────────────
  if (contentType.includes("multipart/form-data")) {
    return handleAnalysis(req);
  }

  // ── Branch B: text-only follow-up → stream response ──────────────────────
  return handleChat(req);
}

// ── Analysis (with files) ─────────────────────────────────────────────────────

async function handleAnalysis(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const rawMessages = form.get("messages") as string | null;
    const messages: Array<{ role: string; content: string }> =
      rawMessages ? JSON.parse(rawMessages) : [];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided." }, { status: 400 });
    }

    const docTexts = await Promise.all(
      files.map(async (f) => ({ name: f.name, text: await extractText(f) }))
    );

    const availableTags = await getAllTags();
    const { tags, reasoning } = await extractTagsFromDocs(docTexts, availableTags);

    if (!tags.length) {
      return NextResponse.json({ error: "No compliance tags identified." }, { status: 422 });
    }

    const [articles, conflicts, regulations] = await Promise.all([
      getArticlesForTags(tags),
      getConflictsForTags(tags),
      getRegulationsForTags(tags),
    ]);

    const decision = await generateDecision({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docNames: files.map((f) => f.name),
      tags,
      articles: articles as Parameters<typeof generateDecision>[0]["articles"],
      conflicts: conflicts as Array<{ tag_a: string; tag_b: string }>,
      regulations: regulations as Array<{
        regulation: string;
        jurisdiction: string;
        article_count: number;
      }>,
    });

    // Also generate a short narrative summary for the chat bubble
    const narrativeMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: buildAnalysisContext({ docTexts, tags, articles, conflicts, regulations, decision: decision as unknown as Record<string, unknown> }) +
          "\n\nWrite a concise 3-5 sentence chat response summarising the compliance verdict and the single most important action needed. Be direct.",
      },
    ];

    const narrative = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      messages: narrativeMessages,
    });

    const summary = narrative.choices[0].message.content ?? "";

    return NextResponse.json({
      type: "analysis",
      summary,
      report: { files: files.map((f) => f.name), tags, tag_reasoning: reasoning, regulations, articles, conflicts, decision },
    });
  } catch (err) {
    console.error("[/api/chat analysis]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

// ── Streaming follow-up chat ───────────────────────────────────────────────────

async function handleChat(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Array<{ role: string; content: string }> = body.messages ?? [];
    const analysisContext: string = body.analysisContext ?? "";

    const systemContent = analysisContext
      ? `${SYSTEM_PROMPT}\n\n## Current Analysis Context\n${analysisContext}`
      : SYSTEM_PROMPT;

    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      stream: true,
      messages: chatMessages,
    });

    const readable = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(enc.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[/api/chat stream]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAnalysisContext({
  docTexts, tags, articles, conflicts, regulations, decision,
}: {
  docTexts: Array<{ name: string; text: string }>;
  tags: string[];
  articles: Record<string, unknown>[];
  conflicts: Record<string, unknown>[];
  regulations: Record<string, unknown>[];
  decision: Record<string, unknown>;
}): string {
  return `
Documents analysed: ${docTexts.map((d) => d.name).join(", ")}
Compliance tags identified: ${tags.join(", ")}
Verdict: ${decision.verdict} — Risk level: ${decision.risk_level}

Applicable regulations:
${regulations.map((r) => `• ${r.regulation} (${r.jurisdiction})`).join("\n")}

Active conflicts: ${conflicts.length ? conflicts.map((c) => `${c.tag_a} ↔ ${c.tag_b}`).join(", ") : "none"}

Key issues:
${((decision.key_issues as string[]) ?? []).map((i: string) => `• ${i}`).join("\n")}
`.trim();
}

// Serialise analysis for use as follow-up context (sent by client)
export function buildFollowUpContext(report: {
  files: string[];
  tags: string[];
  regulations: Array<{ regulation: string; jurisdiction: string; article_count: number }>;
  conflicts: Array<{ tag_a: string; tag_b: string }>;
  decision: {
    verdict: string;
    risk_level: string;
    summary: string;
    key_issues: string[];
    recommendations: string[];
  };
}): string {
  return `
Documents: ${report.files.join(", ")}
Verdict: ${report.decision.verdict} | Risk: ${report.decision.risk_level}
Summary: ${report.decision.summary}

Regulations in scope: ${report.regulations.map((r) => `${r.regulation} (${r.jurisdiction})`).join(", ")}
Active conflicts: ${report.conflicts.length ? report.conflicts.map((c) => `${c.tag_a} ↔ ${c.tag_b}`).join(", ") : "none"}
Tags: ${report.tags.join(", ")}

Key issues:
${report.decision.key_issues.map((i) => `• ${i}`).join("\n")}

Recommendations:
${report.decision.recommendations.map((r) => `• ${r}`).join("\n")}
`.trim();
}
