import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, organizations, type OpportunityRow } from "@/db/schema";
import { Filters, buildConditions, orderBy, visibleCondition } from "@/lib/search";

export interface OpportunityCard {
  id: string;
  slug: string;
  title: string;
  orgName: string;
  category: string;
  interestTags: string[];
  format: string;
  city: string;
  costType: string;
  costAmount: string | null;
  compensation: string;
  compensationDetail: string | null;
  gradeMin: number | null;
  gradeMax: number | null;
  ageMin: number | null;
  ageMax: number | null;
  schedule: string | null;
  timeCommitment: string | null;
  applicationDeadline: string | null;
  lastVerifiedAt: string | null;
  sourceUrl: string | null;
}

function toCard(row: { opp: OpportunityRow; orgName: string }): OpportunityCard {
  const o = row.opp;
  return {
    id: o.id,
    slug: o.slug,
    title: o.title,
    orgName: row.orgName,
    category: o.category,
    interestTags: safeParseArray(o.interestTags),
    format: o.format,
    city: o.city,
    costType: o.costType,
    costAmount: o.costAmount,
    compensation: o.compensation,
    compensationDetail: o.compensationDetail,
    gradeMin: o.gradeMin,
    gradeMax: o.gradeMax,
    ageMin: o.ageMin,
    ageMax: o.ageMax,
    schedule: o.schedule,
    timeCommitment: o.timeCommitment,
    applicationDeadline: o.applicationDeadline,
    lastVerifiedAt: o.lastVerifiedAt,
    sourceUrl: o.sourceUrl,
  };
}

export function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function searchOpportunities(filters: Filters, limit = 60): { results: OpportunityCard[]; total: number } {
  const conditions = buildConditions(filters);
  const rows = db
    .select({ opp: opportunities, orgName: organizations.name })
    .from(opportunities)
    .innerJoin(organizations, eq(opportunities.orgId, organizations.id))
    .where(and(...conditions))
    .orderBy(...orderBy(filters))
    .limit(limit)
    .all();
  return { results: rows.map(toCard), total: rows.length };
}

export function getOpportunityBySlug(slug: string) {
  const row = db
    .select({ opp: opportunities, org: organizations })
    .from(opportunities)
    .innerJoin(organizations, eq(opportunities.orgId, organizations.id))
    .where(eq(opportunities.slug, slug))
    .get();
  return row ?? null;
}

export function getOpportunityById(id: string) {
  const row = db
    .select({ opp: opportunities, org: organizations })
    .from(opportunities)
    .innerJoin(organizations, eq(opportunities.orgId, organizations.id))
    .where(eq(opportunities.id, id))
    .get();
  return row ?? null;
}

export function getOpportunitiesByIds(ids: string[]): OpportunityCard[] {
  if (ids.length === 0) return [];
  const rows = db
    .select({ opp: opportunities, orgName: organizations.name })
    .from(opportunities)
    .innerJoin(organizations, eq(opportunities.orgId, organizations.id))
    .where(sql`${opportunities.id} in ${ids}`)
    .all();
  return rows.map(toCard);
}

/** Is this opportunity publicly visible right now? (approved + deadline not passed) */
export function isPubliclyVisible(opp: OpportunityRow): boolean {
  if (opp.status !== "approved") return false;
  if (!opp.applicationDeadline) return true;
  return opp.applicationDeadline >= new Date().toISOString().slice(0, 10);
}

export function countVisibleOpportunities(): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(opportunities)
    .where(visibleCondition())
    .get();
  return row?.n ?? 0;
}

export function latestOpportunities(limit = 6): OpportunityCard[] {
  const rows = db
    .select({ opp: opportunities, orgName: organizations.name })
    .from(opportunities)
    .innerJoin(organizations, eq(opportunities.orgId, organizations.id))
    .where(visibleCondition())
    .orderBy(desc(opportunities.createdAt))
    .limit(limit)
    .all();
  return rows.map(toCard);
}
