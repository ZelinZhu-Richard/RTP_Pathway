// Admin session cookies signed with HMAC-SHA256 via Web Crypto only, so this
// module works in both the Edge runtime (middleware) and Node route handlers.
// The signing key is derived from ADMIN_PASSWORD; no DB involved.

export const ADMIN_COOKIE = "rtp_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_SALT = "rtp-pathway-admin-v1";

const encoder = new TextEncoder();

async function signingKey(): Promise<CryptoKey | null> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(`${KEY_SALT}:${password}`));
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(key: CryptoKey, data: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** Constant-time-ish comparison: compare HMACs of both values instead of the values. */
export async function passwordMatches(submitted: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  const key = await signingKey();
  if (!expected || !key) return false;
  const [a, b] = await Promise.all([hmacHex(key, submitted), hmacHex(key, expected)]);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function mintSessionCookie(): Promise<string | null> {
  const key = await signingKey();
  if (!key) return null;
  const payload = btoa(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS }));
  const signature = await hmacHex(key, payload);
  return `${payload}.${signature}`;
}

export async function verifySessionCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const key = await signingKey();
  if (!key) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = await hmacHex(key, payload);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
