/**
 * HL subaccount USDC withdraw — perp_withdraw (Degen Claw).
 * Matches successful jobs: { amount: string, recipient: "0x..." }.
 *
 * Usage:
 *   npx tsx scripts/degen/post-perp-withdraw.ts
 *     → amount = HL withdrawable (full balance), recipient = active agent wallet
 *   npx tsx scripts/degen/post-perp-withdraw.ts 0xRecipient
 *     → full withdrawable to 0xRecipient
 *   npx tsx scripts/degen/post-perp-withdraw.ts 25
 *     → fixed amount to active agent
 *   npx tsx scripts/degen/post-perp-withdraw.ts 0xRecipient 25
 *     → fixed amount to recipient
 *
 * HL account queried: HL_SUBACCOUNT_ADDRESS env, else DEFAULT_HL_SUBACCOUNT in constants.
 */
import axios from "axios";
import client from "../../src/lib/client.js";
import { loadApiKey, readConfig } from "../../src/lib/config.js";
import { DEFAULT_HL_SUBACCOUNT, DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

const HL_INFO = "https://api.hyperliquid.xyz/info";

function hlUser(): string {
  const e = process.env.HL_SUBACCOUNT_ADDRESS?.trim();
  if (e) return e;
  return DEFAULT_HL_SUBACCOUNT;
}

async function fetchWithdrawable(user: string): Promise<string> {
  const { data } = await axios.post(HL_INFO, { type: "clearinghouseState", user }, { timeout: 30_000 });
  const w = data?.withdrawable;
  if (w == null || w === "") throw new Error("HL response missing withdrawable");
  const n = parseFloat(String(w));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`HL withdrawable is ${w} — nothing to withdraw`);
  return String(w);
}

function activeAgentRecipient(): string {
  const cfg = readConfig();
  const w = cfg.agents?.find((a) => a.active)?.walletAddress?.trim();
  if (!w) throw new Error("No active agent wallet in config.json — pass recipient as first arg");
  return w;
}

function parseArgs(): { recipient: string; amountStr: string | null } {
  const a = process.argv[2]?.trim();
  const b = process.argv[3]?.trim();
  if (!a) {
    return { recipient: activeAgentRecipient(), amountStr: null };
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) {
    return { recipient: a, amountStr: b || null };
  }
  if (/^\d+(\.\d+)?$/.test(a)) {
    return { recipient: activeAgentRecipient(), amountStr: a };
  }
  throw new Error(`Invalid arg "${a}" — use 0xRecipient, or USDC amount, or 0xRecipient amount`);
}

async function main() {
  const { recipient, amountStr } = parseArgs();
  const user = hlUser();
  const amount = amountStr ?? (await fetchWithdrawable(user));

  console.error(`HL subaccount ${user}`);
  console.error(`withdraw amount (USDC string): ${amount}`);
  console.error(`recipient: ${recipient}`);

  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_withdraw",
    serviceRequirements: {
      amount,
      recipient,
    },
  };
  const r = await client.post<{ data: { jobId: number } }>("/acp/jobs", body);
  console.log(JSON.stringify(r.data));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
