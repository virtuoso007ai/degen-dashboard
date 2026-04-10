/**
 * ETH — Scalp: HL mumlarında çoklu sinyal modu; Degen `perp_trade`.
 *
 * SIGNAL_MODE:
 *   ema   — EMA hızlı/yavaş kesişimi (seyrek)
 *   rsi   — RSI aşırı alım/satım + momentum dönüşü (sık)
 *   macd  — MACD / sinyal çizgisi kesişimi
 *   multi — üsttekilerden biri (çakışmada iptal)
 *
 * Varsayılan: SIGNAL_MODE=multi (scalp için daha fazla fırsat). Eski davranış: SIGNAL_MODE=ema
 *
 * Usage:
 *   npx tsx scripts/degen/eth-signal-degen.ts [--dry-run] [--no-rsi] [usdc_notional] [leverage]
 */
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import client from "../../src/lib/client.js";
import { loadApiKey, ROOT } from "../../src/lib/config.js";
import { DEGEN_CLAW_PROVIDER } from "./constants.js";
import { emaSeries, rsiSeries, macdSeries } from "./ta-indicators.js";

const HL_INFO = "https://api.hyperliquid.xyz/info";
const STATE_PATH = path.join(ROOT, "eth-signal-state.json");

const DEFAULT_TRADING_STYLE = "scalp";
/** Scalp’te EMA tek başına seyrek tetikler; multi önerilir. */
const DEFAULT_SIGNAL_MODE = "multi";

type HlCandle = { t: number; c: string };
type SignalSide = "long" | "short";
export type SignalMode = "ema" | "rsi" | "macd" | "multi";

type StyleParams = {
  interval: string;
  emaFast: number;
  emaSlow: number;
  rsiPeriod: number;
};

function resolveStyle(): StyleParams {
  const style = (process.env.TRADING_STYLE || DEFAULT_TRADING_STYLE).toLowerCase();
  const base = ((): StyleParams => {
    switch (style) {
      case "swing":
        return { interval: "1h", emaFast: 12, emaSlow: 26, rsiPeriod: 14 };
      case "intraday":
        return { interval: "30m", emaFast: 8, emaSlow: 21, rsiPeriod: 9 };
      case "scalp":
      default:
        return { interval: "15m", emaFast: 8, emaSlow: 21, rsiPeriod: 9 };
    }
  })();

  const manualInterval = process.env.HL_INTERVAL?.trim();
  const emaF = process.env.EMA_FAST?.trim();
  const emaS = process.env.EMA_SLOW?.trim();
  const rsiP = process.env.RSI_PERIOD?.trim();

  return {
    interval: manualInterval || base.interval,
    emaFast: emaF ? Number.parseInt(emaF, 10) : base.emaFast,
    emaSlow: emaS ? Number.parseInt(emaS, 10) : base.emaSlow,
    rsiPeriod: rsiP ? Number.parseInt(rsiP, 10) : base.rsiPeriod,
  };
}

function resolveSignalMode(): SignalMode {
  const m = (process.env.SIGNAL_MODE || DEFAULT_SIGNAL_MODE).toLowerCase();
  if (m === "ema" || m === "rsi" || m === "macd" || m === "multi") return m;
  return DEFAULT_SIGNAL_MODE;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const noRsi = argv.includes("--no-rsi");
  const rest = argv.filter((a) => !a.startsWith("--"));
  const notional = rest[0] ?? "12";
  const lev = rest[1] ? Number.parseInt(rest[1], 10) : 5;
  return {
    dryRun,
    noRsi,
    notional,
    leverage: Number.isFinite(lev) && lev > 0 ? lev : 5,
  };
}

async function fetchCandles(
  coin: string,
  interval: string,
  lookbackMs: number
): Promise<HlCandle[]> {
  const end = Date.now();
  const start = end - lookbackMs;
  const { data } = await axios.post<HlCandle[]>(
    HL_INFO,
    { type: "candleSnapshot", req: { coin, interval, startTime: start, endTime: end } },
    { timeout: 30_000 }
  );
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("HL candleSnapshot: boş yanıt");
  }
  return data;
}

interface State {
  lastSignalBarT: number | null;
}

function loadState(): State {
  try {
    if (!fs.existsSync(STATE_PATH)) return { lastSignalBarT: null };
    const j = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as State;
    return { lastSignalBarT: j.lastSignalBarT ?? null };
  } catch {
    return { lastSignalBarT: null };
  }
}

