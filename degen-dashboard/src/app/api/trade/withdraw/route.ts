import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias } from "@/lib/agents";
import { createAcpClient, jobPerpWithdraw } from "@/lib/acp";
import { requireSession } from "@/lib/auth-route";
import { resolveWalletForDegen } from "@/lib/wallet";
import { appendActivity } from "@/lib/redis-activity";

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: { alias?: string; amount?: string; recipient?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const alias = body.alias?.trim();
  const amount = body.amount?.trim();
  const recipientRaw = body.recipient?.trim();

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

  let recipient = recipientRaw;
  if (!recipient) {
    const w = await resolveWalletForDegen(agent);
    if (!w) {
      return NextResponse.json(
        { error: "Agent cüzdanı çözülemedi — recipient belirt" },
        { status: 400 }
      );
    }
    recipient = w;
  }

  try {
    const client = createAcpClient(agent.apiKey);
    const data = await jobPerpWithdraw(client, { amount, recipient });

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "withdraw",
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
      kind: "withdraw",
      alias: alias!,
      size: amount,
      ok: false,
      detail: msg.slice(0, 800),
    });

    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }
}
