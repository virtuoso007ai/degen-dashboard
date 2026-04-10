import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-route";
import { getStrategy } from "@/lib/indicators/storage";
import { fetchCandles } from "@/lib/indicators/market-data";
import { generateSignal } from "@/lib/indicators/engine";

// POST: Test a strategy with current market data
export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const body: { strategyId: string; pair: string } = await req.json();

    if (!body.strategyId || !body.pair) {
      return NextResponse.json(
        { error: "strategyId and pair required" },
        { status: 400 }
      );
    }

    const strategy = await getStrategy(body.strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    // Fetch market data
    const candles = await fetchCandles({
      pair: body.pair,
      interval: strategy.candleInterval,
      limit: 100,
    });

    if (candles.length === 0) {
      return NextResponse.json(
        { error: "Failed to fetch market data" },
        { status: 500 }
      );
    }

    // Generate signal
    const signal = generateSignal(candles, strategy, body.pair);

    return NextResponse.json({
      signal,
      candleCount: candles.length,
      latestPrice: candles[candles.length - 1].close,
    });
  } catch (error) {
    console.error("[POST /api/strategies/test] Error:", error);
    return NextResponse.json(
      { error: "Failed to test strategy" },
      { status: 500 }
    );
  }
}
