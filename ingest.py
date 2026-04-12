"""
LegalIQ — Neo4j Graph Ingestion Pipeline
Reads the Legal_database_LegaliQ.xlsx file and ingests all nodes and relationships
into Neo4j. Fully idempotent: uses MERGE throughout so safe to re-run.

Uses the Neo4j HTTP Query API v2 (port 443) instead of the Bolt driver so it
works even when port 7687 is firewalled (e.g. corporate networks, Neo4j Aura).

Usage:
    NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io \
    NEO4J_USER=neo4j \
    NEO4J_PASSWORD=<password> \
    python3 ingest.py [--xlsx PATH]
"""

import os
import sys
import argparse
import pandas as pd
from neo4j_http import get_session

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_XLSX = os.path.expanduser("~/Downloads/Legal_database_LegaliQ.xlsx")

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "password")

# Map full law names (after stripping whitespace) to short abbreviations
# used when building article_id values.
LAW_ABBREV = {
    "General Data Protection Regulation": "GDPR",
    "Driver's Privacy Protection Act": "DPPA",
    "Federal Trade Commission Act": "FTC",
    "California Consumer Privacy Act": "CCPA",
    "EU AI Act": "EUAIA",
    "ePrivacy Directive": "ePD",
}

# Classify every known tag into one of six semantic types.
TAG_TYPE_MAP = {
    # classification — categorising/identifying data or risk
    "PERSONAL_DATA_CLASSIFICATION": "classification",
    "LINKABILITY_TEST": "classification",
    "AI_RISK_CLASSIFICATION": "classification",
    "DATA_SOURCE_DEPENDENCY": "classification",
    # constraint — things that limit or restrict actions
    "DATA_MINIMISATION_CONSTRAINT": "constraint",
    "RETENTION_LIMIT": "constraint",
    "FAIRNESS_CONSTRAINT": "constraint",
    "SYSTEM_DESIGN_CONSTRAINT": "constraint",
    "DEVICE_STORAGE_RULE": "constraint",
    "SALES_RESTRICTION": "constraint",
    # right — user/consumer rights
    "USER_RIGHT_OVERRIDE": "right",
    "CONSUMER_RIGHTS_NODE": "right",
    "DELETION_NODE": "right",
    "OPT_OUT_REQUIREMENT": "right",
    "DELETION_REQUIREMENT": "right",
    # risk — liability and risk tags
    "CRIMINAL_LIABILITY": "risk",
    "FINANCIAL_RISK": "risk",
    "HIGH_RISK_RULE": "risk",
    "BREACH_LIABILITY": "risk",
    # requirement — affirmative obligations
    "DPA_REQUIREMENT": "requirement",
    "NOTICE_OBLIGATION": "requirement",
    "DISCLOSURE_REQUIREMENT": "requirement",
    "TRANSPARENCY_REQUIREMENT": "requirement",
    "SECURITY_BASELINE": "requirement",
    "RISK_MANAGEMENT_OBLIGATION": "requirement",
    "COMPLIANCE_BASELINE": "requirement",
    "ENFORCEMENT_BACKSTOP": "requirement",
    # rule — foundational rules, logic gates, and process nodes
    "FOUNDATIONAL_RULE": "rule",
    "LAWFUL_BASIS_GATE": "rule",
    "CONSENT_NODE": "rule",
    "CONSENT_TRIGGER": "rule",
    "CONDITIONAL_TRIGGER": "rule",
    "BALANCING_TEST": "rule",
    "THIRD_PARTY_DEPENDENCY": "rule",
    "SYSTEM_MONITORING": "rule",
    "HARD_DELETE": "rule",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _val(v):
    """Return None for NaN/blank, otherwise return stripped string."""
    if pd.isna(v):
        return None
    s = str(v).strip()
    return s if s else None


def _law_abbrev(law_name: str) -> str:
    """Return abbreviation for law name, falling back to a sanitised version."""
    clean = law_name.strip()
    if clean in LAW_ABBREV:
        return LAW_ABBREV[clean]
    # Fallback: uppercase initials
    return "".join(w[0] for w in clean.split() if w).upper()


def _tag_type(tag: str) -> str:
    return TAG_TYPE_MAP.get(tag.strip(), "rule")


def parse_tags(raw) -> list[str]:
    """Split a comma-separated tags string into a clean list."""
    if pd.isna(raw) or not str(raw).strip():
        return []
    return [t.strip() for t in str(raw).split(",") if t.strip()]


# ---------------------------------------------------------------------------
# Row → article-record merging
# ---------------------------------------------------------------------------

def merge_continuation_rows(df: pd.DataFrame, sheet_name: str) -> list[dict]:
    """
    Iterate the DataFrame row-by-row.  A row is an 'anchor' row if it has a
    non-null Jurisdiction value; otherwise it is a continuation row whose Text
    is appended to the previous anchor's text buffer.

    Returns a list of dicts, one per article group.
    """
    col = {c: c for c in df.columns}  # identity map for safety

    # Normalise column names to canonical keys
    rename = {}
    for c in df.columns:
        lc = c.lower().strip()
        if "jurisdiction" in lc:
            rename[c] = "jurisdiction"
        elif "law" in lc:
            rename[c] = "law"
        elif "article" in lc or "section" in lc:
            rename[c] = "section"
        elif lc == "text":
            rename[c] = "text"
        elif "covers" in lc:
            rename[c] = "what_it_covers"
        elif "relevance" in lc or "vrm" in lc or "vin" in lc:
            rename[c] = "relevance_to_vrm_vin"
        elif "tag" in lc or "game" in lc or "argumentation" in lc:
            rename[c] = "tags"

    df = df.rename(columns=rename)

    articles = []
    current = None

    for _, row in df.iterrows():
        jurisdiction = _val(row.get("jurisdiction"))

        if jurisdiction is not None:
            # Anchor row — flush previous article and start a new one
            if current is not None:
                articles.append(current)

            law = _val(row.get("law")) or ""
            section = _val(row.get("section")) or "unknown"
            abbrev = _law_abbrev(law)

            current = {
                "jurisdiction": jurisdiction,
                "law": law.strip(),
                "section": section,
                "article_id": f"{abbrev}_{section}",
                "text": _val(row.get("text")) or "",
                "what_it_covers": _val(row.get("what_it_covers")) or "",
                "relevance_to_vrm_vin": _val(row.get("relevance_to_vrm_vin")) or "",
                "tags": parse_tags(row.get("tags")),
                "sheet_source": sheet_name,
            }
        else:
            # Continuation row — append text to the open article
            if current is None:
                # Orphaned continuation at top of sheet — skip
                continue
            extra_text = _val(row.get("text"))
            if extra_text:
                current["text"] = (current["text"] + " " + extra_text).strip()

    # Flush last article
    if current is not None:
        articles.append(current)

    return articles


# ---------------------------------------------------------------------------
# Neo4j operations
# ---------------------------------------------------------------------------

CONSTRAINT_QUERIES = [
    "CREATE CONSTRAINT IF NOT EXISTS FOR (r:Regulation) REQUIRE r.name IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Article) REQUIRE a.article_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (t:ArgumentationTag) REQUIRE t.tag_name IS UNIQUE",
]

MERGE_REGULATION = """
MERGE (r:Regulation {name: $name})
SET r.jurisdiction = $jurisdiction
RETURN r
"""

MERGE_ARTICLE = """
MERGE (a:Article {article_id: $article_id})
SET a.section            = $section,
    a.text               = $text,
    a.what_it_covers     = $what_it_covers,
    a.relevance_to_vrm_vin = $relevance_to_vrm_vin,
    a.sheet_source       = $sheet_source
RETURN a
"""

MERGE_BELONGS_TO = """
MATCH (a:Article {article_id: $article_id})
MATCH (r:Regulation {name: $law})
MERGE (a)-[:BELONGS_TO]->(r)
"""

MERGE_TAG = """
MERGE (t:ArgumentationTag {tag_name: $tag_name})
SET t.tag_type = $tag_type
RETURN t
"""

MERGE_TAGGED_AS = """
MATCH (a:Article {article_id: $article_id})
MATCH (t:ArgumentationTag {tag_name: $tag_name})
MERGE (a)-[:TAGGED_AS]->(t)
"""

COUNT_QUERY = """
MATCH (n)
RETURN labels(n)[0] AS label, count(n) AS count
ORDER BY label
"""

COUNT_RELS_QUERY = """
MATCH ()-[r]->()
RETURN type(r) AS rel_type, count(r) AS count
ORDER BY rel_type
"""


def setup_constraints(session):
    for q in CONSTRAINT_QUERIES:
        session.run(q)
    print("Constraints created / verified.")


def ingest_article(session, article: dict):
    # 1. Regulation node
    session.run(
        MERGE_REGULATION,
        name=article["law"],
        jurisdiction=article["jurisdiction"],
    )

    # 2. Article node
    session.run(
        MERGE_ARTICLE,
        article_id=article["article_id"],
        section=article["section"],
        text=article["text"],
        what_it_covers=article["what_it_covers"],
        relevance_to_vrm_vin=article["relevance_to_vrm_vin"],
        sheet_source=article["sheet_source"],
    )

    # 3. BELONGS_TO
    session.run(
        MERGE_BELONGS_TO,
        article_id=article["article_id"],
        law=article["law"],
    )

    # 4. Tags + TAGGED_AS
    for tag in article["tags"]:
        session.run(
            MERGE_TAG,
            tag_name=tag,
            tag_type=_tag_type(tag),
        )
        session.run(
            MERGE_TAGGED_AS,
            article_id=article["article_id"],
            tag_name=tag,
        )


def print_summary(session):
    print("\n--- Node counts ---")
    result = session.run(COUNT_QUERY)
    for record in result:
        print(f"  {record['label']}: {record['count']}")

    print("\n--- Relationship counts ---")
    result = session.run(COUNT_RELS_QUERY)
    for record in result:
        print(f"  {record['rel_type']}: {record['count']}")


# ---------------------------------------------------------------------------
# Sheet reader — auto-detects header row
# ---------------------------------------------------------------------------

def _read_sheet(xl: pd.ExcelFile, sheet_name: str) -> pd.DataFrame | None:
    """
    Read a sheet and return a DataFrame with proper column names.

    Some sheets (e.g. "General rules") have a blank/merged row above the real
    header, so pandas reads them as Unnamed: 0, Unnamed: 1, ...  We detect
    this and re-read with header=1 to skip the decorative first row.
    """
    df = pd.read_excel(xl, sheet_name=sheet_name)
    if df.empty:
        return None

    # If every column is "Unnamed: N" the real header is one row down
    all_unnamed = all(str(c).startswith("Unnamed:") for c in df.columns)
    if all_unnamed:
        df = pd.read_excel(xl, sheet_name=sheet_name, header=1)

    if df.empty:
        return None
    return df


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="LegalIQ Neo4j ingestion pipeline")
    parser.add_argument(
        "--xlsx",
        default=DEFAULT_XLSX,
        help=f"Path to Excel file (default: {DEFAULT_XLSX})",
    )
    args = parser.parse_args()

    if not os.path.exists(args.xlsx):
        print(f"ERROR: Excel file not found: {args.xlsx}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading Excel: {args.xlsx}")
    xl = pd.ExcelFile(args.xlsx)
    print(f"Sheets found: {xl.sheet_names}")

    all_articles: list[dict] = []

    for sheet_name in xl.sheet_names:
        df = _read_sheet(xl, sheet_name)
        if df is None or df.empty:
            print(f"  [{sheet_name}] — empty, skipping")
            continue
        articles = merge_continuation_rows(df, sheet_name)
        print(f"  [{sheet_name}] — {len(df)} raw rows → {len(articles)} articles")
        all_articles.extend(articles)

    print(f"\nTotal articles to ingest: {len(all_articles)}")

    print(f"Connecting to Neo4j at {NEO4J_URI} (HTTP Query API) ...")

    with get_session(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD) as session:
        setup_constraints(session)

        print("\nIngesting articles...")
        for i, article in enumerate(all_articles, 1):
            ingest_article(session, article)
            if i % 10 == 0 or i == len(all_articles):
                print(f"  {i}/{len(all_articles)} articles processed")

        print("\nIngestion complete.")
        print_summary(session)


if __name__ == "__main__":
    main()
