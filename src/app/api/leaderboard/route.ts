import { NextResponse } from "next/server";
import axios from "axios";
import { DEFAULT_LEADERBOARD_API } from "@/lib/constants";
import { parseAgentsFromEnv } from "@/lib/agents";
import { requireSession } from "@/lib/auth-route";
import { resolveWalletForDegen } from "@/lib/wallet";

export const dynamic = "force-dynamic";

function normalizeWallet(w: string): string {
  return w.trim().toLowerCase();
}

export async function GET(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "full";
  const seasonId =
    process.env.DEGEN_LEADERBOARD_SEASON_ID?.trim() ||
    searchParams.get("seasonId") ||
    "2";

  const base = (
    process.env.DEGEN_LEADERBOARD_API?.trim() || DEFAULT_LEADERBOARD_API
  ).replace(/\/$/, "");

  try {
    if (mode === "top") {
      const url = `${base}?limit=20&offset=0&seasonId=${encodeURIComponent(seasonId)}`;
      const { data } = await axios.get(url, { timeout: 45_000 });
      return NextResponse.json(data);
    }

    const all: unknown[] = [];
    let offset = 0;
    const limit = 100;
    let total = 0;
    let season: unknown;
    for (let i = 0; i < 200; i++) {
      const url = `${base}?limit=${limit}&offset=${offset}&seasonId=${encodeURIComponent(seasonId)}`;
      const { data } = await axios.get<{
        data?: unknown[];
        season?: unknown;
        pagination?: { total?: number; hasMore?: boolean };
      }>(url, { timeout: 60_000 });
      const chunk = data?.data ?? [];
      all.push(...chunk);
      if (data?.season) season = data.season;
      if (data?.pagination?.total != null) total = data.pagination.total;
      if (data?.pagination?.hasMore !== true || chunk.length === 0) break;
      offset += limit;
    }

    let ours: { alias: string; label?: string; rank: number | null }[] = [];
    try {
      const agents = parseAgentsFromEnv();
      const byWallet = new Map<string, { rank?: number }>();
      for (const row of all as { agentAddress?: string; performance?: { rank?: number } }[]) {
        const addr = row.agentAddress?.trim();
        if (!addr) continue;
        const k = normalizeWallet(addr);
        const r = row.performance?.rank;
        if (r != null && !byWallet.has(k)) byWallet.set(k, { rank: r });
      }
      ours = await Promise.all(
        agents.map(async (a) => {
          const w = await resolveWalletForDegen(a);
          if (!w) return { alias: a.alias, label: a.label, rank: null };
          const hit = byWallet.get(normalizeWallet(w));
          return {
            alias: a.alias,
            label: a.label,
            rank: hit?.rank ?? null,
          };
        })
      );
    } catch {
      ours = [];
    }

    return NextResponse.json({
      season,
      total: total || all.length,
      rows: all,
      ours,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
