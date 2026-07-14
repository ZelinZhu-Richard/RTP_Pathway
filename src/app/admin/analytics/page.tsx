import { computeAnalytics } from "@/db/analytics";
import { fmtDate } from "@/lib/display";
import { AdminNav } from "@/components/admin/AdminNav";
import { CategoryChart, CityChart, FreshnessChart, SearchChart } from "@/components/admin/Charts";

export const dynamic = "force-dynamic";

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className={`text-2xl font-bold ${tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-stone-900"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-stone-500">{label}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
      {subtitle && <p className="mb-2 text-xs text-stone-500">{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function AnalyticsPage() {
  const a = computeAnalytics();

  return (
    <div>
      <AdminNav />
      <h1 className="text-xl font-bold text-stone-900">Community analytics</h1>
      <p className="mt-1 mb-4 text-sm text-stone-500">{a.note}</p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Active listings" value={a.totals.activeListings} />
        <StatTile
          label="Recently verified"
          value={`${a.totals.verifiedFreshPct}%`}
          tone={a.totals.verifiedFreshPct < 50 ? "warn" : undefined}
        />
        <StatTile label="Pending submissions" value={a.totals.pendingSubmissions} tone={a.totals.pendingSubmissions > 0 ? "warn" : undefined} />
        <StatTile label="Open reports" value={a.totals.openReports} tone={a.totals.openReports > 0 ? "bad" : undefined} />
        <StatTile label="Searches (30d)" value={a.totals.searches30d} />
        <StatTile label="…with zero results" value={a.totals.zeroResultSearches30d} tone={a.totals.zeroResultSearches30d > 0 ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Opportunities by category" subtitle="Active listings only — what the community currently offers">
          <CategoryChart data={a.byCategory} />
        </ChartCard>
        <ChartCard title="Opportunities by city" subtitle="Geographic spread across the Triangle">
          <CityChart data={a.byCity} />
        </ChartCard>
        <ChartCard title="Most common student searches" subtitle="Last 30 days, anonymous — what students are looking for">
          {a.topSearches.length ? (
            <SearchChart data={a.topSearches} />
          ) : (
            <p className="py-6 text-center text-sm text-stone-400">No searches recorded yet.</p>
          )}
        </ChartCard>
        <ChartCard
          title="Searches with no matching results"
          subtitle="Unmet demand — share this list with local organizations"
        >
          {a.zeroResultSearches.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-1.5 pr-2">Search</th>
                  <th className="py-1.5 text-right">Times searched</th>
                </tr>
              </thead>
              <tbody>
                {a.zeroResultSearches.map((s, i) => (
                  <tr key={i} className="border-b border-stone-100 last:border-0">
                    <td className="py-1.5 pr-2 text-stone-700">{s.label}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-stone-800">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-stone-400">Every search so far found at least one match.</p>
          )}
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard title="Listing freshness" subtitle="Verification and expiry state of every listing in the database">
          <FreshnessChart data={a.freshness} />
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard title="Recent admin activity">
          {a.recentAudit.length ? (
            <ul className="text-sm text-stone-600">
              {a.recentAudit.map((e, i) => (
                <li key={i} className="border-b border-stone-100 py-1 last:border-0">
                  <span className="font-medium text-stone-800">{e.action.replaceAll("_", " ")}</span>{" "}
                  <span className="text-stone-400">· {e.entityType} · {fmtDate(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-stone-400">No admin activity yet.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
