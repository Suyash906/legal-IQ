"""
LegalIQ — Seed CONFLICTS_WITH edges between ArgumentationTag nodes.

This script is standalone and idempotent.  It can be run before or after
ingest.py.  Tags that do not yet exist in the graph are MERGE-created here
(e.g., BUSINESS_CONTINUITY, INDEFINITE_STORAGE which are not in the Excel).

Usage:
    NEO4J_URI=bolt://localhost:7687 \
    NEO4J_USER=neo4j \
    NEO4J_PASSWORD=password \
    python3 seed_conflict_edges.py
"""

import os

from neo4j_http import get_session

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "password")

# Each tuple is (tag_a, tag_b).  Both directions are created so that
# undirected Cypher queries work without specifying arrow direction.
CONFLICT_PAIRS = [
    ("DATA_MINIMISATION_CONSTRAINT", "BUSINESS_CONTINUITY"),
    ("RETENTION_LIMIT", "INDEFINITE_STORAGE"),
    ("CRIMINAL_LIABILITY", "PROBABILITY_WEIGHTED_REASONING"),
    ("USER_RIGHT_OVERRIDE", "SERVICE_DEPENDENCY"),
]

# Tags that appear only in conflict pairs (not sourced from the Excel file).
# We assign them tag_type="rule" as a sensible default.
CONFLICT_ONLY_TAGS = {
    "BUSINESS_CONTINUITY",
    "INDEFINITE_STORAGE",
    "PROBABILITY_WEIGHTED_REASONING",
    "SERVICE_DEPENDENCY",
}

MERGE_TAG = """
MERGE (t:ArgumentationTag {tag_name: $tag_name})
ON CREATE SET t.tag_type = $tag_type
RETURN t.tag_name AS name, (t.tag_type IS NOT NULL) AS existed
"""

MERGE_CONFLICT = """
MATCH (a:ArgumentationTag {tag_name: $tag_a})
MATCH (b:ArgumentationTag {tag_name: $tag_b})
MERGE (a)-[:CONFLICTS_WITH]->(b)
MERGE (b)-[:CONFLICTS_WITH]->(a)
"""


def seed(session):
    edges_total = 0

    for tag_a, tag_b in CONFLICT_PAIRS:
        # Ensure both nodes exist
        for tag in (tag_a, tag_b):
            tag_type = "rule" if tag in CONFLICT_ONLY_TAGS else "rule"
            records = session.run(MERGE_TAG, tag_name=tag, tag_type=tag_type)
            record = records[0] if records else {}
            status = "already existed" if record.get("existed") else "created/merged"
            print(f"  Tag [{tag}] — {status}")

        # Create bidirectional conflict edges
        session.run(MERGE_CONFLICT, tag_a=tag_a, tag_b=tag_b)
        print(f"  CONFLICTS_WITH: {tag_a} <-> {tag_b}")
        edges_total += 2

    return edges_total


def main():
    print(f"Connecting to Neo4j at {NEO4J_URI} (HTTP Query API) ...")

    with get_session(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD) as session:
        print(f"\nSeeding {len(CONFLICT_PAIRS)} conflict pairs "
              f"({len(CONFLICT_PAIRS) * 2} directed edges):\n")
        total = seed(session)

    print(f"\nDone. {total} CONFLICTS_WITH edges merged.")


if __name__ == "__main__":
    main()