function saveState(barT: number): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ lastSignalBarT: barT }, null, 2) + "\n", "utf-8");
}

function emaCrossSignal(
  lastClosed: number,
  prev: number,
  emaF: number[],
  emaS: number[],
  rsi: number[],
  rsiNow: number,
  noRsi: boolean
): { long: boolean; short: boolean; blockReason?: string } {
  const e12p = emaF[prev]!;
  const e26p = emaS[prev]!;
  const e12c = emaF[lastClosed]!;
  const e26c = emaS[lastClosed]!;
  const golden = e12p <= e26p && e12c > e26c;
  const death = e12p >= e26p && e12c < e26c;
  if (golden) {
    if (!noRsi && rsiNow >= 70) return { long: false, short: false, blockReason: "ema_long_rsi>=70" };
    return { long: true, short: false };
  }
  if (death) {
    if (!noRsi && rsiNow <= 30) return { long: false, short: false, blockReason: "ema_short_rsi<=30" };
    return { long: false, short: true };
  }
  return { long: false, short: false };
}

/** RSI: aşırı bölgeden hafif dönüş (scalp). */
function rsiScalpSignal(
  lastClosed: number,
  prev: number,
  rsi: number[]
): { long: boolean; short: boolean } {
  const rp = rsi[prev]!;
  const rc = rsi[lastClosed]!;
  if (!Number.isFinite(rp) || !Number.isFinite(rc)) return { long: false, short: false };
  const long =
    rp < 38 && rc > rp && rc < 52;
  const short =
    rp > 62 && rc < rp && rc > 48;
  return { long, short };
}

function macdCrossSignal(
  lastClosed: number,
  prev: number,
  macd: number[],
  signal: number[],
  rsiNow: number,
  noRsi: boolean
): { long: boolean; short: boolean; blockReason?: string } {
  const mp = macd[prev]!;
  const sp = signal[prev]!;
  const mc = macd[lastClosed]!;
  const sc = signal[lastClosed]!;
  if (![mp, sp, mc, sc].every(Number.isFinite)) return { long: false, short: false };
  const golden = mp <= sp && mc > sc;
  const death = mp >= sp && mc < sc;
  if (golden) {
    if (!noRsi && rsiNow >= 72) return { long: false, short: false, blockReason: "macd_long_rsi>=72" };
    return { long: true, short: false };
  }
  if (death) {
    if (!noRsi && rsiNow <= 28) return { long: false, short: false, blockReason: "macd_short_rsi<=28" };
    return { long: false, short: true };
  }
  return { long: false, short: false };
}

function combineMulti(
  ema: { long: boolean; short: boolean },
  rsi: { long: boolean; short: boolean },
  macd: { long: boolean; short: boolean }
): { side: SignalSide | null; conflict: boolean; parts: Record<string, string> } {
  const anyL = ema.long || rsi.long || macd.long;
  const anyS = ema.short || rsi.short || macd.short;
  const parts = {
    ema: ema.long ? "long" : ema.short ? "short" : "none",
    rsi: rsi.long ? "long" : rsi.short ? "short" : "none",
    macd: macd.long ? "long" : macd.short ? "short" : "none",
  };
  if (anyL && anyS) return { side: null, conflict: true, parts };
  if (anyL) return { side: "long", conflict: false, parts };
  if (anyS) return { side: "short", conflict: false, parts };
  return { side: null, conflict: false, parts };
}

