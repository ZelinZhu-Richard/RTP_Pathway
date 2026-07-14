import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { getOpportunityById } from "@/db/queries";
import { REPORT_REASON_IDS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const ReportSchema = z.object({
  opportunityId: z.string().min(1),
  reason: z.enum(REPORT_REASON_IDS as [string, ...string[]]),
  details: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
  if (!getOpportunityById(parsed.data.opportunityId)) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const id = randomUUID();
  db.insert(reports)
    .values({
      id,
      opportunityId: parsed.data.opportunityId,
      reason: parsed.data.reason,
      details: parsed.data.details?.trim() || null,
      status: "open",
    })
    .run();
  return NextResponse.json({ id, status: "open" }, { status: 201 });
}
