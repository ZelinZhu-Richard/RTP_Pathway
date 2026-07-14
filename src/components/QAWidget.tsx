"use client";

import { useState } from "react";

interface QAResponse {
  answer: string;
  usedClaude: boolean;
}

const SUGGESTED = ["Do I need any experience?", "Is transportation provided?", "When is the deadline?"];

export function QAWidget({ opportunityId }: { opportunityId: string }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<QAResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setAsked(q.trim());
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim() }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setAnswer(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setAnswer(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal-800">
        Ask about this opportunity
      </h2>
      <p className="mb-3 text-xs text-stone-500">
        Answers come only from this listing’s information — if something isn’t listed, we’ll say so.
      </p>
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
          placeholder="e.g. Is this open to 9th graders?"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="shrink-0 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {loading ? "…" : "Ask"}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuestion(s);
              ask(s);
            }}
            className="rounded-full bg-white px-3 py-1 text-xs text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100"
          >
            {s}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {answer && (
        <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-teal-100">
          {asked && <p className="text-xs font-medium text-stone-400">“{asked}”</p>}
          <p className="mt-1 text-sm text-stone-800">{answer.answer}</p>
          {!answer.usedClaude && (
            <p className="mt-1 text-xs text-stone-400">Answered from listing fields (AI assistance unavailable).</p>
          )}
        </div>
      )}
    </section>
  );
}
