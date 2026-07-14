#!/usr/bin/env python3
"""Clean a raw opportunity spreadsheet into the canonical import format.

Usage:
    python3 pipeline/clean_csv.py data/seed_opportunities_raw.csv \
        -o data/seed_opportunities_clean.csv --report data/quality_report.md

Steps: normalize headers via an alias map, NA-ify blank tokens, standardize
dates to ISO, normalize categories/cities/formats/cost/compensation against
shared/taxonomy.json, parse grade/age eligibility, derive interest tags,
detect duplicates (same URL, or same org + similar title), and flag
incomplete rows. Emits a cleaned CSV plus a markdown data-quality report.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime

import pandas as pd

from common import (
    load_taxonomy,
    match_enum,
    normalize_link,
    normalize_org_name,
    normalize_url,
    title_similarity,
)

# ---------------------------------------------------------------- headers

HEADER_ALIASES = {
    "title": ["title", "program name", "program", "opportunity", "opportunity title", "name"],
    "org_name": ["org name", "org", "organization", "organization name", "provider", "sponsor"],
    "category": ["category", "type", "kind", "opportunity type"],
    "description": ["description", "about", "what is it", "details", "summary"],
    "grades_raw": ["grades raw", "grades", "grade levels", "eligibility", "ages", "who can apply"],
    "city": ["city", "where", "location", "town"],
    "format": ["format", "mode", "delivery", "in person or online"],
    "cost_raw": ["cost raw", "cost", "fee", "price", "tuition"],
    "compensation_raw": ["compensation raw", "pay", "compensation", "stipend", "wage"],
    "schedule": ["schedule", "when", "time of year"],
    "time_commitment": ["time commitment", "time needed", "commitment", "hours", "duration"],
    "application_deadline": ["application deadline", "apply by", "deadline", "due date", "due"],
    "start_date": ["start date", "starts", "start", "begins"],
    "end_date": ["end date", "ends", "end", "finishes"],
    "application_url": ["application url", "link", "apply link", "application link", "apply at"],
    "source_url": ["source url", "website", "source", "org website", "webpage"],
    "contact_email": ["contact email", "contact", "email"],
    "transportation_notes": ["transportation notes", "transportation", "accessibility", "access"],
    "last_checked": ["last checked", "last verified", "verified on", "checked"],
}

NA_TOKENS = {"", "n/a", "na", "tbd", "?", "unknown", "none", "-", "--"}
ROLLING_TOKENS = {"rolling", "ongoing", "open", "anytime", "no deadline", "continuous"}

DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"]

REQUIRED_FIELDS = ["title", "org_name", "category", "description", "city", "format"]
# plus: application_url OR contact_email as a way to apply (checked separately)


def normalize_header(raw: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", raw.strip().lower())).strip()


def map_headers(columns: list[str]) -> tuple[dict[str, str], list[str]]:
    alias_lookup = {alias: canon for canon, aliases in HEADER_ALIASES.items() for alias in aliases}
    mapping, unknown = {}, []
    for col in columns:
        canon = alias_lookup.get(normalize_header(col))
        if canon:
            mapping[col] = canon
        else:
            unknown.append(col)
    return mapping, unknown


# ---------------------------------------------------------------- cell cleaning

def clean_cell(value):
    if not isinstance(value, str):
        return value
    value = re.sub(r"\s+", " ", value).strip()
    return None if value.lower() in NA_TOKENS else value


def parse_date(value: str | None) -> tuple[str | None, bool, str | None]:
    """Returns (iso_date, is_rolling, failure). 'Sept' → 'Sep' fixup included."""
    if value is None:
        return None, False, None
    if value.strip().lower() in ROLLING_TOKENS:
        return None, True, None
    fixed = re.sub(r"\bSept\b\.?", "Sep", value.strip())
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(fixed, fmt).strftime("%Y-%m-%d"), False, None
        except ValueError:
            continue
    return None, False, value


GRADE_WORDS = {
    "freshman": 9, "freshmen": 9, "sophomore": 10, "sophomores": 10,
    "junior": 11, "juniors": 11, "senior": 12, "seniors": 12,
}


def parse_eligibility(raw: str | None) -> dict:
    """Parse 'grades 9-12', 'ages 14-18', '16+', 'rising juniors and seniors',
    'high school' into grade/age bounds."""
    out = {"grade_min": None, "grade_max": None, "age_min": None, "age_max": None}
    if not raw:
        return out
    text = raw.lower()

    # Explicit class-year words beat the generic high-school fallback, so
    # "high school juniors and seniors" narrows to 11-12 rather than 9-12.
    words = [GRADE_WORDS[w] for w in re.findall(r"[a-z]+", text) if w in GRADE_WORDS]
    if words:
        out["grade_min"], out["grade_max"] = min(words), max(words)
        return out

    if "high school" in text:
        out["grade_min"], out["grade_max"] = 9, 12
        return out

    is_ages = "age" in text
    # ordinal suffixes are common in grade ranges ("rising 9th-11th graders")
    rng = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|to)\s*(\d{1,2})(?:st|nd|rd|th)?", text)
    if rng:
        lo, hi = int(rng.group(1)), int(rng.group(2))
        # bare ranges like '14-18' are ages when they exceed grade numbers
        if is_ages or hi > 12:
            out["age_min"], out["age_max"] = lo, hi
        else:
            out["grade_min"], out["grade_max"] = lo, hi
        return out

    plus = re.search(r"(\d{1,2})\s*\+", text)
    if plus:
        n = int(plus.group(1))
        if is_ages or n > 12:
            out["age_min"] = n
        else:
            out["grade_min"] = n
        return out

    single = re.search(r"grade\s*(\d{1,2})", text)
    if single:
        out["grade_min"] = out["grade_max"] = int(single.group(1))
    return out


def parse_cost(raw: str | None) -> tuple[str, str | None]:
    """→ (cost_type, cost_amount). Anything that isn't clearly free costs money."""
    if raw is None:
        return "free", None
    low = raw.lower()
    if low.startswith("free") or low in {"$0", "0", "no cost", "no fee"}:
        return "free", (raw if low != "free" else None)
    if "$" in raw or any(w in low for w in ("fee", "tuition", "dues", "per class", "/year", "/week")):
        return "paid_program", raw
    return "free", raw


