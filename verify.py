"""
LegalIQ — Post-ingestion verification queries.

Runs four Cypher queries and prints formatted results.

Usage:
    NEO4J_URI=bolt://localhost:7687 \
    NEO4J_USER=neo4j \
    NEO4J_PASSWORD=password \
    python3 verify.py
"""

import os

from neo4j_http import get_session

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "password")

QUERIES = [
    (
        "1. Node counts by label",
        """
        MATCH (n)
        RETURN labels(n)[0] AS label, count(n) AS count
        ORDER BY label
        """,
        ["label", "count"],
    ),
    (
        "2. All ArgumentationTag nodes",
        """
        MATCH (t:ArgumentationTag)
        RETURN t.tag_name AS tag_name, t.tag_type AS tag_type
        ORDER BY t.tag_type, t.tag_name
        """,
        ["tag_name", "tag_type"],
    ),
    (
        "3. Articles tagged as FOUNDATIONAL_RULE",
        """
        MATCH (a:Article)-[:TAGGED_AS]->(t:ArgumentationTag {tag_name: 'FOUNDATIONAL_RULE'})
        RETURN a.article_id AS article_id, a.section AS section, a.what_it_covers AS what_it_covers
        ORDER BY a.article_id
        """,
        ["article_id", "section", "what_it_covers"],
    ),
    (
        "4. Conflict graph — all CONFLICTS_WITH relationships",
        """
        MATCH (t1:ArgumentationTag)-[:CONFLICTS_WITH]->(t2:ArgumentationTag)
        RETURN t1.tag_name AS tag, t2.tag_name AS conflicts_with
        ORDER BY t1.tag_name
        """,
        ["tag", "conflicts_with"],
    ),
]


def _col_width(rows: list[dict], key: str, header: str) -> int:
    """Compute column width as max of header length and all value lengths."""
    max_val = max((len(str(r.get(key, "") or "")) for r in rows), default=0)
    return max(len(header), max_val)


def print_table(title: str, rows: list[dict], columns: list[str]):
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}")

    if not rows:
        print("  (no results)")
        return

    widths = {c: _col_width(rows, c, c) for c in columns}
    header = "  " + "  ".join(c.ljust(widths[c]) for c in columns)
    sep = "  " + "  ".join("-" * widths[c] for c in columns)

    print(header)
    print(sep)
    for row in rows:
        line = "  " + "  ".join(
            str(row.get(c, "") or "").ljust(widths[c]) for c in columns
        )
        print(line)

    print(f"\n  ({len(rows)} row{'s' if len(rows) != 1 else ''})")


def main():
    print(f"Connecting to Neo4j at {NEO4J_URI} (HTTP Query API) ...")

    with get_session(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD) as session:
        for title, query, columns in QUERIES:
            rows = session.run(query)
            print_table(title, rows, columns)

    print(f"\n{'=' * 70}")
    print("  Verification complete.")
    print(f"{'=' * 70}\n")


if __name__ == "__main__":
    main()
