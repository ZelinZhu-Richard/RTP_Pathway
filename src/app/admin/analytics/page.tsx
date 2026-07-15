import { computeAnalytics } from "@/db/analytics";
import { fmtDate } from "@/lib/display";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  CategoryChart,
  CityChart,
  DemandSupplyChart,
  FreshnessChart,
  SearchChart,
} from "@/components/admin/Charts";

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
      <p className="mt-1 text-sm text-stone-600">{a.note}</p>
      <ul className="mt-2 mb-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        {a.caveats.map((caveat) => <li key={caveat}>• {caveat}</li>)}
      </ul>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
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
        <StatTile
          label="Categorized coverage"
          value={`${a.searchCoverage.percentage}%`}
          tone={a.totals.searches30d > 0 && a.searchCoverage.percentage < 50 ? "warn" : undefined}
        />
        <StatTile
          label="Failed Sheet syncs"
          value={a.totals.failedSheetSyncs}
          tone={a.totals.failedSheetSyncs > 0 ? "bad" : undefined}
        />
      </div>

      <div className="mb-4">
        <ChartCard
          title="Category demand compared with active supply"
          subtitle={`${a.searchCoverage.categorizedSearches30d} of ${a.searchCoverage.totalSearches30d} completed searches had a category in the last 30 days`}
        >
          {a.demandSupplyByCategory.length ? (
            <>
              <DemandSupplyChart data={a.demandSupplyByCategory} />
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">Category demand, active supply, zero-result demand, and demand per listing</caption>
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                      <th scope="col" className="py-1.5 pr-3">Category</th>
                      <th scope="col" className="py-1.5 px-3 text-right">Searches</th>
                      <th scope="col" className="py-1.5 px-3 text-right">Active listings</th>
                      <th scope="col" className="py-1.5 px-3 text-right">Zero-result</th>
                      <th scope="col" className="py-1.5 pl-3 text-right">Demand / listing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.demandSupplyByCategory.map((row) => (
                      <tr key={row.key} className="border-b border-stone-100 last:border-0">
                        <th scope="row" className="py-1.5 pr-3 text-left font-medium text-stone-800">{row.label}</th>
                        <td className="py-1.5 px-3 text-right tabular-nums">{row.searches}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{row.activeListings}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{row.zeroResultSearches}</td>
                        <td className="py-1.5 pl-3 text-right font-medium tabular-nums">
                          {row.noSupply ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 ring-1 ring-red-200">No supply</span>
                          ) : row.demandPerListing === null ? "—" : row.demandPerListing.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-stone-400">No categorized search or supply data yet.</p>
          )}
        </ChartCard>
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
        <ChartCard title="Latest Python pipeline import" subtitle="Most recent clean/merge/import run recorded in the audit log">
          {a.latestPipelineImport ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <div><dt className="text-xs text-stone-500">Imported</dt><dd className="font-semibold text-stone-900">{a.latestPipelineImport.inserted}</dd></div>
              <div><dt className="text-xs text-stone-500">Queued</dt><dd className="font-semibold text-stone-900">{a.latestPipelineImport.queued}</dd></div>
              <div><dt className="text-xs text-stone-500">Skipped</dt><dd className="font-semibold text-stone-900">{a.latestPipelineImport.skipped}</dd></div>
              <div><dt className="text-xs text-stone-500">Input rows</dt><dd className="font-semibold text-stone-900">{a.latestPipelineImport.rows ?? "—"}</dd></div>
              <div><dt className="text-xs text-stone-500">Completed</dt><dd className="font-semibold text-stone-900">{fmtDate(a.latestPipelineImport.createdAt)}</dd></div>
              <div className="col-span-2 sm:col-span-5">
                <dt className="text-xs text-stone-500">Sources</dt>
                <dd className="text-stone-700">{a.latestPipelineImport.sources.join(", ") || "Not recorded"}</dd>
              </div>
            </dl>
          ) : (
            <p className="py-4 text-center text-sm text-stone-400">No pipeline import audit has been recorded yet.</p>
          )}
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
