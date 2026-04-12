/**
 * OpenAI helpers for LegalIQ compliance analysis.
 *
 * Two-stage pipeline:
 *   1. Tag extraction  — given doc text + known tags → which tags apply?
 *   2. Decision        — given articles + conflicts → compliance verdict
 */

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TagExtractionResult {
  tags: string[];
  reasoning: string;
}

export interface ComplianceDecision {
  verdict: "COMPLIANT" | "NON_COMPLIANT" | "CONDITIONAL" | "INSUFFICIENT_DATA";
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
  key_issues: string[];
  recommendations: string[];
  conflict_resolutions: Array<{ conflict: string; resolution: string }>;
}

/**
 * Stage 1 — Extract relevant argumentation tags from document text.
 */
export async function extractTagsFromDocs(
  docTexts: Array<{ name: string; text: string }>,
  availableTags: string[]
): Promise<TagExtractionResult> {
  const combinedText = docTexts
    .map((d) => `### ${d.name}\n${d.text.slice(0, 3000)}`)
    .join("\n\n---\n\n");

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a legal compliance analyst specialising in data privacy law (GDPR, CCPA, DPPA).
You analyse product and policy documents to identify which legal compliance tags apply to a given use case.

Available tags (pick ONLY from this list):
${availableTags.join(", ")}

Return JSON with:
{
  "tags": ["TAG1", "TAG2", ...],   // subset of the available tags that apply
  "reasoning": "brief explanation of why each tag was selected"
}`,
      },
      {
        role: "user",
        content: `Analyse the following documents and identify which compliance tags apply to this product/company:\n\n${combinedText}`,
      },
    ],
  });

  const raw = JSON.parse(response.choices[0].message.content ?? "{}");
  return {
    tags: (raw.tags ?? []).filter((t: string) => availableTags.includes(t)),
    reasoning: raw.reasoning ?? "",
  };
}

/**
 * Stage 2 — Generate a compliance decision given articles and conflicts.
 */
export async function generateDecision(input: {
  docNames: string[];
  tags: string[];
  articles: Array<{
    article_id: string;
    section: string;
    what_it_covers: string;
    relevance: string;
    regulation: string;
    jurisdiction: string;
    matched_tags: string[];
  }>;
  conflicts: Array<{ tag_a: string; tag_b: string }>;
  regulations: Array<{ regulation: string; jurisdiction: string; article_count: number }>;
}): Promise<ComplianceDecision> {
  const prompt = `
Documents reviewed: ${input.docNames.join(", ")}

Identified compliance tags: ${input.tags.join(", ")}

Applicable regulations:
${input.regulations.map((r) => `• ${r.regulation} (${r.jurisdiction}) — ${r.article_count} articles apply`).join("\n")}

Relevant articles:
${input.articles
  .map(
    (a) =>
      `• [${a.regulation}] ${a.section}: ${a.what_it_covers}\n  Relevance: ${a.relevance}\n  Tags: ${(a.matched_tags as string[]).join(", ")}`
  )
  .join("\n\n")}

Active conflicts detected:
${input.conflicts.length === 0 ? "None" : input.conflicts.map((c) => `• ${c.tag_a} ↔ ${c.tag_b}`).join("\n")}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a senior legal compliance officer specialising in vehicle data and privacy law.
Given a set of applicable regulations, articles, and detected conflicts, produce a structured compliance decision.

Return JSON matching exactly:
{
  "verdict": "COMPLIANT" | "NON_COMPLIANT" | "CONDITIONAL" | "INSUFFICIENT_DATA",
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "2-3 sentence executive summary",
  "key_issues": ["issue 1", "issue 2", ...],
  "recommendations": ["recommendation 1", ...],
  "conflict_resolutions": [
    { "conflict": "TAG_A ↔ TAG_B", "resolution": "how to resolve" }
  ]
}`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content ?? "{}") as ComplianceDecision;
}
