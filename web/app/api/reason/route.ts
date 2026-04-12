import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { extractText } from "@/lib/extract";
import { getAllTags, getArticlesForTags, getConflictsForTags, getRegulationsForTags, runQuery } from "@/lib/neo4j";

export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AGENT_META = {
  A1: { name: "Engineer",       jur: "Technical",       color: "#5271FF", bg: "#EEF0FF" },
  A2: { name: "EU Regulator",   jur: "🇪🇺 GDPR",         color: "#2E8B57", bg: "#F0FDF4" },
  A3: { name: "US Counsel",     jur: "🇺🇸 CCPA / FTC",   color: "#DC4C22", bg: "#FFF4F0" },
  A4: { name: "Product Counsel",jur: "⚖️ Product Law",   color: "#7B1FA2", bg: "#F5F0FB" },
  A5: { name: "Business Owner", jur: "💼 Commercial",    color: "#C05600", bg: "#FFF8F0" },
};

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let question = "";
    let contexts: Record<string, string> = {};
    let docTexts: Array<{ name: string; text: string }> = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      question = (form.get("question") as string) ?? "";
      contexts = JSON.parse((form.get("contexts") as string) ?? "{}");
      const files = form.getAll("files") as File[];
      docTexts = await Promise.all(
        files.map(async (f) => ({ name: f.name, text: await extractText(f) }))
      );
    } else {
      const body = await req.json();
      question = body.question ?? "";
      contexts = body.contexts ?? {};
      docTexts = body.docTexts ?? [];
    }

    // ── Step 1: Tag extraction → Neo4j context ────────────────────────────
    const availableTags = await getAllTags();
    const tagExtractionRes = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Identify which legal compliance tags from this list apply to the question and any document context. Return JSON: {"tags": [...]}.\nAvailable: ${availableTags.join(", ")}`,
        },
        {
          role: "user",
          content: `Question: ${question}\n\nDocument context:\n${docTexts.map((d) => d.text.slice(0, 2000)).join("\n\n")}`,
        },
      ],
    });
    const identifiedTags: string[] = JSON.parse(tagExtractionRes.choices[0].message.content ?? '{"tags":[]}').tags ?? [];
    const tags = identifiedTags.filter((t) => availableTags.includes(t));

    const [articles, conflicts, regulations] = await Promise.all([
      tags.length ? getArticlesForTags(tags) : Promise.resolve([]),
      tags.length ? getConflictsForTags(tags) : Promise.resolve([]),
      tags.length ? getRegulationsForTags(tags) : Promise.resolve([]),
    ]);

    const neo4jContext = buildNeo4jContext(articles, conflicts, regulations, tags);

    // ── Step 2: Generate full adversarial session in one GPT-4o call ──────
    const sessionRes = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(question, contexts, neo4jContext, docTexts),
        },
      ],
    });

    const session = JSON.parse(sessionRes.choices[0].message.content ?? "{}");

    return NextResponse.json({
      ...session,
      agentMeta: AGENT_META,
      tags,
      articles,
      conflicts,
      regulations,
    });
  } catch (err) {
    console.error("[/api/reason]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are LegalIQ's multi-agent adversarial legal reasoning engine. You simulate a counsel panel of 5 agents debating a legal question from different perspectives:

A1 – Engineer: Argues VRM/data is operational, not personal. Favours technical pseudonymisation defences. Minimises compliance burden.
A2 – EU Regulator: GDPR maximalist. Strong on data subject rights, Breyer standard, Recital 30. Challenges pseudonymisation defences.
A3 – US Counsel: CCPA/FTC pragmatist. Business-friendly US law perspective. Disputes over-application of EU standards.
A4 – Product Counsel: Cross-jurisdictional compromise advocate. Proposes consent-based, dual-regime-compliant implementation.
A5 – Business Owner: Commercial viability focus. Argues for least-friction approach. Challenges consent overhead on conversion.

Return ONLY valid JSON matching this schema exactly:
{
  "agents": {
    "A1": {
      "status": "UPHELD"|"UNDER DISPUTE"|"RESTORED",
      "submission": "one clear sentence stating the agent's legal position",
      "factualBasis": "factual grounding for the submission",
      "legalAuthority": "which articles/sections support this",
      "citedAuthority": "precise citations e.g. GDPR Art. 4(5); ICO Code",
      "qualification": "Save where... edge case carve-out",
      "confidence": 0-100
    },
    "A2": { same structure },
    "A3": { same structure },
    "A4": { same structure },
    "A5": { same structure }
  },
  "exchanges": [
    {
      "id": "AT1",
      "type": "Direct Contention"|"Legal Authority Challenge"|"Factual Dispute",
      "typeColor": "#E53935"|"#F57C00"|"#FFA000",
      "typeBg": "#FEE2E2"|"#FEF3C7"|"#FEF9C3",
      "attacker": "A2",
      "target": "A1",
      "quote": "verbatim submission text (2-3 sentences)",
      "outcomeType": "sustained"|"overruled",
      "outcome": "OBJECTION SUSTAINED"|"OBJECTION OVERRULED",
      "outcomeDetail": "brief ruling note"
    }
  ],
  "agentExchangeMap": {
    "A1": {
      "objections": [{ "id": "AT1", "from": "A2", "type": "Direct Contention", "color": "#E53935", "summary": "..." }],
      "challenges": [{ "id": "AT2", "to": "A2", "type": "Legal Authority Challenge", "color": "#F57C00", "summary": "..." }]
    },
    "A2": { same },
    "A3": { same },
    "A4": { same },
    "A5": { same }
  },
  "strategies": [
    {
      "name": "strategy name (e.g. Full VRM Tracking)",
      "score": 0-100,
      "status": "BLOCKED"|"CONDITIONAL"|"OPTIMAL",
      "statusColor": "#B91C1C"|"#92400E"|"#0F766E",
      "statusBg": "#FEE2E2"|"#FEF3C7"|"#CCFBF1",
      "donutColor": "#EF4444"|"#F59E0B"|"#0D9488",
      "donutBg": "#FEE2E2"|"#FEF3C7"|"#CCFBF1",
      "note": "explanation",
      "optimal": false|true
    }
  ],
  "decision": {
    "recommendation": "2-3 sentence panel ruling",
    "jurisdictions": [
      { "flag": "🇪🇺", "name": "EU / GDPR", "rule": "specific ruling for this jurisdiction" },
      { "flag": "🇺🇸", "name": "US / CCPA & FTC", "rule": "specific ruling" },
      { "flag": "🌍", "name": "Global Baseline", "rule": "cross-jurisdiction guidance" }
    ]
  },
  "nextSteps": [
    {
      "phase": "Legal"|"Engineering"|"Product & Legal"|"Launch & Monitor",
      "title": "action title",
      "timeline": "Week X–Y",
      "actions": "1-2 sentence summary of concrete actions",
      "color": "#3d5afe"|"#0D9488"|"#7B1FA2"|"#C05600",
      "checklist": ["specific action item 1", "specific action item 2", "specific action item 3", "specific action item 4", "specific action item 5"],
      "owners": ["Role 1", "Role 2", "Role 3"]
    }
  ]
}

Generate exactly 3 strategies, exactly 4 next steps, and 4-6 exchanges. Make exchanges coherent — agents actually attack each other's specific arguments. The optimal strategy should reflect the Nash equilibrium (no party can improve by deviating).`;
}

