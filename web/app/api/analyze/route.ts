import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/extract";
import { extractTagsFromDocs, generateDecision } from "@/lib/openai";
import {
  getAllTags,
  getArticlesForTags,
  getConflictsForTags,
  getRegulationsForTags,
} from "@/lib/neo4j";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    // ── Step 1: Extract text from all uploaded documents ──────────────────
    const docTexts = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        text: await extractText(file),
      }))
    );

    // ── Step 2: Load available tags from Neo4j ────────────────────────────
    const availableTags = await getAllTags();

    // ── Step 3: OpenAI → identify which tags apply ────────────────────────
    const { tags, reasoning } = await extractTagsFromDocs(docTexts, availableTags);

    if (!tags.length) {
      return NextResponse.json(
        { error: "No compliance tags could be identified from the uploaded documents." },
        { status: 422 }
      );
    }

    // ── Step 4: Neo4j → fetch articles, conflicts, regulations ───────────
    const [articles, conflicts, regulations] = await Promise.all([
      getArticlesForTags(tags),
      getConflictsForTags(tags),
      getRegulationsForTags(tags),
    ]);

    // ── Step 5: OpenAI → generate compliance decision ─────────────────────
    const decision = await generateDecision({
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

    return NextResponse.json({
      files: files.map((f) => f.name),
      tags,
      tag_reasoning: reasoning,
      regulations,
      articles,
      conflicts,
      decision,
    });
  } catch (err) {
    console.error("[/api/analyze]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
