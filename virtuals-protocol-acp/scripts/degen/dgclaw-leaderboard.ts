/**
 * Degen API — championship leaderboard (read-only).
 * Auth: optional DGCLAW_API_KEY in env or dgclaw-skill/.env (some deployments allow public read).
 *
 *   npx tsx scripts/degen/dgclaw-leaderboard.ts [limit]
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

function loadDotEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf-8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const limit = Math.min(1000, Math.max(1, parseInt(process.argv[2] ?? "20", 10) || 20));
const base = process.env.DGCLAW_BASE_URL?.replace(/\/$/, "") || "https://degen.virtuals.io";

loadDotEnvFile(path.resolve(ROOT, ".env"));
loadDotEnvFile(path.resolve(ROOT, "..", "dgclaw-skill", ".env"));

const key = process.env.DGCLAW_API_KEY?.trim();
const headers: Record<string, string> = {};
if (key) headers.Authorization = `Bearer ${key}`;

const url = `${base}/api/leaderboard?limit=${limit}&offset=0`;

const res = await fetch(url, { headers });
const text = await res.text();
if (!res.ok) {
  console.error(res.status, text);
  process.exit(1);
}
try {
  const j = JSON.parse(text) as { data?: unknown[]; season?: unknown; pagination?: unknown };
  console.log(JSON.stringify({ season: j.season, pagination: j.pagination, top: j.data?.slice(0, 5) }, null, 2));
  console.error(`\n(full response has ${Array.isArray(j.data) ? j.data.length : 0} entries; use jq or save to file for full list)`);
} catch {
  console.log(text);
}
