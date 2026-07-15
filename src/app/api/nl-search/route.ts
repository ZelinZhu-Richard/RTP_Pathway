import { NextRequest, NextResponse } from "next/server";
import { searchOpportunities } from "@/db/queries";
import { explainResults } from "@/lib/claude/explainResults";
import { parseQuery } from "@/lib/claude/parseQuery";
import { logSearchEvent } from "@/lib/searchEvents";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let question: unknown;
  try {
    ({ question } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof question !== "string" || !question.trim() || question.length > 500) {
    return NextResponse.json({ error: "question must be a non-empty string (max 500 chars)" }, { status: 400 });
  }
  const q = question.trim();

  // 1. Parse the question into structured filters (Claude or rule-based).
  const { filters, usedClaude: parsedWithClaude } = await parseQuery(q);

  // 2. Query the verified database — Claude never selects records itself.
  const { results, total } = searchOpportunities(filters, { limit: 20 });
  logSearchEvent("nl", q, filters, total);

  // 3. Explain the matches, grounded in the returned records only.
  const { explanation, usedClaude: explainedWithClaude } = await explainResults(q, filters, results);

  return NextResponse.json({
    filters,
    results,
    total,
    explanation,
    usedClaude: parsedWithClaude || explainedWithClaude,
    notice: parsedWithClaude
      ? undefined
      : "Interpreted with basic keyword rules; results come from the verified database.",
  });
}
