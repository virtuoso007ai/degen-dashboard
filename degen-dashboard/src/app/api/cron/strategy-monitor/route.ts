/**
 * Vercel Cron Job Endpoint
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/strategy-monitor",
 *     "schedule": "* /15 * * * *"
 *   }]
 * }
 */

import { NextResponse } from "next/server";
import { runStrategyMonitor } from "@/lib/strategy-monitor";

export async function GET(req: Request) {
  // Verify cron secret (optional but recommended)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[Cron] Unauthorized cron attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] ⏰ Strategy monitor triggered by cron");
    const health = await runStrategyMonitor();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      health,
    });
  } catch (error) {
    console.error("[Cron] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST (for manual testing)
export async function POST(req: Request) {
  return GET(req);
}
