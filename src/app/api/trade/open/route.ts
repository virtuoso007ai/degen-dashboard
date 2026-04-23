import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias } from "@/lib/agents";
import { hlDirectOpen } from "@/lib/hlDirectTrade";
import { requireSession } from "@/lib/auth-route";
import { appendActivity } from "@/lib/redis-activity";
import { hasForumAuth, postToForum } from "@/lib/forum";
import { formatPersonalizedTradeOpen } from "@/lib/agent-personalities";
import { getAgentForumId, getAgentSignalsThreadId } from "@/lib/agent-forum-ids";

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: {
    alias?: string;
    pair?: string;
    side?: string;
    size?: string;
    leverage?: number;
    stopLoss?: string;
    takeProfit?: string;
    orderType?: string;
    limitPrice?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const alias = body.alias?.trim();
  const pair = body.pair?.trim().toUpperCase();
  const side = body.side?.toLowerCase() as "long" | "short" | undefined;
  const size = body.size?.trim();
  const lev = body.leverage ?? 5;
  const stopLoss = body.stopLoss?.trim() || undefined;
  const takeProfit = body.takeProfit?.trim() || undefined;
  const orderType = body.orderType?.trim().toLowerCase() as "market" | "limit" | undefined;
  const limitPrice = body.limitPrice?.trim() || undefined;

  if (!alias || !pair || (side !== "long" && side !== "short") || !size) {
    return NextResponse.json(
      { error: "alias, pair, side (long|short), size gerekli" },
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

  const agent = getAgentByAlias(agents, alias);
  if (!agent) {
    return NextResponse.json({ error: "Bilinmeyen alias" }, { status: 404 });
  }

  try {
    const data = await hlDirectOpen(agent, {
      pair,
      side,
      sizeUsd,
      leverage: Math.floor(lev),
      stopLoss,
      takeProfit,
      orderType,
      limitPrice,
    });

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "open",
      alias,
      pair,
      side,
      size,
      leverage: Math.floor(lev),
      ok: true,
      detail: JSON.stringify(data).slice(0, 800),
    });

    const agentId = getAgentForumId(alias);
    const threadId = getAgentSignalsThreadId(alias);

    if (agentId && threadId && hasForumAuth(agent.forumApiKey)) {
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

        const forumResult = await postToForum({
          agentId,
          threadId: threadId.toString(),
          title,
          content,
          apiKey: agent.forumApiKey,
        });

        if (forumResult.success) {
          console.log(`[Open] ✅ Forum post created for ${alias} - ${pair}`);
        } else {
          console.error(`[Open] ❌ Forum post failed:`, forumResult.error);
        }
      } catch (forumError) {
        console.error("[Open] Forum post exception:", forumError);
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as Error).message)
        : String(e);

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "open",
      alias: alias!,
      pair,
      side,
      size,
      leverage: Math.floor(lev),
      ok: false,
      detail: msg.slice(0, 800),
    });

    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }
}
