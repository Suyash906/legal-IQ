# LegalIQ Graph Schema

## Overview

LegalIQ models legal regulations as a property graph in Neo4j.  The three core
node types — **Regulation**, **Article**, and **ArgumentationTag** — are connected
by four relationship types that support multi-agent compliance reasoning over the
VRM/VIN use case.

---

## Node Labels

### Regulation

One node per distinct law name.

| Property     | Type   | Description                              | Example                              |
|--------------|--------|------------------------------------------|--------------------------------------|
| name         | String | Full law name (unique)                   | `"General Data Protection Regulation"` |
| jurisdiction | String | Geographic jurisdiction of the law       | `"EU"`, `"US (Federal)"`, `"California"` |

**Uniqueness constraint:** `name`

---

### Article

One node per article/section row in the spreadsheet (after merging continuation rows).

| Property            | Type   | Description                                        | Example                        |
|---------------------|--------|----------------------------------------------------|--------------------------------|
| article_id          | String | Stable unique key: `{LAW_ABBREV}_{section}`        | `"GDPR_Article_4(1)"`          |
| section             | String | Article or section identifier from the spreadsheet | `"Article 4(1)"`, `"§2721"`   |
| text                | String | Full legal text (continuation rows merged in)      | `"'personal data' means any..."` |
| what_it_covers      | String | Human-readable summary of what the article covers  | `"Definition of personal data"` |
| relevance_to_vrm_vin | String | How this article relates to VRM/VIN use cases     | `"VRM/VIN can identify individuals indirectly"` |
| sheet_source        | String | Source sheet name in the Excel file                | `"General rules"`, `"US law"` |

**Uniqueness constraint:** `article_id`

---

### ArgumentationTag

One node per unique tag value found in the "Game Theory / Argumentation Tags" column
(plus tags created only for conflict edges).

| Property  | Type   | Description                                        | Example                        |
|-----------|--------|----------------------------------------------------|--------------------------------|
| tag_name  | String | Tag identifier (unique, uppercase with underscores) | `"FOUNDATIONAL_RULE"`          |
| tag_type  | String | Semantic category (see table below)                | `"rule"`                       |

**Uniqueness constraint:** `tag_name`

#### Tag Types

| tag_type       | Description                                      | Example Tags |
|----------------|--------------------------------------------------|--------------|
| classification | Categorising or identifying data or risk         | PERSONAL_DATA_CLASSIFICATION, LINKABILITY_TEST |
| constraint     | Restrictions or limits on actions                | DATA_MINIMISATION_CONSTRAINT, RETENTION_LIMIT |
| right          | User or consumer rights                          | USER_RIGHT_OVERRIDE, DELETION_NODE |
| risk           | Liability and risk signals                       | CRIMINAL_LIABILITY, FINANCIAL_RISK |
| requirement    | Affirmative legal obligations                    | TRANSPARENCY_REQUIREMENT, SECURITY_BASELINE |
| rule           | Foundational rules, logic gates, process nodes   | FOUNDATIONAL_RULE, LAWFUL_BASIS_GATE |

---

## Relationship Types

### (Article)-[:BELONGS_TO]->(Regulation)

Links each article to its parent regulation.  Cardinality: many-to-one.

```cypher
MATCH (a:Article)-[:BELONGS_TO]->(r:Regulation)
RETURN a.article_id, r.name
```

---

### (Article)-[:TAGGED_AS]->(ArgumentationTag)

One directed edge per tag on each article.  Cardinality: many-to-many.

```cypher
MATCH (a:Article)-[:TAGGED_AS]->(t:ArgumentationTag)
RETURN a.article_id, collect(t.tag_name) AS tags
```

---

### (ArgumentationTag)-[:CONFLICTS_WITH]->(ArgumentationTag)

Represents known semantic conflicts between tag pairs.  Stored bidirectionally
(A→B and B→A) for undirected querying.  Seeded by `seed_conflict_edges.py`.

| Pair | Description |
|------|-------------|
| DATA_MINIMISATION_CONSTRAINT ↔ BUSINESS_CONTINUITY | GDPR minimisation principle conflicts with operational continuity needs |
| RETENTION_LIMIT ↔ INDEFINITE_STORAGE | Time-bound deletion obligations conflict with indefinite data retention |
| CRIMINAL_LIABILITY ↔ PROBABILITY_WEIGHTED_REASONING | Hard criminal thresholds conflict with probabilistic inference approaches |
| USER_RIGHT_OVERRIDE ↔ SERVICE_DEPENDENCY | User deletion rights conflict with service dependency on retained data |

---

### (Article)-[:CITED_BY]->(Article)

Placeholder for future inter-article citation relationships.  Currently empty.

---

## Law Abbreviations

| Full Name                              | Abbreviation | article_id Prefix |
|----------------------------------------|--------------|-------------------|
| General Data Protection Regulation     | GDPR         | `GDPR_`           |
| Driver's Privacy Protection Act        | DPPA         | `DPPA_`           |
| Federal Trade Commission Act           | FTC          | `FTC_`            |
| California Consumer Privacy Act        | CCPA         | `CCPA_`           |
| EU AI Act                              | EUAIA        | `EUAIA_`          |
| ePrivacy Directive                     | ePD          | `ePD_`            |

