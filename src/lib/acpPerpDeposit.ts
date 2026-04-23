/**
 * DegenClaw / ACP: Base (8453) üzerindeki agent master cüzdanından HL'ye USDC — `perp_deposit` job + `fund`.
 * Repo kökündeki scripts/degen-hl-deposit.mjs ile aynı mantık (sunucuda acp-cli-v2 + OAuth config gerekir).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export const DEFAULT_PERP_DEPOSIT_PROVIDER =
  "0xd478a8B40372db16cA8045F28C6FE07228F3781A";

function sleepMs(ms: number): void {
  const t = Date.now() + ms;
  while (Date.now() < t) {
    /* busy wait — kısa aralıklar (fund retry) */
  }
}

/** scripts/lib/resolve-acp-dir.mjs ile aynı adaylar (monorepo köküne göre). */
function resolveAcpDirUnderRoot(repoRoot: string): string | null {
  const candidates = [
    join(repoRoot, "acp-cli-v2"),
    join(repoRoot, "vendor", "acp-cli"),
  ];
  const hit = candidates.find((dir) => existsSync(join(dir, "bin", "acp.ts")));
  return hit ?? null;
}

/** Yerel: `degen-dashboard` içinden `npm run dev` → üst dizinlere çıkıp acp-cli ara. */
function resolveAcpDirFromAncestors(startDir: string, maxUp: number): string | null {
  let dir = startDir;
  for (let i = 0; i < maxUp; i++) {
    const hit = resolveAcpDirUnderRoot(dir);
    if (hit) return hit;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function getAcpCliDir(): string {
  const fromEnv = process.env.ACP_CLI_DIR?.trim();
  if (fromEnv) {
    if (!existsSync(join(fromEnv, "bin", "acp.ts"))) {
      throw new Error(`ACP_CLI_DIR geçersiz veya eksik: ${fromEnv}`);
    }
    return fromEnv;
  }

  const fromWalk = resolveAcpDirFromAncestors(process.cwd(), 10);
  if (fromWalk) return fromWalk;

  const onVercel = Boolean(process.env.VERCEL);
  const hint = onVercel
    ? "Vercel’de ACP yok. Seçenekler: (1) Vercel env’e ACP_PERP_DEPOSIT_PROXY_URL + ACP_PERP_DEPOSIT_PROXY_SECRET koy; Railway’de `npm run perp-deposit-worker` + ACP_CLI_DIR (bkz. degen-dashboard scripts). (2) Tüm dashboard’u Railway/VM’de çalıştır + ACP_CLI_DIR. (3) PC’de `npm run degen:hl:deposit -- 25` (monorepo kökü)."
    : "ACP_CLI_DIR ayarla (acp-cli-v2 tam yolu) veya projeyi monorepo içinde çalıştır (üst dizinde acp-cli-v2 olsun). Hızlı yol: repo kökünde `npm run degen:hl:deposit -- <USDC>`.";
  throw new Error(
    `acp-cli-v2 bulunamadı. ${hint}`
  );
}

function runAcpJson(
  acpDir: string,
  args: string[],
  timeoutMs: number
): Record<string, unknown> {
  const tsx = join(acpDir, "node_modules", "tsx", "dist", "cli.mjs");
  const bin = join(acpDir, "bin", "acp.ts");
  const fullArgs = [...args, "--json"];
  const r = spawnSync(process.execPath, [tsx, bin, ...fullArgs], {
    cwd: acpDir,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ACP_LEGACY_SKIP_SOCKET: "1" },
    timeout: timeoutMs,
    windowsHide: true,
  });
  const combined = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  if (r.error?.name === "ETIMEDOUT") {
    throw new Error(`ACP zaman aşımı (${timeoutMs}ms)`);
  }
  if (r.status !== 0) {
    throw new Error(combined.trim() || `ACP çıkış kodu ${r.status}`);
  }
  return parseJsonFromAcpOutput(combined);
}

function runAcpPlain(acpDir: string, args: string[], timeoutMs: number): void {
  const tsx = join(acpDir, "node_modules", "tsx", "dist", "cli.mjs");
  const bin = join(acpDir, "bin", "acp.ts");
  const r = spawnSync(process.execPath, [tsx, bin, ...args], {
    cwd: acpDir,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ACP_LEGACY_SKIP_SOCKET: "1" },
    timeout: timeoutMs,
    windowsHide: true,
  });
  const combined = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  if (r.error?.name === "ETIMEDOUT") {
    throw new Error(`ACP zaman aşımı (${timeoutMs}ms)`);
  }
  if (r.status !== 0) {
    throw new Error(combined.trim() || `ACP çıkış kodu ${r.status}`);
  }
}

function parseJsonFromAcpOutput(text: string): Record<string, unknown> {
  const lines = text.trim().split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (!t.startsWith("{")) continue;
    try {
      return JSON.parse(t) as Record<string, unknown>;
    } catch {
      /* devam */
    }
  }
  throw new Error(text.slice(0, 800) || "ACP JSON çıktısı yok");
}

