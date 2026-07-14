import { z } from "zod";
import {
  CATEGORY_IDS,
  CITY_IDS,
  COMPENSATION_IDS,
  COST_IDS,
  FORMAT_IDS,
  SCHEDULE_IDS,
} from "@/lib/taxonomy";

const asEnum = (ids: string[]) => z.enum(ids as [string, ...string[]]);
const optionalTrimmed = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim() || undefined)
    .optional();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((s) => {
    // Shape alone lets 2026-99-99 (or 2026-02-30 via rollover) through, which
    // would stay "visible" forever and crash the calendar export.
    const date = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s;
  }, "must be a real calendar date")
  .optional();

const URL_PLACEHOLDERS = new Set(["n/a", "na", "tbd", "unknown", "none", "?", "-", "--"]);

function isUrlPlaceholder(value: string): boolean {
  const withoutHttpScheme = value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return URL_PLACEHOLDERS.has(withoutHttpScheme.toLowerCase());
}

/** Trim, auto-prefix https:// for bare domains, and reject placeholders and non-http(s) schemes. */
const safeHttpUrl = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s, ctx) => {
      const trimmed = s.trim();
      if (!trimmed) return undefined;
      if (isUrlPlaceholder(trimmed)) {
        ctx.addIssue({ code: "custom", message: "must be a valid http(s) link" });
        return z.NEVER;
      }
      const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
      try {
        const url = new URL(candidate);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
        return candidate;
      } catch {
        ctx.addIssue({ code: "custom", message: "must be a valid http(s) link" });
        return z.NEVER;
      }
    })
    .optional();

/** The editable listing fields shared by the public submit form and admin review. */
export const ListingFieldsSchema = z.object({
  title: optionalTrimmed(200),
  orgName: optionalTrimmed(200),
  description: optionalTrimmed(4000),
  category: asEnum(CATEGORY_IDS).optional(),
  city: asEnum(CITY_IDS).optional(),
  locationDetail: optionalTrimmed(300),
  format: asEnum(FORMAT_IDS).optional(),
  costType: asEnum(COST_IDS).optional(),
  costAmount: optionalTrimmed(200),
  compensation: asEnum(COMPENSATION_IDS).optional(),
  compensationDetail: optionalTrimmed(200),
  schedule: asEnum(SCHEDULE_IDS).optional(),
  timeCommitment: optionalTrimmed(200),
  gradeMin: z.coerce.number().int().min(1).max(12).optional(),
  gradeMax: z.coerce.number().int().min(1).max(12).optional(),
  ageMin: z.coerce.number().int().min(5).max(25).optional(),
  ageMax: z.coerce.number().int().min(5).max(25).optional(),
  eligibilityNotes: optionalTrimmed(500),
  whatYoullDo: optionalTrimmed(2000),
  howToApply: optionalTrimmed(1000),
  applicationUrl: safeHttpUrl(500),
  contactEmail: optionalTrimmed(200),
  sourceUrl: safeHttpUrl(500),
  transportationNotes: optionalTrimmed(500),
  deadlineType: z.enum(["specific", "rolling", "unknown"]).optional(),
  applicationDeadline: isoDate,
  startDate: isoDate,
  endDate: isoDate,
});
export type ListingFields = z.infer<typeof ListingFieldsSchema>;

export const SubmissionBodySchema = z.object({
  submitterName: optionalTrimmed(200),
  submitterEmail: optionalTrimmed(200),
  fields: ListingFieldsSchema,
  messyText: z.string().max(12_000).optional(),
  extractedFields: z.record(z.string(), z.unknown()).optional(),
});
export type SubmissionBody = z.infer<typeof SubmissionBodySchema>;

/** Missing-field check shared by /api/submissions and the admin queue. */
export function missingListingFields(fields: ListingFields): string[] {
  const missing: string[] = [];
  if (!fields.title) missing.push("title");
  if (!fields.orgName) missing.push("organization name");
  if (!fields.category) missing.push("category");
  if (!fields.description) missing.push("description");
  if (!fields.city) missing.push("city");
  if (!fields.format) missing.push("format");
  if (!fields.applicationUrl && !fields.contactEmail) missing.push("application link or contact email");
  if (fields.deadlineType !== "rolling" && !fields.applicationDeadline) {
    missing.push("application deadline (or mark as rolling)");
  }
  return missing;
}
