/**
 * Degen forum: PATCH subscription price (USDC).
 * Requires DGClaw API key (join_leaderboard deliverable decrypt) — NOT ACP LITE key.
 *
 * Env: DGCLAW_API_KEY, optional DGCLAW_BASE_URL (default https://degen.virtuals.io)
 * Also loads ../dgclaw-skill/.env if present (same folder layout as this monorepo).
 *
 * Usage:
 *   npx tsx scripts/degen/dgclaw-set-subscription-price.ts <agentId> <usdc_price>
 * Example:
 *   npx tsx scripts/degen/dgclaw-set-subscription-price.ts 32049 5
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { readConfig } from "../../src/lib/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

function loadDotEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadDotEnvFile(path.resolve(ROOT, ".env"));
loadDotEnvFile(path.resolve(ROOT, "..", "dgclaw-skill", ".env"));

/** Degen API uses its own agent id (forum, /api/agents/:id) — not always equal to ACP `id`. */
function defaultDegenAgentId(): string | undefined {
  const fromEnv = process.env.DGCLAW_AGENT_ID?.trim();
  if (fromEnv) return fromEnv;
  const a = readConfig().agents?.find((x) => x.active);
  if (a?.degenAgentId != null) return String(a.degenAgentId);
  return undefined;
}

let agentId = process.argv[2]?.trim();
let price = process.argv[3]?.trim();

// Tek argüman: abonelik fiyatı (küçük / ondalıklı) → agentId config'ten; 32049 gibi id tek başına verme
if (agentId && !price && /^[0-9]*\.?[0-9]+$/.test(agentId)) {
  const n = parseFloat(agentId);
  if (agentId.includes(".") || (Number.isFinite(n) && n > 0 && n <= 1000)) {
    price = agentId;
    agentId = defaultDegenAgentId() ?? "";
  }
}

if (!agentId) agentId = defaultDegenAgentId() ?? "";

async function main() {
  if (!agentId || !price) {
    console.error(
      "Usage: tsx scripts/degen/dgclaw-set-subscription-price.ts [agentId] <usdc_price>\n" +
        "  Or only price:   ... 5   (uses agents[].degenAgentId or DGCLAW_AGENT_ID — not ACP id)\n" +
        "  Set config.json agents[].degenAgentId to the id from degen.virtuals.io (forum URL / GET /api/agents)."
    );
    process.exit(1);
  }

  const key = process.env.DGCLAW_API_KEY?.trim();
  if (!key) {
    console.error(
      "DGCLAW_API_KEY yok. join_leaderboard job COMPLETED olunca deliverable'daki\n" +
        "encryptedApiKey'i coz, sonra dgclaw-skill/.env veya virtuals-protocol-acp/.env icine:\n" +
        "  DGCLAW_API_KEY=dgc_...\n" +
        "Sonra bu komutu tekrar calistir."
    );
    process.exit(1);
  }

  if (!/^[0-9]*\.?[0-9]+$/.test(price)) {
    console.error("Price must be a non-negative number");
    process.exit(1);
  }

  const base =
    process.env.DGCLAW_BASE_URL?.replace(/\/$/, "") || "https://degen.virtuals.io";
  const url = `${base}/api/agents/${agentId}/settings`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ subscriptionPrice: price }),
  });

  const text = await res.text();
  let j: { success?: boolean; data?: { agentName?: string; subscriptionPrice?: string }; error?: string };
  try {
    j = JSON.parse(text) as typeof j;
  } catch {
    console.error(res.status, text);
    process.exit(1);
    return;
  }

  if (!res.ok || !j.success) {
    console.error("Failed:", j.error ?? text);
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, agentName: j.data?.agentName, subscriptionPrice: j.data?.subscriptionPrice }));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
