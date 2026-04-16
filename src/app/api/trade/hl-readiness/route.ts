import { NextResponse } from "next/server";
import { parseAgentsFromEnv } from "@/lib/agents";
import { requireSession } from "@/lib/auth-route";

export const dynamic = "force-dynamic";

/**
 * HL v2 trade için agent başına: master adres + API wallet key var mı (secret göstermez).
 * Vercel'de HL_API_WALLET_KEY_* eksikse burada görünür.
 */
export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const agents = parseAgentsFromEnv();
    const rows = agents.map((a) => {
      const hasMaster = !!(a.walletAddress?.trim());
      const hasHlKey = !!(a.hlApiWalletKey?.trim());
      const ready = hasMaster && hasHlKey;
      const missing: string[] = [];
      if (!hasMaster) missing.push("walletAddress veya HL_MASTER_ADDRESS_*");
      if (!hasHlKey) missing.push("hlApiWalletKey veya HL_API_WALLET_KEY_<ALIAS>");
      return {
        alias: a.alias,
        ready,
        missing: ready ? [] : missing,
      };
    });
    const allReady = rows.every((r) => r.ready);
    return NextResponse.json({ allReady, agents: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Config" },
      { status: 500 }
    );
  }
}