async function main() {
  loadApiKey();
  const { dryRun, noRsi, notional, leverage } = parseArgs();
  const { interval, emaFast: fastP, emaSlow: slowP, rsiPeriod } = resolveStyle();
  const signalMode = resolveSignalMode();

  if (fastP >= slowP) {
    console.error("EMA_FAST < EMA_SLOW olmalı");
    process.exit(1);
    return;
  }

  const lookbackDays =
    interval === "1h" || interval === "4h" || interval === "1d" ? 120 : interval === "30m" ? 21 : 14;
  const candles = await fetchCandles("ETH", interval, lookbackDays * 24 * 60 * 60 * 1000);
  const closes = candles.map((c) => Number.parseFloat(c.c));
  if (closes.some((x) => !Number.isFinite(x))) {
    throw new Error("Geçersiz kapanış fiyatı");
  }

  const emaF = emaSeries(closes, fastP);
  const emaS = emaSeries(closes, slowP);
  const rsi = rsiSeries(closes, rsiPeriod);
  const { macd: macdL, signal: macdSig } = macdSeries(closes, 12, 26, 9);

  const lastClosed = closes.length - 2;
  const prev = lastClosed - 1;

  const minEma = Math.max(slowP, rsiPeriod + 1) + 2;
  const minMacd = 40;
  const minWarmup = signalMode === "ema" ? minEma : signalMode === "rsi" ? minEma : minMacd;

  if (prev < minWarmup) {
    console.log(
      JSON.stringify({
        ok: false,
        reason: `Yetersiz mum (min ~${minWarmup + 5}, interval=${interval})`,
        signalMode,
        interval,
        bars: closes.length,
      })
    );
    process.exit(0);
    return;
  }

  if (!Number.isFinite(emaF[prev]!) || !Number.isFinite(emaS[prev]!)) {
    console.log(JSON.stringify({ ok: false, reason: "EMA henüz hazır değil", signalMode }));
    process.exit(0);
    return;
  }

  const rsiNow = rsi[lastClosed]!;
  const e12c = emaF[lastClosed]!;
  const e26c = emaS[lastClosed]!;

  const emaSig = emaCrossSignal(lastClosed, prev, emaF, emaS, rsi, rsiNow, noRsi);
  const rsiSig = rsiScalpSignal(lastClosed, prev, rsi);
  const macdSigR = macdCrossSignal(lastClosed, prev, macdL, macdSig, rsiNow, noRsi);

  let side: SignalSide | null = null;
  let detail: Record<string, unknown> = {
    signalMode,
    interval,
    tradingStyle: process.env.TRADING_STYLE || DEFAULT_TRADING_STYLE,
    emaPeriods: { fast: fastP, slow: slowP },
    rsiPeriod,
    lastClose: closes[lastClosed],
    emaFast: e12c,
    emaSlow: e26c,
    rsi: rsiNow,
    macd: macdL[lastClosed],
    macdSignal: macdSig[lastClosed],
    barT: candles[lastClosed]!.t,
  };

  if (signalMode === "ema") {
    if (emaSig.blockReason) {
      console.log(JSON.stringify({ ok: false, reason: emaSig.blockReason, ...detail }));
      process.exit(0);
      return;
    }
    if (emaSig.long) side = "long";
    else if (emaSig.short) side = "short";
  } else if (signalMode === "rsi") {
    if (rsiSig.long) side = "long";
    else if (rsiSig.short) side = "short";
  } else if (signalMode === "macd") {
    if (macdSigR.blockReason) {
      console.log(JSON.stringify({ ok: false, reason: macdSigR.blockReason, ...detail }));
      process.exit(0);
      return;
    }
    if (macdSigR.long) side = "long";
    else if (macdSigR.short) side = "short";
  } else {
    const emaOnly = { long: emaSig.long, short: emaSig.short };
    const comb = combineMulti(emaOnly, rsiSig, {
      long: macdSigR.long,
      short: macdSigR.short,
    });
    detail = { ...detail, multiParts: comb.parts, conflict: comb.conflict };
    if (comb.conflict) {
      console.log(
        JSON.stringify({
          ok: true,
          signal: "none",
          reason: "multi: aynı mumda long ve short kaynakları çakıştı",
          ...detail,
        })
      );
      process.exit(0);
      return;
    }
    side = comb.side;
  }

  if (!side) {
    console.log(
      JSON.stringify({
        ok: true,
        signal: "none",
        ...detail,
      })
    );
    process.exit(0);
    return;
  }

  const barT = candles[lastClosed]!.t;
  const state = loadState();
  if (state.lastSignalBarT === barT) {
    console.log(
      JSON.stringify({
        ok: false,
        reason: "Bu mum için zaten işlem üretildi (state)",
        barT,
        side,
        signalMode,
      })
    );
    process.exit(0);
    return;
  }

  const payload = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "open",
      pair: "ETH",
      side,
      size: notional,
      leverage,
    },
  };

  console.log(
    JSON.stringify({
      ok: true,
      signal: side,
      ...detail,
      notional,
      leverage,
      dryRun,
    })
  );

  if (dryRun) {
    console.error("(dry-run — job oluşturulmadı)");
    process.exit(0);
    return;
  }

  const r = await client.post<{ data: { jobId: number }; message?: string }>("/acp/jobs", payload);
  saveState(barT);
  console.log(JSON.stringify(r.data));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
