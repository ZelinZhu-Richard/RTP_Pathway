import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// All IDs are TEXT UUIDs and all dates are ISO-8601 TEXT so that the Python
// pipeline (stdlib sqlite3 + uuid) can write rows that are indistinguishable
// from app-written rows. SQL-level defaults (not client-side ones) for the
// same reason. Keep column names snake_case — pipeline/import_db.py depends
// on them matching drizzle/0000_init.sql exactly.

const uuid = (name: string) => text(name);
const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const organizations = sqliteTable(
  "organizations",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull().unique(),
    website: text("website"),
    contactEmail: text("contact_email"),
    description: text("description"),
    createdAt: text("created_at").notNull().default(nowIso),
  },
  (t) => [index("idx_org_name_normalized").on(t.nameNormalized)],
);

export const opportunities = sqliteTable(
  "opportunities",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    interestTags: text("interest_tags"), // JSON array of interest ids
    format: text("format").notNull(),
    city: text("city").notNull(),
    locationDetail: text("location_detail"),
    gradeMin: integer("grade_min"),
    gradeMax: integer("grade_max"),
    ageMin: integer("age_min"),
    ageMax: integer("age_max"),
    costType: text("cost_type").notNull().default("free"),
    costAmount: text("cost_amount"),
    compensation: text("compensation").notNull().default("none"),
    compensationDetail: text("compensation_detail"),
    schedule: text("schedule"),
    timeCommitment: text("time_commitment"),
    whatYoullDo: text("what_youll_do"),
    eligibilityNotes: text("eligibility_notes"),
    howToApply: text("how_to_apply"),
    applicationUrl: text("application_url"),
    applicationDeadline: text("application_deadline"), // YYYY-MM-DD; NULL = rolling
    startDate: text("start_date"),
    endDate: text("end_date"),
    transportationNotes: text("transportation_notes"),
    sourceUrl: text("source_url"),
    contactEmail: text("contact_email"),
    lastVerifiedAt: text("last_verified_at"),
    status: text("status").notNull().default("approved"),
    createdAt: text("created_at").notNull().default(nowIso),
    updatedAt: text("updated_at").notNull().default(nowIso),
  },
  (t) => [
    index("idx_opp_category").on(t.category),
    index("idx_opp_city").on(t.city),
    index("idx_opp_deadline").on(t.applicationDeadline),
    index("idx_opp_status").on(t.status),
    check(
      "chk_opp_category",
      sql`${t.category} in ('internship','part_time_job','volunteer','summer_program','after_school_program','competition','scholarship','workshop_course','research_program','mentorship')`,
    ),
    check("chk_opp_format", sql`${t.format} in ('in_person','online','hybrid')`),
    check("chk_opp_cost_type", sql`${t.costType} in ('free','paid_program')`),
    check("chk_opp_compensation", sql`${t.compensation} in ('none','stipend','paid')`),
    check(
      "chk_opp_schedule",
      sql`${t.schedule} is null or ${t.schedule} in ('after_school','weekend','summer','school_break','flexible')`,
    ),
    check("chk_opp_status", sql`${t.status} in ('approved','archived')`),
  ],
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: uuid("id").primaryKey(),
    source: text("source").notNull().default("web_form"),
    submitterName: text("submitter_name"),
    submitterEmail: text("submitter_email"),
    orgName: text("org_name"),
    rawFields: text("raw_fields"), // JSON: structured form values as submitted
    messyText: text("messy_text"),
    extractedFields: text("extracted_fields"), // JSON from Claude extraction
    missingFields: text("missing_fields"), // JSON array of field names
    duplicateWarnings: text("duplicate_warnings"), // JSON array {opportunityId,title,score,reason}
    status: text("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id),
    sheetSyncStatus: text("sheet_sync_status").notNull().default("disabled"),
    sheetSyncedAt: text("sheet_synced_at"),
    sheetSyncError: text("sheet_sync_error"),
    sheetRemoteRange: text("sheet_remote_range"),
    createdAt: text("created_at").notNull().default(nowIso),
    reviewedAt: text("reviewed_at"),
  },
  (t) => [
    index("idx_sub_status").on(t.status),
    index("idx_sub_sheet_sync_status").on(t.sheetSyncStatus),
    check("chk_sub_source", sql`${t.source} in ('web_form','csv_import')`),
    check("chk_sub_status", sql`${t.status} in ('pending','approved','rejected')`),
    check(
      "chk_sub_sheet_sync_status",
      sql`${t.sheetSyncStatus} in ('disabled','pending','synced','failed')`,
    ),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: uuid("id").primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull().default(nowIso),
    resolvedAt: text("resolved_at"),
  },
  (t) => [
    index("idx_report_status").on(t.status),
    check("chk_report_reason", sql`${t.reason} in ('outdated','incorrect','broken_link','other')`),
    check("chk_report_status", sql`${t.status} in ('open','resolved','dismissed')`),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    actor: text("actor").notNull().default("admin"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    detail: text("detail"), // JSON summary of the change
    createdAt: text("created_at").notNull().default(nowIso),
  },
  (t) => [index("idx_audit_created").on(t.createdAt)],
);

// Anonymous by construction: no IP, no session id, no user fields.
export const searchEvents = sqliteTable(
  "search_events",
  {
    id: uuid("id").primaryKey(),
    mode: text("mode").notNull(),
    queryText: text("query_text"),
    filters: text("filters"), // JSON of applied filters
    resultCount: integer("result_count").notNull(),
    createdAt: text("created_at").notNull().default(nowIso),
  },
  (t) => [
    index("idx_search_created").on(t.createdAt),
    check("chk_search_mode", sql`${t.mode} in ('keyword','nl')`),
  ],
);

export type OpportunityRow = typeof opportunities.$inferSelect;
export type OrganizationRow = typeof organizations.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type SearchEventRow = typeof searchEvents.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
