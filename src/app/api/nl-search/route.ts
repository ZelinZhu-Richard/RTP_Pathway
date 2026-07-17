import { NextRequest, NextResponse } from "next/server";
import { searchOpportunities } from "@/db/queries";
import { explainResults } from "@/lib/claude/explainResults";
import { parseQuery } from "@/lib/claude/parseQuery";
import { MAX_PAGE_SIZE } from "@/lib/search";
import { logSearchEvent } from "@/lib/searchEvents";

export const dynamic = "force-dynamic";
const DEFAULT_NL_PAGE_SIZE = 20;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const question =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).question
      : undefined;
  const requestedPageSize =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).pageSize
      : undefined;
  if (typeof question !== "string" || !question.trim() || question.length > 500) {
    return NextResponse.json({ error: "question must be a non-empty string (max 500 chars)" }, { status: 400 });
  }
  if (
    requestedPageSize !== undefined &&
    (typeof requestedPageSize !== "number" ||
      !Number.isInteger(requestedPageSize) ||
      requestedPageSize < 1 ||
      requestedPageSize > MAX_PAGE_SIZE)
  ) {
    return NextResponse.json(
      { error: `pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}` },
      { status: 400 },
    );
  }
  const q = question.trim();
  const pageSize = (requestedPageSize as number | undefined) ?? DEFAULT_NL_PAGE_SIZE;

  // 1. Parse the question into structured filters (Claude or rule-based).
  const { filters, usedClaude: parsedWithClaude } = await parseQuery(q);

  // 2. Query the public directory — Claude never selects records itself.
  const { results, total } = searchOpportunities(filters, { limit: pageSize });
  logSearchEvent("nl", q, filters, total);

  // 3. Explain the matches, grounded in the returned records only.
  const { explanation, usedClaude: explainedWithClaude } = await explainResults(q, filters, results);

  return NextResponse.json({
    filters,
    results,
    total,
    page: 1,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    explanation,
    usedClaude: parsedWithClaude || explainedWithClaude,
    notice: parsedWithClaude
      ? undefined
      : "Interpreted with basic keyword rules; results come from the source-linked preview directory.",
  });
}
