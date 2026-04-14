import type { AgentEntry } from "./agents";
import { fetchAcpWallet } from "./acp";

/** hlWallet → /acp/me → walletAddress (bot ile aynı; hlWallet v2 HL adresi override). */
export async function resolveWalletForDegen(
  agent: AgentEntry
): Promise<string | undefined> {
  const hl = agent.hlWallet?.trim();
  if (hl) return hl;
  const fromAcp = await fetchAcpWallet(agent.apiKey);
  if (fromAcp) return fromAcp;
  return agent.walletAddress?.trim();
}
