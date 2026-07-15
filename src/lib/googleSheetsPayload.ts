import type { SubmissionRow } from "@/db/schema";

export const SUBMISSION_SHEET_SCHEMA_VERSION = "1";

// Column A is the stable idempotency key. Keep this order append-only and bump
// the schema version when changing the wire shape.
export const SUBMISSION_SHEET_HEADERS = [
  "submission_id",
  "sheet_schema_version",
  "submitted_at_utc",
  "source",
  "review_status",
  "reviewed_at_utc",
  "opportunity_id",
  "review_note",
  "submitter_name",
  "submitter_email",
  "organization_name",
  "title",
  "description",
  "category",
  "city",
  "format",
  "location_detail",
  "cost_type",
  "cost_amount",
  "compensation",
  "compensation_detail",
  "schedule",
  "time_commitment",
  "grade_min",
  "grade_max",
  "age_min",
  "age_max",
  "eligibility_notes",
  "what_youll_do",
  "how_to_apply",
  "application_url",
  "contact_email",
  "source_url",
  "transportation_notes",
  "deadline_type",
  "application_deadline",
  "start_date",
  "end_date",
  "missing_fields_json",
  "duplicate_warnings_json",
  "messy_text",
] as const;

export type SubmissionSheetCell = string | number;

export function classifySubmissionSheetHeader(header: unknown[]): "empty" | "valid" | "mismatch" {
  const cells = header.map((value) => String(value ?? ""));
  if (cells.length === 0 || cells.every((value) => value === "")) return "empty";
  if (
    cells.length === SUBMISSION_SHEET_HEADERS.length &&
    SUBMISSION_SHEET_HEADERS.every((expected, index) => cells[index] === expected)
  ) {
    return "valid";
  }
  return "mismatch";
}

export type SubmissionSheetWritePlan =
  | { kind: "append" }
  | { kind: "update"; rowNumber: number };

/** Column A is the idempotency key; row 1 is always the versioned header. */
export function planSubmissionSheetWrite(
  rows: unknown[][],
  submissionId: string,
): SubmissionSheetWritePlan {
  const existingIndex = rows
    .slice(1)
    .findIndex((candidate) => String(candidate?.[0] ?? "") === submissionId);
  return existingIndex >= 0
    ? { kind: "update", rowNumber: existingIndex + 2 }
    : { kind: "append" };
}

function parseRecord(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function field(raw: Record<string, unknown>, camel: string, snake?: string): SubmissionSheetCell {
  const value = raw[camel] ?? (snake ? raw[snake] : undefined);
  return typeof value === "string" || typeof value === "number" ? value : "";
}

function normalizedJson(json: string | null): string {
  if (!json) return "";
  try {
    return JSON.stringify(JSON.parse(json));
  } catch {
    return "";
  }
}

/**
 * Build the versioned row sent to Google Sheets. extractedFields is
 * intentionally excluded: it originated in a client request and is useful to
 * reviewers, but is not trusted export data.
 */
export function buildSubmissionSheetRow(submission: SubmissionRow): SubmissionSheetCell[] {
  const raw = parseRecord(submission.rawFields);

  return [
    submission.id,
    SUBMISSION_SHEET_SCHEMA_VERSION,
    submission.createdAt,
    submission.source,
    submission.status,
    submission.reviewedAt ?? "",
    submission.opportunityId ?? "",
    submission.reviewNote ?? "",
    submission.submitterName ?? "",
    submission.submitterEmail ?? "",
    field(raw, "orgName", "org_name") || submission.orgName || "",
    field(raw, "title"),
    field(raw, "description"),
    field(raw, "category"),
    field(raw, "city"),
    field(raw, "format"),
    field(raw, "locationDetail", "location_detail"),
    field(raw, "costType", "cost_type"),
    field(raw, "costAmount", "cost_amount"),
    field(raw, "compensation"),
    field(raw, "compensationDetail", "compensation_detail"),
    field(raw, "schedule"),
    field(raw, "timeCommitment", "time_commitment"),
    field(raw, "gradeMin", "grade_min"),
    field(raw, "gradeMax", "grade_max"),
    field(raw, "ageMin", "age_min"),
    field(raw, "ageMax", "age_max"),
    field(raw, "eligibilityNotes", "eligibility_notes"),
    field(raw, "whatYoullDo", "what_youll_do"),
    field(raw, "howToApply", "how_to_apply"),
    field(raw, "applicationUrl", "application_url"),
    field(raw, "contactEmail", "contact_email"),
    field(raw, "sourceUrl", "source_url"),
    field(raw, "transportationNotes", "transportation_notes"),
    field(raw, "deadlineType", "deadline_type"),
    field(raw, "applicationDeadline", "application_deadline"),
    field(raw, "startDate", "start_date"),
    field(raw, "endDate", "end_date"),
    normalizedJson(submission.missingFields),
    normalizedJson(submission.duplicateWarnings),
    submission.messyText ?? "",
  ];
}
