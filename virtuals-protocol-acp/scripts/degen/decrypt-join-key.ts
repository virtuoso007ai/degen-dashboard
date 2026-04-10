/**
 * join_leaderboard deliverable — decrypt `encryptedApiKey` (Base64) with RSA private PEM.
 * Degen encrypts the API key with your job public key; you decrypt with the matching private key
 * (RSA-OAEP; try SHA-1 OAEP first, common with PKCS#1 v1.5 interop — override if docs say otherwise).
 *
 * Usage:
 *   npx tsx scripts/degen/decrypt-join-key.ts path/to/degen_join_private.pem <base64>
 *   npx tsx scripts/degen/decrypt-join-key.ts path/to/degen_join_private.pem --stdin
 *   (paste base64, then Ctrl+Z / Ctrl+D)
 *
 * Flags:
 *   --oaep-sha256   use sha256 for OAEP (if sha1 fails, try this)
 */
import { constants, createPrivateKey, privateDecrypt } from "node:crypto";
import { readFile } from "node:fs/promises";

type OaepHash = "sha1" | "sha256";

function decrypt(encryptedB64: string, pem: string, oaepHash: OaepHash): string {
  const buf = Buffer.from(encryptedB64.replace(/\s/g, ""), "base64");
  const key = createPrivateKey(pem);
  const plain = privateDecrypt(
    {
      key,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash,
    },
    buf
  );
  return plain.toString("utf8");
}

async function main() {
  const args = process.argv.slice(2);
  let oaepHash: OaepHash = "sha1";
  const filtered: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--oaep-sha256") oaepHash = "sha256";
    else if (args[i] === "--stdin") filtered.push("--stdin");
    else filtered.push(args[i]!);
  }

  const pemPath = filtered[0];
  if (!pemPath) {
    console.error(
      "Usage: tsx scripts/degen/decrypt-join-key.ts <private.pem> <base64> [--oaep-sha256]\n" +
        "   or: tsx scripts/degen/decrypt-join-key.ts <private.pem> --stdin [--oaep-sha256]"
    );
    process.exit(1);
  }

  const pem = await readFile(pemPath, "utf-8");

  let b64: string;
  if (filtered[1] === "--stdin") {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    b64 = Buffer.concat(chunks).toString("utf8").trim();
  } else if (filtered[1]) {
    b64 = filtered[1];
  } else {
    console.error("Missing base64 ciphertext or --stdin");
    process.exit(1);
  }

  try {
    process.stdout.write(decrypt(b64, pem, oaepHash) + "\n");
  } catch (e) {
    if (oaepHash === "sha1") {
      try {
        process.stdout.write(decrypt(b64, pem, "sha256") + "\n");
        console.error("(decrypted with --oaep-sha256 fallback)");
        return;
      } catch {
        /* fall through */
      }
    }
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