function buildUserPrompt(
  question: string,
  contexts: Record<string, string>,
  neo4jContext: string,
  docTexts: Array<{ name: string; text: string }>
): string {
  const ctxLines = Object.entries(contexts)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${AGENT_META[k as keyof typeof AGENT_META]?.name ?? k}: ${v}`)
    .join("\n");

  const docSummary = docTexts.length
    ? `\n\nUploaded documents:\n${docTexts.map((d) => `${d.name}: ${d.text.slice(0, 1500)}`).join("\n\n")}`
    : "";

  return `Legal Question: ${question}

Agent Context:
${ctxLines || "(no additional context provided)"}
${docSummary}

Regulatory Knowledge Graph (Neo4j):
${neo4jContext}

Generate the full adversarial session JSON.`;
}

function buildNeo4jContext(
  articles: Record<string, unknown>[],
  conflicts: Record<string, unknown>[],
  regulations: Record<string, unknown>[],
  tags: string[]
): string {
  if (!articles.length && !tags.length) return "No specific regulatory articles identified.";
  return [
    `Identified tags: ${tags.join(", ")}`,
    `Regulations: ${regulations.map((r) => `${r.regulation} (${r.jurisdiction})`).join(", ")}`,
    `Key articles:\n${articles.slice(0, 8).map((a) => `• [${a.regulation}] ${a.section}: ${a.what_it_covers} — ${a.relevance}`).join("\n")}`,
    conflicts.length ? `Active conflicts: ${conflicts.map((c) => `${c.tag_a} ↔ ${c.tag_b}`).join(", ")}` : "",
  ].filter(Boolean).join("\n");
}
