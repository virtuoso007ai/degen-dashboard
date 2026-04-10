/**
 * Trading Strategy Types and Configurations
 * Based on TrendTrader methodology
 */

export type StrategyType = 
  | "rsi_reversal"
  | "ema_cross"
  | "macd_histogram"
  | "macd_crossover"
  | "trendtrader_combined"
  | "rsi_divergence";

export type SignalType = "buy" | "sell" | "hold";

export interface StrategyConfig {
  id: string;
  agentAlias: string;
  strategyType: StrategyType;
  enabled: boolean;
  
  // Trading pairs to scan (empty = scan all supported pairs)
  pairs: string[]; // ["BTC", "ETH", "SOL"] or [] for all
  
  // Timeframe
  tickInterval: string; // "1m", "5m", "15m", "1h", etc.
  candleInterval: string;
  
  // Position management
  positionSizeUSD: number;
  leverage: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  
  // Strategy-specific parameters
  parameters: Record<string, number | string | boolean>;
  
  // Metadata
  createdAt: string;
  lastSignalAt?: string;
  minSignalStrength?: number; // Minimum signal strength to trade (default: 60)
}

export interface TradingSignal {
  strategyId: string;
  agentAlias: string;
  pair: string;
  signal: SignalType;
  strength: number; // 0-100
  reason: string;
  indicators: Record<string, number>;
  timestamp: string;
}

// RSI Strategy Parameters
export interface RSIReversalParams {
  period: number; // default: 14
  oversold: number; // default: 30
  overbought: number; // default: 70
}

// EMA Strategy Parameters
export interface EMACrossParams {
  fastPeriod: number; // default: 9
  slowPeriod: number; // default: 21
}

// MACD Strategy Parameters
export interface MACDParams {
  fastPeriod: number; // default: 12
  slowPeriod: number; // default: 26
  signalPeriod: number; // default: 9
}

// Combined Strategy Parameters
export interface TrendTraderCombinedParams {
  rsi: RSIReversalParams;
  ema: EMACrossParams;
  macd: MACDParams;
  requireAll: boolean; // All indicators must align
}

// Preset strategies matching the UI
export const STRATEGY_PRESETS: Record<StrategyType, {
  name: string;
  description: string;
  defaultParams: Record<string, any>;
}> = {
  rsi_reversal: {
    name: "RSI Reversal",
    description: "Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)",
    defaultParams: {
      period: 14,
      oversold: 30,
      overbought: 70,
    }
  },
  ema_cross: {
    name: "EMA Cross",
    description: "Buy on EMA golden cross, sell on death cross",
    defaultParams: {
      fastPeriod: 9,
      slowPeriod: 21,
    }
  },
  macd_histogram: {
    name: "MACD Histogram",
    description: "Buy when histogram turns positive, sell when negative",
    defaultParams: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    }
  },
  macd_crossover: {
    name: "MACD Crossover",
    description: "Buy on bullish MACD line/signal cross, sell on bearish cross",
    defaultParams: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    }
  },
  trendtrader_combined: {
    name: "TrendTrader Combined",
    description: "Full RSI + MACD + EMA scoring system with divergence detection (uses all indicators and plots strongest signals)",
    defaultParams: {
      rsi: { period: 14, oversold: 30, overbought: 70 },
      ema: { fastPeriod: 9, slowPeriod: 21 },
      macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      requireAll: false, // false = score-based, true = all must align
    }
  },
  rsi_divergence: {
    name: "RSI Divergence",
    description: "Buy on bullish RSI divergence, sell on bearish divergence",
    defaultParams: {
      period: 14,
      lookbackBars: 5, // How many bars to check for divergence
    }
  },
};
