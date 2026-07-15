"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OpportunityCard } from "@/db/queries";
import { deadlineText } from "@/lib/display";
import { Chip, DeadlineBadge, VerificationBadge } from "@/components/Badges";
import { CalendarLinks } from "@/components/CalendarLinks";
import { getSavedIds, setSavedIds, useSavedIds } from "@/components/SaveCompare";
import { categoryLabel } from "@/lib/taxonomy";

// Application checklist per saved opportunity — stored in localStorage only.
const DEFAULT_STEPS = [
  "Check that I'm eligible",
  "Gather documents / résumé",
  "Ask for a recommendation (if needed)",
  "Draft the application or essay",
  "Submit the application",
  "Follow up / confirm receipt",
];

function useChecklist(oppId: string): [boolean[], (i: number) => void] {
  const key = `rtp:checklist:${oppId}`;
  const [steps, setSteps] = useState<boolean[]>(() => Array(DEFAULT_STEPS.length).fill(false));
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      if (Array.isArray(stored)) {
        setSteps(DEFAULT_STEPS.map((_, i) => Boolean(stored[i])));
      }
    } catch {
      /* keep defaults */
    }
  }, [key]);
  const toggle = (i: number) =>
    setSteps((prev) => {
      const next = prev.map((v, j) => (j === i ? !v : v));
      window.localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  return [steps, toggle];
}

function SavedItem({ card }: { card: OpportunityCard }) {
  const [steps, toggle] = useChecklist(card.id);
  const done = steps.filter(Boolean).length;

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/opportunities/${card.slug}`} className="font-semibold text-stone-900 hover:text-teal-700">
          {card.title}
        </Link>
        <span className="text-sm text-stone-500">{card.orgName}</span>
        <Chip>{categoryLabel(card.category)}</Chip>
        <DeadlineBadge deadline={card.applicationDeadline} />
        <VerificationBadge lastVerifiedAt={card.lastVerifiedAt} />
        <button
          type="button"
          onClick={() => setSavedIds(getSavedIds().filter((x) => x !== card.id))}
          className="ml-auto text-xs text-stone-400 hover:text-red-600"
        >
          Remove
        </button>
      </div>

      <details className="mt-3" open={done > 0 && done < steps.length}>
        <summary className="cursor-pointer text-sm font-medium text-stone-700">
          Application checklist ({done}/{steps.length})
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {DEFAULT_STEPS.map((step, i) => (
            <li key={step}>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={steps[i]} onChange={() => toggle(i)} className="accent-teal-700" />
                <span className={steps[i] ? "text-stone-400 line-through" : ""}>{step}</span>
              </label>
            </li>
          ))}
        </ul>
      </details>

      {card.applicationDeadline && (
        <div className="mt-3">
          <CalendarLinks
            opportunityId={card.id}
            title={card.title}
            deadline={card.applicationDeadline}
            orgName={card.orgName}
          />
        </div>
      )}
      <p className="mt-2 text-xs text-stone-400">{deadlineText(card.applicationDeadline)}</p>
    </li>
  );
}

export default function SavedPage() {
  const ids = useSavedIds();
  const [cards, setCards] = useState<OpportunityCard[] | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      setCards([]);
      return;
    }
    fetch(`/api/opportunities?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((d) => {
        const order = new Map(ids.map((id, i) => [id, i]));
        setCards(
          (d.results as OpportunityCard[]).sort(
            (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
          ),
        );
      })
      .catch(() => setCards([]));
  }, [ids]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-stone-900">Saved opportunities</h1>
      <p className="mt-1 mb-4 text-sm text-stone-600">
        Saved on this device only — no account needed. Track your application steps and export
        deadlines to your calendar.{" "}
        {ids.length >= 2 && (
          <Link href="/compare" className="text-teal-700 underline">
            Compare your top {Math.min(ids.length, 3)} side by side →
          </Link>
        )}
      </p>

      {cards === null ? (
        <p className="text-stone-400">Loading…</p>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          <p>Nothing saved yet.</p>
          <p className="mt-1 text-sm">
            Tap the bookmark on any{" "}
            <Link href="/explore" className="text-teal-700 underline">
              opportunity
            </Link>{" "}
            to keep it here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => (
            <SavedItem key={card.id} card={card} />
          ))}
        </ul>
      )}
    </div>
  );
}
