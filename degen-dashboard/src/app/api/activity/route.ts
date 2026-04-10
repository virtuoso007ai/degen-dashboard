import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-route";
import { getActivity } from "@/lib/redis-activity";

export async function GET(req: Request) {
  const authErr = await requireSession();
  if (authErr) return authErr;

  // Debug logs for Vercel
  console.log("[Activity API] Redis URL exists:", !!process.env.UPSTASH_REDIS_REST_URL);
  console.log("[Activity API] Redis Token exists:", !!process.env.UPSTASH_REDIS_REST_TOKEN);

  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    const activities = await getActivity(limit);
    console.log("[Activity API] Activities fetched:", activities.length);
    return NextResponse.json({ activities });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Activity API] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
