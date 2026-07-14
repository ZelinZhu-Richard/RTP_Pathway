import taxonomyJson from "../../shared/taxonomy.json";

export interface TaxonomyEntry {
  id: string;
  label?: string;
  synonyms?: string[];
}

export const taxonomy = taxonomyJson as unknown as {
  categories: TaxonomyEntry[];
  interests: TaxonomyEntry[];
  formats: TaxonomyEntry[];
  cost_types: TaxonomyEntry[];
  compensation_types: TaxonomyEntry[];
  schedules: TaxonomyEntry[];
  cities: TaxonomyEntry[];
  report_reasons: { id: string; label: string }[];
  statuses: { opportunity: string[]; submission: string[]; report: string[] };
  verification_fresh_days: number;
};

export const CATEGORY_IDS = taxonomy.categories.map((c) => c.id);
export const FORMAT_IDS = taxonomy.formats.map((f) => f.id);
export const COST_IDS = taxonomy.cost_types.map((c) => c.id);
export const COMPENSATION_IDS = taxonomy.compensation_types.map((c) => c.id);
export const SCHEDULE_IDS = taxonomy.schedules.map((s) => s.id);
export const CITY_IDS = taxonomy.cities.map((c) => c.id);
export const REPORT_REASON_IDS = taxonomy.report_reasons.map((r) => r.id);

const labelMaps: Record<string, Map<string, string>> = {};
function labelMap(key: keyof typeof taxonomy): Map<string, string> {
  if (!labelMaps[key]) {
    const entries = taxonomy[key] as TaxonomyEntry[];
    labelMaps[key] = new Map(entries.map((e) => [e.id, e.label ?? e.id]));
  }
  return labelMaps[key];
}

export const categoryLabel = (id: string) => labelMap("categories").get(id) ?? id;
export const formatLabel = (id: string) => labelMap("formats").get(id) ?? id;
export const costLabel = (id: string) => labelMap("cost_types").get(id) ?? id;
export const compensationLabel = (id: string) => labelMap("compensation_types").get(id) ?? id;
export const scheduleLabel = (id: string) => labelMap("schedules").get(id) ?? id;
export const interestLabel = (id: string) => labelMap("interests").get(id) ?? id;

/** 'verified' when confirmed within the freshness window, else 'needs_verification'. */
export function verificationStatus(lastVerifiedAt: string | null): "verified" | "needs_verification" {
  if (!lastVerifiedAt) return "needs_verification";
  const ageMs = Date.now() - new Date(lastVerifiedAt).getTime();
  return ageMs <= taxonomy.verification_fresh_days * 24 * 60 * 60 * 1000
    ? "verified"
    : "needs_verification";
}
