/**
 * Neo4j HTTP Query API v2 client (TypeScript).
 * Uses port 443 / HTTPS — works when port 7687 (Bolt) is firewalled.
 */

const NEO4J_HOST = (process.env.NEO4J_URI ?? "")
  .replace("neo4j+s://", "")
  .replace("bolt+s://", "")
  .replace("https://", "")
  .replace(/\/$/, "");

const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? "";

const API_URL = `https://${NEO4J_HOST}/db/neo4j/query/v2`;

function authHeader(): string {
  return "Basic " + Buffer.from(`${NEO4J_USER}:${NEO4J_PASSWORD}`).toString("base64");
}

type Row = Record<string, unknown>;

export async function runQuery(statement: string, parameters: Record<string, unknown> = {}): Promise<Row[]> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({ statement, parameters }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Neo4j HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const body = await res.json();
  const fields: string[] = body.data?.fields ?? [];
  const values: unknown[][] = body.data?.values ?? [];
  return values.map((row) => Object.fromEntries(fields.map((f, i) => [f, row[i]])));
}

// ── Compliance queries ────────────────────────────────────────────────────────

/** Return all articles + their regulation for a set of tags. */
export async function getArticlesForTags(tags: string[]): Promise<Row[]> {
  return runQuery(
    `
    MATCH (a:Article)-[:TAGGED_AS]->(t:ArgumentationTag)
    WHERE t.tag_name IN $tags
    MATCH (a)-[:BELONGS_TO]->(r:Regulation)
    RETURN DISTINCT
      a.article_id        AS article_id,
      a.section           AS section,
      a.what_it_covers    AS what_it_covers,
      a.relevance_to_vrm_vin AS relevance,
      r.name              AS regulation,
      r.jurisdiction      AS jurisdiction,
      collect(DISTINCT t.tag_name) AS matched_tags
    ORDER BY r.jurisdiction, r.name, a.section
    `,
    { tags }
  );
}

/** Return all CONFLICTS_WITH pairs among the supplied tags. */
export async function getConflictsForTags(tags: string[]): Promise<Row[]> {
  return runQuery(
    `
    MATCH (t1:ArgumentationTag)-[:CONFLICTS_WITH]->(t2:ArgumentationTag)
    WHERE t1.tag_name IN $tags AND t2.tag_name IN $tags
    RETURN DISTINCT t1.tag_name AS tag_a, t2.tag_name AS tag_b
    ORDER BY t1.tag_name
    `,
    { tags }
  );
}

/** Return distinct regulations that cover a set of tags. */
export async function getRegulationsForTags(tags: string[]): Promise<Row[]> {
  return runQuery(
    `
    MATCH (a:Article)-[:TAGGED_AS]->(t:ArgumentationTag)
    WHERE t.tag_name IN $tags
    MATCH (a)-[:BELONGS_TO]->(r:Regulation)
    RETURN DISTINCT r.name AS regulation, r.jurisdiction AS jurisdiction,
           count(DISTINCT a) AS article_count
    ORDER BY r.jurisdiction
    `,
    { tags }
  );
}

/** Return all tags in the graph (used for the OpenAI prompt). */
export async function getAllTags(): Promise<string[]> {
  const rows = await runQuery(
    `MATCH (t:ArgumentationTag) RETURN t.tag_name AS tag ORDER BY t.tag_name`
  );
  return rows.map((r) => r.tag as string);
}
