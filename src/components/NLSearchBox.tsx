"use client";

import { useState } from "react";
import type { OpportunityCard } from "@/db/queries";
import type { Filters } from "@/lib/search";
import { filtersToSearchParams } from "@/lib/search";
import {
  categoryLabel,
  compensationLabel,
  costLabel,
  formatLabel,
  scheduleLabel,
} from "@/lib/taxonomy";
import { OpportunityCardView } from "@/components/OpportunityCard";

interface NLResponse {
  results: OpportunityCard[];
  total: number;
  filters: Filters;
  explanation: { summary: string; perResult: { id: string; reason: string }[] };
  usedClaude: boolean;
  notice?: string;
}

const EXAMPLES = [
  "Free summer coding programs for a 15-year-old in Durham",
  "Weekend volunteer opportunities related to animals or nature",
  "Paid internships I can apply to this month",
];

function filterChips(filters: Filters): string[] {
  const chips: string[] = [];
  if (filters.category) chips.push(`Category: ${categoryLabel(filters.category)}`);
  if (filters.keywords?.length) chips.push(`Topics: ${filters.keywords.join(", ")}`);
  if (filters.grade) chips.push(`Grade ${filters.grade}`);
  if (filters.city) chips.push(`City: ${filters.city}`);
  if (filters.format) chips.push(`Format: ${formatLabel(filters.format)}`);
  if (filters.cost) chips.push(`Cost: ${costLabel(filters.cost)}`);
  if (filters.compensation) {
    chips.push(
      filters.compensation === "any_pay"
        ? "Pay: paid or stipend"
        : `Pay: ${compensationLabel(filters.compensation)}`,
    );
  }
  if (filters.schedule) chips.push(`Schedule: ${scheduleLabel(filters.schedule)}`);
  if (filters.deadlineWithinDays) chips.push(`Deadline: within ${filters.deadlineWithinDays} days`);
  return chips;
}

const RELAXABLE_FILTERS: { key: keyof Filters; label: string }[] = [
  { key: "city", label: "Search the whole Triangle" },
  { key: "schedule", label: "Remove the schedule" },
  { key: "deadlineWithinDays", label: "Remove the deadline window" },
  { key: "category", label: "Try every category" },
  { key: "format", label: "Try every format" },
  { key: "cost", label: "Include paid programs" },
  { key: "compensation", label: "Try any compensation" },
  { key: "grade", label: "Remove the grade filter" },
  { key: "keywords", label: "Remove topic keywords" },
];

function relaxationLinks(filters: Filters): { label: string; href: string }[] {
  const links = RELAXABLE_FILTERS.filter(({ key }) => filters[key] !== undefined)
    .slice(0, 3)
    .map(({ key, label }) => {
      const relaxed = { ...filters };
      delete relaxed[key];
      const query = filtersToSearchParams(relaxed).toString();
      return { label, href: `/explore${query ? `?${query}` : ""}#opportunity-directory` };
    });
  return links.length ? links : [{ label: "Browse all opportunities", href: "/explore#opportunity-directory" }];
}

export function NLSearchBox() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<NLResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nl-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim() }),
      });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      setResponse(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const reasonsById = new Map(response?.explanation.perResult.map((r) => [r.id, r.reason]) ?? []);
  const interpretedChips = response ? filterChips(response.filters) : [];
  const relaxations = response && response.total === 0 ? relaxationLinks(response.filters) : [];

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          aria-label="Describe the opportunity you are looking for"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ask in plain English — e.g. “free weekend health programs for a 10th grader”"
          className="w-full rounded-lg border-0 bg-white/95 px-3 py-2.5 text-sm text-stone-800 placeholder-stone-400 shadow focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="shrink-0 rounded-lg bg-teal-950/80 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-teal-950 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Ask"}
        </button>
      </form>

      {!response && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuestion(ex);
                ask(ex);
              }}
              className="rounded-full bg-white/15 px-3 py-1 text-xs text-teal-50 ring-1 ring-white/30 hover:bg-white/25"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-100">{error}</p>}

      {response && (
        <div className="rounded-xl bg-white p-4 text-stone-800 shadow" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm">{response.explanation.summary}</p>
            <button
              type="button"
              onClick={() => setResponse(null)}
              className="shrink-0 text-xs text-stone-400 hover:text-stone-600"
            >
              Clear
            </button>
          </div>
          <div className="mt-2">
            <p className="text-xs font-medium text-stone-500">Interpreted as</p>
            {interpretedChips.length ? (
              <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Interpreted search filters">
                {interpretedChips.map((chip) => (
                  <li key={chip} className="rounded-full bg-teal-50 px-2.5 py-1 text-xs text-teal-800 ring-1 ring-teal-200">
                    {chip}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-stone-500">Broad search; no structured filter was inferred.</p>
            )}
          </div>
          {response.notice && <p className="mt-1 text-xs text-stone-500">{response.notice}</p>}
          <p className={`mt-2 text-xs ${response.usedClaude ? "text-teal-700" : "text-stone-500"}`}>
            {response.usedClaude
              ? `Claude-assisted and grounded: ${response.total} match${response.total === 1 ? "" : "es"} selected from approved database records.`
              : `Basic fallback mode: ${response.total} match${response.total === 1 ? "" : "es"} selected from approved database records without Claude.`}
          </p>
          {relaxations.length > 0 && (
            <div className="mt-3 rounded-lg bg-stone-50 p-3 ring-1 ring-stone-200">
              <p className="text-xs font-medium text-stone-600">Try a broader directory search</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {relaxations.map((suggestion) => (
                  <li key={suggestion.label}>
                    <a
                      href={suggestion.href}
                      className="inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-stone-300 hover:bg-teal-50"
                    >
                      {suggestion.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {response.results.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {response.results.slice(0, 6).map((card) => (
                <OpportunityCardView key={card.id} card={card} matchReason={reasonsById.get(card.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
