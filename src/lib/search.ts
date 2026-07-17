import { SQL, and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { opportunities, organizations } from "@/db/schema";
import {
  CATEGORY_IDS,
  CITY_IDS,
  COMPENSATION_IDS,
  COST_IDS,
  FORMAT_IDS,
  SCHEDULE_IDS,
} from "@/lib/taxonomy";

/** One shared filter shape for keyword search, the NL parser, and its fallback. */
export interface Filters {
  q?: string;
  keywords?: string[];
  category?: string;
  format?: string;
  cost?: string;
  /** compensation id, or "any_pay" for stipend-or-paid */
  compensation?: string;
  city?: string;
  grade?: number;
  schedule?: string;
  deadlineWithinDays?: number;
  sort?: "deadline" | "newest";
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;
export const MAX_KEYWORDS = 3;
export const MAX_KEYWORD_LENGTH = 50;

const inSet = (value: string | undefined, ids: string[]) =>
  value && ids.includes(value) ? value : undefined;

/**
 * Keep topical URL filters compact and safe to render/share. Comparisons are
 * case-insensitive so repeated values do not add duplicate SQL conditions.
 */
function normalizeKeywords(values: Iterable<string>): string[] {
  const keywords: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const keyword = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_KEYWORD_LENGTH);
    const canonical = keyword.toLocaleLowerCase("en-US");
    if (keyword.length < 2 || seen.has(canonical)) continue;
    seen.add(canonical);
    keywords.push(keyword);
    if (keywords.length === MAX_KEYWORDS) break;
  }
  return keywords;
}

/** Parse and validate filters from URL search params; invalid values are dropped. */
export function parseFilters(params: URLSearchParams): Filters {
  const filters: Filters = {};
  const q = params.get("q")?.trim();
  if (q) filters.q = q.slice(0, 200);
  const repeatedKeywords = params.getAll("keyword");
  // `keywords=a,b` was never emitted by the canonical helper, but accepting it
  // as a read-only fallback keeps hand-authored and preview-era links working.
  const legacyKeywords = repeatedKeywords.length === 0
    ? params.getAll("keywords").flatMap((value) => value.split(","))
    : [];
  const keywords = normalizeKeywords([...repeatedKeywords, ...legacyKeywords]);
  if (keywords.length) filters.keywords = keywords;
  filters.category = inSet(params.get("category") ?? undefined, CATEGORY_IDS);
  filters.format = inSet(params.get("format") ?? undefined, FORMAT_IDS);
  filters.cost = inSet(params.get("cost") ?? undefined, COST_IDS);
  const comp = params.get("compensation") ?? undefined;
  filters.compensation = comp === "any_pay" ? "any_pay" : inSet(comp, COMPENSATION_IDS);
  filters.city = inSet(params.get("city") ?? undefined, CITY_IDS);
  const grade = Number(params.get("grade"));
  if (Number.isInteger(grade) && grade >= 6 && grade <= 12) filters.grade = grade;
  filters.schedule = inSet(params.get("schedule") ?? undefined, SCHEDULE_IDS);
  const days = Number(params.get("deadlineWithinDays"));
  if (Number.isInteger(days) && days > 0 && days <= 365) filters.deadlineWithinDays = days;
  const sort = params.get("sort");
  if (sort === "deadline" || sort === "newest") filters.sort = sort;
  return filters;
}

/** Parse bounded public-directory pagination independently from search filters. */
export function parsePagination(params: URLSearchParams): Pagination {
  const rawPage = Number(params.get("page"));
  const rawPageSize = Number(params.get("pageSize"));
  return {
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize:
      Number.isInteger(rawPageSize) && rawPageSize > 0
        ? Math.min(rawPageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE,
  };
}

/** Canonical URL representation shared by SSR, the API, and the client UI. */
export function filtersToSearchParams(
  filters: Filters,
  pagination?: Partial<Pagination>,
): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  if (q) params.set("q", q.slice(0, 200));
  for (const keyword of normalizeKeywords(filters.keywords ?? [])) {
    params.append("keyword", keyword);
  }
  for (const key of ["category", "format", "cost", "compensation", "city", "schedule"] as const) {
    if (filters[key]) params.set(key, String(filters[key]));
  }
  if (filters.grade) params.set("grade", String(filters.grade));
  if (filters.deadlineWithinDays) params.set("deadlineWithinDays", String(filters.deadlineWithinDays));
  if (filters.sort && filters.sort !== "deadline") params.set("sort", filters.sort);
  if (pagination?.page && pagination.page > 1) params.set("page", String(pagination.page));
  if (pagination?.pageSize && pagination.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(Math.min(pagination.pageSize, MAX_PAGE_SIZE)));
  }
  return params;
}

