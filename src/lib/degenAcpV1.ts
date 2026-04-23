/**
 * Degen ACP v1 — `perp_trade` job (api.agdp.io).
 * Eski pozisyonlar bazen yalnızca bu yolla kapanır; HL doğrudan imza farklı cüzdanda kalabilir.
 * Bearer: genelde agent `forumApiKey` (dgc_…) veya Degen’in verdiği aynı API anahtarı.
 */
const DEFAULT_BASE = "https://api.agdp.io/degen-acp";

export function degenAcpV1BaseUrl(): string {
  const u = process.env.DEGEN_ACP_API_BASE?.trim();
  if (u) return u.replace(/\/$/, "");
  return DEFAULT_BASE;
}

export async function degenAcpV1PerpClose(opts: {
  bearerToken: string;
  pair: string;
  side: "long" | "short";
}): Promise<unknown> {
  const token = opts.bearerToken.trim();
  if (!token) {
    throw new Error("Degen ACP v1: bearer token (forumApiKey / dgc_) gerekli");
  }
  const pair = opts.pair.trim().toUpperCase().replace(/-USD$/i, "");
  const url = `${degenAcpV1BaseUrl()}/job`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      service: "perp_trade",
      action: "close",
      params: { pair, side: opts.side },
    }),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Degen ACP yanıtı JSON değil: HTTP ${res.status} ${text.slice(0, 240)}`
    );
  }
  const o = data as { ok?: boolean; error?: string; data?: { jobId?: string } };
  if (!res.ok) {
    throw new Error(
      o.error || `Degen ACP HTTP ${res.status}: ${text.slice(0, 300)}`
    );
  }
  if (o.ok === false) {
    throw new Error(o.error || "Degen ACP job reddedildi");
  }
  return data;
}
