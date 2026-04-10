/**
 * Degen Claw — buy_agent_token (KyberSwap on Base).
 *
 * Başarılı job şekli (Degen): **`amount` = satın alınacak token adedi** (string), `tokenAddress`, `ticker`.
 * `usdcAmount` kullanan istek negotiation’da reddedilebiliyor.
 *
 * Varsayılan: ilk argüman **harcamak istediğin USDC** (ör. `10`) — bunu token adedine çevirir:
 *   `amount = round(usdc × BUY_TOKEN_PER_USDC)`
 * Varsayılan `BUY_TOKEN_PER_USDC=10`: önceki işlemde ~**10 NOX ≈ 1 USDC** idi → **10 USDC ≈ 100** token.
 * Fiyat değiştiyse `BUY_TOKEN_PER_USDC` env ile ince ayar (örn. `12`).
 *
 * Usage:
 *   # ~X USDC harca (amount alanına çevrilir — eski başarılı job ile aynı anahtarlar)
 *   npx tsx scripts/degen/post-buy-agent-token.ts <usdc_spend> <tokenAddress> [ticker]
 *
 *   # Token adedini birebir vermek (amount = "47" gibi)
 *   npx tsx scripts/degen/post-buy-agent-token.ts --tokens <amount> <tokenAddress> [ticker]
 */
import client from "../../src/lib/client.js";
import { loadApiKey } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

function tokensPerUsdc(): number {
  const e = process.env.BUY_TOKEN_PER_USDC?.trim();
  const n = e ? parseFloat(e) : 10;
  return Number.isFinite(n) && n > 0 ? n : 10;
}

async function main() {
  const raw = process.argv.slice(2);
  let byTokens = false;
  if (raw[0] === "--tokens") {
    byTokens = true;
    raw.shift();
  }

  const value = raw[0]?.trim();
  const tokenAddress = raw[1]?.trim();
  const ticker = raw[2]?.trim();

  if (!value || !tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    console.error(
      "~USDC harca (amount otomatik):\n" +
        "  tsx scripts/degen/post-buy-agent-token.ts <usdc> <tokenAddress> [ticker]\n" +
        "Token adedi sabit:\n" +
        "  tsx scripts/degen/post-buy-agent-token.ts --tokens <amount> <tokenAddress> [ticker]"
    );
    process.exit(1);
  }

  const serviceRequirements: Record<string, string> = {
    tokenAddress,
  };
  if (ticker) serviceRequirements.ticker = ticker;

  if (byTokens) {
    serviceRequirements.amount = value;
    console.error(`[buy_agent_token] amount (token adedi)=${value}, token=${tokenAddress}`);
  } else {
    const usdc = parseFloat(value);
    if (!Number.isFinite(usdc) || usdc <= 0) {
      console.error("USDC miktarı pozitif sayı olmalı.");
      process.exit(1);
    }
    const mult = tokensPerUsdc();
    const tokenAmt = Math.max(1, Math.round(usdc * mult));
    serviceRequirements.amount = String(tokenAmt);
    console.error(
      `[buy_agent_token] ~${usdc} USDC hedefi → amount=${tokenAmt} token (BUY_TOKEN_PER_USDC=${mult}), token=${tokenAddress}`
    );
  }

  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "buy_agent_token",
    serviceRequirements,
  };

  const r = await client.post<{ data: { jobId: number } }>("/acp/jobs", body);
  console.log(JSON.stringify(r.data));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
