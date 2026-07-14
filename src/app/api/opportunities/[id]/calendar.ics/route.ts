import { NextRequest, NextResponse } from "next/server";
import { getOpportunityById } from "@/db/queries";
import { buildIcs } from "@/lib/ics";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getOpportunityById(id);
  if (!row || row.opp.status !== "approved") {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }
  const date = row.opp.applicationDeadline ?? row.opp.startDate;
  if (!date) {
    return NextResponse.json(
      { error: "This opportunity has a rolling deadline — no date to export" },
      { status: 404 },
    );
  }

  const ics = buildIcs({
    uid: row.opp.id,
    date,
    summary: `Application deadline: ${row.opp.title}`,
    description: `${row.opp.title} (${row.org.name}) — saved from RTP Pathway. Confirm details at the source before applying.`,
    url: row.opp.applicationUrl ?? row.opp.sourceUrl ?? undefined,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(row.opp.title)}-deadline.ics"`,
    },
  });
}