export function resolveAgentIdFromAcpConfig(
  acpDir: string,
  masterLower: string
): string | null {
  const p = join(acpDir, "config.json");
  if (!existsSync(p)) return null;
  try {
    const cfg = JSON.parse(readFileSync(p, "utf-8")) as {
      agents?: Record<string, { id?: string }>;
    };
    const map = cfg.agents;
    if (!map || typeof map !== "object") return null;
    for (const [k, v] of Object.entries(map)) {
      if (String(k).toLowerCase() === masterLower && v?.id) {
        return String(v.id);
      }
    }
  } catch {
    /* */
  }
  return null;
}

/** config.json’da yoksa `agent list` ile Virtuals’taki master eşleşmesi (terminaldeki `agent use` ile aynı). */
function resolveAgentIdFromAcpList(
  acpDir: string,
  masterLower: string
): string | null {
  try {
    const raw = runAcpJson(
      acpDir,
      ["agent", "list", "--page", "1", "--page-size", "100"],
      120_000
    );
    const data = raw.data;
    if (!Array.isArray(data)) return null;
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const w = String(o.walletAddress ?? "").toLowerCase();
      if (w === masterLower && o.id) return String(o.id);
    }
  } catch {
    /* */
  }
  return null;
}

export type PerpDepositResult = {
  jobId: string | number;
  amount: string;
  message: string;
};

const MIN_USDC = 20;

/**
 * @throws Error — yapılandırma, ACP veya fund hatası
 */
export function runAcpPerpDeposit(opts: {
  masterAddress: string;
  amountUsdc: string;
}): PerpDepositResult {
  const acpDir = getAcpCliDir();
  const master = opts.masterAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/i.test(master)) {
    throw new Error("Geçersiz master (walletAddress)");
  }
  const amount = opts.amountUsdc.trim();
  const n = Number(amount);
  if (!Number.isFinite(n) || n < MIN_USDC) {
    throw new Error(`perp_deposit: en az ${MIN_USDC} USDC gir`);
  }

  const masterLc = master.toLowerCase();
  const agentId =
    resolveAgentIdFromAcpConfig(acpDir, masterLc) ??
    resolveAgentIdFromAcpList(acpDir, masterLc);
  if (!agentId) {
    throw new Error(
      "Bu master (AGENTS_JSON walletAddress) için ACP agent bulunamadı. Yerelde `acp agent add-signer --agent-id <uuid>` veya `agent list` ile Virtuals hesabının eşleştiğinden emin olun; ACP_CLI_DIR doğru olsun."
    );
  }

  runAcpPlain(acpDir, ["agent", "use", "--agent-id", agentId], 120_000);

  const addrJson = runAcpJson(acpDir, ["wallet", "address"], 90_000);
  const active = String(
    (addrJson as { address?: string }).address ?? ""
  ).toLowerCase();
  if (active !== masterLc) {
    throw new Error(
      `ACP aktif cüzdan (${active || "?"}) ile agent master (${masterLc}) eşleşmiyor.`
    );
  }

  const provider =
    process.env.ACP_PERP_DEPOSIT_PROVIDER?.trim() || DEFAULT_PERP_DEPOSIT_PROVIDER;
  const chain = process.env.ACP_PERP_DEPOSIT_CHAIN_ID?.trim() || "8453";
  const inner = JSON.stringify({ amount });
  const requirements = JSON.stringify(inner);

  const created = runAcpJson(
    acpDir,
    [
      "client",
      "create-job",
      "--provider",
      provider,
      "--offering-name",
      "perp_deposit",
      "--requirements",
      requirements,
      "--chain-id",
      chain,
      "--legacy",
    ],
    240_000
  );

  if (created.error) {
    throw new Error(String(created.error));
  }
  const dataObj =
    created.data != null && typeof created.data === "object"
      ? (created.data as Record<string, unknown>)
      : null;
  const rawJobId = created.jobId ?? dataObj?.jobId;
  const jobId: string | number | undefined =
    typeof rawJobId === "string" || typeof rawJobId === "number"
      ? rawJobId
      : undefined;
  if (jobId == null) {
    throw new Error(`jobId alınamadı: ${JSON.stringify(created)}`);
  }

  let funded = false;
  let lastErr = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    const fundArgs =
      attempt <= 2
        ? [
            "client",
            "fund",
            "--job-id",
            String(jobId),
            "--chain-id",
            chain,
            "--amount",
            amount,
          ]
        : ["client", "fund", "--job-id", String(jobId), "--chain-id", chain];
    try {
      runAcpJson(acpDir, fundArgs, 180_000);
      funded = true;
      break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (attempt < 4) sleepMs(3000 * attempt);
    }
  }

  if (!funded) {
    throw new Error(
      lastErr || "fund başarısız — Base’de yeterli USDC ve Privy imza akışını kontrol et"
    );
  }

  return {
    jobId,
    amount,
    message:
      "perp_deposit fund tamam. HL spot’ta USDC görünmesi köprü SLA’sına bağlı; gerekirse `degen:hl:activate` / Spot→Perp kullan.",
  };
}
