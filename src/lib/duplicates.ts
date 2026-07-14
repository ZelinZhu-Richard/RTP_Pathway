import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, organizations } from "@/db/schema";

// TS counterpart of the pipeline's duplicate rules (pipeline/clean_csv.py):
// same normalized application URL, or same normalized org + similar title.

export interface DuplicateWarning {
  opportunityId: string;
  title: string;
  score: number;
  reason: string;
}

export function normalizeOrgName(name: string): string {
  let n = name.toLowerCase().trim().replace(/&/g, " and ");
  n = n.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  return n.startsWith("the ") ? n.slice(4) : n;
}

export function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dice coefficient over character bigrams — a close stand-in for difflib's ratio. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const bigrams = (s: string) => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      map.set(bg, (map.get(bg) ?? 0) + 1);
    }
    return map;
  };
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let overlap = 0;
  for (const [bg, count] of ba) overlap += Math.min(count, bb.get(bg) ?? 0);
  return (2 * overlap) / (na.length - 1 + nb.length - 1);
}

export function findDuplicates(candidate: {
  title?: string | null;
  orgName?: string | null;
  applicationUrl?: string | null;
}): DuplicateWarning[] {
  const rows = db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      applicationUrl: opportunities.applicationUrl,
      orgName: organizations.name,
    })
    .from(opportunities)
    .innerJoin(organizations, eq(opportunities.orgId, organizations.id))
    .where(eq(opportunities.status, "approved"))
    .all();

  const warnings: DuplicateWarning[] = [];
  const candUrl = candidate.applicationUrl ? normalizeUrl(candidate.applicationUrl) : null;
  const candOrg = candidate.orgName ? normalizeOrgName(candidate.orgName) : null;

  for (const row of rows) {
    if (candUrl && row.applicationUrl && normalizeUrl(row.applicationUrl) === candUrl) {
      warnings.push({ opportunityId: row.id, title: row.title, score: 1, reason: "same application URL" });
      continue;
    }
    if (candOrg && candidate.title && normalizeOrgName(row.orgName) === candOrg) {
      const score = titleSimilarity(candidate.title, row.title);
      if (score >= 0.8) {
        warnings.push({
          opportunityId: row.id,
          title: row.title,
          score: Math.round(score * 100) / 100,
          reason: `same organization + similar title (${score.toFixed(2)})`,
        });
      }
    }
  }
  return warnings.slice(0, 5);
}
