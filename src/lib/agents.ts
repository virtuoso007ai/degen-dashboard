import * as fs from "fs";
import * as path from "path";
import { applyHlTradeEnvToAgent } from "./hlAgentSecretsFromEnv";

export type AgentEntry = {
  alias: string;
  /** Opsiyonel — /acp/me ile cüzdan; HL-only için walletAddress/hlWallet yeter */
  apiKey?: string;
  forumApiKey?: string;
  label?: string;
  walletAddress?: string;
  hlWallet?: string;
  /** HL API cüzdanı private key — repoya commit etme */
  hlApiWalletKey?: string;
};

function normalizeAlias(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

function loadAgentsJsonRaw(): string {
  const inline = process.env.AGENTS_JSON?.trim();
  if (inline) return inline;
  const filePath = process.env.AGENTS_JSON_PATH?.trim();
  if (filePath) {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.join(/* turbopackIgnore: true */ process.cwd(), filePath);
    if (!fs.existsSync(abs)) {
      throw new Error(`AGENTS_JSON_PATH bulunamadı: ${abs}`);
    }
    return fs.readFileSync(abs, "utf-8");
  }
  throw new Error(
    "AGENTS_JSON veya AGENTS_JSON_PATH gerekli (Telegram bot ile aynı JSON; bot AGENTS_JSON_PATH destekler)."
  );
}

type HlTradeSecretBlock = {
  hlApiWalletKey?: string;
  walletAddress?: string;
  hlWallet?: string;
  /** HL_TRADE_SECRETS_JSON içinde hlWallet ile aynı anlam */
  hlSubaccount?: string;
};

function findHlTradeSecretsBlock(
  map: Record<string, unknown>,
  alias: string
): HlTradeSecretBlock | null {
  const k = normalizeAlias(alias);
  const keys = [k, alias.trim(), alias.trim().replace(/^@/, "")];
  for (const key of keys) {
    const v = map[key];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as HlTradeSecretBlock;
  }
  for (const [key, v] of Object.entries(map)) {
    if (normalizeAlias(key) === k && v && typeof v === "object" && !Array.isArray(v)) {
      return v as HlTradeSecretBlock;
    }
  }
  return null;
}

/** Tek Vercel/Railway secret: eksik HL alanlarını doldurur (private key repoda tutulmaz). */
function mergeHlTradeSecretsJson(agents: AgentEntry[]): AgentEntry[] {
  const raw = process.env.HL_TRADE_SECRETS_JSON?.trim();
  if (!raw) return agents;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("HL_TRADE_SECRETS_JSON geçersiz JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("HL_TRADE_SECRETS_JSON bir nesne olmalı (alias → { hlApiWalletKey, walletAddress, hlWallet })");
  }
  const map = parsed as Record<string, unknown>;
  return agents.map((a) => {
    const block = findHlTradeSecretsBlock(map, a.alias);
    if (!block) return a;
    const next: AgentEntry = { ...a };
    const pk = String(block.hlApiWalletKey ?? "").trim();
    const m = String(block.walletAddress ?? "").trim();
    const hw = String(block.hlWallet ?? block.hlSubaccount ?? "").trim();
    if (!next.hlApiWalletKey?.trim() && pk) next.hlApiWalletKey = pk;
    if (!next.walletAddress?.trim() && m) next.walletAddress = m;
    if (!next.hlWallet?.trim() && hw) next.hlWallet = hw;
    return next;
  });
}

export function parseAgentsFromEnv(): AgentEntry[] {
  const raw = loadAgentsJsonRaw();
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AGENTS_JSON geçersiz veya boş");
  }
  const out: AgentEntry[] = [];
  const seen = new Set<string>();
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const alias = normalizeAlias(String(o.alias ?? ""));
    const apiKey = String(o.apiKey ?? "").trim();
    if (!alias) continue;
    if (seen.has(alias)) throw new Error(`Yinelenen alias: ${alias}`);
    seen.add(alias);
    out.push({
      alias,
      apiKey: apiKey || undefined,
      forumApiKey: o.forumApiKey != null ? String(o.forumApiKey).trim() : undefined,
      label: o.label != null ? String(o.label).trim() : undefined,
      walletAddress:
        o.walletAddress != null ? String(o.walletAddress).trim() : undefined,
      hlWallet:
        o.hlWallet != null ? String(o.hlWallet).trim() : undefined,
      hlApiWalletKey:
        o.hlApiWalletKey != null ? String(o.hlApiWalletKey).trim() : undefined,
    });
  }
  if (out.length === 0) throw new Error("Geçerli agent yok");
  const sole = out.length === 1;
  const withSecrets = mergeHlTradeSecretsJson(out);
  const merged = withSecrets.map((a) => applyHlTradeEnvToAgent(a, sole));
  return merged.sort((a, b) => a.alias.localeCompare(b.alias));
}

export function getAgentByAlias(
  agents: AgentEntry[],
  alias: string
): AgentEntry | undefined {
  const k = normalizeAlias(alias);
  return agents.find((a) => a.alias === k);
}

/** HL subaccount cüzdanı — önce hlWallet, yoksa walletAddress. */
export function getHlWallet(agent: AgentEntry): string | undefined {
  return agent.hlWallet?.trim() || agent.walletAddress?.trim();
}