---

## Example Cypher Query Patterns

### Pattern 1 — Given a product scenario tag, which regulations apply?

> "My system uses probabilistic VIN inference.  Which regulations govern this?"

```cypher
// Find all regulations whose articles are tagged with a given scenario tag
MATCH (a:Article)-[:TAGGED_AS]->(t:ArgumentationTag {tag_name: $scenario_tag})
MATCH (a)-[:BELONGS_TO]->(r:Regulation)
RETURN DISTINCT r.name           AS regulation,
               r.jurisdiction    AS jurisdiction,
               collect(DISTINCT a.article_id) AS articles
ORDER BY r.jurisdiction, r.name
```

**Example:** `$scenario_tag = "PERSONAL_DATA_CLASSIFICATION"` returns GDPR, CCPA, etc.

---

### Pattern 2 — Which articles are in conflict with each other for the VIN use case?

> "Show me all pairs of articles whose tags are in conflict."

```cypher
// Find article pairs that carry conflicting tags
MATCH (a1:Article)-[:TAGGED_AS]->(t1:ArgumentationTag)
MATCH (a2:Article)-[:TAGGED_AS]->(t2:ArgumentationTag)
MATCH (t1)-[:CONFLICTS_WITH]->(t2)
WHERE a1.article_id < a2.article_id   // deduplicate symmetric pairs
RETURN a1.article_id          AS article_1,
       t1.tag_name            AS tag_1,
       t2.tag_name            AS tag_2,
       a2.article_id          AS article_2,
       a1.what_it_covers      AS covers_1,
       a2.what_it_covers      AS covers_2
ORDER BY t1.tag_name
```

---

### Pattern 3 — What conditions resolve a given conflict?

> "RETENTION_LIMIT conflicts with INDEFINITE_STORAGE.  Which articles impose or
> resolve this tension?"

```cypher
// Identify articles on each side of a specific conflict pair
MATCH (t1:ArgumentationTag {tag_name: $tag_a})-[:CONFLICTS_WITH]->(t2:ArgumentationTag {tag_name: $tag_b})

// Articles that trigger the conflict
MATCH (imposing:Article)-[:TAGGED_AS]->(t1)
MATCH (imposing)-[:BELONGS_TO]->(r1:Regulation)

// Articles that may resolve or balance it (e.g. tagged with BALANCING_TEST or CONDITIONAL_TRIGGER)
OPTIONAL MATCH (resolving:Article)-[:TAGGED_AS]->(:ArgumentationTag)
WHERE resolving.article_id IN [
    // articles tagged with resolution-related tags
    (MATCH (x:Article)-[:TAGGED_AS]->(:ArgumentationTag {tag_name: 'BALANCING_TEST'}) RETURN x.article_id)
  + (MATCH (x:Article)-[:TAGGED_AS]->(:ArgumentationTag {tag_name: 'CONDITIONAL_TRIGGER'}) RETURN x.article_id)
]

RETURN t1.tag_name            AS conflict_tag,
       t2.tag_name            AS opposing_tag,
       collect(DISTINCT imposing.article_id + " [" + r1.name + "]") AS imposing_articles,
       collect(DISTINCT resolving.article_id) AS potential_resolvers
```

**Simplified version for quick exploration:**

```cypher
// Articles imposing RETENTION_LIMIT
MATCH (a:Article)-[:TAGGED_AS]->(t:ArgumentationTag {tag_name: 'RETENTION_LIMIT'})
MATCH (a)-[:BELONGS_TO]->(r:Regulation)
RETURN a.article_id, a.section, a.what_it_covers, r.name AS law

UNION

// Articles with balancing/resolution logic
MATCH (a:Article)-[:TAGGED_AS]->(t:ArgumentationTag)
WHERE t.tag_name IN ['BALANCING_TEST', 'CONDITIONAL_TRIGGER', 'LAWFUL_BASIS_GATE']
MATCH (a)-[:BELONGS_TO]->(r:Regulation)
RETURN a.article_id, a.section, a.what_it_covers, r.name AS law
```

---

## Running the Pipeline

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set Neo4j connection (optional — defaults to localhost)
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=password

# 3. Ingest all articles, regulations, and tags
python3 ingest.py

# 4. Seed conflict edges (run after or before ingest — order-independent)
python3 seed_conflict_edges.py

# 5. Verify the graph
python3 verify.py

# 6. Explore in Neo4j Browser
#    http://localhost:7474
#    MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100
```

---

## Data Source

- **File:** `Legal_database_LegaliQ.xlsx`
- **Sheet "General rules":** EU GDPR + EU AI Act + ePrivacy Directive (~259 rows)
- **Sheet "US law":** DPPA, FTC Act, CCPA (6 rows)
- **Sheet "EU law":** Reserved for future EU law additions (currently empty)

Continuation rows (rows with no Jurisdiction/Law/Article value) are merged into
the preceding article's text during ingestion by `ingest.py`.
