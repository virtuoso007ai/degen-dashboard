import axios from "axios";
import { DEFAULT_DGCLAW_APP_URL } from "./constants";

export type DgPositionRow = {
  pair?: string;
  side?: string;
  entryPrice?: string;
  markPrice?: string;
  leverage?: number;
  margin?: string;
  notionalSize?: string;
  unrealizedPnl?: string;
  liquidationPrice?: string | null;
  createdAt?: string;
};

export type DgAccountData = {
  buyerAddress?: string;
  hlAddress?: string;
  hlBalance?: string;
  withdrawableBalance?: string;
};

export type DgOpenOrder = {
  orderId?: string;
  pair?: string;
  side?: string;
  size?: string;
  price?: string;
  orderType?: string;
  createdAt?: string;
};

function baseUrl(): string {
  return (process.env.DGCLAW_APP_URL?.trim() || DEFAULT_DGCLAW_APP_URL).replace(
    /\/$/,
    ""
  );
}

export async function fetchDgPositions(
  walletAddress: string
): Promise<DgPositionRow[]> {
  const url = `${baseUrl()}/users/${walletAddress.trim()}/positions`;
  const { data } = await axios.get<{ data?: DgPositionRow[] }>(url, {
    timeout: 45_000,
    validateStatus: (s) => s === 200,
  });
  return Array.isArray(data?.data) ? data.data : [];
}

export async function fetchDgAccount(
  walletAddress: string
): Promise<DgAccountData | null> {
  const url = `${baseUrl()}/users/${walletAddress.trim()}/account`;
  try {
    const { data } = await axios.get<{ data?: DgAccountData }>(url, {
      timeout: 45_000,
      validateStatus: (s) => s === 200,
    });
    return data?.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchDgOpenOrders(
  walletAddress: string
): Promise<DgOpenOrder[]> {
  const url = `${baseUrl()}/users/${walletAddress.trim()}/orders`;
  try {
    const { data } = await axios.get<{ data?: DgOpenOrder[] }>(url, {
      timeout: 45_000,
      validateStatus: (s) => s === 200,
    });
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}
