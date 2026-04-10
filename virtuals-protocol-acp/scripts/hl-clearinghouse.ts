/**
 * Hyperliquid clearinghouse snapshot for a wallet (same wallet Degen uses for HL).
 * Shows account value, margin usage, and open perp positions (not Base chain balances).
 *
 * Usage:
 *   npx tsx scripts/hl-clearinghouse.ts
 *   npx tsx scripts/hl-clearinghouse.ts 0xYourWallet
 */
import axios from "axios";
import { readConfig } from "../src/lib/config.js";

const HL_INFO = "https://api.hyperliquid.xyz/info";

async function main() {
  const arg = process.argv[2]?.trim();
  const cfg = readConfig();
  const fromConfig = cfg.agents?.find((a) => a.active)?.walletAddress;
  const user = arg || fromConfig;
  if (!user) {
    throw new Error("Pass wallet as argv or set active agent in config.json");
  }

  const { data } = await axios.post(HL_INFO, { type: "clearinghouseState", user }, { timeout: 30_000 });

  // Response shape varies; handle common fields.
  const ms = data?.crossMarginSummary ?? data?.marginSummary;
  const av = ms?.accountValue ?? ms?.accountValueUsd;
  const rawUsd = ms?.totalRawUsd;
  const ntlPos = ms?.totalNtlPos;
  const marginUsed = ms?.totalMarginUsed ?? ms?.totalMarginUsedUsd;

  console.log("Hyperliquid —", user);
  console.log("---");
  if (av != null) console.log("Hesap değeri (USD):       ", av);
  if (marginUsed != null) console.log("Kullanılan marj (USD):    ", marginUsed);
  if (ntlPos != null) console.log("Pozisyon notional (USD): ", ntlPos);
  if (rawUsd != null) console.log("Total raw USD:            ", rawUsd);

  const positions = data?.assetPositions ?? [];
  if (positions.length === 0) {
    console.log("\nAçık perp pozisyonu:      yok");
  } else {
    console.log("\nAçık perp pozisyonları:");
    for (const ap of positions) {
      const p = ap?.position ?? ap;
      const coin = p?.coin ?? "?";
      const szi = p?.szi ?? p?.size ?? "?";
      const entry = p?.entryPx ?? "?";
      const ntl = p?.positionValue ?? p?.marginUsed ?? "";
      console.log(`  ${coin}  size ${szi}  entry ${entry}  ${ntl ? `value ${ntl}` : ""}`);
    }
  }

  // Withdrawable / free collateral if present
  const w = data?.withdrawable;
  if (w != null) console.log("\nÇekilebilir / boşta (USD):", w);

  console.log("\n(Kaynak: HL clearinghouseState — üst seviye anahtarlar:", Object.keys(data || {}).join(", "), ")");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
