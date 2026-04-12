# LegalIQ — Claude Code Guide

## Project Overview

LegalIQ is a multi-agent compliance reasoning system. It queries a **Neo4j legal knowledge graph** to ground a **GPT-4o adversarial panel** of 5 agents that debate a legal question and produce structured outputs rendered in a **Next.js chat UI**.

## Repository Layout

```
legalIQ/
├── ingest.py               # Excel → Neo4j ingestion (run once per data update)
├── seed_conflict_edges.py  # Seeds CONFLICTS_WITH edges between argumentation tags
├── verify.py               # Post-ingestion verification queries
├── neo4j_http.py           # Custom HTTP client for Neo4j Query API v2
├── requirements.txt        # Python deps: neo4j, pandas, openpyxl
├── schema.md               # Neo4j graph schema reference
└── web/                    # Next.js 16 app (Turbopack)
    ├── app/
    │   ├── page.tsx              # Full chat UI (single-page, no routing)
    │   ├── layout.tsx            # Root layout — body is h-full overflow-hidden flex
    │   ├── globals.css           # All CSS (Tailwind + custom chat classes)
    │   └── api/
    │       └── reason/route.ts   # Main API: tag extraction → Neo4j → GPT-4o
    ├── components/               # Legacy components (kept but not used in chat UI)
    └── lib/
        ├── neo4j.ts              # Neo4j query helpers (getArticlesForTags, etc.)
        └── extract.ts            # Document text extraction (.docx, .txt, .md)
```

## Environment Variables

Both the Python scripts and the Next.js app read from `.env` files:

| Variable         | Used by          | Description                              |
|------------------|------------------|------------------------------------------|
| `NEO4J_URI`      | Python + Next.js | `neo4j+s://xxxx.databases.neo4j.io`      |
| `NEO4J_USER`     | Python + Next.js | `neo4j`                                  |
| `NEO4J_PASSWORD` | Python + Next.js | Aura instance password                   |
| `OPENAI_API_KEY` | Next.js only     | GPT-4o for tag extraction + session gen  |

- Python scripts: source from `legalIQ/.env`
- Next.js app: reads from `legalIQ/web/.env` (or `web/.env.local`)

## Running the Stack

### Ingest legal data (Python)
```bash
pip install -r requirements.txt
set -a && source .env && set +a
python3 ingest.py --xlsx /path/to/Legal_database_LegaliQ.xlsx
python3 seed_conflict_edges.py
python3 verify.py
```

### Web app
```bash
cd web
npm install
npm run dev     # http://localhost:3000
```

## Architecture: API Request Flow

```
POST /api/reason
  │
  ├─ 1. GPT-4o: extract argumentation tags from question
  ├─ 2. Neo4j: getArticlesForTags, getConflictsForTags, getRegulationsForTags
  ├─ 3. GPT-4o: generate full adversarial session JSON (one call, temp 0.3)
  └─ 4. Return JSON → chat UI renders progressively
```

The session JSON schema (returned by GPT-4o):
- `agents` — 5 agent briefs (status, submission, factualBasis, legalAuthority, confidence)
- `exchanges` — 4–6 adversarial exchanges between agents
- `agentExchangeMap` — per-agent objections and challenges
- `strategies` — exactly 3 strategies with scores and Nash equilibrium flag
- `decision` — panel ruling + 3 jurisdiction cards
- `nextSteps` — exactly 4 steps with `checklist[]` and `owners[]`

## Chat UI State Machine (`page.tsx`)

```
"greeting"  →  user picks scenario or types question
    │
"doc-upload" →  LQ asks for documents/links
    │
"analysing"  →  API call, results stream into chat bubble:
    │            exchanges animate → ruling → strategy → steps → arg map
    │
"follow-up"  →  QA with hardcoded pattern matching + GPT fallback
```

Key components inside `page.tsx` (all inline, not separate files):
- `DocUploadWidget` — file/link upload widget inside chat bubble
- `AnalysisBlock` — fetches API, animates exchanges, renders all result sections
- `ArgumentMapSVG` — SVG graph with clickable agent nodes
- `BriefPanelInline` — legal brief shown when agent node is clicked

## Neo4j Graph Schema

### Nodes
- `Regulation` — `name`, `jurisdiction`
- `Article` — `article_id` (unique), `section`, `text`, `what_it_covers`, `sheet_source`
- `ArgumentationTag` — `tag_name` (unique), `tag_type`

### Relationships
- `BELONGS_TO` — Article → Regulation
- `TAGGED_AS` — Article → ArgumentationTag
- `CONFLICTS_WITH` — Tag ↔ Tag (bidirectional, 4 hardcoded pairs)

### Tag types
`classification` · `constraint` · `right` · `risk` · `requirement` · `rule`

### Conflict pairs
- `DATA_MINIMISATION_CONSTRAINT ↔ BUSINESS_CONTINUITY`
- `RETENTION_LIMIT ↔ INDEFINITE_STORAGE`
- `CRIMINAL_LIABILITY ↔ PROBABILITY_WEIGHTED_REASONING`
- `USER_RIGHT_OVERRIDE ↔ SERVICE_DEPENDENCY`

## CSS Architecture

All styles live in `web/app/globals.css`. The file has two sections:
1. Tailwind import + base reset
2. Named CSS classes for the chat UI (`.msg`, `.msg-bubble`, `.ex-card`, `.verdict-box`, `.strat-box`, `.step-item`, `.graph-details`, etc.)

Do **not** add Tailwind utility classes for chat-specific elements — use the named classes defined in `globals.css` to keep the design consistent with the HTML spec.

## Key Conventions

- **MERGE everywhere** in Python scripts — all ingestion is idempotent
- **No Bolt driver** — `neo4j_http.py` talks to Neo4j Query API v2 over HTTPS (port 443), works through firewalls
- **Single GPT-4o call** for the full session — temperature 0.3, response_format json_object
- **`maxDuration = 120`** on the API route — GPT-4o + Neo4j can take 30–60s
- **Chat UI is stateful React** — no URL routing, no server components in `page.tsx`
- The `web/components/` directory contains legacy components from the previous form-based UI — they are not imported by the current `page.tsx`

## Common Tasks

### Add a new legal Excel file
```bash
set -a && source .env && set +a
python3 ingest.py --xlsx /path/to/new_file.xlsx
```

### Add a new conflict pair
Edit `seed_conflict_edges.py` and add to the `CONFLICT_PAIRS` list, then re-run it.

### Update the GPT-4o system prompt
Edit `buildSystemPrompt()` in `web/app/api/reason/route.ts`. The JSON schema in the prompt must stay in sync with how `AnalysisBlock` in `page.tsx` consumes the response.

### Change agent personas
Edit the `A1`–`A5` descriptions in both `buildSystemPrompt()` (`route.ts`) and `AGENT_META` (`page.tsx`).
