import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias } from "@/lib/agents";
import { requireSession } from "@/lib/auth-route";
import { appendActivity } from "@/lib/redis-activity";
import { runAcpPerpDeposit } from "@/lib/acpPerpDeposit";
import {
  getPerpDepositProxy,
  runAcpPerpDepositProxied,
} from "@/lib/acpPerpDepositProxy";

/**
 * Base (8453) agent master USDC → Hyperliquid — ACP `perp_deposit` + `client fund`.
 *
 * - Doğrudan: ACP_CLI_DIR + acp-cli-v2 (Railway’de tam uygulama veya yerel).
 * - Vercel: ACP_PERP_DEPOSIT_PROXY_URL + ACP_PERP_DEPOSIT_PROXY_SECRET → harici worker (Railway).
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: { alias?: string; amount?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const alias = body.alias?.trim();
  const amount = body.amount?.trim();
  if (!alias || !amount) {
    return NextResponse.json(
      { error: "alias ve amount (USDC) gerekli" },
      { status: 400 }
    );
  }

  let agents;
  try {
    agents = parseAgentsFromEnv();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Config" },
      { status: 500 }
    );
  }

  const agent = getAgentByAlias(agents, alias);
  const master = agent?.walletAddress?.trim();
  if (!agent || !master) {
    return NextResponse.json(
      { error: "Bilinmeyen alias veya walletAddress yok" },
      { status: 404 }
    );
  }

  try {
    const proxy = getPerpDepositProxy();
    const result = proxy
      ? await runAcpPerpDepositProxied({
          masterAddress: master,
          amountUsdc: amount,
        })
      : runAcpPerpDeposit({ masterAddress: master, amountUsdc: amount });

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "deposit",
      alias,
      pair: "perp_deposit",
      ok: true,
      detail: JSON.stringify({
        jobId: result.jobId,
        amount: result.amount,
        message: result.message,
      }).slice(0, 800),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as Error).message)
        : String(e);

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "deposit",
      alias: alias!,
      pair: "perp_deposit",
      ok: false,
      detail: msg.slice(0, 800),
    });

    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }
}
