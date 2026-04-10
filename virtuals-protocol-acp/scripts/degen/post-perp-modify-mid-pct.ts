/**
 * HL açık long/short için: mark (allMids) × **0.99** = stopLoss, × **1.01** = takeProfit (ters short’ta ters).
 * Fiyat yuvarlama: **BTC, ETH** tam sayı; diğerleri en fazla 2 ondalık.
 *
 * HL kullanıcı: HL_SUBACCOUNT_ADDRESS veya DEFAULT_HL_SUBACCOUNT.
 *
 *   npx tsx scripts/degen/post-perp-modify-mid-pct.ts
 */
import axios from "axios";
import client from "../../src/lib/client.js";
import { loadApiKey } from "../../src/lib/config.js";
import { DEFAULT_HL_SUBACCOUNT, DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

const HL = "https://api.hyperliquid.xyz/info";

function hlUser(): string {
  const e = process.env.HL_SUBACCOUNT_ADDRESS?.trim();
  return e || DEFAULT_HL_SUBACCOUNT;
}

function roundPx(coin: string, x: number): string {
  const u = coin.toUpperCase();
  if (u === "BTC" || u === "ETH") return String(Math.round(x));
  return String(Math.round(x * 100) / 100);
}

async function main() {
  const user = hlUser();
  const [{ data: ch }, { data: mids }] = await Promise.all([
    axios.post(HL, { type: "clearinghouseState", user }, { timeout: 30_000 }),
    axios.post(HL, { type: "allMids" }, { timeout: 30_000 }),
  ]);

  const midsMap = mids as Record<string, string>;
  const rows = ch?.assetPositions ?? [];
  let n = 0;

  for (const ap of rows) {
    const p = ap?.position ?? ap;
    const coin = p?.coin as string | undefined;
    const szi = parseFloat(String(p?.szi ?? "0"));
    if (!coin || szi === 0) continue;

    const midRaw = midsMap[coin];
    if (midRaw == null) {
      console.error(`[skip] ${coin}: no mid`);
      continue;
    }
    const mid = parseFloat(midRaw);
    if (!Number.isFinite(mid) || mid <= 0) continue;

    let slN: number;
    let tpN: number;
    if (szi > 0) {
      slN = mid * 0.99;
      tpN = mid * 1.01;
    } else {
      slN = mid * 1.01;
      tpN = mid * 0.99;
    }

    const stopLoss = roundPx(coin, slN);
    const takeProfit = roundPx(coin, tpN);

    console.error(`[perp_modify] ${coin} mid≈${mid} ${szi > 0 ? "long" : "short"} SL=${stopLoss} TP=${takeProfit}`);

    const body = {
      providerWalletAddress: DEGEN_CLAW_PROVIDER,
      jobOfferingName: "perp_modify",
      serviceRequirements: { pair: coin, stopLoss, takeProfit },
    };
    const res = await client.post<{ message?: string; data: { jobId: number } }>("/acp/jobs", body);
    console.log(JSON.stringify({ coin, ...res.data }));
    n++;
  }

  if (n === 0) console.error("Açık pozisyon yok veya mid bulunamadı.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
