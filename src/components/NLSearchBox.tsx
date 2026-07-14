"use client";

import { useState } from "react";
import type { OpportunityCard } from "@/db/queries";
import { OpportunityCardView } from "@/components/OpportunityCard";

interface NLResponse {
  results: OpportunityCard[];
  explanation: { summary: string; perResult: { id: string; reason: string }[] };
  usedClaude: boolean;
  notice?: string;
}

const EXAMPLES = [
  "Free summer coding programs for a 15-year-old in Durham",
  "Weekend volunteer opportunities related to animals or nature",
  "Paid internships I can apply to this month",
];

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
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
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

      {error && <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-100">{error}</p>}

      {response && (
        <div className="rounded-xl bg-white p-4 text-stone-800 shadow">
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
          {response.notice && <p className="mt-1 text-xs text-stone-500">{response.notice}</p>}
          {!response.usedClaude && (
            <p className="mt-1 text-xs text-stone-400">
              Basic search mode — AI assistance is currently unavailable, results matched by keyword rules.
            </p>
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
