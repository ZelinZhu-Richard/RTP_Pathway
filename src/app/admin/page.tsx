import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { submissions } from "@/db/schema";
import { safeParseArray } from "@/db/queries";
import { fmtDate } from "@/lib/display";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default function AdminQueuePage() {
  const pending = db
    .select()
    .from(submissions)
    .where(eq(submissions.status, "pending"))
    .orderBy(desc(submissions.createdAt))
    .all();

  return (
    <div>
      <AdminNav />
      <h1 className="text-xl font-bold text-stone-900">Review queue</h1>
      <p className="mt-1 mb-4 text-sm text-stone-500">
        {pending.length} pending submission{pending.length === 1 ? "" : "s"} — nothing goes public
        without review.
      </p>

      {pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          Queue is empty. 🎉
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((s) => {
            const raw = safeParse(s.rawFields);
            const missing = safeParseArray(s.missingFields);
            const dups = safeParseObjects(s.duplicateWarnings);
            const title = (raw?.title as string) ?? "(untitled)";
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/submissions/${s.id}`}
                  className="block rounded-xl border border-stone-200 bg-white p-4 transition hover:border-teal-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900">{title}</span>
                    <span className="text-sm text-stone-500">{s.orgName ?? "unknown org"}</span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                        s.source === "csv_import"
                          ? "bg-violet-50 text-violet-700 ring-violet-200"
                          : "bg-sky-50 text-sky-700 ring-sky-200"
                      }`}
                    >
                      {s.source === "csv_import" ? "CSV import" : "Web form"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {missing.length > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200">
                        Missing: {missing.join(", ")}
                      </span>
                    )}
                    {dups.length > 0 && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700 ring-1 ring-red-200">
                        ⚠ Possible duplicate of “{String(dups[0].title ?? "existing listing")}”
                      </span>
                    )}
                    {s.extractedFields && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-700 ring-1 ring-teal-200">
                        AI-extracted fields available
                      </span>
                    )}
                    <span className="text-stone-400">Submitted {fmtDate(s.createdAt)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function safeParse(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return typeof v === "object" && v !== null ? v : null;
  } catch {
    return null;
  }
}

function safeParseObjects(text: string | null): Record<string, unknown>[] {
  if (!text) return [];
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v.filter((x) => typeof x === "object" && x !== null) : [];
  } catch {
    return [];
  }
}
