import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { opportunities } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/requireAdmin";
import { ListingFieldsSchema } from "@/lib/submissionSchema";

export const dynamic = "force-dynamic";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_verified") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("unarchive") }),
  z.object({ action: z.literal("edit"), fields: ListingFieldsSchema.omit({ orgName: true }) }),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const existing = db.select().from(opportunities).where(eq(opportunities.id, id)).get();
  if (!existing) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid action", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const action = parsed.data.action;

  if (action === "mark_verified") {
    db.update(opportunities).set({ lastVerifiedAt: now, updatedAt: now }).where(eq(opportunities.id, id)).run();
    writeAudit("opportunity_verified", "opportunity", id);
    return NextResponse.json({ ok: true, lastVerifiedAt: now });
  }

  if (action === "archive" || action === "unarchive") {
    const status = action === "archive" ? "archived" : "approved";
    db.update(opportunities).set({ status, updatedAt: now }).where(eq(opportunities.id, id)).run();
    writeAudit(`opportunity_${action}d`, "opportunity", id);
    return NextResponse.json({ ok: true, status });
  }

  // edit: apply only the provided fields
  const fields = parsed.data.fields;
  const changed: Record<string, unknown> = {};
  const updates: Partial<typeof opportunities.$inferInsert> = { updatedAt: now };
  const assign = <K extends keyof typeof fields>(key: K, column: keyof typeof opportunities.$inferInsert) => {
    const value = fields[key];
    if (value !== undefined) {
      (updates as Record<string, unknown>)[column] = value;
      changed[String(key)] = value;
    }
  };
  assign("title", "title");
  assign("description", "description");
  assign("category", "category");
  assign("city", "city");
  assign("locationDetail", "locationDetail");
  assign("format", "format");
  assign("costType", "costType");
  assign("costAmount", "costAmount");
  assign("compensation", "compensation");
  assign("compensationDetail", "compensationDetail");
  assign("schedule", "schedule");
  assign("timeCommitment", "timeCommitment");
  assign("gradeMin", "gradeMin");
  assign("gradeMax", "gradeMax");
  assign("ageMin", "ageMin");
  assign("ageMax", "ageMax");
  assign("eligibilityNotes", "eligibilityNotes");
  assign("whatYoullDo", "whatYoullDo");
  assign("howToApply", "howToApply");
  assign("applicationUrl", "applicationUrl");
  assign("contactEmail", "contactEmail");
  assign("sourceUrl", "sourceUrl");
  assign("transportationNotes", "transportationNotes");
  assign("applicationDeadline", "applicationDeadline");
  assign("startDate", "startDate");
  assign("endDate", "endDate");
  if (fields.deadlineType === "rolling") {
    updates.applicationDeadline = null;
    changed.applicationDeadline = "rolling";
  }

  db.update(opportunities).set(updates).where(eq(opportunities.id, id)).run();
  writeAudit("opportunity_edited", "opportunity", id, { changed: Object.keys(changed) });
  return NextResponse.json({ ok: true, changed: Object.keys(changed) });
}
