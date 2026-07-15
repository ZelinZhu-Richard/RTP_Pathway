# Data pipeline

pandas scripts that turn messy community spreadsheets into reviewed database rows.
See the root README ("The data pipeline") for the full walkthrough.

- `common.py` — shared taxonomy loading, `slugify()` (kept in sync with `src/lib/slug.ts`),
  org-name/URL normalizers, and the SQLite connection with the same PRAGMAs the app uses.
- `clean_csv.py` — reusable single/multi-source cleaning, per-file header aliasing,
  provenance, NA cleanup, date standardization, taxonomy normalization, grade/age parsing,
  cross-file duplicate detection, completeness flags, and a reconciled quality report.
- `import_db.py` — loads clean rows as approved listings and flagged rows as pending
  review-queue submissions. Idempotent; `--reset` reloads from scratch. Never owns the
  schema (run `npm run db:migrate` first).

```bash
pip install -r requirements.txt
python3 clean_csv.py ../data/partner-a.csv ../data/partner-b.csv \
  -o ../data/clean.csv --report ../data/quality_report.md
python3 import_db.py ../data/clean.csv --db ../data/rtp.db
```

One input remains backward compatible. Python callers can import
`clean_csv_files(input_csvs, output, report_path)` and receive reconciled input/ready/queued
counts. The canonical CSV retains `source_file` and the original one-based spreadsheet
`source_row` (including the header as row 1).
