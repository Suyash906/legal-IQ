# LegalIQ — Database Schema & Design Decisions

## Why a Graph Database?

Legal reasoning is fundamentally about **relationships between concepts**, not rows of data. Three reasons graph wins here:

1. **Conflict detection is a graph problem.** "Does DATA_MINIMISATION conflict with BUSINESS_CONTINUITY?" is a single edge traversal in Neo4j — in a relational DB it's a self-join on a junction table with recursive queries.

2. **Multi-hop reasoning.** "Find all articles from EU regulations that share a conflicting tag with this article" is a 3-hop path query. Graph databases are built for exactly this; SQL gets exponentially messier.

3. **Schema flexibility.** Legal data is heterogeneous — GDPR articles look nothing like CCPA provisions. A graph lets us MERGE nodes with different property sets without schema migrations.

---

## Node Types (3 labels)

| Node | Key Properties | What it represents |
|------|---------------|-------------------|
| `Regulation` | `name`, `jurisdiction` | A law — e.g., "General Data Protection Regulation", jurisdiction "EU" |
| `Article` | `article_id` (unique), `section`, `text`, `what_it_covers`, `sheet_source` | A specific legal article — e.g., `GDPR_Article_4(1)` |
| `ArgumentationTag` | `tag_name` (unique), `tag_type` | A semantic label — e.g., `DATA_MINIMISATION_CONSTRAINT` |

**Current counts:** 18 Articles · 6 Regulations · 40 ArgumentationTags

---

## Relationship Types (3 edges)

```
(Article) -[:BELONGS_TO]→  (Regulation)
(Article) -[:TAGGED_AS]→   (ArgumentationTag)
(Tag)     -[:CONFLICTS_WITH]→ (Tag)          ← bidirectional
```

---

## Tag Types (6 categories)

| Type | Example Tags |
|------|-------------|
| `classification` | `PERSONAL_DATA_CLASSIFICATION`, `LINKABILITY_TEST` |
| `constraint` | `DATA_MINIMISATION_CONSTRAINT`, `RETENTION_LIMIT` |
| `right` | `USER_RIGHT_OVERRIDE`, `DELETION_NODE` |
| `risk` | `CRIMINAL_LIABILITY`, `FINANCIAL_RISK` |
| `requirement` | `TRANSPARENCY_REQUIREMENT`, `SECURITY_BASELINE` |
| `rule` | `LAWFUL_BASIS_GATE`, `CONSENT_NODE` |

---

## The 4 Hardcoded Conflict Pairs

These represent the core legal tensions the system reasons over:

| Conflict | What it means |
|----------|--------------|
| `DATA_MINIMISATION_CONSTRAINT ↔ BUSINESS_CONTINUITY` | GDPR says collect only what you need; business says keep everything for continuity |
| `RETENTION_LIMIT ↔ INDEFINITE_STORAGE` | GDPR mandates deletion after purpose expires; operational systems want to keep data forever |
| `CRIMINAL_LIABILITY ↔ PROBABILITY_WEIGHTED_REASONING` | Criminal law requires certainty; AI systems reason probabilistically |
| `USER_RIGHT_OVERRIDE ↔ SERVICE_DEPENDENCY` | User can demand deletion; but deleting their data breaks the service |

---

## How It Powers the AI Reasoning

```
User question
    │
    ▼
GPT-4o extracts tags  →  ["DATA_MINIMISATION_CONSTRAINT", "RETENTION_LIMIT"]
    │
    ▼
Neo4j: getArticlesForTags()    →  relevant GDPR / CCPA articles
Neo4j: getConflictsForTags()   →  which tags conflict with each other
Neo4j: getRegulationsForTags() →  which jurisdictions apply
    │
    ▼
All of this becomes grounding context for the 5-agent GPT-4o debate
```

The graph ensures the AI agents argue over **real legal articles** — not hallucinated ones.

---

## One-liner for the Demo

> *"We model law as a knowledge graph — regulations own articles, articles carry semantic tags, and tags conflict with each other. The AI panel reasons over those conflicts, grounded in real legal text retrieved from Neo4j."*
