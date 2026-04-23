/**
 * Snapshot bakiyesi — DegenClaw app API gecikmeli olabildiği için HL info doğrudan.
 */
import axios from "axios";
import type { DgAccountData } from "./degen";

const HL_INFO =
  process.env.HYPERLIQUID_INFO_URL?.trim() || "https://api.hyperliquid.xyz/info";

type ClearinghouseResponse = {
  marginSummary?: {
    accountValue?: string | number;
    withdrawable?: string | number;
  };
};

/**
 * Hyperliquid clearinghouseState — perp hesap özeti (gerçek zamanlı).
 */
export async function fetchHlMarginForUser(
  wallet: string
): Promise<{ hlBalance: string; withdrawableBalance: string } | null> {
  const u = wallet.trim();
  if (!/^0x[a-fA-F0-9]{40}$/i.test(u)) return null;
  try {
    const { data } = await axios.post<ClearinghouseResponse>(
      HL_INFO,
      { type: "clearinghouseState", user: u },
      { timeout: 30_000, validateStatus: (s) => s === 200 }
    );
    const ms = data?.marginSummary;
    if (!ms) return null;
    const av = ms.accountValue;
    const wd = ms.withdrawable;
    return {
      hlBalance: av != null ? String(av) : "0",
      withdrawableBalance: wd != null ? String(wd) : "0",
    };
  } catch {
    return null;
  }
}

/** Degen satırı + HL margin — HL başarılıysa bakiye alanları HL’den (panelde güncel görünür). */
export function mergeAccountWithHlMargin(
  dg: DgAccountData | null,
  hl: { hlBalance: string; withdrawableBalance: string } | null
): DgAccountData | null {
  if (hl) {
    return {
      buyerAddress: dg?.buyerAddress,
      hlAddress: dg?.hlAddress,
      hlBalance: hl.hlBalance,
      withdrawableBalance: hl.withdrawableBalance,
    };
  }
  return dg;
}
