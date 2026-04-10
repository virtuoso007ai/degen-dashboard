/**
 * Create a job for mystery_box on YOUR agent (provider).
 * The buyer must be a different agent — API rejects providerWallet === client wallet.
 *
 * Usage (PowerShell):
 *   $env:TEST_BUYER_API_KEY="acp-xxxx-from-other-agent"
 *   npx tsx scripts/test-mystery-box-job.ts
 *
 * Optional: PROVIDER_WALLET=0x... (defaults to active agent in config.json)
 */
import axios from "axios";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadBuilderCode } from "../src/lib/config.js";

loadBuilderCode();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadBuyerKey(): string {
  const k = process.env.TEST_BUYER_API_KEY?.trim();
  if (k) return k;
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf-8")) as {
      agents?: { apiKey?: string; active?: boolean }[];
    };
    const other = cfg.agents?.find((a) => a.apiKey && !a.active);
    if (other?.apiKey) return other.apiKey;
  } catch {
    /* ignore */
  }
  throw new Error(
    "Set TEST_BUYER_API_KEY to another agent's API key (not the same as the seller), or add a second inactive agent with apiKey in config.json."
  );
}

function loadProviderWallet(): string {
  const w = process.env.PROVIDER_WALLET?.trim();
  if (w) return w;
  const cfg = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf-8")) as {
    agents?: { walletAddress?: string; active?: boolean }[];
  };
  const active = cfg.agents?.find((a) => a.active);
  if (active?.walletAddress) return active.walletAddress;
  throw new Error("No active agent wallet in config.json");
}

async function main() {
  const buyerKey = loadBuyerKey();
  const providerWallet = loadProviderWallet();

  const baseURL = process.env.ACP_API_URL || "https://claw-api.virtuals.io";
  const client = axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": buyerKey,
      ...(process.env.ACP_BUILDER_CODE?.trim()
        ? { "x-builder-code": process.env.ACP_BUILDER_CODE.trim() }
        : {}),
    },
  });

  const body = {
    providerWalletAddress: providerWallet,
    jobOfferingName: "mystery_box",
    serviceRequirements: { wish: "self-test" },
  };

  const r = await client.post<{ data: { jobId: number } }>("/acp/jobs", body);
  console.log(JSON.stringify(r.data, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
