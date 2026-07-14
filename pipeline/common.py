"""Shared helpers for the RTP_Pathway data pipeline.

The database schema is owned by the Next.js app (drizzle/ migrations); these
scripts only read taxonomy + write rows. Keep slugify() in sync with
src/lib/slug.ts — both produce identical slugs for the same input.
"""

from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from difflib import SequenceMatcher, get_close_matches
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TAXONOMY_PATH = REPO_ROOT / "shared" / "taxonomy.json"


def load_taxonomy() -> dict:
    with open(TAXONOMY_PATH, encoding="utf-8") as f:
        return json.load(f)


def slugify(text: str) -> str:
    """Mirror of src/lib/slug.ts: ascii-fold, lowercase, non-alnum -> '-'."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def normalize_org_name(name: str) -> str:
    """Canonical form used for organization dedup (organizations.name_normalized)."""
    name = name.lower().strip()
    name = name.replace("&", " and ")
    name = re.sub(r"[^a-z0-9 ]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    if name.startswith("the "):
        name = name[4:]
    return name


def normalize_url(url: str) -> str:
    url = url.strip().lower()
    url = re.sub(r"^https?://", "", url)
    url = re.sub(r"^www\.", "", url)
    return url.rstrip("/")


_DOMAIN_RE = re.compile(r"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/?#].*)?$", re.IGNORECASE)


def normalize_link(url: str | None) -> tuple[str | None, str | None]:
    """Make a spreadsheet link safe to publish as an href.

    Returns (normalized_url, note): http(s) links pass through; bare domains
    ("www.example.org") gain https://; anything else — javascript:, data:,
    or non-URL text — is rejected to None so it can be flagged for review.
    """
    if not url:
        return None, None
    u = url.strip()
    scheme_match = re.match(r"^([a-zA-Z][a-zA-Z0-9+.-]*):", u)
    if scheme_match:
        scheme = scheme_match.group(1).lower()
        if scheme in ("http", "https"):
            return u, None
        return None, f"rejected unsafe scheme '{scheme}:'"
    if _DOMAIN_RE.match(u):
        return f"https://{u}", "added https://"
    return None, "not a valid web address"


def normalize_title(title: str) -> str:
    """Loose title form used only for duplicate comparison (drops years/punctuation)."""
    t = title.lower()
    t = re.sub(r"\b(19|20)\d{2}\b", " ", t)  # drop year tokens
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def title_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize_title(a), normalize_title(b)).ratio()


def match_enum(value: str | None, entries: list[dict], cutoff: float = 0.85) -> str | None:
    """Map a raw cell to a taxonomy entry id via exact id/label/synonym match,
    then difflib fuzzy match. Returns the entry id or None."""
    if not value:
        return None
    needle = re.sub(r"\s+", " ", value.strip().lower().replace("_", " ").replace("-", " "))
    lookup: dict[str, str] = {}
    for entry in entries:
        for key in [entry["id"], entry.get("label", ""), *entry.get("synonyms", [])]:
            if key:
                lookup[re.sub(r"\s+", " ", key.lower().replace("_", " ").replace("-", " "))] = entry["id"]
    if needle in lookup:
        return lookup[needle]
    close = get_close_matches(needle, list(lookup.keys()), n=1, cutoff=cutoff)
    return lookup[close[0]] if close else None


def connect(db_path: str | Path) -> sqlite3.Connection:
    """Open the app's SQLite DB with the same PRAGMAs the Next.js client uses,
    so the dev server and the pipeline can run at the same time."""
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
