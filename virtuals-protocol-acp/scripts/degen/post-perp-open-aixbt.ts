/**
 * AIXBT long open — perp_trade (Degen Claw).
 *
 * `pair` must match Hyperliquid’s symbol (typically "AIXBT").
 * `size` is coin amount on HL, not USDC. Default ~40 targets ~10 USDC notional
 * if AIXBT ≈ $0.25; override: `npx tsx scripts/degen/post-perp-open-aixbt.ts 35`
 *
 * Max leverage for this pair is 3x (5x is rejected by HL/Degen for AIXBT).
 */
import client from "../../src/lib/client.js";
import { loadApiKey } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

const SIZE_COINS = process.argv[2] ?? "40";

async function main() {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "open",
      pair: "AIXBT",
      side: "long",
      size: SIZE_COINS,
      leverage: 3,
    },
  };
  const r = await client.post<{ data: { jobId: number } }>("/acp/jobs", body);
  console.log(JSON.stringify(r.data));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
