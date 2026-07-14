import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, mintSessionCookie, passwordMatches } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin login is not configured (set ADMIN_PASSWORD)." },
      { status: 503 },
    );
  }
  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof password !== "string" || !(await passwordMatches(password))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const cookie = await mintSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, cookie!, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
