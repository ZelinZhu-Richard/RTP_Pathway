import { NextRequest, NextResponse } from "next/server";
import { getOpportunityById } from "@/db/queries";
import { answerListingQuestion } from "@/lib/claude/groundedQa";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let question: unknown;
  try {
    ({ question } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof question !== "string" || !question.trim() || question.length > 300) {
    return NextResponse.json({ error: "question must be a non-empty string (max 300 chars)" }, { status: 400 });
  }

  const row = getOpportunityById(id);
  if (!row || row.opp.status !== "approved") {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const result = await answerListingQuestion(question.trim(), row.opp, row.org);
  return NextResponse.json({ ...result, grounded: true });
}
