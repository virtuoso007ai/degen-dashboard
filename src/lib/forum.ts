import axios from "axios";

const DGCLAW_API_BASE = "https://degen.virtuals.io";

/** Agent başına `forumApiKey` veya ortamda `DGCLAW_API_KEY` — ikisinden biri yeterli. */
export function hasForumAuth(agentForumApiKey?: string): boolean {
  return Boolean(
    agentForumApiKey?.trim() || process.env.DGCLAW_API_KEY?.trim()
  );
}

export type ForumPostParams = {
  agentId: number;
  threadId: string;
  title: string;
  content: string;
  apiKey?: string; // Agent-specific API key (overrides global)
};

/**
 * Post to Degen Claw forum
 * Uses agent-specific API key if provided, otherwise falls back to global DGCLAW_API_KEY
 */
export async function postToForum(params: ForumPostParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = params.apiKey || process.env.DGCLAW_API_KEY;
  if (!apiKey) {
    return { success: false, error: "DGCLAW_API_KEY not configured" };
  }

  try {
    const { data } = await axios.post(
      `${DGCLAW_API_BASE}/api/forums/${params.agentId}/threads/${params.threadId}/posts`,
      {
        title: params.title,
        content: params.content,
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    return { success: true };
  } catch (e) {
    const msg = axios.isAxiosError(e) && e.response?.data 
      ? JSON.stringify(e.response.data) 
      : e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * Format trade close post for forum
 */
export function formatTradeClosePost(params: {
  pair: string;
  side: "long" | "short";
  entryPrice?: string;
  exitPrice?: string;
  pnl?: string;
  pnlPercent?: string;
  duration?: string;
  leverage?: number;
  agentName: string;
}): { title: string; content: string } {
  const { pair, side, entryPrice, exitPrice, pnl, pnlPercent, duration, leverage, agentName } = params;
  
  const sideLabel = side === "long" ? "Long" : "Short";
  const title = `Closed ${sideLabel} ${pair} position`;
  
  let content = "";
  
  // Entry/Exit
  if (entryPrice && exitPrice) {
    content += `Entry $${entryPrice} → Exit $${exitPrice}\n\n`;
  }
  
  // Results
  content += "Result:\n";
  if (pnl) {
    content += `- PnL: $${pnl}`;
    if (pnlPercent) {
      content += ` (${pnlPercent}% on margin)`;
    }
    content += "\n";
  }
  if (duration) {
    content += `- Duration: ${duration}\n`;
  }
  if (leverage) {
    content += `- Leverage: ${leverage}x\n`;
  }
  
  // Footer
  content += `\n— ${agentName}\n\nDYOR - Not financial advice.`;
  
  return { title, content };
}
