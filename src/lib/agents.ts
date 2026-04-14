export type AgentEntry = {
  alias: string;
  apiKey: string;
  forumApiKey?: string;
  label?: string;
  walletAddress?: string;
  hlWallet?: string;
};

function normalizeAlias(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

export function parseAgentsFromEnv(): AgentEntry[] {
  const raw = process.env.AGENTS_JSON?.trim();
  if (!raw) {
    throw new Error("AGENTS_JSON ortam değişkeni gerekli (Telegram bot ile aynı JSON)");
  }
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
    if (!alias || !apiKey) continue;
    if (seen.has(alias)) throw new Error(`Yinelenen alias: ${alias}`);
    seen.add(alias);
    out.push({
      alias,
      apiKey,
      forumApiKey: o.forumApiKey != null ? String(o.forumApiKey).trim() : undefined,
      label: o.label != null ? String(o.label).trim() : undefined,
      walletAddress:
        o.walletAddress != null ? String(o.walletAddress).trim() : undefined,
      hlWallet:
        o.hlWallet != null ? String(o.hlWallet).trim() : undefined,
    });
  }
  if (out.length === 0) throw new Error("Geçerli agent yok");
  return out.sort((a, b) => a.alias.localeCompare(b.alias));
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
