"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { taxonomy } from "@/lib/taxonomy";

interface Props {
  submissionId: string;
  initialFields: Record<string, string>;
  missingFields: string[];
  duplicateWarnings: { opportunityId?: string; title?: string; reason?: string }[];
}

const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none";

const ENUM_FIELDS: Record<string, { id: string; label?: string }[]> = {
  category: taxonomy.categories,
  city: taxonomy.cities,
  format: taxonomy.formats,
  costType: taxonomy.cost_types,
  compensation: taxonomy.compensation_types,
  schedule: taxonomy.schedules,
};

const FIELD_ORDER: { key: string; label: string; kind?: "textarea" | "date" | "number" }[] = [
  { key: "orgName", label: "Organization" },
  { key: "title", label: "Title" },
  { key: "description", label: "Description", kind: "textarea" },
  { key: "category", label: "Category" },
  { key: "city", label: "City" },
  { key: "format", label: "Format" },
  { key: "locationDetail", label: "Location detail" },
  { key: "costType", label: "Cost type" },
  { key: "costAmount", label: "Cost details" },
  { key: "compensation", label: "Compensation" },
  { key: "compensationDetail", label: "Compensation details" },
  { key: "schedule", label: "Schedule" },
  { key: "timeCommitment", label: "Time commitment" },
  { key: "gradeMin", label: "Grade min", kind: "number" },
  { key: "gradeMax", label: "Grade max", kind: "number" },
  { key: "ageMin", label: "Age min", kind: "number" },
  { key: "ageMax", label: "Age max", kind: "number" },
  { key: "eligibilityNotes", label: "Eligibility notes" },
  { key: "whatYoullDo", label: "What you'll do", kind: "textarea" },
  { key: "howToApply", label: "How to apply", kind: "textarea" },
  { key: "applicationUrl", label: "Application URL" },
  { key: "contactEmail", label: "Contact email" },
  { key: "sourceUrl", label: "Source URL" },
  { key: "transportationNotes", label: "Transportation notes" },
  { key: "applicationDeadline", label: "Application deadline", kind: "date" },
  { key: "startDate", label: "Start date", kind: "date" },
  { key: "endDate", label: "End date", kind: "date" },
];

export function ReviewForm({ submissionId, initialFields, missingFields, duplicateWarnings }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<Record<string, string>>(initialFields);
  const [rolling, setRolling] = useState(initialFields.deadlineType === "rolling");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const numeric = (v: string | undefined) => (v ? Number(v) : undefined);
      const body =
        action === "approve"
          ? {
              action,
              fields: {
                ...Object.fromEntries(
                  Object.entries(fields).filter(
                    ([k, v]) => v !== "" && !["gradeMin", "gradeMax", "ageMin", "ageMax", "deadlineType"].includes(k),
                  ),
                ),
                gradeMin: numeric(fields.gradeMin),
                gradeMax: numeric(fields.gradeMax),
                ageMin: numeric(fields.ageMin),
                ageMax: numeric(fields.ageMax),
                deadlineType: rolling ? "rolling" : "specific",
              },
            }
          : { action, note: note || undefined };
      const res = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.missingFields ? `Cannot publish — missing: ${data.missingFields.join(", ")}` : (data.error ?? "Action failed"),
        );
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {missingFields.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          Flagged as missing at submission: {missingFields.join(", ")}
        </div>
      )}
      {duplicateWarnings.length > 0 && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
          <p className="font-medium">Possible duplicates:</p>
          <ul className="mt-1 list-inside list-disc">
            {duplicateWarnings.map((d, i) => (
              <li key={i}>
                {d.opportunityId ? (
                  <Link href={`/admin/listings#${d.opportunityId}`} className="underline">
                    {d.title ?? d.opportunityId}
                  </Link>
                ) : (
                  (d.title ?? "existing listing")
                )}{" "}
                — {d.reason}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">If this really is a duplicate, reject it with a note.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELD_ORDER.map(({ key, label, kind }) => {
          const missing = !fields[key] && missingFields.some((m) => m.toLowerCase().includes(label.toLowerCase().split(" ")[0]));
          if (key === "applicationDeadline") {
            return (
              <label key={key} className="flex flex-col gap-1 text-xs font-medium text-stone-600">
                <span>
                  {label}
                  {missing && <span className="text-amber-600"> (missing)</span>}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    disabled={rolling}
                    className={inputCls + (rolling ? " opacity-40" : "")}
                    value={fields[key] ?? ""}
                    onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                  />
                  <label className="flex shrink-0 items-center gap-1 font-normal">
                    <input type="checkbox" checked={rolling} onChange={(e) => setRolling(e.target.checked)} />
                    rolling
                  </label>
                </div>
              </label>
            );
          }
          return (
            <label
              key={key}
              className={`flex flex-col gap-1 text-xs font-medium text-stone-600 ${kind === "textarea" ? "sm:col-span-2" : ""}`}
            >
              <span>
                {label}
                {missing && <span className="text-amber-600"> (missing)</span>}
              </span>
              {ENUM_FIELDS[key] ? (
                <select
                  className={inputCls}
                  value={fields[key] ?? ""}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                >
                  <option value="">— select —</option>
                  {ENUM_FIELDS[key].map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label ?? e.id}
                    </option>
                  ))}
                </select>
              ) : kind === "textarea" ? (
                <textarea
                  rows={3}
                  className={inputCls}
                  value={fields[key] ?? ""}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                />
              ) : (
                <input
                  type={kind ?? "text"}
                  className={inputCls}
                  value={fields[key] ?? ""}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                />
              )}
            </label>
          );
        })}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={busy !== null}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === "approve" ? "Publishing…" : "Approve & publish"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Rejection note (optional)"
            className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={() => act("reject")}
            disabled={busy !== null}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
