import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias, getHlWallet } from "@/lib/agents";
import { hlDirectClose } from "@/lib/hlDirectTrade";
import { requireSession } from "@/lib/auth-route";
import { appendActivity } from "@/lib/redis-activity";
import { postToForum } from "@/lib/forum";
import { formatPersonalizedTradeClose } from "@/lib/agent-personalities";
import { getAgentForumId, getAgentSignalsThreadId } from "@/lib/agent-forum-ids";
import { fetchDgPositions, type DgPositionRow } from "@/lib/degen";

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: { alias?: string; pair?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const alias = body.alias?.trim();
  const pair = body.pair?.trim();
  if (!alias || !pair) {
    return NextResponse.json({ error: "alias ve pair gerekli" }, { status: 400 });
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
    let positionInfo: DgPositionRow | null = null;
    try {
      const walletAddr = getHlWallet(agent) || agent.walletAddress || "";
      if (walletAddr) {
        const positions = await fetchDgPositions(walletAddr);
        positionInfo =
          positions.find((p) => p.pair?.toUpperCase() === pair.toUpperCase()) ?? null;
      }
    } catch (e) {
      console.warn("[Close] Could not fetch position info:", e);
    }

    const data = await hlDirectClose(agent, pair);

    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "close",
      alias,
      pair,
      ok: true,
      detail: JSON.stringify(data).slice(0, 800),
    });

    if (positionInfo) {
      const agentId = getAgentForumId(alias);
      const threadId = getAgentSignalsThreadId(alias);

      if (agentId && threadId && agent.forumApiKey) {
        try {
          let pnlPercent = "N/A";
          if (positionInfo.entryPrice && positionInfo.markPrice && positionInfo.side) {
            const entry = parseFloat(positionInfo.entryPrice);
            const exit = parseFloat(positionInfo.markPrice);
            const leverage = Number(positionInfo.leverage) || 1;

            if (positionInfo.side === "long") {
              pnlPercent = (((exit - entry) / entry) * 100 * leverage).toFixed(2);
            } else {
              pnlPercent = (((entry - exit) / entry) * 100 * leverage).toFixed(2);
            }
          }

          const sideRaw = (positionInfo.side || "long").toString().toLowerCase();
          const side: "long" | "short" = sideRaw === "short" ? "short" : "long";

          const { title, content } = formatPersonalizedTradeClose({
            agentAlias: alias,
            pair: pair,
            side,
            entryPrice: positionInfo.entryPrice || "N/A",
            exitPrice: positionInfo.markPrice || "N/A",
            pnl: positionInfo.unrealizedPnl || "N/A",
            pnlPercent: pnlPercent,
            leverage: positionInfo.leverage
              ? parseInt(String(positionInfo.leverage), 10)
              : undefined,
          });

          const forumResult = await postToForum({
            agentId,
            threadId: threadId.toString(),
            title,
            content,
            apiKey: agent.forumApiKey,
          });

          if (forumResult.success) {
            console.log(`[Close] ✅ Forum post created for ${alias} - ${pair}`);
          } else {
            console.error(`[Close] ❌ Forum post failed:`, forumResult.error);
          }
        } catch (forumError) {
          console.error("[Close] Forum post exception:", forumError);
        }
      } else if (!agent.forumApiKey) {
        console.log(`[Close] ⏭️  Skipping forum post for ${alias} - no forumApiKey`);
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
      kind: "close",
      alias: alias!,
      pair,
      ok: false,
      detail: msg.slice(0, 800),
    });

    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }
}
