import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/db/client";
import { searchEvents } from "@/db/schema";
import type { Filters } from "@/lib/search";
import {
  CATEGORY_IDS,
  CITY_IDS,
  COMPENSATION_IDS,
  COST_IDS,
  FORMAT_IDS,
  SCHEDULE_IDS,
} from "@/lib/taxonomy";

const asEnum = (ids: string[]) => z.enum(ids as [string, ...string[]]);

/** Public request contract. Unknown keys are rejected instead of entering analytics. */
export const SearchEventRequestSchema = z.object({
  filters: z
    .object({
      q: z.string().max(200).optional(),
      keywords: z.array(z.string().max(50)).max(3).optional(),
      category: asEnum(CATEGORY_IDS).optional(),
      format: asEnum(FORMAT_IDS).optional(),
      cost: asEnum(COST_IDS).optional(),
      compensation: asEnum([...COMPENSATION_IDS, "any_pay"]).optional(),
      city: asEnum(CITY_IDS).optional(),
      grade: z.number().int().min(6).max(12).optional(),
      schedule: asEnum(SCHEDULE_IDS).optional(),
      deadlineWithinDays: z.number().int().min(1).max(365).optional(),
      sort: z.enum(["deadline", "newest"]).optional(),
    })
    .strict(),
}).strict();

export type SearchEventRequest = z.infer<typeof SearchEventRequestSchema>;

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL = /\b(?:https?:\/\/|www\.)\S+/gi;
const PHONE = /(?<!\d)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)/g;

/** Redact common direct identifiers before any free text reaches SQLite. */
export function sanitizeQueryText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(URL, "[link]")
    .replace(EMAIL, "[email]")
    .replace(PHONE, "[phone]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return cleaned || null;
}

/** Store only canonical demand dimensions; omit free-text tokens and presentation state. */
export function analyticsFilters(filters: Filters): Partial<Filters> {
  const safe: Partial<Filters> = {};
  for (const key of ["category", "format", "cost", "compensation", "city", "schedule"] as const) {
    if (filters[key]) safe[key] = filters[key];
  }
  if (filters.grade) safe.grade = filters.grade;
  if (filters.deadlineWithinDays) safe.deadlineWithinDays = filters.deadlineWithinDays;
  return safe;
}

/**
 * Anonymous demand logging. No IP, cookie, session id, or user id is accepted.
 * Callers must pass the result count computed by the server-side database query.
 */
export function logSearchEvent(
  mode: "keyword" | "nl",
  queryText: string | null,
  filters: Filters,
  resultCount: number,
): boolean {
  const safeQuery = sanitizeQueryText(queryText);
  const safeFilters = analyticsFilters(filters);
  // Never persist raw public free text. Even after common identifier
  // redaction, names and schools are difficult to recognize reliably.
  const queryClass = safeQuery
    ? mode === "nl"
      ? "[natural-language query]"
      : "[keyword query]"
    : null;
  try {
    db.insert(searchEvents)
      .values({
        id: randomUUID(),
        mode,
        queryText: queryClass,
        filters: JSON.stringify(safeFilters),
        resultCount: Math.max(0, Math.trunc(resultCount)),
      })
      .run();
    return true;
  } catch {
    // Analytics must never break the student-facing search flow.
    return false;
  }
}
