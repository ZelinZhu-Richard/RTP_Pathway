#!/usr/bin/env python3
"""Import a cleaned opportunity CSV into the app's SQLite database.

Usage:
    python3 pipeline/import_db.py data/seed_opportunities_clean.csv --db data/rtp.db [--reset]

Clean rows become approved opportunities; rows flagged as duplicate or
incomplete become pending submissions so they land in the admin review queue.
The schema is owned by the app's Drizzle migrations — run `npm run db:migrate`
first. Re-running skips rows whose (title, organization) already exist;
--reset wipes all data first (dev convenience).
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid

import pandas as pd

from common import connect, normalize_org_name, slugify


def norm(value):
    """pandas cell -> python value (None for NA)."""
    if value is None or (isinstance(value, float) and pd.isna(value)) or pd.isna(value):
        return None
    if isinstance(value, str):
        return value.strip() or None
    return value


def to_timestamp(date_str: str | None) -> str | None:
    return f"{date_str}T00:00:00.000Z" if date_str else None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input_csv")
    ap.add_argument("--db", default="data/rtp.db")
    ap.add_argument("--reset", action="store_true", help="delete all existing data first")
    args = ap.parse_args()

    conn = connect(args.db)
    tables = {r[0] for r in conn.execute("select name from sqlite_master where type='table'")}
    if "opportunities" not in tables:
        sys.exit("Database schema not found - run `npm run db:migrate` first.")

    df = pd.read_csv(args.input_csv, dtype={"dup_group": "Int64", "grade_min": "Int64", "grade_max": "Int64", "age_min": "Int64", "age_max": "Int64"})

    cur = conn.cursor()
    if args.reset:
        for table in ["search_events", "audit_log", "reports", "submissions", "opportunities", "organizations"]:
            cur.execute(f"delete from {table}")
        print("Existing data cleared (--reset).")

    inserted = skipped = pending = 0
    dup_primary_ids: dict[int, tuple[str, str]] = {}  # dup_group -> (opportunity_id, title)

    def get_or_create_org(name: str) -> str:
        normalized = normalize_org_name(name)
        row = cur.execute("select id from organizations where name_normalized = ?", (normalized,)).fetchone()
        if row:
            return row[0]
        org_id = str(uuid.uuid4())
        cur.execute(
            "insert into organizations (id, name, name_normalized) values (?, ?, ?)",
            (org_id, name, normalized),
        )
        return org_id

    # First pass: clean rows -> approved opportunities.
    for _, row in df.iterrows():
        if bool(row["is_duplicate"]) or bool(row["incomplete"]):
            continue
        title, org_name = norm(row["title"]), norm(row["org_name"])
        org_id = get_or_create_org(org_name)
        exists = cur.execute(
            "select id from opportunities where title = ? and org_id = ?", (title, org_id)
        ).fetchone()
        if exists:
            skipped += 1
            if norm(row["dup_group"]) is not None:
                dup_primary_ids[int(row["dup_group"])] = (exists[0], title)
            continue
        opp_id = str(uuid.uuid4())
        slug = f"{slugify(title)}-{opp_id[:6]}"
        cur.execute(
            """insert into opportunities
               (id, org_id, title, slug, description, category, interest_tags, format, city,
                location_detail, grade_min, grade_max, age_min, age_max,
                cost_type, cost_amount, compensation, compensation_detail,
                schedule, time_commitment, eligibility_notes, application_url,
                application_deadline, start_date, end_date, transportation_notes,
                source_url, contact_email, last_verified_at, status)
               values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                opp_id, org_id, title, slug,
                norm(row["description"]), norm(row["category"]), norm(row["interest_tags"]),
                norm(row["format"]), norm(row["city"]), None,
                norm(row["grade_min"]), norm(row["grade_max"]), norm(row["age_min"]), norm(row["age_max"]),
                norm(row["cost_type"]), norm(row["cost_amount"]),
                norm(row["compensation"]), norm(row["compensation_detail"]),
                norm(row["schedule"]), norm(row["time_commitment"]), norm(row["eligibility_notes"]),
                norm(row["application_url"]),
                norm(row["application_deadline"]), norm(row["start_date"]), norm(row["end_date"]),
                norm(row["transportation_notes"]), norm(row["source_url"]), norm(row["contact_email"]),
                to_timestamp(norm(row["last_checked"])), "approved",
            ),
        )
        inserted += 1
        if norm(row["dup_group"]) is not None:
            dup_primary_ids[int(row["dup_group"])] = (opp_id, title)

    # Second pass: flagged rows -> pending submissions for the admin queue.
    for _, row in df.iterrows():
        if not (bool(row["is_duplicate"]) or bool(row["incomplete"])):
            continue
        title = norm(row["title"]) or "(untitled)"
        already = cur.execute(
            "select id from submissions where source = 'csv_import' and org_name is ? and json_extract(raw_fields, '$.title') = ?",
            (norm(row["org_name"]), title),
        ).fetchone()
        if already:
            skipped += 1
            continue
        warnings = []
        if bool(row["is_duplicate"]) and norm(row["dup_group"]) is not None:
            primary = dup_primary_ids.get(int(row["dup_group"]))
            warnings.append(
                {
                    "opportunityId": primary[0] if primary else None,
                    "title": primary[1] if primary else None,
                    "reason": norm(row["dup_reason"]) or "possible duplicate",
                }
            )
        raw_fields = {
            k: norm(row[k])
            for k in [
                "title", "org_name", "category", "raw_category", "description", "city", "format",
                "cost_type", "cost_amount", "compensation", "schedule", "time_commitment",
                "eligibility_notes", "application_url", "source_url", "contact_email",
                "application_deadline", "start_date", "end_date", "transportation_notes",
            ]
        }
        cur.execute(
            """insert into submissions
               (id, source, org_name, raw_fields, missing_fields, duplicate_warnings, status)
               values (?,?,?,?,?,?,?)""",
            (
                str(uuid.uuid4()), "csv_import", norm(row["org_name"]),
                json.dumps(raw_fields),
                norm(row["missing_fields"]) or "[]",
                json.dumps(warnings),
                "pending",
            ),
        )
        pending += 1

    conn.commit()
    conn.close()
    print(f"Imported {inserted} opportunities, queued {pending} submissions for review, skipped {skipped} already present.")


if __name__ == "__main__":
    main()
