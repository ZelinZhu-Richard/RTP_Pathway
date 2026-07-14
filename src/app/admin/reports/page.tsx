import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, reports } from "@/db/schema";
import { fmtDate } from "@/lib/display";
import { taxonomy } from "@/lib/taxonomy";
import { AdminNav } from "@/components/admin/AdminNav";
import { ReportActions } from "@/components/admin/ReportActions";

export const dynamic = "force-dynamic";

const reasonLabel = new Map(taxonomy.report_reasons.map((r) => [r.id, r.label]));

export default function AdminReportsPage() {
  const rows = db
    .select({ report: reports, title: opportunities.title, slug: opportunities.slug })
    .from(reports)
    .innerJoin(opportunities, eq(reports.opportunityId, opportunities.id))
    .orderBy(desc(reports.createdAt))
    .all();

  const open = rows.filter((r) => r.report.status === "open");
  const closed = rows.filter((r) => r.report.status !== "open");

  return (
    <div>
      <AdminNav />
      <h1 className="text-xl font-bold text-stone-900">User reports</h1>
      <p className="mt-1 mb-4 text-sm text-stone-500">
        {open.length} open — students and organizations help keep listings accurate.
      </p>

      {open.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          No open reports.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {open.map(({ report, title, slug }) => (
            <li key={report.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/opportunities/${slug}`} className="font-semibold text-stone-900 hover:text-teal-700">
                  {title}
                </Link>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                  {reasonLabel.get(report.reason) ?? report.reason}
                </span>
                <span className="ml-auto text-xs text-stone-400">{fmtDate(report.createdAt)}</span>
              </div>
              {report.details && <p className="mt-2 text-sm text-stone-600">“{report.details}”</p>}
              <div className="mt-3">
                <ReportActions id={report.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-stone-500">
            {closed.length} closed report{closed.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {closed.map(({ report, title }) => (
              <li key={report.id} className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-sm text-stone-500">
                {title} — {reasonLabel.get(report.reason) ?? report.reason} · {report.status}{" "}
                {report.resolvedAt && `(${fmtDate(report.resolvedAt)})`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
