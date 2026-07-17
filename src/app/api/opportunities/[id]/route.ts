import { NextResponse } from "next/server";
import { getPublicOpportunityDetailById } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const opportunity = getPublicOpportunityDetailById(id);
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  return NextResponse.json({ opportunity });
}
