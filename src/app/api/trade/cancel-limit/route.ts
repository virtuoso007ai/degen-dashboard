import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias, getHlWallet } from "@/lib/agents";
import { createAcpClient, jobPerpCancelLimit } from "@/lib/acp";
import { requireSession } from "@/lib/auth-route";
import { appendActivity } from "@/lib/redis-activity";

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: { alias?: string; pair?: string; oid?: string | number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const alias = body.alias?.trim();
  const pair = body.pair?.trim().toUpperCase();
  const oid = body.oid;
  if (!alias || !pair || oid == null || String(oid).trim() === "") {
    return NextResponse.json(
      { error: "alias, pair ve oid gerekli" },
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
    const hlUser = getHlWallet(agent);
    const data = await jobPerpCancelLimit(client, pair, oid, hlUser);

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "cancel_limit",
      alias,
      pair,
      ok: !!(data as { data?: { jobId?: number } })?.data?.jobId,
      detail: JSON.stringify({ oid: String(oid), ...data }).slice(0, 800),
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
      kind: "cancel_limit",
      alias: alias!,
      pair,
      ok: false,
      detail: msg.slice(0, 800),
    });

    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }
}
