/**
 * Degen Claw — join_leaderboard (wolfy-agent parity)
 *
 * Degen encrypts the returned API key with your public key; decrypt with private PEM via
 * `npm run degen:join:decrypt` — see scripts/degen/JOIN_LEADERBOARD.md
 *
 * Flat serviceRequirements: { agentAddress, publicKey } (RSA-OAEP; PEM or base64 string per API).
 *
 * publicKey source (first match):
 *   1. env JOIN_LEADERBOARD_PUBLIC_KEY
 *   2. degen_join_requirements.json (repo root next to package.json)
 * agentAddress: json file, else active agent wallet in config.json
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import client from "../../src/lib/client.js";
import { loadApiKey, readConfig } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";

loadApiKey();

const __dirname = dirname(fileURLToPath(import.meta.url));
const reqPath = join(__dirname, "..", "..", "degen_join_requirements.json");

function isPlaceholderPublicKey(pk: string): boolean {
  const t = pk.trim();
  if (!t) return true;
  if (/PASTE_|YOUR_.*KEY|PLACEHOLDER/i.test(t)) return true;
  return false;
}

function loadServiceRequirements(): { agentAddress: string; publicKey: string } {
  const envPk = process.env.JOIN_LEADERBOARD_PUBLIC_KEY?.trim();
  const cfg = readConfig();
  const activeWallet = cfg.agents?.find((a) => a.active)?.walletAddress?.trim();

  let agentAddress = activeWallet ?? "";
  let publicKey = envPk ?? "";

  if (existsSync(reqPath)) {
    const raw = JSON.parse(readFileSync(reqPath, "utf-8")) as {
      agentAddress?: string;
      publicKey?: string;
    };
    if (raw.agentAddress?.trim()) agentAddress = raw.agentAddress.trim();
    if (!envPk && raw.publicKey != null) publicKey = String(raw.publicKey).trim();
  }

  if (!agentAddress) {
    throw new Error(
      "No agentAddress — set an active agent in config.json or agentAddress in degen_join_requirements.json"
    );
  }
  if (isPlaceholderPublicKey(publicKey)) {
    throw new Error(
      "Missing RSA publicKey — export JOIN_LEADERBOARD_PUBLIC_KEY (PEM or base64) or paste into " +
        "degen_join_requirements.json. Same fields as join_leaderboard in the wolfy Degen UI screenshot."
    );
  }

  return { agentAddress, publicKey };
}

async function main() {
  const serviceRequirements = loadServiceRequirements();

  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "join_leaderboard",
    serviceRequirements,
  };

  const r = await client.post<{ data: { jobId: number } }>("/acp/jobs", body);
  console.log(JSON.stringify(r.data));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
