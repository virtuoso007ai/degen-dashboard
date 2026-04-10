import axios, { type AxiosInstance } from "axios";
import { DEFAULT_ACP_API_URL, DEGEN_CLAW_PROVIDER } from "./constants";

export function createAcpClient(apiKey: string): AxiosInstance {
  const baseURL = process.env.ACP_API_URL?.trim() || DEFAULT_ACP_API_URL;
  const h: Record<string, string> = { "x-api-key": apiKey };
  const bc = process.env.ACP_BUILDER_CODE?.trim();
  if (bc) h["x-builder-code"] = bc;
  return axios.create({ baseURL, headers: h, timeout: 120_000 });
}

export async function fetchAcpWallet(apiKey: string): Promise<string | undefined> {
  try {
    const client = createAcpClient(apiKey);
    const { data } = await client.get<{ data?: { walletAddress?: string } }>(
      "/acp/me"
    );
    return data?.data?.walletAddress?.trim();
  } catch {
    return undefined;
  }
}

export type PerpOpenParams = {
  pair: string;
  side: "long" | "short";
  size: string;
  leverage: number;
  stopLoss?: string;
  takeProfit?: string;
  orderType?: "market" | "limit";
  limitPrice?: string;
};

export async function jobPerpOpen(client: AxiosInstance, p: PerpOpenParams) {
  const req: Record<string, string | number> = {
    action: "open",
    pair: p.pair.toUpperCase(),
    side: p.side,
    size: p.size,
    leverage: p.leverage,
  };
  if (p.stopLoss && p.stopLoss.trim()) req.stopLoss = p.stopLoss.trim();
  if (p.takeProfit && p.takeProfit.trim()) req.takeProfit = p.takeProfit.trim();
  if (p.orderType && p.orderType !== "market") req.orderType = p.orderType;
  if (p.limitPrice && p.limitPrice.trim()) req.limitPrice = p.limitPrice.trim();

  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: req,
  };
  const { data } = await client.post("/acp/jobs", body);
  return data;
}

export async function jobPerpClose(client: AxiosInstance, pair: string) {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "close",
      pair: pair.toUpperCase(),
    },
  };
  const { data } = await client.post("/acp/jobs", body);
  return data;
}

export async function jobPerpCancelLimit(
  client: AxiosInstance,
  pair: string,
  oid: string | number
) {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "cancel_limit",
      pair: pair.toUpperCase(),
      oid: String(oid),
    },
  };
  const { data } = await client.post("/acp/jobs", body);
  return data;
}

export type PerpModifyParams = {
  pair: string;
  stopLoss?: string;
  takeProfit?: string;
  leverage?: number;
};

export async function jobPerpModify(
  client: AxiosInstance,
  p: PerpModifyParams
) {
  const req: Record<string, string | number> = {
    pair: p.pair.toUpperCase(),
  };
  if (p.stopLoss != null && p.stopLoss !== "") req.stopLoss = p.stopLoss;
  if (p.takeProfit != null && p.takeProfit !== "") req.takeProfit = p.takeProfit;
  if (p.leverage != null && Number.isFinite(p.leverage) && p.leverage >= 1)
    req.leverage = p.leverage;

  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_modify",
    serviceRequirements: req,
  };
  const { data } = await client.post("/acp/jobs", body);
  return data;
}

export async function jobPerpDeposit(client: AxiosInstance, amount: string) {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_deposit",
    serviceRequirements: { amount },
  };
  const { data } = await client.post("/acp/jobs", body);
  return data;
}

export async function jobPerpWithdraw(
  client: AxiosInstance,
  p: { amount: string; recipient: string }
) {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_withdraw",
    serviceRequirements: { amount: p.amount, recipient: p.recipient },
  };
  const { data } = await client.post("/acp/jobs", body);
  return data;
}
