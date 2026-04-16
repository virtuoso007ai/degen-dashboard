import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias } from "@/lib/agents";
import { hlDirectOpen } from "@/lib/hlDirectTrade";
import { requireSession } from "@/lib/auth-route";
import { appendActivity } from "@/lib/redis-activity";
import { postToForum } from "@/lib/forum";
import { formatPersonalizedTradeOpen } from "@/lib/agent-personalities";
import { getAgentForumId, getAgentSignalsThreadId } from "@/lib/agent-forum-ids";

type OpenMultiBody = {
  allAgents?: boolean;
  aliases?: string[];
  pair?: string;
  side?: string;
  size?: string;
  leverage?: number;
  stopLoss?: string;
  takeProfit?: string;
  orderType?: string;
  limitPrice?: string;
};

export type OpenMultiResultRow = {
  alias: string;
  ok: boolean;
  error?: string;
  data?: unknown;
};

async function forumAfterOpen(
  alias: string,
  agent: { forumApiKey?: string },
  pair: string,
  side: "long" | "short",
  stopLoss: string | undefined,
  takeProfit: string | undefined,
  lev: number,
  limitPrice: string | undefined
) {
  const agentId = getAgentForumId(alias);
  const threadId = getAgentSignalsThreadId(alias);
  if (!agentId || !threadId || !agent.forumApiKey) return;
  try {
    const { title, content } = formatPersonalizedTradeOpen({
      agentAlias: alias,
      pair,
      side,
      entryPrice: limitPrice || "Market",
      stopLoss,
      takeProfit,
      leverage: Math.floor(lev),
    });
    await postToForum({
      agentId,
      threadId: threadId.toString(),
      title,
      content,
      apiKey: agent.forumApiKey,
    });
  } catch (e) {
    console.error(`[OpenMulti] Forum ${alias}:`, e);
  }
}

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: OpenMultiBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pair = body.pair?.trim().toUpperCase();
  const side = body.side?.toLowerCase() as "long" | "short" | undefined;
  const size = body.size?.trim();
  const lev = body.leverage ?? 5;
  const stopLoss = body.stopLoss?.trim() || undefined;
  const takeProfit = body.takeProfit?.trim() || undefined;
  const orderType = body.orderType?.trim().toLowerCase() as "market" | "limit" | undefined;
  const limitPrice = body.limitPrice?.trim() || undefined;

  if (!pair || (side !== "long" && side !== "short") || !size) {
    return NextResponse.json(
      { error: "pair, side (long|short), size gerekli; allAgents veya aliases gerekli" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(lev) || lev < 1) {
    return NextResponse.json({ error: "leverage geçersiz" }, { status: 400 });
  }

  const sizeUsd = parseFloat(size);
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) {
    return NextResponse.json(
      { error: "size pozitif USDC notional (sayı) olmalı" },
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

  let targetAliases: string[];
  if (body.allAgents === true) {
    targetAliases = agents.map((a) => a.alias);
  } else if (Array.isArray(body.aliases) && body.aliases.length > 0) {
    targetAliases = body.aliases.map((a) => a.trim().toLowerCase()).filter(Boolean);
  } else {
    return NextResponse.json(
      { error: "allAgents: true veya dolu aliases[] gerekli" },
      { status: 400 }
    );
  }

  const results: OpenMultiResultRow[] = [];
  const openParams = {
    pair,
    side: side!,
    sizeUsd,
    leverage: Math.floor(lev),
    stopLoss,
    takeProfit,
    orderType,
    limitPrice,
  };

  for (const alias of targetAliases) {
    const agent = getAgentByAlias(agents, alias);
    if (!agent) {
      results.push({ alias, ok: false, error: "Bilinmeyen alias" });
      continue;
    }
    try {
      const data = await hlDirectOpen(agent, openParams);
      await appendActivity({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        at: new Date().toISOString(),
        kind: "open",
        alias: agent.alias,
        pair,
        side: side!,
        size,
        leverage: Math.floor(lev),
        ok: true,
        detail: JSON.stringify(data).slice(0, 800),
      });
      await forumAfterOpen(
        agent.alias,
        agent,
        pair,
        side!,
        stopLoss,
        takeProfit,
        Math.floor(lev),
        limitPrice
      );
      results.push({ alias: agent.alias, ok: true, data });
    } catch (e) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as Error).message)
          : String(e);
      await appendActivity({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        at: new Date().toISOString(),
        kind: "open",
        alias: agent.alias,
        pair,
        side: side!,
        size,
        leverage: Math.floor(lev),
        ok: false,
        detail: msg.slice(0, 800),
      });
      results.push({ alias: agent.alias, ok: false, error: msg.slice(0, 500) });
    }
  }

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };

  // Hepsi başarısızsa HTTP 502 — aksi halde fetch `res.ok` true kalıyor, panel "gönderildi" sanıyordu.
  if (summary.total > 0 && summary.ok === 0) {
    const firstErr =
      results.find((r) => !r.ok)?.error ??
      "Tüm agentlar için HL emri başarısız (Vercel: AGENTS_JSON + HL_API_WALLET_KEY_<ALIAS>)";
    return NextResponse.json(
      { results, summary, error: firstErr },
      { status: 502 }
    );
  }

  return NextResponse.json({ results, summary });
}
