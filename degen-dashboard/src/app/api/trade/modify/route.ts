import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias } from "@/lib/agents";
import { createAcpClient, jobPerpModify } from "@/lib/acp";
import { requireSession } from "@/lib/auth-route";
import { appendActivity } from "@/lib/redis-activity";

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: {
    alias?: string;
    pair?: string;
    stopLoss?: string;
    takeProfit?: string;
    leverage?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const alias = body.alias?.trim();
  const pair = body.pair?.trim().toUpperCase();
  const stopLoss = body.stopLoss?.trim() || undefined;
  const takeProfit = body.takeProfit?.trim() || undefined;
  const leverage = body.leverage;

  if (!alias || !pair) {
    return NextResponse.json(
      { error: "alias ve pair gerekli" },
      { status: 400 }
    );
  }
  if (!stopLoss && !takeProfit && leverage == null) {
    return NextResponse.json(
      { error: "stopLoss, takeProfit veya leverage'dan en az biri gerekli" },
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
  if (!agent) {
    return NextResponse.json({ error: "Bilinmeyen alias" }, { status: 404 });
  }

  try {
    const client = createAcpClient(agent.apiKey);
    const data = await jobPerpModify(client, {
      pair,
      stopLoss,
      takeProfit,
      leverage,
    });

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "modify",
      alias,
      pair,
      ok: !!data?.data?.jobId,
      detail: JSON.stringify(data).slice(0, 800),
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
      kind: "modify",
      alias: alias!,
      pair,
      ok: false,
      detail: msg.slice(0, 800),
    });

    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }
}
