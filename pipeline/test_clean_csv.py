#!/usr/bin/env python3
"""Focused regression tests for the CSV cleaning helpers."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from clean_csv import parse_cost  # noqa: E402


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
