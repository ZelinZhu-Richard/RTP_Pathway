import Link from "next/link";
import { redirect } from "next/navigation";
import {
  countVisibleByCategory,
  countVisibleOpportunities,
  nextDeadline,
} from "@/db/queries";
import { TriangleMap } from "@/components/TriangleMap";
import { fmtDate } from "@/lib/display";
import { taxonomy } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STEPS: [string, string, string][] = [
  ["1", "Submit", "Organizations share structured fields or paste an existing program description."],
  ["2", "Verify", "An administrator reviews sources, missing details, and possible duplicates."],
  ["3", "Search", "Students use filters or Claude-assisted search against approved database records."],
  ["4", "Analyze", "Anonymous completed searches reveal directional supply and demand gaps."],
];

export default async function HomePage({ searchParams }: HomePageProps) {
  // Filter URLs used to live at "/". Shared bookmarks like /?category=…&page=2
  // keep working by landing on the explorer with the same query.
  const rawParams = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") urlParams.set(key, value);
    else if (Array.isArray(value)) for (const v of value) urlParams.append(key, v);
  }
  const legacyQuery = urlParams.toString();
  if (legacyQuery) redirect(`/explore?${legacyQuery}`);

  const total = countVisibleOpportunities();
  const byCategory = new Map(countVisibleByCategory().map((row) => [row.category, row.n]));
  const activeCategories = [...byCategory.values()].filter((n) => n > 0).length;
  const upcoming = nextDeadline();

  return (
    <div className="flex flex-col gap-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-pine-deep to-pine text-white">
        <div className="grid items-center gap-8 px-6 py-12 sm:px-10 sm:py-14 lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col items-start gap-5">
            <p
              className="anim-rise font-mono text-[11px] tracking-[0.25em] text-teal-200/90"
              style={{ animationDelay: "0s" }}
            >
              CHAPEL HILL · CARRBORO · DURHAM · RALEIGH
            </p>
            <h1
              className="anim-rise font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl"
              style={{ animationDelay: "0.08s" }}
            >
              Find your place in the Triangle.
            </h1>
            <p className="anim-rise max-w-xl text-teal-50/90" style={{ animationDelay: "0.16s" }}>
              Internships, volunteer roles, scholarships, and summer programs for high-school
              students — every listing checked by a person and linked to its original source.
              Free to browse, no account needed.
            </p>
            <div className="anim-rise flex flex-wrap gap-3" style={{ animationDelay: "0.24s" }}>
              <Link
                href="/explore"
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-pine shadow-sm hover:bg-teal-50 hover:shadow"
              >
                Start exploring
              </Link>
              <Link
                href="#how-it-works"
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-teal-100 ring-1 ring-teal-200/40 hover:bg-white/10"
              >
                How listings are checked
              </Link>
            </div>
          </div>
          <div className="anim-rise mx-auto w-full max-w-[520px]" style={{ animationDelay: "0.3s" }}>
            <TriangleMap />
          </div>
        </div>
      </section>

      <section
        aria-label="Live directory numbers"
        className="anim-rise flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-stone-200 bg-white px-5 py-3.5 font-mono text-xs text-stone-600 sm:text-[13px]"
        style={{ animationDelay: "0.4s" }}
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
          {total} {total === 1 ? "opportunity" : "opportunities"} open now
        </span>
        {upcoming && (
          <span>
            next deadline {fmtDate(upcoming.applicationDeadline, { year: undefined })} —{" "}
            <Link
              href={`/opportunities/${upcoming.slug}`}
              className="text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-800"
            >
              {upcoming.title}
            </Link>
          </span>
        )}
        <span>
          {activeCategories} of {taxonomy.categories.length} categories active
        </span>
        <span className="text-stone-400">free · no account needed</span>
      </section>

      <section aria-labelledby="ways-in" className="reveal">
        <h2 id="ways-in" className="font-display text-2xl font-bold text-stone-900">
          Pick a starting point
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Every tile opens the same verified directory — it just sets your first filter.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {taxonomy.categories.map((category) => {
            const count = byCategory.get(category.id) ?? 0;
            return (
              <li key={category.id}>
                <Link
                  href={`/explore?category=${category.id}`}
                  className="group flex h-full flex-col gap-1 rounded-xl border border-stone-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
                >
                  <span className="font-semibold text-stone-900 group-hover:text-teal-800">
                    {category.label ?? category.id}
                  </span>
                  <span className={`font-mono text-xs ${count === 0 ? "text-stone-400" : "text-stone-500"}`}>
                    {count === 0 ? "none right now" : `${count} open`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="how-it-works" id="how-it-works" className="reveal scroll-mt-24">
        <h2 className="font-display text-2xl font-bold text-stone-900">
          How a listing earns its place
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          One transparent workflow keeps opportunity data useful without letting AI invent
          listings — Claude helps search and extract, people decide what publishes.
        </p>
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([number, title, body]) => (
            <li
              key={number}
              className="relative rounded-xl bg-white p-4 ring-1 ring-stone-200 lg:after:absolute lg:after:top-7 lg:after:-right-4 lg:after:h-px lg:after:w-4 lg:after:bg-stone-300 lg:after:content-[''] lg:last:after:hidden"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foam font-mono text-xs font-bold text-teal-800">
                {number}
              </span>
              <h3 className="mt-2 font-semibold text-stone-900">{title}</h3>
              <p className="mt-1 text-sm text-stone-600">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-stone-500">
          Every listing shows its <span className="font-medium text-stone-700">last-verified date</span> and
          links back to the original source. Listings past their deadline leave the directory
          automatically.
        </p>
      </section>

      <section aria-labelledby="for-organizations" className="reveal overflow-hidden rounded-3xl bg-pine text-white">
        <div className="flex flex-wrap items-center justify-between gap-6 px-6 py-10 sm:px-10">
          <div className="max-w-xl">
            <h2 id="for-organizations" className="font-display text-2xl font-bold">
              Run a program for Triangle teens?
            </h2>
            <p className="mt-2 text-sm text-teal-100/90">
              Submit it once. It goes through the same human review as everything else, and the
              published listing stays linked to your original posting.
            </p>
          </div>
          <Link
            href="/submit"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-pine shadow-sm hover:bg-teal-50 hover:shadow"
          >
            Submit an opportunity
          </Link>
        </div>
      </section>
    </div>
  );
}
