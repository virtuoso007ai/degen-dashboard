import axios, { type AxiosInstance } from "axios";
import { DEFAULT_ACP_API_URL } from "./constants";

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
