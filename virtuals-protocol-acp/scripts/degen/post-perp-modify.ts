/**
 * perp_modify — Degen Claw: HL açık pozda TP/SL güncelleme.
 *
 * BTC/ETH gibi paritelerde HL bazen kesirli TP/SL reddeder (`Invalid TP/SL price`).
 * Tam sayı gönder: `--int` ile SL/TP yuvarlanır veya doğrudan düz rakam yaz.
 *
 * Kullanım:
 *   tsx scripts/degen/post-perp-modify.ts <pair> <stopLoss> <takeProfit> [--int]
 *
 * `--int`: stopLoss ve takeProfit değerlerini Math.round ile tam sayı string yapar.
 */
import client from "../../src/lib/client.js";
import { loadApiKey } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

function parseArgs(): { pair: string; stopLoss: string; takeProfit: string } {
  const args = process.argv.slice(2).filter(Boolean);
  let roundInt = false;
  if (args[args.length - 1] === "--int") {
    roundInt = true;
    args.pop();
  }

  const pair = args[0]?.trim();
  const slRaw = args[1]?.trim();
  const tpRaw = args[2]?.trim();

  if (!pair || !slRaw || !tpRaw) {
    console.error(
      "Usage: tsx scripts/degen/post-perp-modify.ts <pair> <stopLoss> <takeProfit> [--int]\n" +
        "Example: tsx scripts/degen/post-perp-modify.ts BTC 69690 72468\n" +
        "         tsx scripts/degen/post-perp-modify.ts ETH 2121 2220.99 --int"
    );
    process.exit(1);
  }

  if (!roundInt) {
    return { pair, stopLoss: slRaw, takeProfit: tpRaw };
  }

  const sl = Math.round(Number(slRaw));
  const tp = Math.round(Number(tpRaw));
  if (!Number.isFinite(sl) || !Number.isFinite(tp)) {
    console.error("--int için stopLoss ve takeProfit sayı olmalı.");
    process.exit(1);
  }

  return {
    pair,
    stopLoss: String(sl),
    takeProfit: String(tp),
  };
}

async function main() {
  const { pair, stopLoss, takeProfit } = parseArgs();

  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_modify",
    serviceRequirements: {
      pair,
      stopLoss,
      takeProfit,
    },
  };

  const r = await client.post<{ data: { jobId: number } }>("/acp/jobs", body);
  console.log(JSON.stringify(r.data));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
