"use client";

import { useState } from "react";
import type { ListingFields } from "@/lib/submissionSchema";
import { taxonomy } from "@/lib/taxonomy";

type Extraction = {
  fields: Record<string, unknown> | null;
  missingFields: string[];
  usedClaude: boolean;
  notice?: string;
};

type SubmitResult = {
  id: string;
  missingFields: string[];
  duplicateWarnings: { title: string; reason: string }[];
};

const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none";
const labelCls = "flex flex-col gap-1 text-xs font-medium text-stone-600";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className={labelCls}>
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function EnumSelect({
  value,
  onChange,
  entries,
}: {
  value: string;
  onChange: (v: string) => void;
  entries: { id: string; label?: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">— select —</option>
      {entries.map((e) => (
        <option key={e.id} value={e.id}>
          {e.label ?? e.id}
        </option>
      ))}
    </select>
  );
}

export function SubmitForm() {
  const [fields, setFields] = useState<Record<string, string>>({ deadlineType: "specific" });
  const [submitter, setSubmitter] = useState({ name: "", email: "" });
  const [messyText, setMessyText] = useState("");
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [pendingOverwrites, setPendingOverwrites] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string) => (value: string) => setFields((f) => ({ ...f, [key]: value }));
  const get = (key: string) => fields[key] ?? "";

  async function runExtraction() {
    setExtracting(true);
    setError(null);
    setPendingOverwrites({});
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messyText }),
      });
      const data = (await res.json()) as Extraction & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setExtraction(data);
      if (data.fields) {
        const next: Record<string, string> = { ...fields };
        const conflicts: Record<string, string> = {};
        for (const [key, value] of Object.entries(data.fields)) {
          if (key === "assumptions" || value === null || value === undefined) continue;
          const suggested = String(value);
          const current = fields[key]?.trim();
          if (current && current !== suggested) conflicts[key] = suggested;
          else next[key] = suggested;
        }
        setFields(next);
        setPendingOverwrites(conflicts);
      }
    } catch {
      setError("Extraction failed — please fill in the fields manually.");
    } finally {
      setExtracting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const numeric = (v: string) => (v === "" ? undefined : Number(v));
      const body = {
        submitterName: submitter.name || undefined,
        submitterEmail: submitter.email || undefined,
        messyText: messyText || undefined,
        fields: {
          ...Object.fromEntries(
            Object.entries(fields).filter(([k, v]) => v !== "" && !["gradeMin", "gradeMax", "ageMin", "ageMax"].includes(k)),
          ),
          gradeMin: numeric(get("gradeMin")),
          gradeMax: numeric(get("gradeMax")),
          ageMin: numeric(get("ageMin")),
          ageMax: numeric(get("ageMax")),
        } as ListingFields,
      };
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-lg font-semibold text-emerald-800">Thanks — your opportunity was submitted!</h2>
        <p className="mt-1 text-sm text-emerald-900">
          Our team reviews every submission before it appears publicly, so students only see verified
          information.
        </p>
        {result.missingFields.length > 0 && (
          <div className="mt-3 rounded-lg bg-white p-3 text-sm ring-1 ring-amber-200">
            <p className="font-medium text-amber-800">Still missing (we may follow up):</p>
            <ul className="mt-1 list-inside list-disc text-stone-700">
              {result.missingFields.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {result.duplicateWarnings.length > 0 && (
          <div className="mt-3 rounded-lg bg-white p-3 text-sm ring-1 ring-sky-200">
            <p className="font-medium text-sky-800">Heads up — this may already be listed:</p>
            <ul className="mt-1 list-inside list-disc text-stone-700">
              {result.duplicateWarnings.map((d, i) => (
                <li key={i}>
                  “{d.title}” ({d.reason})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-1 font-semibold text-stone-800">1. Paste your program description (optional)</h2>
        <p className="mb-3 text-xs text-stone-500">
          Paste your flyer text, email announcement, or webpage copy — we&apos;ll extract the structured
          details for you to check.
        </p>
        <textarea
          value={messyText}
          onChange={(e) => setMessyText(e.target.value)}
          rows={6}
          placeholder="The Youth Leadership Development Initiative is pleased to announce that applications are being accepted…"
          className={inputCls}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={runExtraction}
            disabled={extracting || messyText.trim().length < 40}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {extracting ? "Extracting…" : "✨ Extract details with AI"}
          </button>
          {extraction?.notice && <p className="text-xs text-amber-700">{extraction.notice}</p>}
        </div>
        {extraction?.fields && (
          <div className="mt-3 rounded-lg bg-teal-50 p-3 text-sm ring-1 ring-teal-200">
            <p className="font-medium text-teal-900">
              Details extracted below — please double-check every field before submitting.
            </p>
            {extraction.missingFields.length > 0 && (
              <p className="mt-1 text-amber-800">
                Couldn&apos;t find: {extraction.missingFields.join(", ")}
              </p>
            )}
            {Array.isArray(extraction.fields.assumptions) && extraction.fields.assumptions.length > 0 && (
              <p className="mt-1 text-stone-600">
                Reviewer notes: {(extraction.fields.assumptions as string[]).join("; ")}
              </p>
            )}
          </div>
        )}
        {Object.keys(pendingOverwrites).length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
            <p className="font-medium">Your existing entries were preserved.</p>
            <p className="mt-1 text-xs">
              AI suggested different values for {Object.keys(pendingOverwrites).join(", ")}. Review the suggestion before replacing fields you already entered.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setFields((current) => ({ ...current, ...pendingOverwrites }));
                  setPendingOverwrites({});
                }}
                className="rounded-md bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900"
              >
                Use AI values for these fields
              </button>
              <button
                type="button"
                onClick={() => setPendingOverwrites({})}
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                Keep my entries
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-stone-800">2. Opportunity details</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Organization name" required>
            <input className={inputCls} value={get("orgName")} onChange={(e) => set("orgName")(e.target.value)} />
          </Field>
          <Field label="Opportunity title" required>
            <input className={inputCls} value={get("title")} onChange={(e) => set("title")(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description (what is it, in plain language)" required>
              <textarea
                className={inputCls}
                rows={3}
                value={get("description")}
                onChange={(e) => set("description")(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Category" required>
            <EnumSelect value={get("category")} onChange={set("category")} entries={taxonomy.categories} />
          </Field>
          <Field label="City" required>
            <EnumSelect value={get("city")} onChange={set("city")} entries={taxonomy.cities} />
          </Field>
          <Field label="Format" required>
            <EnumSelect value={get("format")} onChange={set("format")} entries={taxonomy.formats} />
          </Field>
          <Field label="Location detail (address, building…)">
            <input className={inputCls} value={get("locationDetail")} onChange={(e) => set("locationDetail")(e.target.value)} />
          </Field>
          <Field label="Cost">
            <EnumSelect value={get("costType")} onChange={set("costType")} entries={taxonomy.cost_types} />
          </Field>
          <Field label="Cost details ($ amount, scholarships…)">
            <input className={inputCls} value={get("costAmount")} onChange={(e) => set("costAmount")(e.target.value)} />
          </Field>
          <Field label="Compensation">
            <EnumSelect value={get("compensation")} onChange={set("compensation")} entries={taxonomy.compensation_types} />
          </Field>
          <Field label="Compensation details ($/hr, stipend amount…)">
            <input
              className={inputCls}
              value={get("compensationDetail")}
              onChange={(e) => set("compensationDetail")(e.target.value)}
            />
          </Field>
          <Field label="Schedule">
            <EnumSelect value={get("schedule")} onChange={set("schedule")} entries={taxonomy.schedules} />
          </Field>
          <Field label="Time commitment (hours/week, length)">
            <input className={inputCls} value={get("timeCommitment")} onChange={(e) => set("timeCommitment")(e.target.value)} />
          </Field>
          <Field label="Minimum grade">
            <input type="number" min={1} max={12} className={inputCls} value={get("gradeMin")} onChange={(e) => set("gradeMin")(e.target.value)} />
          </Field>
          <Field label="Maximum grade">
            <input type="number" min={1} max={12} className={inputCls} value={get("gradeMax")} onChange={(e) => set("gradeMax")(e.target.value)} />
          </Field>
          <Field label="Minimum age">
            <input type="number" min={5} max={25} className={inputCls} value={get("ageMin")} onChange={(e) => set("ageMin")(e.target.value)} />
          </Field>
          <Field label="Maximum age">
            <input type="number" min={5} max={25} className={inputCls} value={get("ageMax")} onChange={(e) => set("ageMax")(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Other eligibility notes">
              <input className={inputCls} value={get("eligibilityNotes")} onChange={(e) => set("eligibilityNotes")(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="What participants will do">
              <textarea className={inputCls} rows={2} value={get("whatYoullDo")} onChange={(e) => set("whatYoullDo")(e.target.value)} />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-stone-800">3. Applying</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Application link" required>
            <input className={inputCls} placeholder="https://…" value={get("applicationUrl")} onChange={(e) => set("applicationUrl")(e.target.value)} />
          </Field>
          <Field label="Contact email">
            <input className={inputCls} value={get("contactEmail")} onChange={(e) => set("contactEmail")(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="How to apply (steps, required materials)">
              <textarea className={inputCls} rows={2} value={get("howToApply")} onChange={(e) => set("howToApply")(e.target.value)} />
            </Field>
          </div>
          <Field label="Deadline type">
            <select value={get("deadlineType") || "specific"} onChange={(e) => set("deadlineType")(e.target.value)} className={inputCls}>
              <option value="specific">Specific deadline</option>
              <option value="rolling">Rolling / ongoing</option>
            </select>
          </Field>
          {get("deadlineType") !== "rolling" && (
            <Field label="Application deadline" required>
              <input type="date" className={inputCls} value={get("applicationDeadline")} onChange={(e) => set("applicationDeadline")(e.target.value)} />
            </Field>
          )}
          <Field label="Start date">
            <input type="date" className={inputCls} value={get("startDate")} onChange={(e) => set("startDate")(e.target.value)} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputCls} value={get("endDate")} onChange={(e) => set("endDate")(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Accessibility & transportation notes">
              <input className={inputCls} value={get("transportationNotes")} onChange={(e) => set("transportationNotes")(e.target.value)} />
            </Field>
          </div>
          <Field label="Source webpage (where students can verify)">
            <input className={inputCls} placeholder="https://…" value={get("sourceUrl")} onChange={(e) => set("sourceUrl")(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-stone-800">4. About you (so we can follow up)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Your name">
            <input className={inputCls} value={submitter.name} onChange={(e) => setSubmitter({ ...submitter, name: e.target.value })} />
          </Field>
          <Field label="Your email">
            <input type="email" className={inputCls} value={submitter.email} onChange={(e) => setSubmitter({ ...submitter, email: e.target.value })} />
          </Field>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-teal-700 px-6 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit for review"}
      </button>
      <p className="text-xs text-stone-500">
        Submissions are reviewed by our team before publishing. Incomplete submissions are still welcome —
        we&apos;ll flag what&apos;s missing and follow up.
      </p>
    </form>
  );
}
