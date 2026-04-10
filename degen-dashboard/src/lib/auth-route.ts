import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieName, verifySessionToken } from "./session";

/** Oturum yoksa 401 döner; varsa null. */
export async function requireSession(): Promise<NextResponse | null> {
  const c = await cookies();
  const t = c.get(cookieName())?.value;
  if (!verifySessionToken(t)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
