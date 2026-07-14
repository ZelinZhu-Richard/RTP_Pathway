import { NextRequest, NextResponse } from "next/server";
import { extractListing } from "@/lib/claude/extractListing";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let messyText: unknown;
  try {
    ({ messyText } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof messyText !== "string" || messyText.trim().length < 40) {
    return NextResponse.json(
      { error: "messyText must be a description of at least 40 characters" },
      { status: 400 },
    );
  }
  const result = await extractListing(messyText.trim());
  return NextResponse.json(result);
}
