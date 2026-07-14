"use client";

import { useState } from "react";
import { taxonomy } from "@/lib/taxonomy";

export function ReportIssueDialog({ opportunityId }: { opportunityId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("outdated");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit() {
    setState("sending");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, reason, details: details.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="text-xs font-medium text-emerald-700">Thanks — our team will review this listing.</p>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-amber-400 hover:text-amber-700"
      >
        Report outdated or incorrect info
      </button>
      {open && (
        <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-3 text-left shadow-md">
          <label className="text-xs font-medium text-stone-600">
            What’s wrong?
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm font-normal focus:outline-none"
            >
              {taxonomy.report_reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything else we should know? (optional)"
            rows={2}
            className="mt-2 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:outline-none"
          />
          {state === "error" && <p className="mt-1 text-xs text-red-600">Could not send — please try again.</p>}
          <button
            type="button"
            onClick={submit}
            disabled={state === "sending"}
            className="mt-2 w-full rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {state === "sending" ? "Sending…" : "Send report"}
          </button>
        </div>
      )}
    </div>
  );
}
