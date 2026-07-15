import { NextRequest, NextResponse } from "next/server";
import { searchOpportunities } from "@/db/queries";
import { logSearchEvent, SearchEventRequestSchema } from "@/lib/searchEvents";

export const dynamic = "force-dynamic";

/** Record one completed, explicit search. Result counts are recomputed server-side. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SearchEventRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search event", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }

  const { filters } = parsed.data;
  const { total } = searchOpportunities(filters, { limit: 1 });
  // This endpoint belongs only to the deterministic directory. NL events are
  // recorded inside /api/nl-search so callers cannot relabel public events.
  const recorded = logSearchEvent("keyword", filters.q ?? null, filters, total);
  return NextResponse.json({ recorded }, { status: recorded ? 201 : 202 });
}
