import { NextResponse } from "next/server";
import { parseAgentsFromEnv, getAgentByAlias, type AgentEntry } from "@/lib/agents";
import { resolveWalletForDegen } from "@/lib/wallet";
import { hlDirectClose } from "@/lib/hlDirectTrade";
import { requireSession } from "@/lib/auth-route";
import { appendActivity } from "@/lib/redis-activity";
import { hasForumAuth, postToForum } from "@/lib/forum";
import { formatPersonalizedTradeClose } from "@/lib/agent-personalities";
import { getAgentForumId, getAgentSignalsThreadId } from "@/lib/agent-forum-ids";
import { fetchDgPositions, type DgPositionRow } from "@/lib/degen";
import { degenAcpV1PerpClose } from "@/lib/degenAcpV1";

function normalizePair(p: string): string {
  return p.trim().toUpperCase().replace(/-USD$/i, "");
}

function normalizeCloseSide(s: unknown): "long" | "short" | null {
  if (s == null || s === "") return null;
  const x = String(s).toLowerCase();
  if (x === "short" || x === "s") return "short";
  if (x === "long" || x === "l") return "long";
  return null;
}

async function loadPositionInfo(
  agent: AgentEntry,
  pairNorm: string
): Promise<DgPositionRow | null> {
  const walletAddr = (await resolveWalletForDegen(agent)) || "";
  if (!walletAddr) return null;
  try {
    const positions = await fetchDgPositions(walletAddr);
    return (
      positions.find(
        (pos) => normalizePair(pos.pair ?? "") === pairNorm
      ) ?? null
    );
  } catch {
    return null;
  }
}

async function forumAfterClose(
  alias: string,
  agent: AgentEntry,
  pair: string,
  positionInfo: DgPositionRow | null,
  fallbackSide?: "long" | "short" | null
): Promise<void> {
  const agentId = getAgentForumId(alias);
  const threadId = getAgentSignalsThreadId(alias);

  if (!agentId || !threadId) {
    console.log(`[Close] ⏭️  Forum: ${alias} için agent/thread id yok (agent-forum-ids).`);
    return;
  }
  if (!hasForumAuth(agent.forumApiKey)) {
    console.log(
      `[Close] ⏭️  Skipping forum post for ${alias} - no forumApiKey / DGCLAW_API_KEY`
    );
    return;
  }

  let pnlPercent = "N/A";
  if (
    positionInfo?.entryPrice &&
    positionInfo?.markPrice &&
    positionInfo?.side
  ) {
    const entry = parseFloat(positionInfo.entryPrice);
    const exit = parseFloat(positionInfo.markPrice);
    const leverage = Number(positionInfo.leverage) || 1;
    if (!Number.isNaN(entry) && !Number.isNaN(exit) && entry !== 0) {
      if (positionInfo.side === "long") {
        pnlPercent = (((exit - entry) / entry) * 100 * leverage).toFixed(2);
      } else {
        pnlPercent = (((entry - exit) / entry) * 100 * leverage).toFixed(2);
      }
    }
  }

  const fromPos = positionInfo?.side
    ? String(positionInfo.side).toLowerCase()
    : "";
  const side: "long" | "short" =
    fromPos === "short"
      ? "short"
      : fromPos === "long"
        ? "long"
        : fallbackSide === "short"
          ? "short"
          : "long";

  try {
    const { title, content } = formatPersonalizedTradeClose({
      agentAlias: alias,
      pair,
      side,
      entryPrice: positionInfo?.entryPrice || "—",
      exitPrice: positionInfo?.markPrice || "—",
      pnl: positionInfo?.unrealizedPnl || "—",
      pnlPercent,
      leverage: positionInfo?.leverage
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
}

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: {
    alias?: string;
    pair?: string;
    mode?: string;
    side?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const alias = body.alias?.trim();
  const pair = normalizePair(body.pair ?? "");
  const mode = body.mode?.trim().toLowerCase();
  const isV1 = mode === "degen_acp_v1" || mode === "acp_v1" || mode === "legacy";

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

  let positionInfo: DgPositionRow | null = null;
  try {
    positionInfo = await loadPositionInfo(agent, pair);
  } catch (e) {
    console.warn("[Close] Could not fetch position info:", e);
  }

  if (isV1) {
    const token = agent.forumApiKey?.trim();
    if (!token) {
      return NextResponse.json(
        {
          error:
            "ACP v1 kapatma için agent için forumApiKey (dgc_…) gerekli — AGENTS_JSON’a ekleyin (Degen / forum anahtarı).",
        },
        { status: 400 }
      );
    }
    let side = normalizeCloseSide(body.side);
    if (!side) {
      side = normalizeCloseSide(positionInfo?.side);
    }
    if (!side) {
      return NextResponse.json(
        {
          error:
            "ACP v1 close için yön (long/short) gerekli veya Degen’de bu parite için pozisyon görünmüyor — panelden yönü gönderilemiyor.",
        },
        { status: 400 }
      );
    }

    try {
      const data = await degenAcpV1PerpClose({
        bearerToken: token,
        pair,
        side,
      });

      await appendActivity({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        at: new Date().toISOString(),
        kind: "close",
        alias,
        pair,
        ok: true,
        detail: `degen_acp_v1 ${JSON.stringify(data).slice(0, 700)}`,
      });

      await forumAfterClose(
        alias,
        agent,
        pair,
        positionInfo,
        normalizeCloseSide(body.side)
      );

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
        detail: `degen_acp_v1 ${msg.slice(0, 800)}`,
      });

      return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
    }
  }

  const closeSideHint = normalizeCloseSide(body.side);

  try {
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

    await forumAfterClose(alias, agent, pair, positionInfo, closeSideHint);

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
