/**
 * Technical Indicators Library
 * Pure TypeScript implementations of common trading indicators
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(values: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
      continue;
    }
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(values: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    if (i >= values.length) break;
    sum += values[i];
  }
  ema.push(sum / period);
  
  // Calculate remaining EMAs
  for (let i = period; i < values.length; i++) {
    const currentEMA = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEMA);
  }
  
  // Pad beginning with NaN
  const padding = new Array(period - 1).fill(NaN);
  return [...padding, ...ema];
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // First RSI uses simple average
  if (gains.length < period) {
    return new Array(closes.length).fill(NaN);
  }
  
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  rsi.push(NaN); // First value is NaN
  for (let i = period; i < closes.length; i++) {
    const rs = avgGain / avgLoss;
    const rsiValue = 100 - (100 / (1 + rs));
    rsi.push(rsiValue);
    
    // Smooth for next iteration
    if (i < closes.length - 1) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
  }
  
  // Pad beginning
  const padding = new Array(period).fill(NaN);
  return [...padding, ...rsi];
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  
  const macd: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      macd.push(NaN);
    } else {
      macd.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  // Signal line is EMA of MACD
  const validMACDs = macd.filter(v => !isNaN(v));
  const signalEMA = calculateEMA(validMACDs, signalPeriod);
  
  // Pad signal line to match length
  const signal: number[] = [];
  let signalIndex = 0;
  for (let i = 0; i < macd.length; i++) {
    if (isNaN(macd[i])) {
      signal.push(NaN);
    } else {
      signal.push(signalEMA[signalIndex] || NaN);
      signalIndex++;
    }
  }
  
  // Histogram
  const histogram: number[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (isNaN(macd[i]) || isNaN(signal[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macd[i] - signal[i]);
    }
  }
  
  return { macd, signal, histogram };
}

/**
 * Detect RSI Divergence
 * Returns: "bullish" | "bearish" | "none"
 */
export function detectRSIDivergence(
  closes: number[],
  rsi: number[],
  lookback: number = 5
): "bullish" | "bearish" | "none" {
  if (closes.length < lookback + 2 || rsi.length < lookback + 2) {
    return "none";
  }
  
  const recentCloses = closes.slice(-lookback);
  const recentRSI = rsi.slice(-lookback);
  
  const priceDown = recentCloses[recentCloses.length - 1] < recentCloses[0];
  const priceUp = recentCloses[recentCloses.length - 1] > recentCloses[0];
  const rsiUp = recentRSI[recentRSI.length - 1] > recentRSI[0];
  const rsiDown = recentRSI[recentRSI.length - 1] < recentRSI[0];
  
  // Bullish divergence: price makes lower low, RSI makes higher low
  if (priceDown && rsiUp) return "bullish";
  
  // Bearish divergence: price makes higher high, RSI makes lower high
  if (priceUp && rsiDown) return "bearish";
  
  return "none";
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    
    const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
    const mean = middle[i];
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    
    upper.push(mean + stdDev * sd);
    lower.push(mean - stdDev * sd);
  }
  
  return { upper, middle, lower };
}

/**
 * Get latest indicator values (last non-NaN value)
 */
export function getLatestValue(values: number[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (!isNaN(values[i])) return values[i];
  }
  return null;
}

/**
 * Check if two lines crossed (useful for EMA/MACD crossover detection)
 */
export function detectCrossover(
  fast: number[],
  slow: number[],
  lookback: number = 2
): "bullish" | "bearish" | "none" {
  if (fast.length < lookback || slow.length < lookback) return "none";
  
  const fastNow = fast[fast.length - 1];
  const slowNow = slow[slow.length - 1];
  const fastPrev = fast[fast.length - 2];
  const slowPrev = slow[slow.length - 2];
  
  if (isNaN(fastNow) || isNaN(slowNow) || isNaN(fastPrev) || isNaN(slowPrev)) {
    return "none";
  }
  
  // Bullish crossover: fast was below, now above
  if (fastPrev <= slowPrev && fastNow > slowNow) return "bullish";
  
  // Bearish crossover: fast was above, now below
  if (fastPrev >= slowPrev && fastNow < slowNow) return "bearish";
  
  return "none";
}
