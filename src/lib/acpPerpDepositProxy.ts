import type { PerpDepositResult } from "./acpPerpDeposit";

/**
 * Vercel vb. serverless: ACP yok; deposit Railway/VM’deki worker’a HTTP ile devredilir.
 * Vercel’de `maxDuration` yine sınırlı olabilir — gerekirse Pro + route maxDuration.
 */
export function getPerpDepositProxy(): { baseUrl: string; secret: string } | null {
  const baseUrl = process.env.ACP_PERP_DEPOSIT_PROXY_URL?.trim().replace(/\/$/, "");
  const secret = process.env.ACP_PERP_DEPOSIT_PROXY_SECRET?.trim();
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

export async function runAcpPerpDepositProxied(opts: {
  masterAddress: string;
  amountUsdc: string;
}): Promise<PerpDepositResult> {
  const p = getPerpDepositProxy();
  if (!p) {
    throw new Error("ACP_PERP_DEPOSIT_PROXY_URL / ACP_PERP_DEPOSIT_PROXY_SECRET tanımlı değil");
  }

  const url = `${p.baseUrl}/perp-deposit`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${p.secret}`,
    },
    body: JSON.stringify({
      masterAddress: opts.masterAddress.trim(),
      amountUsdc: opts.amountUsdc.trim(),
    }),
    signal: AbortSignal.timeout(600_000),
  });

  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      typeof j.error === "string"
        ? j.error
        : typeof j.message === "string"
          ? j.message
          : `worker HTTP ${res.status}`;
    throw new Error(err.slice(0, 2000));
  }

  if (j.ok !== true) {
    const err = typeof j.error === "string" ? j.error : "worker: beklenmeyen yanıt";
    throw new Error(err.slice(0, 2000));
  }

  const jobId = j.jobId;
  if (typeof jobId !== "string" && typeof jobId !== "number") {
    throw new Error("worker: jobId yok");
  }

  return {
    jobId,
    amount: String(j.amount ?? opts.amountUsdc),
    message: String(j.message ?? ""),
  };
}
