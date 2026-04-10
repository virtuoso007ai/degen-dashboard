import type { AgentEntry } from "./agents";
import { fetchAcpWallet } from "./acp";

/** Önce /acp/me, yoksa AGENTS_JSON cüzdanı (bot ile aynı mantık). */
export async function resolveWalletForDegen(
  agent: AgentEntry
): Promise<string | undefined> {
  const fromAcp = await fetchAcpWallet(agent.apiKey);
  if (fromAcp) return fromAcp;
  return agent.walletAddress?.trim();
}
