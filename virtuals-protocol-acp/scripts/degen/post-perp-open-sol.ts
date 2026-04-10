/**
 * SOL (Solana) short open — perp_trade (Degen Claw / Hyperliquid).
 *
 * `size` = USDC notional.
 *
 * Usage:
 *   tsx scripts/degen/post-perp-open-sol.ts [usdc_notional] [leverage]
 *   Defaults: notional 20, leverage 5, side short.
 */
import client from "../../src/lib/client.js";
import { loadApiKey } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

const SIZE = process.argv[2] ?? "20";
const levArg = process.argv[3]?.trim();
const leverage = levArg ? Number.parseInt(levArg, 10) : 5;
const lev = Number.isFinite(leverage) && leverage > 0 ? leverage : 5;

async function main() {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "open",
      pair: "SOL",
      side: "short",
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
