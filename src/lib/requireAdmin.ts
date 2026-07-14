import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionCookie } from "@/lib/auth";

/**
 * Defense in depth: middleware already gates /api/admin/*, but every admin
 * handler re-verifies the cookie itself. Returns a 401 response to send, or
 * null when the request is authenticated.
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const authed = await verifySessionCookie(request.cookies.get(ADMIN_COOKIE)?.value);
  return authed ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
