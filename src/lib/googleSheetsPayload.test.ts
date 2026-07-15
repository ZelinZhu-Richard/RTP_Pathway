import assert from "node:assert/strict";
import test from "node:test";
import type { SubmissionRow } from "@/db/schema";
import {
  buildSubmissionSheetRow,
  classifySubmissionSheetHeader,
  planSubmissionSheetWrite,
  SUBMISSION_SHEET_HEADERS,
  SUBMISSION_SHEET_SCHEMA_VERSION,
} from "./googleSheetsPayload";

function submission(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    id: "submission-123",
    source: "web_form",
    submitterName: "Taylor",
    submitterEmail: "taylor@example.org",
    orgName: "Triangle Youth Lab",
    rawFields: JSON.stringify({
      orgName: "Triangle Youth Lab",
      title: "Summer Research",
      category: "research_program",
      city: "durham",
      gradeMin: 9,
      applicationUrl: "https://example.org/apply",
    }),
    messyText: "Original flyer text",
    extractedFields: JSON.stringify({ title: "UNTRUSTED CLIENT AI VALUE" }),
    missingFields: JSON.stringify(["description"]),
    duplicateWarnings: JSON.stringify([{ title: "Similar program", reason: "same URL" }]),
    status: "pending",
    reviewNote: null,
    opportunityId: null,
    sheetSyncStatus: "pending",
    sheetSyncedAt: null,
    sheetSyncError: null,
    sheetRemoteRange: null,
    createdAt: "2026-07-14T12:00:00.000Z",
    reviewedAt: null,
    ...overrides,
  };
}

test("Google Sheets payload follows the fixed schema and keeps submission_id in column A", () => {
  const row = buildSubmissionSheetRow(submission());

  assert.equal(row.length, SUBMISSION_SHEET_HEADERS.length);
  assert.equal(row[0], "submission-123");
  assert.equal(row[1], SUBMISSION_SHEET_SCHEMA_VERSION);
  assert.equal(row[SUBMISSION_SHEET_HEADERS.indexOf("title")], "Summer Research");
  assert.equal(row[SUBMISSION_SHEET_HEADERS.indexOf("grade_min")], 9);
});

test("client-provided extracted fields are never exported", () => {
  const row = buildSubmissionSheetRow(submission());

  assert.equal(SUBMISSION_SHEET_HEADERS.includes("extracted_fields_json" as never), false);
  assert.equal(row.some((cell) => String(cell).includes("UNTRUSTED CLIENT AI VALUE")), false);
});

test("review outcome overwrites the same row payload fields", () => {
  const row = buildSubmissionSheetRow(
    submission({
      status: "approved",
      reviewedAt: "2026-07-14T13:00:00.000Z",
      opportunityId: "opportunity-456",
      rawFields: JSON.stringify({
        orgName: "Triangle Youth Lab",
        title: "Reviewer-corrected title",
        category: "research_program",
      }),
    }),
  );

  assert.equal(row[SUBMISSION_SHEET_HEADERS.indexOf("review_status")], "approved");
  assert.equal(row[SUBMISSION_SHEET_HEADERS.indexOf("opportunity_id")], "opportunity-456");
  assert.equal(row[SUBMISSION_SHEET_HEADERS.indexOf("reviewed_at_utc")], "2026-07-14T13:00:00.000Z");
  assert.equal(row[SUBMISSION_SHEET_HEADERS.indexOf("title")], "Reviewer-corrected title");
});

test("setup classifies empty, valid, and incompatible header rows", () => {
  assert.equal(classifySubmissionSheetHeader([]), "empty");
  assert.equal(classifySubmissionSheetHeader(["", ""]), "empty");
  assert.equal(classifySubmissionSheetHeader([...SUBMISSION_SHEET_HEADERS]), "valid");
  assert.equal(classifySubmissionSheetHeader(["submission_id", "old_schema"]), "mismatch");
  assert.equal(classifySubmissionSheetHeader([...SUBMISSION_SHEET_HEADERS, "unexpected"]), "mismatch");
});

test("submission_id retries update the existing row instead of appending a duplicate", () => {
  assert.deepEqual(
    planSubmissionSheetWrite([[...SUBMISSION_SHEET_HEADERS]], "submission-123"),
    { kind: "append" },
  );
  assert.deepEqual(
    planSubmissionSheetWrite(
      [[...SUBMISSION_SHEET_HEADERS], ["another-id"], ["submission-123"]],
      "submission-123",
    ),
    { kind: "update", rowNumber: 3 },
  );
});
