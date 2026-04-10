/**
 * Market Data Fetcher for Hyperliquid
 * Fetches candle data for technical analysis
 */

import axios from "axios";
import { Candle } from "./calculations";

const HYPERLIQUID_API = "https://api.hyperliquid-testnet.xyz/info";

export interface CandleRequest {
  pair: string;
  interval: string; // "1m", "5m", "15m", "1h", "4h", "1d"
  limit?: number; // default 100
}

/**
 * Fetch candles from Hyperliquid
 */
export async function fetchCandles(req: CandleRequest): Promise<Candle[]> {
  try {
    const response = await axios.post(HYPERLIQUID_API, {
      type: "candleSnapshot",
      req: {
        coin: req.pair,
        interval: req.interval,
        startTime: Date.now() - (req.limit || 100) * getIntervalMs(req.interval),
        endTime: Date.now(),
      },
    });

    if (!response.data || !Array.isArray(response.data)) {
      console.error("[fetchCandles] Invalid response:", response.data);
      return [];
    }

    return response.data.map((c: any) => ({
      timestamp: c.t,
      open: parseFloat(c.o),
      high: parseFloat(c.h),
      low: parseFloat(c.l),
      close: parseFloat(c.c),
      volume: parseFloat(c.v || "0"),
    }));
  } catch (error) {
    console.error("[fetchCandles] Error:", error);
    return [];
  }
}

/**
 * Convert interval string to milliseconds
 */
function getIntervalMs(interval: string): number {
  const value = parseInt(interval.slice(0, -1));
  const unit = interval.slice(-1);

  switch (unit) {
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000; // default 15m
  }
}

/**
 * Validate interval string
 */
export function isValidInterval(interval: string): boolean {
  return /^\d+[mhd]$/.test(interval);
}

/**
 * Get supported intervals
 */
export const SUPPORTED_INTERVALS = [
  "1m", "3m", "5m", "15m", "30m",
  "1h", "2h", "4h", "6h", "12h",
  "1d", "3d", "1w"
];
