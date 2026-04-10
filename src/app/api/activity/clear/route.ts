import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-route";
import { clearActivity } from "@/lib/redis-activity";

export async function POST(req: Request) {
  const authErr = await requireSession();
  if (authErr) return authErr;

  try {
    await clearActivity();
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
