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
| Data pipeline | `pipeline/` | pandas scripts that normalize and merge partner CSVs with source-row provenance, detect duplicates, report quality, and load SQLite |
| Sheets workflow | `src/lib/googleSheets.ts` | Idempotent, server-to-server mirror of web submissions and review outcomes to a private staff Google Sheet |
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
| `GOOGLE_SHEETS_SYNC_ENABLED` | no | Set `true` only after the Sheet and service account are configured |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | with Sheets | ID between `/d/` and `/edit` in the spreadsheet URL |
| `GOOGLE_SHEETS_TAB` | with Sheets | Private worksheet tab name (for example, `Submissions`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | with Sheets | Service-account email that the private spreadsheet is shared with |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | with Sheets | JSON credential `private_key`, stored server-side with literal `\n` line breaks |

If your network requires an HTTP(S) proxy, note that Node's `fetch` ignores `HTTPS_PROXY`;
the Anthropic client in `src/lib/claude/client.ts` already routes through undici's
`EnvHttpProxyAgent`, and you may need `NODE_EXTRA_CA_CERTS` pointing at your CA bundle.

## The data pipeline

```bash
# 1. Normalize each source independently, merge, deduplicate, and analyze.
# One input remains valid; add as many partner CSVs as needed.
python3 pipeline/clean_csv.py data/partner-a.csv data/partner-b.csv \
    -o data/opportunities_clean.csv --report data/quality_report.md

# 2. Import: clean rows -> published listings; flagged rows -> review queue
python3 pipeline/import_db.py data/opportunities_clean.csv --db data/rtp.db
```

The cleaner: renames inconsistent headers via an alias map · blanks out `N/A`/`TBD`
tokens · parses five date formats to ISO · normalizes categories/cities/formats against
`shared/taxonomy.json` (synonyms + fuzzy match) · parses grade/age eligibility ("rising
juniors", "ages 14–18") · tags interests · detects duplicates (same URL, or same org +
title similarity ≥ 0.85) · keeps the most complete candidate · routes other likely duplicates
and incomplete rows to review · writes a reconciled markdown quality report. The merged CSV
retains `source_file` and original spreadsheet `source_row`; the report includes per-source
readiness, rejected dates/links, taxonomy mismatches, duplicate groups, completeness, and
category/city distributions.

Imports are idempotent (re-runs skip existing rows); `--reset` wipes and reloads.
Python never defines the schema — it preflights `sqlite_master` and tells you to run
`npm run db:migrate` if tables are missing. IDs are UUIDs and dates ISO strings in both
languages, so rows written by Python are indistinguishable from app-written rows.
Every completed import also writes an audit event with source filenames and input, inserted,
queued, and skipped row counts; the latest outcome appears on the analytics dashboard.

## Private Google Sheets mirror

SQLite remains authoritative. A web submission commits locally first and then makes one
five-second, best-effort Sheets sync. A Google outage never rejects or loses the local
submission. Column A is the stable `submission_id`; retries update that row or append one new
row with `RAW` input, so formulas are not interpreted and retries do not create duplicates.
Approval and rejection update the same Sheet row, while Sheet edits never flow back to SQLite.

To enable the mirror:

1. Create a private spreadsheet and worksheet tab, follow Google's
   [service-account setup guidance](https://developers.google.com/identity/protocols/oauth2/service-account),
   and share the spreadsheet with its service-account email. The integration uses the
   [Sheets Values API](https://developers.google.com/workspace/sheets/api/guides/values).
2. Copy the five `GOOGLE_*` values from `.env.example` into `.env.local`, then set
   `GOOGLE_SHEETS_SYNC_ENABLED=true`.
3. Validate the credentials and initialize the fixed version-1 header:

```bash
npm run sheets:setup
```

Admins can retry one row from its review page. For a local demo, retry every pending/failed
web-form row sequentially with:

```bash
npm run sheets:retry
```

## How the AI search stays grounded

```
Student question → Claude extracts filters (JSON, validated against the taxonomy)
                 → SQL query over verified listings only
                 → Claude suggests which returned records to highlight
                 → code allow-lists ids and rebuilds every displayed reason from SQLite fields
```

Claude never selects or invents opportunities. Per-listing Q&A answers only from the
listing's stored fields and says *"the listing does not say"* when information is missing.
Untrusted text (questions, submissions, listing content) is wrapped in data tags with
explicit not-instructions framing. Every AI response carries a `usedClaude` flag, and the
UI labels Claude-grounded or deterministic fallback mode. The no-key fallback still searches
the same SQLite records.

## Verification & freshness

- Every listing shows a **Last verified** date; older than 180 days → "Needs verification".
- Listings past their application deadline are **hidden automatically** (admins still see them).
- Students can report outdated/incorrect info → admin queue → resolve with an audit trail.
- Approving a submission stamps a fresh verification date; "Mark verified today" renews it.

## Admin area (`/admin`)

Review queue (with Claude-extracted fields, missing-info flags, duplicate warnings) ·
approve/edit/reject · user reports · listing verification/archival · audit log · analytics:
active supply by category and city, categorized search demand, **searches with zero results**,
30-day demand per active listing, listing freshness, failed Sheet syncs, and the latest Python
import. Every chart has a tabular equivalent. Category coverage is shown separately so keyword-
only demand is not presented as categorized demand, and results below 50 searches are labeled
directional rather than conclusive.

Directory drafts stay local until Search is selected. Applied filters, page, page size, and sort
are URL-backed and shareable; `GET /api/opportunities` has no analytics side effects. Completed
search events store canonical dimensions and a generic query class—never raw free text, IPs,
cookies, sessions, or user identifiers.

## End-to-end demo

1. Merge partner CSVs with `clean_csv.py`, inspect the quality report, and import to SQLite.
2. Submit an organization listing at `/submit`; optional Claude extraction fills only blank
   fields and asks before replacing an existing entry.
3. Confirm the local review row and its Sheet sync state in `/admin`, then approve it.
4. Find the published record through URL-backed filters or grounded natural-language search.
5. Run an explicit categorized search and inspect the updated supply-demand table in
   `/admin/analytics`.

## Tests / verification

```bash
npm test             # TypeScript + Python fixtures
npm run lint
npx tsc --noEmit
npm run build        # production build
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
