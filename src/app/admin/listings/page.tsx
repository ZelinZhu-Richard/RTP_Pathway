import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, organizations } from "@/db/schema";
import { fmtDate } from "@/lib/display";
import { verificationStatus } from "@/lib/taxonomy";
import { AdminNav } from "@/components/admin/AdminNav";
import { ListingActions } from "@/components/admin/ListingActions";

export const dynamic = "force-dynamic";

export default function AdminListingsPage() {
  const rows = db
    .select({ opp: opportunities, orgName: organizations.name })
    .from(opportunities)
    .innerJoin(organizations, eq(opportunities.orgId, organizations.id))
    .orderBy(asc(opportunities.title))
    .all();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <AdminNav />
      <h1 className="text-xl font-bold text-stone-900">All listings</h1>
      <p className="mt-1 mb-4 text-sm text-stone-500">
        {rows.length} total — including expired and archived listings students can&apos;t see.
      </p>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Organization</th>
              <th className="px-3 py-2">Deadline</th>
              <th className="px-3 py-2">Verification</th>
              <th className="px-3 py-2">Visibility</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ opp, orgName }) => {
              const expired = opp.applicationDeadline !== null && opp.applicationDeadline < today;
              const fresh = verificationStatus(opp.lastVerifiedAt) === "verified";
              return (
                <tr key={opp.id} id={opp.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-3 py-2">
                    <Link href={`/opportunities/${opp.slug}`} className="font-medium text-stone-800 hover:text-teal-700">
                      {opp.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-stone-500">{orgName}</td>
                  <td className="px-3 py-2 text-stone-600">
                    {opp.applicationDeadline ? fmtDate(opp.applicationDeadline) : "Rolling"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={fresh ? "text-emerald-700" : "text-amber-700"}>
                      {opp.lastVerifiedAt ? `${fresh ? "✓" : "⚠"} ${fmtDate(opp.lastVerifiedAt)}` : "⚠ never"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {opp.status === "archived" ? (
                      <span className="text-stone-400">archived</span>
                    ) : expired ? (
                      <span className="text-red-600">hidden (expired)</span>
                    ) : (
                      <span className="text-emerald-700">public</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ListingActions id={opp.id} status={opp.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
