import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { submissions } from "@/db/schema";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const status = request.nextUrl.searchParams.get("status") ?? "pending";
  const rows =
    status === "all"
      ? db.select().from(submissions).orderBy(desc(submissions.createdAt)).all()
      : db.select().from(submissions).where(eq(submissions.status, status)).orderBy(desc(submissions.createdAt)).all();

  return NextResponse.json({
    submissions: rows.map((s) => ({
      ...s,
      rawFields: safeJson(s.rawFields),
      extractedFields: safeJson(s.extractedFields),
      missingFields: safeJson(s.missingFields) ?? [],
      duplicateWarnings: safeJson(s.duplicateWarnings) ?? [],
    })),
  });
}

function safeJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
