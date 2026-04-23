import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias } from "@/lib/agents";
import { hlDirectUsdClassTransfer } from "@/lib/hlDirectTrade";
import { requireSession } from "@/lib/auth-route";
import { appendActivity } from "@/lib/redis-activity";

/**
 * HL v2: spot ↔ perp USDC (usdClassTransfer). ACP `perp_deposit` job yok.
 * Body: { alias, amount, direction?: "spotToPerp" | "perpToSpot" } — varsayılan spotToPerp (marj yatırma).
 */
export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: { alias?: string; amount?: string; direction?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const alias = body.alias?.trim();
  const amount = body.amount?.trim();
  const dir = body.direction?.trim().toLowerCase();
  if (!alias || !amount) {
    return NextResponse.json(
      { error: "alias ve amount (USDC) gerekli" },
      { status: 400 }
    );
  }

  const toPerp = dir !== "perptospot" && dir !== "perp_to_spot";

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
  if (!agent) {
    return NextResponse.json({ error: "Bilinmeyen alias" }, { status: 404 });
  }

  try {
    const data = await hlDirectUsdClassTransfer(agent, { amount, toPerp });

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "deposit",
      alias,
      ok: true,
      detail: JSON.stringify({ direction: toPerp ? "spotToPerp" : "perpToSpot", amount, data }).slice(0, 800),
    });

    return NextResponse.json(data);
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
      ok: false,
      detail: msg.slice(0, 800),
    });

    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }
}
