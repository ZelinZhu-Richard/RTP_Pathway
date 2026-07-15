"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OpportunityCard } from "@/db/queries";
import { costCompText, deadlineText, eligibilityText } from "@/lib/display";
import { categoryLabel, formatLabel, scheduleLabel, verificationStatus } from "@/lib/taxonomy";
import { COMPARE_LIMIT, useSavedIds } from "@/components/SaveCompare";
import { fmtDate } from "@/lib/display";

const ROWS: { label: string; value: (c: OpportunityCard) => string }[] = [
  { label: "Organization", value: (c) => c.orgName },
  { label: "Category", value: (c) => categoryLabel(c.category) },
  { label: "Deadline", value: (c) => deadlineText(c.applicationDeadline) },
  { label: "Cost & pay", value: (c) => costCompText(c) },
  { label: "Eligibility", value: (c) => eligibilityText(c) },
  { label: "City", value: (c) => c.city },
  { label: "Format", value: (c) => formatLabel(c.format) },
  { label: "Schedule", value: (c) => (c.schedule ? scheduleLabel(c.schedule) : "—") },
  { label: "Time commitment", value: (c) => c.timeCommitment ?? "—" },
  {
    label: "Verification",
    value: (c) =>
      verificationStatus(c.lastVerifiedAt) === "verified"
        ? `Verified ${fmtDate(c.lastVerifiedAt)}`
        : "Needs verification",
  },
];

export default function ComparePage() {
  const ids = useSavedIds();
  const [cards, setCards] = useState<OpportunityCard[] | null>(null);

  useEffect(() => {
    const chosen = ids.slice(0, COMPARE_LIMIT);
    if (chosen.length === 0) {
      setCards([]);
      return;
    }
    fetch(`/api/opportunities?ids=${chosen.join(",")}`)
      .then((r) => r.json())
      .then((d) => {
        const order = new Map(chosen.map((id, i) => [id, i]));
        setCards(
          (d.results as OpportunityCard[])
            .filter((c) => order.has(c.id))
            .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)),
        );
      })
      .catch(() => setCards([]));
  }, [ids]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-stone-900">Compare opportunities</h1>
      <p className="mt-1 mb-4 text-sm text-stone-600">
        Your first {COMPARE_LIMIT} saved opportunities, side by side.
        {ids.length > COMPARE_LIMIT && " (Remove some on the Saved page to compare others.)"}
      </p>

      {cards === null ? (
        <p className="text-stone-400">Loading…</p>
      ) : cards.length < 2 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          <p>Save at least two opportunities to compare them.</p>
          <p className="mt-1 text-sm">
            <Link href="/explore" className="text-teal-700 underline">
              Browse opportunities →
            </Link>
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-stone-500">Feature</th>
                {cards.map((c) => (
                  <th key={c.id} className="px-3 py-2 text-left">
                    <Link href={`/opportunities/${c.slug}`} className="font-semibold text-teal-800 hover:underline">
                      {c.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-stone-500">{row.label}</td>
                  {cards.map((c) => (
                    <td key={c.id} className="px-3 py-2 text-stone-800">
                      {row.value(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
