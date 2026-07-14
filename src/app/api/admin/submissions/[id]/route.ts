import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { opportunities, organizations, submissions } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { normalizeOrgName } from "@/lib/duplicates";
import { requireAdmin } from "@/lib/requireAdmin";
import { slugify } from "@/lib/slug";
import { ListingFieldsSchema, missingListingFields } from "@/lib/submissionSchema";

export const dynamic = "force-dynamic";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), fields: ListingFieldsSchema }),
  z.object({ action: z.literal("reject"), note: z.string().max(1000).optional() }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const submission = db.select().from(submissions).where(eq(submissions.id, id)).get();
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (submission.status !== "pending") {
    return NextResponse.json({ error: `Submission already ${submission.status}` }, { status: 409 });
  }

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

  if (parsed.data.action === "reject") {
    db.update(submissions)
      .set({ status: "rejected", reviewNote: parsed.data.note ?? null, reviewedAt: now })
      .where(eq(submissions.id, id))
      .run();
    writeAudit("submission_rejected", "submission", id, { note: parsed.data.note });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Approve: the reviewed fields must be complete before publishing.
  const fields = parsed.data.fields;
  const missing = missingListingFields(fields);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Cannot publish an incomplete listing", missingFields: missing },
      { status: 422 },
    );
  }

  const orgName = fields.orgName!;
  const normalized = normalizeOrgName(orgName);
  let org = db.select().from(organizations).where(eq(organizations.nameNormalized, normalized)).get();
  if (!org) {
    const orgId = randomUUID();
    db.insert(organizations)
      .values({ id: orgId, name: orgName, nameNormalized: normalized, contactEmail: fields.contactEmail ?? null })
      .run();
    org = db.select().from(organizations).where(eq(organizations.id, orgId)).get()!;
  }

  const oppId = randomUUID();
  db.insert(opportunities)
    .values({
      id: oppId,
      orgId: org.id,
      title: fields.title!,
      slug: `${slugify(fields.title!)}-${oppId.slice(0, 6)}`,
      description: fields.description!,
      category: fields.category!,
      format: fields.format!,
      city: fields.city!,
      locationDetail: fields.locationDetail ?? null,
      gradeMin: fields.gradeMin ?? null,
      gradeMax: fields.gradeMax ?? null,
      ageMin: fields.ageMin ?? null,
      ageMax: fields.ageMax ?? null,
      costType: fields.costType ?? "free",
      costAmount: fields.costAmount ?? null,
      compensation: fields.compensation ?? "none",
      compensationDetail: fields.compensationDetail ?? null,
      schedule: fields.schedule ?? null,
      timeCommitment: fields.timeCommitment ?? null,
      whatYoullDo: fields.whatYoullDo ?? null,
      eligibilityNotes: fields.eligibilityNotes ?? null,
      howToApply: fields.howToApply ?? null,
      applicationUrl: fields.applicationUrl ?? null,
      applicationDeadline: fields.deadlineType === "rolling" ? null : (fields.applicationDeadline ?? null),
      startDate: fields.startDate ?? null,
      endDate: fields.endDate ?? null,
      transportationNotes: fields.transportationNotes ?? null,
      sourceUrl: fields.sourceUrl ?? null,
      contactEmail: fields.contactEmail ?? null,
      lastVerifiedAt: now, // an admin just reviewed it against the source
      status: "approved",
    })
    .run();

  db.update(submissions)
    .set({ status: "approved", opportunityId: oppId, reviewedAt: now })
    .where(eq(submissions.id, id))
    .run();

  writeAudit("submission_approved", "submission", id, { opportunityId: oppId, title: fields.title });
  writeAudit("opportunity_published", "opportunity", oppId, { fromSubmission: id });

  const slug = db.select({ slug: opportunities.slug }).from(opportunities).where(eq(opportunities.id, oppId)).get();
  return NextResponse.json({ ok: true, status: "approved", opportunityId: oppId, slug: slug?.slug });
}
