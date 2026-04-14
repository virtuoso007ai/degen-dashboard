import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getHlWallet } from "@/lib/agents";
import { requireSession } from "@/lib/auth-route";
import axios from "axios";

export const dynamic = "force-dynamic";

const HL_INFO_URL =
  process.env.HYPERLIQUID_INFO_URL?.trim() || "https://api.hyperliquid.xyz/info";

type HyperLiquidOpenOrder = {
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  oid: number;
  timestamp: number;
  origSz: string;
};

async function fetchHyperLiquidOpenOrders(wallet: string): Promise<HyperLiquidOpenOrder[]> {
  try {
    const { data } = await axios.post<HyperLiquidOpenOrder[]>(
      HL_INFO_URL,
      {
        type: "openOrders",
        user: wallet,
      },
      { timeout: 30000 }
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let agents;
  try {
    agents = parseAgentsFromEnv();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Config error" },
      { status: 500 }
    );
  }

  const rows = await Promise.all(
    agents.map(async (a) => {
      try {
        const w = getHlWallet(a);
        if (!w) {
          return {
            alias: a.alias,
            label: a.label,
            wallet: null as string | null,
            error: "HL cüzdan yok",
            orders: [] as HyperLiquidOpenOrder[],
          };
        }
        const orders = await fetchHyperLiquidOpenOrders(w);
        return {
          alias: a.alias,
          label: a.label,
          wallet: w,
          error: null as string | null,
          orders,
        };
      } catch (e) {
        return {
          alias: a.alias,
          label: a.label,
          wallet: null as string | null,
          error: e instanceof Error ? e.message : String(e),
          orders: [] as HyperLiquidOpenOrder[],
        };
      }
    })
  );

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    agents: rows,
  });
}
