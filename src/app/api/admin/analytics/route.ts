import { NextRequest, NextResponse } from "next/server";
import { computeAnalytics } from "@/db/analytics";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json(computeAnalytics());
}
