import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { submissions } from "@/db/schema";
import { requireAdmin } from "@/lib/requireAdmin";
import { syncSubmissionToGoogleSheet } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const submission = db.select({ id: submissions.id }).from(submissions).where(eq(submissions.id, id)).get();
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const result = await syncSubmissionToGoogleSheet(id);
  return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
}

