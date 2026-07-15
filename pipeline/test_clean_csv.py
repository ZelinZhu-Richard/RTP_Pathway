#!/usr/bin/env python3
"""Focused regression tests for the CSV cleaning helpers."""

from __future__ import annotations

import sys
import json
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

from clean_csv import clean_csv_files, parse_cost  # noqa: E402


class ParseCostTests(unittest.TestCase):
    def test_exact_no_cost_values_remain_free(self) -> None:
        cases = {
            "Free": ("free", None),
            "$0": ("free", "$0"),
            "0": ("free", "0"),
            "no cost": ("free", "no cost"),
            "no fee": ("free", "no fee"),
        }

        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(parse_cost(raw), expected)


class MultiSourcePipelineTests(unittest.TestCase):
    def test_merges_sources_preserves_provenance_and_audits_import(self) -> None:
        pipeline_dir = Path(__file__).parent
        project_root = pipeline_dir.parent
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            first = temp / "partner-a.csv"
            second = temp / "partner-b.csv"
            cleaned = temp / "merged.csv"
            report = temp / "quality.md"
            cli_cleaned = temp / "merged-cli.csv"
            cli_report = temp / "quality-cli.md"
            database = temp / "rtp.db"

            first.write_text(
                "Program Name,Organization,Type,Description,Grades,Location,Mode,Cost,Deadline,Apply Link,Last Checked\n"
                "Youth Health Internship,Triangle Health,Internship,Support a community health team,Grades 9-12,Durham,In person,Free,08/01/2026,https://example.org/apply,07/01/2026\n",
                encoding="utf-8",
            )
            second.write_text(
                "Opportunity Title,Sponsor,Category,About,Who Can Apply,Town,Delivery,Fee,Apply By,Application URL,Verified On\n"
                "Youth Health Internship 2026,Triangle Health,Internship,Similar partner record,High school,Durham,In person,Free,August 1 2026,https://example.org/apply,July 2 2026\n",
                encoding="utf-8",
            )

            summary = clean_csv_files(
                [str(first), str(second)], str(cleaned), str(report)
            )
            self.assertEqual(
                summary,
                {
                    "input_rows": 2,
                    "ready_rows": 1,
                    "queued_rows": 1,
                    "duplicate_rows": 1,
                    "incomplete_rows": 0,
                },
            )

            # The public CLI remains compatible while accepting multiple inputs.
            subprocess.run(
                [
                    sys.executable,
                    str(pipeline_dir / "clean_csv.py"),
                    str(first),
                    str(second),
                    "-o",
                    str(cli_cleaned),
                    "--report",
                    str(cli_report),
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            merged = pd.read_csv(cleaned)
            self.assertEqual(len(merged), 2)
            self.assertEqual(set(merged["source_file"]), {first.name, second.name})
            self.assertEqual(set(merged["source_row"]), {2})
            self.assertEqual(int(merged["is_duplicate"].sum()), 1)
            self.assertTrue((merged["application_deadline"] == "2026-08-01").all())
            quality = report.read_text(encoding="utf-8")
            self.assertIn("## Source coverage", quality)
            self.assertIn(first.name, quality)
            self.assertIn(second.name, quality)
            self.assertIn("Possible duplicates", quality)
            self.assertIn("Reconciliation: 1 ready + 1 queued = 2 input rows", quality)
            self.assertTrue(cli_cleaned.exists())
            self.assertTrue(cli_report.exists())

            connection = sqlite3.connect(database)
            for migration in [project_root / "drizzle/0000_init.sql", project_root / "drizzle/0001_google_sheet_sync.sql"]:
                sql = migration.read_text(encoding="utf-8").replace("--> statement-breakpoint", "")
                connection.executescript(sql)
            connection.close()

            subprocess.run(
                [
                    sys.executable,
                    str(pipeline_dir / "import_db.py"),
                    str(cleaned),
                    "--db",
                    str(database),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            connection = sqlite3.connect(database)
            action, detail = connection.execute(
                "select action, detail from audit_log where action = 'pipeline_import_completed'"
            ).fetchone()
            connection.close()
            payload = json.loads(detail)
            self.assertEqual(action, "pipeline_import_completed")
            self.assertEqual(payload["sources"], [first.name, second.name])
            self.assertEqual(payload["inputRows"], 2)
            self.assertEqual(payload["inserted"], 1)
            self.assertEqual(payload["queued"], 1)

    def test_free_with_variable_team_fees_is_paid(self) -> None:
        raw = "Free (team fees vary)"

        self.assertEqual(parse_cost(raw), ("paid_program", raw))

    def test_fee_indicators_take_precedence_over_generic_free_wording(self) -> None:
        for raw in ("Free; tuition required", "Free registration, annual dues apply", "Free + $25 materials"):
            with self.subTest(raw=raw):
                self.assertEqual(parse_cost(raw), ("paid_program", raw))

    def test_unqualified_free_wording_and_existing_fallback_remain_unchanged(self) -> None:
        cases = {
            "Free with registration": ("free", "Free with registration"),
            "Contact organizer": ("free", "Contact organizer"),
            None: ("free", None),
        }

        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(parse_cost(raw), expected)


if __name__ == "__main__":
    unittest.main()
