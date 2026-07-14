import { countVisibleOpportunities, searchOpportunities } from "@/db/queries";
import { DirectoryExplorer } from "@/components/DirectoryExplorer";
import { NLSearchBox } from "@/components/NLSearchBox";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const { results } = searchOpportunities({});
  const total = countVisibleOpportunities();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-gradient-to-br from-teal-800 to-teal-600 px-6 py-8 text-white">
        <h1 className="text-2xl font-bold sm:text-3xl">
          Find your next opportunity in the Triangle.
        </h1>
        <p className="mt-2 max-w-2xl text-teal-50">
          {total} verified internships, volunteer roles, scholarships, and programs for high-school
          students in Chapel Hill, Durham, Raleigh, and nearby — every listing links back to its
          original source.
        </p>
        <div className="mt-4">
          <NLSearchBox />
        </div>
      </section>

      <DirectoryExplorer initialResults={results} />
    </div>
  );
}
