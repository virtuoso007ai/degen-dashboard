/**
 * VIRTUAL long open — perp_trade (Degen Claw).
 *
 * `size` is coin amount on Hyperliquid (not USDC). ~15 USDC notional ≈ **21** coins
 * at ~$0.71/VIRTUAL (wolfy reference). ~10 USDC ≈ 14 coins. ~20 USDC ≈ **28** coins.
 *
 * Usage:
 *   tsx scripts/degen/post-perp-open-virtual.ts [coins] [leverage]
 *   Defaults: 21 coins, leverage 5.
 */
import client from "../../src/lib/client.js";
import { loadApiKey } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

const SIZE_COINS = process.argv[2] ?? "21";
const levArg = process.argv[3]?.trim();
const leverage = levArg ? Number.parseInt(levArg, 10) : 5;
const lev = Number.isFinite(leverage) && leverage > 0 ? leverage : 5;

async function main() {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "open",
      pair: "VIRTUAL",
      side: "long",
      size: SIZE_COINS,
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
