import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { submissions } from "@/db/schema";
import { fmtDate } from "@/lib/display";
import { AdminNav } from "@/components/admin/AdminNav";
import { ReviewForm } from "@/components/admin/ReviewForm";

export const dynamic = "force-dynamic";

// Fields the review form edits — extracted values fill gaps in the raw form data.
function mergeFields(raw: Record<string, unknown> | null, extracted: Record<string, unknown> | null) {
  const merged: Record<string, string> = {};
  for (const source of [extracted, raw]) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === undefined || key === "assumptions" || key === "raw_category") continue;
      merged[camel(key)] = String(value);
    }
  }
  return merged;
}

// csv_import submissions store snake_case keys; the form uses camelCase.
function camel(key: string): string {
  const map: Record<string, string> = {
    org_name: "orgName",
    cost_type: "costType",
    cost_amount: "costAmount",
    time_commitment: "timeCommitment",
    eligibility_notes: "eligibilityNotes",
    application_url: "applicationUrl",
    source_url: "sourceUrl",
    contact_email: "contactEmail",
    application_deadline: "applicationDeadline",
    start_date: "startDate",
    end_date: "endDate",
    transportation_notes: "transportationNotes",
  };
  return map[key] ?? key;
}

function parse(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return typeof v === "object" && v !== null ? v : null;
  } catch {
    return null;
  }
}

export default async function SubmissionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = db.select().from(submissions).where(eq(submissions.id, id)).get();
  if (!submission) notFound();

  const raw = parse(submission.rawFields);
  const extracted = parse(submission.extractedFields);
  const missing = (parse(submission.missingFields) as unknown as string[] | null) ?? [];
  const dups = (parse(submission.duplicateWarnings) as unknown as { opportunityId?: string; title?: string; reason?: string }[] | null) ?? [];

  return (
    <div>
      <AdminNav />
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <h1 className="text-xl font-bold text-stone-900">Review submission</h1>
        <span className="text-sm text-stone-500">
          via {submission.source === "csv_import" ? "CSV import" : "web form"} · {fmtDate(submission.createdAt)}
          {submission.submitterName && ` · from ${submission.submitterName}`}
          {submission.submitterEmail && ` (${submission.submitterEmail})`}
        </span>
        {submission.status !== "pending" && (
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
            already {submission.status}
          </span>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {submission.messyText && (
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Original submitted text
            </h2>
            <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-stone-700">
              {submission.messyText}
            </p>
          </div>
        )}
        {extracted && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
              Claude-extracted fields (prefilled below)
            </h2>
            <dl className="max-h-64 overflow-y-auto text-sm">
              {Object.entries(extracted)
                .filter(([k, v]) => v !== null && k !== "assumptions")
                .map(([k, v]) => (
                  <div key={k} className="flex gap-2 border-b border-teal-100 py-0.5 last:border-0">
                    <dt className="w-40 shrink-0 font-medium text-stone-500">{k}</dt>
                    <dd className="text-stone-800">{String(v)}</dd>
                  </div>
                ))}
            </dl>
            {Array.isArray(extracted.assumptions) && extracted.assumptions.length > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Model notes: {(extracted.assumptions as string[]).join("; ")}
              </p>
            )}
          </div>
        )}
      </div>

      <ReviewForm
        submissionId={submission.id}
        initialFields={mergeFields(raw, extracted)}
        missingFields={missing}
        duplicateWarnings={dups}
      />
    </div>
  );
}