def parse_compensation(raw: str | None, taxonomy: dict) -> tuple[str, str | None]:
    if raw is None:
        return "none", None
    matched = match_enum(raw, taxonomy["compensation_types"])
    if matched:
        return matched, (raw if matched != "none" else None)
    low = raw.lower()
    if re.search(r"\$\s*[\d,.]+\s*(/|per\s*)(hr|hour)", low) or "/hr" in low:
        return "paid", raw
    if "stipend" in low or "award" in low or "prize" in low or "scholarship" in low:
        return "stipend", raw
    if "$" in raw:
        return "paid", raw
    return "none", raw


def derive_interest_tags(title: str | None, description: str | None, taxonomy: dict) -> list[str]:
    text = f"{title or ''} {description or ''}".lower()
    tags = []
    for interest in taxonomy["interests"]:
        terms = [interest["label"].lower(), *[s.lower() for s in interest["synonyms"]]]
        if any(re.search(rf"\b{re.escape(t)}\b", text) for t in terms):
            tags.append(interest["id"])
    return tags


# ---------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input_csv")
    ap.add_argument("-o", "--output", required=True)
    ap.add_argument("--report", required=True)
    args = ap.parse_args()

    df = pd.read_csv(args.input_csv, dtype=str, keep_default_na=False)
    original_rows = len(df)

    mapping, unknown_cols = map_headers(list(df.columns))
    df = df.rename(columns=mapping)
    df = df.drop(columns=unknown_cols)
    for canon in HEADER_ALIASES:
        if canon not in df.columns:
            df[canon] = None

    df = df.map(clean_cell)

    taxonomy = load_taxonomy()
    report: dict[str, list[str]] = {
        "renamed": [f"`{k}` → `{v}`" for k, v in mapping.items() if normalize_header(k) != v.replace("_", " ")],
        "dropped": [f"`{c}`" for c in unknown_cols],
        "date_fixes": [],
        "category_fixes": [],
        "unmatched_categories": [],
        "link_fixes": [],
        "dup_groups": [],
        "incomplete": [],
    }

    # --- links: publish only safe, absolute http(s) URLs
    for col in ["application_url", "source_url"]:
        fixed_vals = []
        for i, v in enumerate(df[col]):
            fixed, note = normalize_link(v)
            fixed_vals.append(fixed)
            if note:
                report["link_fixes"].append(f"row {i + 2}: `{col}` \"{v}\" — {note}")
        df[col] = fixed_vals

    # --- dates
    for col in ["application_deadline", "start_date", "end_date", "last_checked"]:
        iso_vals, rolling_flags = [], []
        for i, v in enumerate(df[col]):
            iso, rolling, failure = parse_date(v)
            iso_vals.append(iso)
            rolling_flags.append(rolling)
            if failure:
                report["date_fixes"].append(f"row {i + 2}: could not parse `{col}` value \"{failure}\"")
            elif v and iso and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v.strip()):
                report["date_fixes"].append(f"row {i + 2}: `{col}` \"{v}\" → {iso}")
        df[col] = iso_vals
        if col == "application_deadline":
            df["is_rolling"] = rolling_flags

    # --- category
    raw_categories = df["category"].tolist()
    matched_categories = []
    for i, raw in enumerate(raw_categories):
        matched = match_enum(raw, taxonomy["categories"])
        matched_categories.append(matched)
        if raw and matched and normalize_org_name(raw) != matched.replace("_", " "):
            report["category_fixes"].append(f"row {i + 2}: \"{raw}\" → `{matched}`")
        elif raw and not matched:
            report["unmatched_categories"].append(f"row {i + 2}: \"{raw}\"")
    df["raw_category"] = raw_categories
    df["category"] = matched_categories

    # --- other enums
    df["city"] = [match_enum(v, taxonomy["cities"], cutoff=0.9) for v in df["city"]]
    df["format"] = [match_enum(v, taxonomy["formats"]) for v in df["format"]]
    df["schedule"] = [match_enum(v, taxonomy["schedules"]) for v in df["schedule"]]

    costs = [parse_cost(v) for v in df["cost_raw"]]
    df["cost_type"] = [c[0] for c in costs]
    df["cost_amount"] = [c[1] for c in costs]
    comps = [parse_compensation(v, taxonomy) for v in df["compensation_raw"]]
    df["compensation"] = [c[0] for c in comps]
    df["compensation_detail"] = [c[1] for c in comps]

    # --- eligibility + interests
    elig = [parse_eligibility(v) for v in df["grades_raw"]]
    for key in ["grade_min", "grade_max", "age_min", "age_max"]:
        df[key] = [e[key] for e in elig]
    df["eligibility_notes"] = df["grades_raw"]
    df["interest_tags"] = [
        json.dumps(derive_interest_tags(t, d, taxonomy))
        for t, d in zip(df["title"], df["description"])
    ]

    # --- duplicate detection
    df["dup_group"] = None
    df["is_duplicate"] = False
    df["dup_reason"] = None
    group_id = 0
    rows = df.to_dict("records")
    assigned: dict[int, int] = {}
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            a, b = rows[i], rows[j]
            reason = None
            if a["application_url"] and b["application_url"] and normalize_url(a["application_url"]) == normalize_url(b["application_url"]):
                reason = "same application URL"
            elif (
                a["org_name"] and b["org_name"]
                and normalize_org_name(a["org_name"]) == normalize_org_name(b["org_name"])
                and a["title"] and b["title"]
                and title_similarity(a["title"], b["title"]) >= 0.85
            ):
                reason = f"same organization + similar title ({title_similarity(a['title'], b['title']):.2f})"
            if reason:
                grp = assigned.get(i) or assigned.get(j)
                if grp is None:
                    group_id += 1
                    grp = group_id
                assigned[i] = assigned[j] = grp
                df.loc[i, "dup_group"] = grp
                df.loc[j, "dup_group"] = grp
                df.loc[j, "dup_reason"] = reason
                report["dup_groups"].append(
                    f"group {grp}: rows {i + 2} and {j + 2} — \"{a['title']}\" / \"{b['title']}\" ({reason})"
                )

    # within each group, keep the most complete row; flag the rest as duplicates
    for grp in sorted(set(assigned.values())):
        members = [i for i, g in assigned.items() if g == grp]
        completeness = {i: df.loc[i].notna().sum() for i in members}
        primary = max(completeness, key=lambda i: completeness[i])
        for i in members:
            if i != primary:
                df.loc[i, "is_duplicate"] = True
                if not df.loc[i, "dup_reason"]:
                    df.loc[i, "dup_reason"] = "duplicate group member"

    # --- completeness
    missing_lists = []
    for i, row in df.iterrows():
        missing = [f for f in REQUIRED_FIELDS if pd.isna(row[f]) or row[f] is None]
        if (pd.isna(row["application_url"]) or row["application_url"] is None) and (
            pd.isna(row["contact_email"]) or row["contact_email"] is None
        ):
            missing.append("application_url or contact_email")
        # A missing deadline is only acceptable when the row is explicitly
        # rolling — otherwise it would publish as "rolling admission" forever.
        if (pd.isna(row["application_deadline"]) or row["application_deadline"] is None) and not bool(
            row["is_rolling"]
        ):
            missing.append("application_deadline or rolling flag")
        missing_lists.append(missing)
        if missing:
            report["incomplete"].append(f"row {i + 2} (\"{row['title'] or '?'}\"): missing {', '.join(missing)}")
    df["incomplete"] = [bool(m) for m in missing_lists]
    df["missing_fields"] = [json.dumps(m) for m in missing_lists]

    out_cols = [
        "title", "org_name", "category", "raw_category", "description", "interest_tags",
        "grade_min", "grade_max", "age_min", "age_max", "eligibility_notes",
        "city", "format", "cost_type", "cost_amount", "compensation", "compensation_detail",
        "schedule", "time_commitment", "application_deadline", "is_rolling",
        "start_date", "end_date", "application_url", "source_url", "contact_email",
        "transportation_notes", "last_checked",
        "is_duplicate", "dup_group", "dup_reason", "incomplete", "missing_fields",
    ]
    df[out_cols].to_csv(args.output, index=False)

    clean_count = int((~df["is_duplicate"] & ~df["incomplete"]).sum())
    null_rates = {
        col: f"{df[col].isna().mean():.0%}"
        for col in ["category", "city", "format", "application_deadline", "application_url", "last_checked"]
    }

    lines = [
        "# Data quality report",
        "",
        f"Input: `{args.input_csv}` — {original_rows} rows",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Summary",
        "",
        f"- **{clean_count}** rows clean and ready to import",
        f"- **{int(df['is_duplicate'].sum())}** rows flagged as likely duplicates (routed to review queue)",
        f"- **{int(df['incomplete'].sum())}** rows incomplete (routed to review queue)",
        f"- **{int(df['is_rolling'].sum())}** rows with rolling/ongoing deadlines",
        "",
        "## Columns renamed",
        *([f"- {x}" for x in report["renamed"]] or ["- (none)"]),
        "",
        "## Unknown columns dropped",
        *([f"- {x}" for x in report["dropped"]] or ["- (none)"]),
        "",
        "## Null rates (after cleaning)",
        *[f"- `{col}`: {rate}" for col, rate in null_rates.items()],
        "",
        "## Date values standardized or rejected",
        *([f"- {x}" for x in report["date_fixes"]] or ["- (none)"]),
        "",
        "## Category values normalized",
        *([f"- {x}" for x in report["category_fixes"]] or ["- (none)"]),
        "",
        "## Categories that could not be matched",
        *([f"- {x}" for x in report["unmatched_categories"]] or ["- (none)"]),
        "",
        "## Link normalization",
        *([f"- {x}" for x in report["link_fixes"]] or ["- (none)"]),
        "",
        "## Possible duplicates",
        *([f"- {x}" for x in report["dup_groups"]] or ["- (none)"]),
        "",
        "## Incomplete rows",
        *([f"- {x}" for x in report["incomplete"]] or ["- (none)"]),
        "",
    ]
    with open(args.report, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Cleaned {original_rows} rows → {args.output}")
    print(f"  clean: {clean_count}, duplicates: {int(df['is_duplicate'].sum())}, incomplete: {int(df['incomplete'].sum())}")
    print(f"  report: {args.report}")


if __name__ == "__main__":
    main()
