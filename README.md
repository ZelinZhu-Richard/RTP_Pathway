# RTP Pathway

**A Claude-powered opportunity navigator for high-school students in the Research Triangle
(Chapel Hill · Carrboro · Durham · Raleigh, NC).**

RTP Pathway is a community data system: it collects opportunity listings from nonprofit
spreadsheets, web forms, and pasted program descriptions; cleans, deduplicates, and verifies
them with a Python/pandas pipeline and a human review queue; publishes them through a
searchable website; and answers students' plain-English questions **grounded only in the
verified database** — with sources and last-verified dates on every listing.

## What's inside

| Piece | Where | What it does |
|---|---|---|
| Public site | `src/app` | Directory with structured filters, natural-language search, detail pages, save/compare, checklists, calendar export, report-a-problem |
| Data pipeline | `pipeline/` | pandas scripts that clean messy CSVs (headers, dates, categories), detect duplicates, flag incomplete rows, and load the database |
| Seed dataset | `data/seed_opportunities_raw.csv` | ~44 realistic Triangle-area opportunities, intentionally messy to exercise the pipeline |
| Claude integration | `src/lib/claude/` | Query parsing, grounded result explanations, per-listing Q&A, structured extraction — each with a deterministic fallback |
| Admin area | `/admin` | Review queue, duplicate warnings, user reports, listing verification, audit log, analytics dashboard |
| Shared taxonomy | `shared/taxonomy.json` | One fixed category/city/enum vocabulary consumed by TypeScript **and** Python |

## Quick start

Requirements: Node 20+, Python 3.10+.

```bash
npm install
pip install -r pipeline/requirements.txt

cp .env.example .env.local        # set ADMIN_PASSWORD (and optionally ANTHROPIC_API_KEY)

npm run setup                     # migrate DB + clean & import the seed CSV
npm run dev                       # http://localhost:3000
```

`npm run setup` runs the full data workflow: Drizzle migrations create the SQLite schema,
`pipeline/clean_csv.py` normalizes the raw spreadsheet (writing `data/quality_report.md`),
and `pipeline/import_db.py` loads clean rows as listings and routes duplicates/incomplete
rows into the admin review queue.

### Environment variables (`.env.local`)

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | for `/admin` | Password for the admin review area |
| `ANTHROPIC_API_KEY` | no | Enables Claude features. **Without it the whole site still works** — search falls back to rule-based parsing, Q&A to field lookups |
| `CLAUDE_MODEL` | no | Defaults to `claude-opus-4-8`; set `claude-haiku-4-5` for lower cost |
| `DATABASE_PATH` | no | SQLite file location (default `data/rtp.db`) |

If your network requires an HTTP(S) proxy, note that Node's `fetch` ignores `HTTPS_PROXY`;
the Anthropic client in `src/lib/claude/client.ts` already routes through undici's
`EnvHttpProxyAgent`, and you may need `NODE_EXTRA_CA_CERTS` pointing at your CA bundle.

## The data pipeline

```bash
# 1. Clean a raw spreadsheet (any column-name variants, mixed date formats, etc.)
python3 pipeline/clean_csv.py data/seed_opportunities_raw.csv \
    -o data/seed_opportunities_clean.csv --report data/quality_report.md

# 2. Import: clean rows -> published listings; flagged rows -> review queue
python3 pipeline/import_db.py data/seed_opportunities_clean.csv --db data/rtp.db
```

The cleaner: renames inconsistent headers via an alias map · blanks out `N/A`/`TBD`
tokens · parses five date formats to ISO · normalizes categories/cities/formats against
`shared/taxonomy.json` (synonyms + fuzzy match) · parses grade/age eligibility ("rising
juniors", "ages 14–18") · tags interests · detects duplicates (same URL, or same org +
title similarity ≥ 0.85) · flags incomplete rows · writes a markdown quality report.

Imports are idempotent (re-runs skip existing rows); `--reset` wipes and reloads.
Python never defines the schema — it preflights `sqlite_master` and tells you to run
`npm run db:migrate` if tables are missing. IDs are UUIDs and dates ISO strings in both
languages, so rows written by Python are indistinguishable from app-written rows.

## How the AI search stays grounded

```
Student question → Claude extracts filters (JSON, validated against the taxonomy)
                 → SQL query over verified listings only
                 → Claude explains the returned records (ids checked in code —
                   anything it didn't receive is dropped)
```

Claude never selects or invents opportunities. Per-listing Q&A answers only from the
listing's stored fields and says *"the listing does not say"* when information is missing.
Untrusted text (questions, submissions, listing content) is wrapped in data tags with
explicit not-instructions framing. Every AI response carries a `usedClaude` flag, and the
UI labels fallback mode.

## Verification & freshness

- Every listing shows a **Last verified** date; older than 180 days → "Needs verification".
- Listings past their application deadline are **hidden automatically** (admins still see them).
- Students can report outdated/incorrect info → admin queue → resolve with an audit trail.
- Approving a submission stamps a fresh verification date; "Mark verified today" renews it.

## Admin area (`/admin`)

Review queue (with Claude-extracted fields, missing-info flags, duplicate warnings) ·
approve/edit/reject · user reports · listing verification/archival · audit log · analytics:
opportunities by category and city, top student searches, **searches with zero results**
(unmet community demand), and listing freshness — with a sample-size caveat when volume is low.
Search analytics are anonymous by construction: no IPs, sessions, or user identifiers are stored.

## Tests / verification

```bash
npm run build        # production build
npm run lint
npx tsc --noEmit
npm run pipeline:seed  # re-run the data workflow; check data/quality_report.md
```

## Deploying beyond SQLite

The schema is plain Drizzle + snake_case SQL. To move to Postgres/Supabase: switch the
Drizzle dialect and driver in `src/db/`, re-generate migrations, and point the Python
scripts at Postgres via `psycopg`. All IDs/dates/JSON columns were chosen to port 1:1.

## A note on the seed data

The organizations in the seed CSV are real Triangle institutions, but program details,
dates, and URLs are **illustrative and unverified** — that's why every seeded listing
shows its verification status prominently. Verify each listing against the organization
before treating it as real guidance.
