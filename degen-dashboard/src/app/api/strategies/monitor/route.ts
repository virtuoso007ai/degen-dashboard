import { NextResponse } from "next/server";
import { runStrategyMonitor, getMonitorHealth } from "@/lib/strategy-monitor";

// Simple API key authentication for external schedulers
function verifyApiKey(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const apiKey = process.env.STRATEGY_MONITOR_API_KEY;
  
  // If no API key set, allow (backward compatibility)
  if (!apiKey) return true;
  
  // Check Bearer token
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return token === apiKey;
  }
  
  return false;
}

// GET: Get monitor health status
export async function GET(req: Request) {
  if (!verifyApiKey(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = getMonitorHealth();
    return NextResponse.json(health);
  } catch (error) {
    console.error("[GET /api/strategies/monitor] Error:", error);
    return NextResponse.json(
      { error: "Failed to get health status" },
      { status: 500 }
    );
  }
}

// POST: Manually trigger monitor cycle
export async function POST(req: Request) {
  if (!verifyApiKey(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[POST /api/strategies/monitor] Manual trigger started");
    const health = await runStrategyMonitor();
    
    return NextResponse.json({
      message: "Monitor cycle completed",
      health,
    });
  } catch (error) {
    console.error("[POST /api/strategies/monitor] Error:", error);
    return NextResponse.json(
      { error: "Monitor cycle failed" },
      { status: 500 }
    );
  }
}
