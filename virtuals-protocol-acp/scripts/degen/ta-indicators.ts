/**
 * Minimal TA helpers for ETH signal bot (HL candles → EMA / RSI).
 */

export function emaSeries(closes: number[], period: number): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  out[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    out[i] = closes[i] * k + out[i - 1]! * (1 - k);
  }
  return out;
}

/** Wilder RSI (14) on close; leading values NaN until enough bars. */
export function rsiSeries(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return out;
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const ch = changes[i]!;
    if (ch >= 0) avgGain += ch;
    else avgLoss -= ch;
  }
  avgGain /= period;
  avgLoss /= period;

  const idx = period;
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  out[idx] = 100 - 100 / (1 + rs0);

  for (let i = idx + 1; i < closes.length; i++) {
    const ch = changes[i - 1]!;
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

/** MACD (12,26) ve sinyal çizgisi EMA(9). */
export function macdSeries(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { macd: number[]; signal: number[]; hist: number[] } {
  const n = closes.length;
  const macd = new Array(n).fill(NaN);
  const emaF = emaSeries(closes, fast);
  const emaS = emaSeries(closes, slow);
  const start = slow - 1;
  for (let i = start; i < n; i++) {
    if (Number.isFinite(emaF[i]) && Number.isFinite(emaS[i])) macd[i] = emaF[i]! - emaS[i]!;
  }
  const trimmed = macd.slice(start);
  const sigTrim = emaSeries(trimmed, signalPeriod);
  const signal = new Array(n).fill(NaN);
  for (let i = 0; i < sigTrim.length; i++) signal[start + i] = sigTrim[i];
  const hist = macd.map((m, i) =>
    Number.isFinite(m) && Number.isFinite(signal[i]) ? m - signal[i]! : NaN
  );
  return { macd, signal, hist };
}
