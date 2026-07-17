import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  countVisibleByCategory,
  countVisibleOpportunities,
  nextDeadline,
} from "@/db/queries";
import {
  LandingExperience,
  type LandingCategory,
} from "@/components/landing/LandingExperience";
import { fmtDate } from "@/lib/display";
import { taxonomy } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RTP Pathway — find your place in the Triangle",
  description:
    "A community-powered directory for Triangle high-school students to discover local internships, jobs, service, scholarships, mentorship, and programs.",
};

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const LEGACY_DIRECTORY_KEYS = new Set([
  "q",
  "keyword",
  "keywords",
  "category",
  "format",
  "cost",
  "compensation",
  "city",
  "grade",
  "schedule",
  "deadlineWithinDays",
  "sort",
  "page",
  "pageSize",
]);

export default async function HomePage({ searchParams }: HomePageProps) {
  // Filter URLs used to live at "/". Keep those bookmarks working without
  // sending ordinary campaign/referral parameters away from the landing page.
  const rawParams = await searchParams;
  const legacyParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (!LEGACY_DIRECTORY_KEYS.has(key)) continue;
    if (typeof value === "string") legacyParams.set(key, value);
    else if (Array.isArray(value)) for (const entry of value) legacyParams.append(key, entry);
  }
  const legacyQuery = legacyParams.toString();
  if (legacyQuery) redirect("/explore?" + legacyQuery);

  const total = countVisibleOpportunities();
  const byCategory = new Map(countVisibleByCategory().map((row) => [row.category, row.n]));
  const activeCategories = [...byCategory.values()].filter((count) => count > 0).length;
  const next = nextDeadline();
  const categories: LandingCategory[] = taxonomy.categories.map((category) => ({
    id: category.id,
    label: category.label ?? category.id,
    count: byCategory.get(category.id) ?? 0,
  }));

  return (
    <LandingExperience
      total={total}
      activeCategories={activeCategories}
      categories={categories}
      upcoming={
        next
          ? {
              title: next.title,
              slug: next.slug,
              date: fmtDate(next.applicationDeadline, { year: undefined }),
            }
          : null
      }
    />
  );
}
