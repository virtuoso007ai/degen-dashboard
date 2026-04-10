import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias } from "@/lib/agents";
import { createAcpClient, jobPerpDeposit } from "@/lib/acp";
import { requireSession } from "@/lib/auth-route";
import { appendActivity } from "@/lib/redis-activity";

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
      { error: "alias ve amount gerekli" },
      { status: 400 }
    );
  }

  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) {
    return NextResponse.json(
      { error: "amount pozitif sayı olmalı" },
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
    const data = await jobPerpDeposit(client, amount);

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "deposit",
      alias,
      size: amount,
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
      kind: "deposit",
      alias: alias!,
      size: amount,
      ok: false,
      detail: msg.slice(0, 800),
    });

    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }
}
