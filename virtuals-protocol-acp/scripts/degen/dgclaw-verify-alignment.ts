/**
 * Degen Claw — doğrula: join_leaderboard cüzdanı, config.json aktif agent,
 * DGCLAW_API_KEY ile Degen API’deki agent kaydı ve leaderboard’da görünürlük.
 *
 *   npx tsx scripts/degen/dgclaw-verify-alignment.ts
 * Env: DGCLAW_API_KEY (dgclaw-skill/.env veya virtuals-protocol-acp/.env)
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

function normAddr(a: string): string {
  return a.trim().toLowerCase();
}

async function main() {
  const cfg = readConfig();
  const active = cfg.agents?.find((a) => a.active);
  if (!active?.id || !active.walletAddress) {
    console.error("config.json: aktif agent id ve walletAddress gerekli.");
    process.exit(1);
  }

  const degenId =
    process.env.DGCLAW_AGENT_ID?.trim() ??
    (active.degenAgentId != null ? String(active.degenAgentId) : "");
  if (!degenId) {
    console.error(
      "Degen API için agents[].degenAgentId veya DGCLAW_AGENT_ID gerekli (ACP id ile aynı değildir)."
    );
    process.exit(1);
  }

  const reqPath = path.join(ROOT, "degen_join_requirements.json");
  let joinAddr = "";
  if (fs.existsSync(reqPath)) {
    const j = JSON.parse(fs.readFileSync(reqPath, "utf-8")) as { agentAddress?: string };
    joinAddr = j.agentAddress?.trim() ?? "";
  }

  const key = process.env.DGCLAW_API_KEY?.trim();
  const base = process.env.DGCLAW_BASE_URL?.replace(/\/$/, "") || "https://degen.virtuals.io";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;

  console.log("=== 1) Yerel eşleşme (join ↔ config) ===");
  const wMatch = joinAddr && normAddr(joinAddr) === normAddr(active.walletAddress);
  console.log(
    JSON.stringify(
      {
        acpAgentId: active.id,
        degenAgentIdUsed: degenId,
        activeAgentName: active.name,
        walletFromConfig: active.walletAddress,
        walletFromJoinRequirements: joinAddr || "(degen_join_requirements.json yok)",
        walletsMatch: joinAddr ? wMatch : null,
      },
      null,
      2
    )
  );

  if (joinAddr && !wMatch) {
    console.error(
      "\nUYARI: join_leaderboard farklı cüzdan ile yapılmış olabilir. API key bu kayıta bağlı; config ile aynı cüzdan olmalı."
    );
  }

  console.log("\n=== 2) Degen API — agent kaydı (key ile) ===");
  if (!key) {
    console.error("DGCLAW_API_KEY yok — sadece herkese açık endpoint’ler denenecek.\n");
  }

  const agentUrl = `${base}/api/agents/${degenId}`;
  const rAgent = await fetch(agentUrl, { headers: key ? headers : {} });
  const tAgent = await rAgent.text();
  let agentJson: { success?: boolean; data?: { walletAddress?: string; name?: string; id?: string } };
  try {
    agentJson = JSON.parse(tAgent) as typeof agentJson;
  } catch {
    console.error(rAgent.status, tAgent.slice(0, 500));
    process.exit(1);
    return;
  }
  console.log(JSON.stringify({ status: rAgent.status, body: agentJson }, null, 2));

  const apiWallet = agentJson.data?.walletAddress;
  if (apiWallet && normAddr(apiWallet) !== normAddr(active.walletAddress)) {
    console.error(
      "\nUYARI: Degen API’deki agent cüzdanı config’ten farklı. Sitede gördüğün agent bu id ile mi kontrol et."
    );
  }

  console.log("\n=== 3) Abonelik fiyatı ===");
  const rPrice = await fetch(`${base}/api/agents/${degenId}/subscription-price`, {
    headers: key ? headers : {},
  });
  console.log(rPrice.status, await rPrice.text());

  const rForumsFirst = await fetch(`${base}/api/forums`, { headers: key ? headers : {} });
  const tForumsFirst = await rForumsFirst.text();
  let forumsList: Array<{ agentId?: string; id?: string; agent?: { id?: string } }> = [];
  try {
    forumsList = (JSON.parse(tForumsFirst) as { data?: typeof forumsList }).data ?? [];
  } catch {
    /* ignore */
  }
  const forumPresentEarly = forumsList.some((f) => String(f.agentId ?? f.agent?.id ?? f.id ?? "") === String(degenId));

  console.log("\n=== 4) Leaderboard’da ara (isim / id) ===");
  const rLb = await fetch(`${base}/api/leaderboard?limit=1000&offset=0`, { headers: key ? headers : {} });
  const tLb = await rLb.text();
  let lb: {
    data?: Array<{
      name?: string;
      id?: string;
      agentAddress?: string;
      acpAgent?: { id?: string; name?: string };
    }>;
  };
  try {
    lb = JSON.parse(tLb) as typeof lb;
  } catch {
    console.error(rLb.status, tLb.slice(0, 400));
    process.exit(1);
    return;
  }

  const name = active.name?.trim() ?? "";
  const idStr = String(degenId);
  const rows = lb.data ?? [];
  const nameLower = name.toLowerCase();
  const byName = rows.filter((e) => {
    const n = (e.name ?? e.acpAgent?.name ?? "").toLowerCase();
    return n === nameLower || (name.length >= 4 && n.includes(nameLower));
  });
  const byAcpId = rows.filter((e) => e.acpAgent?.id === idStr || e.id === idStr);

  const lbHint =
    byName.length > 0 || byAcpId.length > 0
      ? "Bulundu — örnek aşağıda."
      : forumPresentEarly
        ? "Şampiyona leaderboard’unda (PnL sırası) henüz yoksun; Degen kaydı ve forum aktif — üst sıralar genelde işlem/PnL ile dolar."
        : "Listede yok: PnL sıralaması veya kayıt eksik olabilir; forum bölümünü kontrol et.";

  console.log(
    JSON.stringify(
      {
        leaderboardEntryCount: rows.length,
        matchesByAgentName: byName.length,
        matchesByAcpAgentId: byAcpId.length,
        hint: lbHint,
        sample: byAcpId[0] ?? byName[0] ?? null,
      },
      null,
      2
    )
  );

  console.log("\n=== 5) Forum listesinde bu agent ===");
  const forumHit = forumsList.filter((f) => String(f.agentId ?? f.agent?.id ?? f.id ?? "") === idStr);
  console.log(
    JSON.stringify(
      {
        status: rForumsFirst.status,
        forumCount: forumsList.length,
        agentForumPresent: forumHit.length > 0,
      },
      null,
      2
    )
  );

  console.log("\n=== Sonraki adımlar (aktif + fiyat) ===");
  console.log(
    "Abonelik fiyatını ayarlamak için: npm run degen:claw:set-price -- <usdc>\n" +
      "Örnek: npm run degen:claw:set-price -- 5"
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
