/**
 * Hyperliquid info / DegenClaw sorgu adresi.
 * HL_API_WALLET_KEY ile türetilen adres ve HL_API_WALLET_ADDRESS_* öncelikli;
 * stale AGENTS_JSON hlWallet master ile karışmasın diye ayrı tutulur.
 */
import { privateKeyToAccount } from "viem/accounts";
import type { AgentEntry } from "./agents";
import { hlApiWalletAddressFromEnv } from "./hlAgentSecretsFromEnv";

function normalizePk(raw: string): `0x${string}` | null {
  const s = raw.trim();
  const hex = s.startsWith("0x") ? s : `0x${s}`;
  if (!/^0x[0-9a-fA-F]{64}$/i.test(hex)) return null;
  return hex as `0x${string}`;
}

/** Sadece HL_API_WALLET_KEY / HL_API_WALLET_ADDRESS_* (env veya JSON hlApiWalletKey). */
export function resolveHlApiMaterialAddress(agent: AgentEntry): string | undefined {
  const pk = agent.hlApiWalletKey?.trim();
  if (pk) {
    const hex = normalizePk(pk);
    if (hex) {
      try {
        return privateKeyToAccount(hex).address;
      } catch {
        /* */
      }
    }
  }
  const envAddr = hlApiWalletAddressFromEnv(agent.alias)?.trim();
  if (envAddr && /^0x[a-fA-F0-9]{40}$/i.test(envAddr)) {
    return envAddr;
  }
  return undefined;
}

/**
 * Sync HL `openOrders` vb. — async yok; öncelik: API materyali → hlWallet → master.
 * (Snapshot için async `resolveWalletForDegen` tercih edin: orada /acp/me de var.)
 */
export function resolveHlQueryWallet(agent: AgentEntry): string | undefined {
  return (
    resolveHlApiMaterialAddress(agent) ||
    agent.hlWallet?.trim() ||
    agent.walletAddress?.trim()
  );
}
