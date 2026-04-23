import type { AgentEntry } from "./agents";
import { fetchAcpWallet } from "./acp";
import { resolveHlApiMaterialAddress } from "./hlQueryWallet";

/**
 * DegenClaw snapshot / leaderboard için HL kullanıcı adresi.
 * Öncelik: HL_API_WALLET_KEY / HL_API_WALLET_ADDRESS_* → hlWallet → /acp/me → master.
 */
export async function resolveWalletForDegen(
  agent: AgentEntry
): Promise<string | undefined> {
  const mat = resolveHlApiMaterialAddress(agent);
  if (mat) return mat;

  const hl = agent.hlWallet?.trim();
  if (hl) return hl;

  const ak = agent.apiKey?.trim();
  if (ak) {
    const fromAcp = await fetchAcpWallet(ak);
    if (fromAcp) return fromAcp;
  }
  return agent.walletAddress?.trim();
}
