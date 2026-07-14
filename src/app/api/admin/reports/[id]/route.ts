import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

const ActionSchema = z.object({
  action: z.enum(["resolve", "dismiss"]),
  note: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const report = db.select().from(reports).where(eq(reports.id, id)).get();
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (report.status !== "open") {
    return NextResponse.json({ error: `Report already ${report.status}` }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const status = parsed.data.action === "resolve" ? "resolved" : "dismissed";
  db.update(reports)
    .set({ status, resolvedAt: new Date().toISOString() })
    .where(eq(reports.id, id))
    .run();
  writeAudit(`report_${status}`, "report", id, {
    opportunityId: report.opportunityId,
    reason: report.reason,
    note: parsed.data.note,
  });
  return NextResponse.json({ ok: true, status });
}