export function hasActiveFilters(filters: Filters): boolean {
  return Boolean(
    filters.q ||
      filters.keywords?.length ||
      filters.category ||
      filters.format ||
      filters.cost ||
      filters.compensation ||
      filters.city ||
      filters.grade ||
      filters.schedule ||
      filters.deadlineWithinDays,
  );
}

/** Publicly visible = approved and not past its deadline (rolling counts as open). */
export function visibleCondition(): SQL {
  return and(
    eq(opportunities.status, "approved"),
    or(isNull(opportunities.applicationDeadline), sql`${opportunities.applicationDeadline} >= date('now')`),
  )!;
}

export function buildConditions(filters: Filters): SQL[] {
  const conditions: SQL[] = [visibleCondition()];

  const tokens = [
    ...(filters.q?.toLowerCase().split(/\s+/).filter((t) => t.length > 1) ?? []),
    ...(filters.keywords?.map((k) => k.toLowerCase()).filter((t) => t.length > 1) ?? []),
  ].slice(0, 8);
  for (const token of tokens) {
    const pat = `%${token}%`;
    conditions.push(
      or(
        sql`lower(${opportunities.title}) like ${pat}`,
        sql`lower(${opportunities.description}) like ${pat}`,
        sql`lower(coalesce(${opportunities.whatYoullDo}, '')) like ${pat}`,
        sql`lower(coalesce(${opportunities.interestTags}, '')) like ${pat}`,
        sql`lower(${organizations.name}) like ${pat}`,
        sql`lower(${opportunities.city}) like ${pat}`,
      )!,
    );
  }

  if (filters.category) conditions.push(eq(opportunities.category, filters.category));
  if (filters.format) conditions.push(eq(opportunities.format, filters.format));
  if (filters.cost) conditions.push(eq(opportunities.costType, filters.cost));
  if (filters.compensation === "any_pay") {
    conditions.push(sql`${opportunities.compensation} in ('stipend', 'paid')`);
  } else if (filters.compensation) {
    conditions.push(eq(opportunities.compensation, filters.compensation));
  }
  if (filters.city) conditions.push(eq(opportunities.city, filters.city));
  if (filters.schedule) conditions.push(eq(opportunities.schedule, filters.schedule));

  if (filters.grade) {
    const g = filters.grade;
    // Rows may specify grades, ages, or neither. Approximate age from grade
    // (US: grade + 5..6) so age-bounded rows still match a grade filter.
    const ageLow = g + 5;
    const ageHigh = g + 6;
    conditions.push(
      or(
        // no eligibility bounds at all -> assume open
        sql`(${opportunities.gradeMin} is null and ${opportunities.gradeMax} is null and ${opportunities.ageMin} is null and ${opportunities.ageMax} is null)`,
        // grade-bounded rows
        sql`((${opportunities.gradeMin} is not null or ${opportunities.gradeMax} is not null)
            and (${opportunities.gradeMin} is null or ${opportunities.gradeMin} <= ${g})
            and (${opportunities.gradeMax} is null or ${opportunities.gradeMax} >= ${g}))`,
        // age-bounded rows
        sql`((${opportunities.ageMin} is not null or ${opportunities.ageMax} is not null)
            and (${opportunities.ageMin} is null or ${opportunities.ageMin} <= ${ageHigh})
            and (${opportunities.ageMax} is null or ${opportunities.ageMax} >= ${ageLow}))`,
      )!,
    );
  }

  if (filters.deadlineWithinDays) {
    conditions.push(
      sql`${opportunities.applicationDeadline} is not null and ${opportunities.applicationDeadline} <= date('now', ${"+" + filters.deadlineWithinDays + " days"})`,
    );
  }

  return conditions;
}

export function orderBy(filters: Filters) {
  if (filters.sort === "newest") return [desc(opportunities.createdAt)];
  // default: soonest deadline first, rolling (null) last
  return [sql`${opportunities.applicationDeadline} is null`, asc(opportunities.applicationDeadline)];
}
