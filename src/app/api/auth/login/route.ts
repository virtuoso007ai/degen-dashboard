import { NextResponse } from "next/server";
import {
  cookieName,
  createSessionToken,
  sessionMaxAgeSec,
  verifyDashboardPassword,
} from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { password?: string };
    if (!verifyDashboardPassword(body.password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    const token = createSessionToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionMaxAgeSec(),
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
