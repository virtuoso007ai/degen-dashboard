/**
 * ETH long open — perp_trade (Degen Claw).
 *
 * `size` is treated as **USDC notional** (e.g. `180` = $180 in successful jobs).
 * HL rejects with "minimum value of $10" if the effective order is **under** $10
 * (rounding, fees, or exactly $10 on a strict check). Use **12** as default so a
 * "~10 USDC" intent clears the floor safely; override e.g. `11` or `10.5` if your route accepts it.
 *
 * Usage:
 *   tsx scripts/degen/post-perp-open-eth.ts [usdc_notional] [leverage]
 *   Default notional 12, default leverage 5.
 */
import client from "../../src/lib/client.js";
import { loadApiKey } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

const SIZE_ETH = process.argv[2] ?? "12";
const levArg = process.argv[3]?.trim();
const leverage = levArg ? Number.parseInt(levArg, 10) : 5;
const lev = Number.isFinite(leverage) && leverage > 0 ? leverage : 5;

async function main() {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "open",
      pair: "ETH",
      side: "long",
      size: SIZE_ETH,
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
