/**
 * BTC long open — perp_trade (Degen Claw).
 *
 * `size` = USDC notional (same pattern as ETH opens).
 *
 * Usage:
 *   tsx scripts/degen/post-perp-open-btc.ts [usdc_notional] [leverage]
 *   Defaults: notional 12, leverage 5.
 */
import client from "../../src/lib/client.js";
import { loadApiKey } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

const SIZE = process.argv[2] ?? "12";
const levArg = process.argv[3]?.trim();
const leverage = levArg ? Number.parseInt(levArg, 10) : 5;
const lev = Number.isFinite(leverage) && leverage > 0 ? leverage : 5;

async function main() {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "open",
      pair: "BTC",
      side: "long",
      size: SIZE,
      leverage: lev,
    },
  };
  const r = await client.post<{ data: { jobId: number } }>("/acp/jobs", body);
  console.log(JSON.stringify(r.data));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
