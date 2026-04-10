import { NextResponse } from "next/server";
import { parseAgentsFromEnv } from "@/lib/agents";
import { requireSession } from "@/lib/auth-route";
import { fetchDgAccount, fetchDgPositions } from "@/lib/degen";
import { resolveWalletForDegen } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let agents;
  try {
    agents = parseAgentsFromEnv();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Config error" },
      { status: 500 }
    );
  }

  const rows = await Promise.all(
    agents.map(async (a) => {
      try {
        const w = await resolveWalletForDegen(a);
        if (!w) {
          return {
            alias: a.alias,
            label: a.label,
            wallet: null as string | null,
            error: "Cüzdan çözülemedi",
            positions: [] as unknown[],
            account: null,
          };
        }
        const [positions, account] = await Promise.all([
          fetchDgPositions(w),
          fetchDgAccount(w),
        ]);
        return {
          alias: a.alias,
          label: a.label,
          wallet: w,
          error: null as string | null,
          positions,
          account,
        };
      } catch (e) {
        return {
          alias: a.alias,
          label: a.label,
          wallet: null as string | null,
          error: e instanceof Error ? e.message : String(e),
          positions: [] as unknown[],
          account: null,
        };
      }
    })
  );

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    agents: rows,
  });
}
