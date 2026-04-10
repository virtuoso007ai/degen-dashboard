/**
 * Trading Strategy Signal Engine
 * Generates buy/sell signals based on technical indicators
 */

import {
  calculateRSI,
  calculateEMA,
  calculateMACD,
  detectRSIDivergence,
  detectCrossover,
  getLatestValue,
  Candle,
} from "./calculations";

import {
  StrategyConfig,
  TradingSignal,
  SignalType,
  RSIReversalParams,
  EMACrossParams,
  MACDParams,
  TrendTraderCombinedParams,
} from "./types";

/**
 * Generate signal from RSI Reversal strategy
 */
export function generateRSIReversalSignal(
  candles: Candle[],
  config: StrategyConfig
): SignalType {
  const closes = candles.map(c => c.close);
  const params = config.parameters as unknown as RSIReversalParams;
  
  const rsi = calculateRSI(closes, params.period);
  const latestRSI = getLatestValue(rsi);
  
  if (latestRSI === null) return "hold";
  
  if (latestRSI < params.oversold) return "buy";
  if (latestRSI > params.overbought) return "sell";
  
  return "hold";
}

/**
 * Generate signal from EMA Cross strategy
 */
export function generateEMACrossSignal(
  candles: Candle[],
  config: StrategyConfig
): SignalType {
  const closes = candles.map(c => c.close);
  const params = config.parameters as unknown as EMACrossParams;
  
  const fastEMA = calculateEMA(closes, params.fastPeriod);
  const slowEMA = calculateEMA(closes, params.slowPeriod);
  
  const crossover = detectCrossover(fastEMA, slowEMA);
  
  if (crossover === "bullish") return "buy";
  if (crossover === "bearish") return "sell";
  
  return "hold";
}

/**
 * Generate signal from MACD Histogram strategy
 */
export function generateMACDHistogramSignal(
  candles: Candle[],
  config: StrategyConfig
): SignalType {
  const closes = candles.map(c => c.close);
  const params = config.parameters as unknown as MACDParams;
  
  const { histogram } = calculateMACD(
    closes,
    params.fastPeriod,
    params.slowPeriod,
    params.signalPeriod
  );
  
  const latestHisto = getLatestValue(histogram);
  const prevHisto = histogram.length > 1 ? histogram[histogram.length - 2] : null;
  
  if (latestHisto === null || prevHisto === null) return "hold";
  
  // Histogram turns positive
  if (prevHisto <= 0 && latestHisto > 0) return "buy";
  
  // Histogram turns negative
  if (prevHisto >= 0 && latestHisto < 0) return "sell";
  
  return "hold";
}

/**
 * Generate signal from MACD Crossover strategy
 */
export function generateMACDCrossoverSignal(
  candles: Candle[],
  config: StrategyConfig
): SignalType {
  const closes = candles.map(c => c.close);
  const params = config.parameters as unknown as MACDParams;
  
  const { macd, signal } = calculateMACD(
    closes,
    params.fastPeriod,
    params.slowPeriod,
    params.signalPeriod
  );
  
  const crossover = detectCrossover(macd, signal);
  
  if (crossover === "bullish") return "buy";
  if (crossover === "bearish") return "sell";
  
  return "hold";
}

/**
 * Generate signal from RSI Divergence strategy
 */
export function generateRSIDivergenceSignal(
  candles: Candle[],
  config: StrategyConfig
): SignalType {
  const closes = candles.map(c => c.close);
  const params = config.parameters as any;
  
  const rsi = calculateRSI(closes, params.period);
  const divergence = detectRSIDivergence(closes, rsi, params.lookbackBars || 5);
  
  if (divergence === "bullish") return "buy";
  if (divergence === "bearish") return "sell";
  
  return "hold";
}

/**
 * Generate signal from TrendTrader Combined strategy
 * Uses scoring system: each indicator votes, majority wins
 */
