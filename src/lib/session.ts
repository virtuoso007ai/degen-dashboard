import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "dc_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export function cookieName(): string {
  return COOKIE_NAME;
}

export function sessionMaxAgeSec(): number {
  return MAX_AGE_SEC;
}

function secret(): string {
  const s = process.env.DASHBOARD_SESSION_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("DASHBOARD_SESSION_SECRET (min 16 char) gerekli");
  }
  return s;
}

export function createSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const sig = createHmac("sha256", secret())
    .update(String(exp))
    .digest("hex");
  return Buffer.from(JSON.stringify({ exp, sig }), "utf8").toString("base64url");
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const j = JSON.parse(raw) as { exp: number; sig: string };
    if (typeof j.exp !== "number") return false;
    if (j.exp < Math.floor(Date.now() / 1000)) return false;
    const expected = createHmac("sha256", secret())
      .update(String(j.exp))
      .digest("hex");
    const a = Buffer.from(j.sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyDashboardPassword(pw: string | undefined): boolean {
  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  if (!expected || !pw) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(pw, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
