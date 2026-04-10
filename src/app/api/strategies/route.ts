import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-route";
import {
  saveStrategy,
  getAgentStrategies,
  getAllStrategies,
  getAllEnabledStrategies,
  updateStrategy,
  deleteStrategy,
} from "@/lib/indicators/storage";
import { StrategyConfig } from "@/lib/indicators/types";

// GET: Fetch strategies (all, or by agent)
export async function GET(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const agentAlias = searchParams.get("agent");

  try {
    if (agentAlias) {
      const strategies = await getAgentStrategies(agentAlias);
      return NextResponse.json(strategies);
    } else {
      // Return ALL strategies (enabled + disabled) for dashboard UI
      const strategies = await getAllStrategies();
      return NextResponse.json(strategies);
    }
  } catch (error) {
    console.error("[GET /api/strategies] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategies" },
      { status: 500 }
    );
  }
}

// POST: Create new strategy
export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const body: Partial<StrategyConfig> = await req.json();

    if (!body.agentAlias || !body.strategyType) {
      return NextResponse.json(
        { error: "agentAlias and strategyType required" },
        { status: 400 }
      );
    }

    const strategy: StrategyConfig = {
      id: `${body.agentAlias}_${body.strategyType}_${Date.now()}`,
      agentAlias: body.agentAlias,
      strategyType: body.strategyType,
      enabled: body.enabled ?? false,
      pairs: body.pairs || [], // Empty array = scan all pairs
      tickInterval: body.tickInterval || "15m",
      candleInterval: body.candleInterval || "15m",
      positionSizeUSD: body.positionSizeUSD || 100,
      leverage: body.leverage || 3,
      takeProfitPercent: body.takeProfitPercent || 3,
      stopLossPercent: body.stopLossPercent || 3,
      minSignalStrength: body.minSignalStrength || 60,
      parameters: body.parameters || {},
      createdAt: new Date().toISOString(),
    };

    const success = await saveStrategy(strategy);
    if (success) {
      return NextResponse.json(strategy, { status: 201 });
    } else {
      return NextResponse.json(
        { error: "Failed to save strategy" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[POST /api/strategies] Error:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

// PUT: Update strategy
export async function PUT(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const body: StrategyConfig = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Strategy ID required" },
        { status: 400 }
      );
    }

    const success = await updateStrategy(body);
    if (success) {
      return NextResponse.json(body);
    } else {
      return NextResponse.json(
        { error: "Failed to update strategy" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[PUT /api/strategies] Error:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

// DELETE: Remove strategy
export async function DELETE(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const strategyId = searchParams.get("id");
  const agentAlias = searchParams.get("agent");

  if (!strategyId || !agentAlias) {
    return NextResponse.json(
      { error: "Strategy ID and agent alias required" },
      { status: 400 }
    );
  }

  try {
    const success = await deleteStrategy(strategyId, agentAlias);
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Failed to delete strategy" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[DELETE /api/strategies] Error:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