export function generateTrendTraderCombinedSignal(
  candles: Candle[],
  config: StrategyConfig
): { signal: SignalType; strength: number; reason: string } {
  const closes = candles.map(c => c.close);
  const params = config.parameters as unknown as TrendTraderCombinedParams;
  
  let buyScore = 0;
  let sellScore = 0;
  const reasons: string[] = [];
  
  // RSI analysis
  const rsi = calculateRSI(closes, params.rsi.period);
  const latestRSI = getLatestValue(rsi);
  if (latestRSI !== null) {
    if (latestRSI < params.rsi.oversold) {
      buyScore++;
      reasons.push(`RSI oversold (${latestRSI.toFixed(1)})`);
    } else if (latestRSI > params.rsi.overbought) {
      sellScore++;
      reasons.push(`RSI overbought (${latestRSI.toFixed(1)})`);
    }
  }
  
  // EMA analysis
  const fastEMA = calculateEMA(closes, params.ema.fastPeriod);
  const slowEMA = calculateEMA(closes, params.ema.slowPeriod);
  const emaCross = detectCrossover(fastEMA, slowEMA);
  if (emaCross === "bullish") {
    buyScore++;
    reasons.push("EMA golden cross");
  } else if (emaCross === "bearish") {
    sellScore++;
    reasons.push("EMA death cross");
  }
  
  // MACD analysis
  const { macd, signal, histogram } = calculateMACD(
    closes,
    params.macd.fastPeriod,
    params.macd.slowPeriod,
    params.macd.signalPeriod
  );
  
  const macdCross = detectCrossover(macd, signal);
  if (macdCross === "bullish") {
    buyScore++;
    reasons.push("MACD bullish cross");
  } else if (macdCross === "bearish") {
    sellScore++;
    reasons.push("MACD bearish cross");
  }
  
  const latestHisto = getLatestValue(histogram);
  if (latestHisto !== null) {
    if (latestHisto > 0) {
      buyScore += 0.5;
    } else if (latestHisto < 0) {
      sellScore += 0.5;
    }
  }
  
  // RSI Divergence (bonus)
  const divergence = detectRSIDivergence(closes, rsi, 5);
  if (divergence === "bullish") {
    buyScore++;
    reasons.push("RSI bullish divergence");
  } else if (divergence === "bearish") {
    sellScore++;
    reasons.push("RSI bearish divergence");
  }
  
  // Decision logic
  const totalScore = buyScore + sellScore;
  if (params.requireAll) {
    // All must agree
    if (buyScore > 0 && sellScore === 0) {
      return {
        signal: "buy",
        strength: Math.min(100, (buyScore / 4) * 100),
        reason: reasons.join(", ")
      };
    }
    if (sellScore > 0 && buyScore === 0) {
      return {
        signal: "sell",
        strength: Math.min(100, (sellScore / 4) * 100),
        reason: reasons.join(", ")
      };
    }
  } else {
    // Majority vote - minimum 1.5 score to trigger (at least 1 strong + 1 weak indicator)
    if (buyScore > sellScore && buyScore >= 1.5) {
      return {
        signal: "buy",
        strength: Math.min(100, (buyScore / 4) * 100),
        reason: reasons.join(", ")
      };
    }
    if (sellScore > buyScore && sellScore >= 1.5) {
      return {
        signal: "sell",
        strength: Math.min(100, (sellScore / 4) * 100),
        reason: reasons.join(", ")
      };
    }
  }
  
  return {
    signal: "hold",
    strength: 0,
    reason: reasons.length > 0 ? `Mixed signals: ${reasons.join(", ")}` : "No clear signal"
  };
}

/**
 * Main signal generator - routes to appropriate strategy
 */
export function generateSignal(
  candles: Candle[],
  config: StrategyConfig,
  pair: string
): TradingSignal {
  let signal: SignalType = "hold";
  let strength = 0;
  let reason = "";
  const indicators: Record<string, number> = {};
  
  const closes = candles.map(c => c.close);
  const latestPrice = closes[closes.length - 1];
  
  switch (config.strategyType) {
    case "rsi_reversal": {
      signal = generateRSIReversalSignal(candles, config);
      const params = config.parameters as unknown as RSIReversalParams;
      const rsi = calculateRSI(closes, params.period);
      const latestRSI = getLatestValue(rsi);
      if (latestRSI) indicators.rsi = latestRSI;
      reason = signal !== "hold" 
        ? `RSI ${latestRSI?.toFixed(1)} (oversold<${params.oversold}, overbought>${params.overbought})` 
        : `RSI ${latestRSI?.toFixed(1)} - neutral (${params.oversold}-${params.overbought})`;
      strength = signal !== "hold" ? 75 : 0;
      break;
    }
      
    case "ema_cross": {
      signal = generateEMACrossSignal(candles, config);
      const emaParams = config.parameters as unknown as EMACrossParams;
      const fastEMA = calculateEMA(closes, emaParams.fastPeriod);
      const slowEMA = calculateEMA(closes, emaParams.slowPeriod);
      const fastVal = getLatestValue(fastEMA);
      const slowVal = getLatestValue(slowEMA);
      if (fastVal) indicators.emaFast = fastVal;
      if (slowVal) indicators.emaSlow = slowVal;
      reason = signal !== "hold" 
        ? `EMA${emaParams.fastPeriod}=${fastVal?.toFixed(2)} crossed EMA${emaParams.slowPeriod}=${slowVal?.toFixed(2)}`
        : `EMA${emaParams.fastPeriod}=${fastVal?.toFixed(2)} vs EMA${emaParams.slowPeriod}=${slowVal?.toFixed(2)} - no cross`;
      strength = signal !== "hold" ? 80 : 0;
      break;
    }
      
    case "macd_histogram": {
      signal = generateMACDHistogramSignal(candles, config);
      const macdParams = config.parameters as unknown as MACDParams;
      const { histogram: histo } = calculateMACD(closes, macdParams.fastPeriod, macdParams.slowPeriod, macdParams.signalPeriod);
      const latestH = getLatestValue(histo);
      if (latestH) indicators.histogram = latestH;
      reason = signal !== "hold" 
        ? `MACD histogram flipped (${latestH?.toFixed(4)})` 
        : `MACD histogram=${latestH?.toFixed(4)} - no flip`;
      strength = signal !== "hold" ? 70 : 0;
      break;
    }
      
    case "macd_crossover": {
      signal = generateMACDCrossoverSignal(candles, config);
      reason = signal !== "hold" ? "MACD line cross" : "MACD - no cross";
      strength = signal !== "hold" ? 80 : 0;
      break;
    }
      
    case "rsi_divergence": {
      signal = generateRSIDivergenceSignal(candles, config);
      reason = signal !== "hold" ? "RSI divergence detected" : "No divergence";
      strength = signal !== "hold" ? 85 : 0;
      break;
    }
      
    case "trendtrader_combined": {
      const combined = generateTrendTraderCombinedSignal(candles, config);
      signal = combined.signal;
      strength = combined.strength;
      reason = combined.reason;
      break;
    }
  }
  
  indicators.price = latestPrice;
  
  return {
    strategyId: config.id,
    agentAlias: config.agentAlias,
    pair,
    signal,
    strength,
    reason,
    indicators,
    timestamp: new Date().toISOString(),
  };
}
