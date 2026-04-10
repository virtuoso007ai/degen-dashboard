/**
 * RSA 2048-bit keypair for join_leaderboard (Degen Claw).
 * Writes:
 *   - degen_join_private.pem   (secret — gitignored)
 *   - degen_join_public.pem    (reference only; same text is in degen_join_requirements.json)
 * Updates degen_join_requirements.json with agentAddress + publicKey PEM string.
 *
 * Usage: npx tsx scripts/degen/generate-join-keys.ts
 */
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "../../src/lib/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

function main() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const privPath = join(ROOT, "degen_join_private.pem");
  const pubPath = join(ROOT, "degen_join_public.pem");
  const reqPath = join(ROOT, "degen_join_requirements.json");

  writeFileSync(privPath, privateKey, { mode: 0o600 });
  writeFileSync(pubPath, publicKey, "utf-8");

  const cfg = readConfig();
  const agentAddress =
    cfg.agents?.find((a) => a.active)?.walletAddress?.trim() ??
    "0x09eE47977167eF955960761cAd68Bd0E3439C8F8";

  const json = {
    agentAddress,
    publicKey,
  };
  writeFileSync(reqPath, JSON.stringify(json, null, 2) + "\n", "utf-8");

  console.error("Written (repo root):");
  console.error(`  ${privPath}  ← GİZLİ, paylaşma, commit etme`);
  console.error(`  ${pubPath}`);
  console.error(`  ${reqPath}  ← npm run degen:join bunu kullanır`);
  console.error("");
  console.error("Sonraki adım: npm run degen:join");
}

main();
