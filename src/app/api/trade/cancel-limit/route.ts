import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias } from "@/lib/agents";
import { hlDirectCancelLimit } from "@/lib/hlDirectTrade";
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

  const oidNum = typeof oid === "string" ? parseInt(oid, 10) : Number(oid);
  if (!Number.isFinite(oidNum)) {
    return NextResponse.json({ error: "oid sayı olmalı" }, { status: 400 });
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
    const data = await hlDirectCancelLimit(agent, pair, oidNum);

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "cancel_limit",
      alias,
      pair,
      ok: true,
      detail: JSON.stringify({ oid: String(oid), data }).slice(0, 800),
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
