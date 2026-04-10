/**
 * perp_trade close — arbitrary pair (minimal { action, pair }).
 * Usage: tsx scripts/degen/post-perp-close-pair.ts BTC
 */
import client from "../../src/lib/client.js";
import { loadApiKey } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

const pair = process.argv[2]?.trim().toUpperCase();

async function main() {
  if (!pair) {
    console.error("Usage: tsx scripts/degen/post-perp-close-pair.ts <PAIR>");
    process.exit(1);
  }
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "close",
      pair,
    },
  };
  const r = await client.post<{ data: { jobId: number } }>("/acp/jobs", body);
  console.log(JSON.stringify(r.data));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
