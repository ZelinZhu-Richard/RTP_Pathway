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

/** NL question → structured filters. All optional; "only set what the question clearly implies". */
export const FiltersSchema = z.object({
  keywords: z
    .array(z.string())
    .describe("1-3 short topical keywords from the question (e.g. 'coding', 'animals'). Empty if the question is only about filters."),
  category: asEnum(CATEGORY_IDS).nullable(),
  format: asEnum(FORMAT_IDS).nullable(),
  cost: asEnum(COST_IDS).nullable(),
  compensation: asEnum([...COMPENSATION_IDS, "any_pay"])
    .nullable()
    .describe("'any_pay' when the student asks for paid opportunities generally"),
  city: asEnum(CITY_IDS).nullable(),
  grade: z.number().int().min(6).max(12).nullable().describe("School grade; convert ages (age 15 ≈ grade 10)"),
  schedule: asEnum(SCHEDULE_IDS).nullable(),
  deadlineWithinDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .nullable()
    .describe("Only when the student asks about deadlines soon, e.g. 'before Friday' ≈ 7, 'this month' ≈ 30"),
});
export type ParsedFilters = z.infer<typeof FiltersSchema>;

/** Explanation of search results, grounded in provided records only. */
export const ExplanationSchema = z.object({
  summary: z.string().describe("2-3 sentences for the student: what was found and which match is strongest, and why. Mention eligibility uncertainty when relevant."),
  perResult: z.array(
    z.object({
      id: z.string().describe("id of one of the provided records — never invent ids"),
      reason: z.string().describe("One sentence: why this record matches the question"),
    }),
  ),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

/** Structured extraction from a messy program description. */
export const ExtractedListingSchema = z.object({
  title: z.string().nullable(),
  orgName: z.string().nullable(),
  description: z.string().nullable().describe("2-3 plain-language sentences a high-school student understands"),
  category: asEnum(CATEGORY_IDS).nullable(),
  city: asEnum(CITY_IDS).nullable(),
  locationDetail: z.string().nullable(),
  format: asEnum(FORMAT_IDS).nullable(),
  costType: asEnum(COST_IDS).nullable(),
  costAmount: z.string().nullable(),
  compensation: asEnum(COMPENSATION_IDS).nullable(),
  compensationDetail: z.string().nullable(),
  schedule: asEnum(SCHEDULE_IDS).nullable(),
  timeCommitment: z.string().nullable(),
  gradeMin: z.number().int().min(1).max(12).nullable(),
  gradeMax: z.number().int().min(1).max(12).nullable(),
  ageMin: z.number().int().min(5).max(25).nullable(),
  ageMax: z.number().int().min(5).max(25).nullable(),
  eligibilityNotes: z.string().nullable(),
  whatYoullDo: z.string().nullable(),
  howToApply: z.string().nullable(),
  applicationUrl: z.string().nullable(),
  contactEmail: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  deadlineType: z.enum(["specific", "rolling", "unknown"]),
  applicationDeadline: z.string().nullable().describe("YYYY-MM-DD, only when deadlineType is 'specific'"),
  startDate: z.string().nullable().describe("YYYY-MM-DD"),
  endDate: z.string().nullable().describe("YYYY-MM-DD"),
  transportationNotes: z.string().nullable(),
  assumptions: z.array(z.string()).describe("Anything you were unsure about or that a reviewer should double-check"),
});
export type ExtractedListing = z.infer<typeof ExtractedListingSchema>;
