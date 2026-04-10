"use client";

import { useState } from "react";
import { STRATEGY_PRESETS, StrategyType } from "@/lib/indicators/types";

interface StrategyCreatorProps {
  agents: Array<{ alias: string; label?: string }>;
  onClose: () => void;
}

export default function StrategyCreator({ agents, onClose }: StrategyCreatorProps) {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType | "">("");
  const [tickInterval, setTickInterval] = useState("15m");
  const [candleInterval, setCandleInterval] = useState("15m");
  const [positionSize, setPositionSize] = useState("11");
  const [leverage, setLeverage] = useState("3");
  const [tpPercent, setTpPercent] = useState("3.5");
  const [slPercent, setSlPercent] = useState("3");
  const [minSignalStrength, setMinSignalStrength] = useState("60");
  const [creating, setCreating] = useState(false);

  const strategyList: Array<{ type: StrategyType; name: string; desc: string }> = [
    { type: "rsi_reversal", name: "RSI Reversal", desc: "Scan all pairs, buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)" },
    { type: "ema_cross", name: "EMA Cross", desc: "Scan all pairs, buy on EMA golden cross, sell on death cross" },
    { type: "macd_histogram", name: "MACD Histogram", desc: "Scan all pairs, buy when histogram turns positive, sell when negative" },
    { type: "macd_crossover", name: "MACD Crossover", desc: "Scan all pairs, buy on bullish MACD line/signal cross, sell on bearish cross" },
    { type: "trendtrader_combined", name: "TrendTrader Combined", desc: "Scan all pairs with RSI + MACD + EMA scoring, trade the strongest signal" },
    { type: "rsi_divergence", name: "RSI Divergence", desc: "Scan all pairs, buy on bullish RSI divergence, sell on bearish divergence" },
  ];

  const intervals = ["1m", "5m", "15m", "30m", "1h", "4h"];

  const handleCreate = async () => {
    if (!selectedAgent || !selectedStrategy) {
      alert("Please select agent and strategy");
      return;
    }

    setCreating(true);
    try {
      const preset = STRATEGY_PRESETS[selectedStrategy];
      const response = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentAlias: selectedAgent,
          strategyType: selectedStrategy,
          pairs: [], // Empty = scan all pairs
          enabled: false, // Start disabled for safety
          tickInterval,
          candleInterval,
          positionSizeUSD: parseFloat(positionSize),
          leverage: parseInt(leverage),
          takeProfitPercent: parseFloat(tpPercent),
          stopLossPercent: parseFloat(slPercent),
          minSignalStrength: parseInt(minSignalStrength),
          parameters: preset.defaultParams,
        }),
      });

      if (response.ok) {
        alert("Strategy created successfully! Enable it to start trading.");
        onClose();
      } else {
        const error = await response.json();
        alert(`Failed to create strategy: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-[#0f1419] border border-cyan-900/30 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f1419] border-b border-cyan-900/30 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-cyan-400 uppercase tracking-wider">Create Bot</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Agent Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Agent
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full bg-[#1a2332] border border-cyan-900/30 rounded px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="">Select...</option>
              {agents.map((a) => (
                <option key={a.alias} value={a.alias}>
                  {a.label || a.alias}
                </option>
              ))}
            </select>
          </div>

          {/* Strategy Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              Strategy
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {strategyList.map((s) => (
                <button
                  key={s.type}
                  onClick={() => setSelectedStrategy(s.type)}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    selectedStrategy === s.type
                      ? "bg-cyan-900/20 border-cyan-500"
                      : "bg-[#1a2332] border-cyan-900/30 hover:border-cyan-700"
                  }`}
                >
                  <div className="font-semibold text-white mb-1">{s.name}</div>
                  <div className="text-xs text-zinc-400 leading-relaxed">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Tick Interval (MTR)
                </label>
                <select
                  value={tickInterval}
                  onChange={(e) => setTickInterval(e.target.value)}
                  className="w-full bg-[#1a2332] border border-cyan-900/30 rounded px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  {intervals.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Position Size (USD)
                </label>
                <input
                  type="number"
                  value={positionSize}
                  onChange={(e) => setPositionSize(e.target.value)}
                  className="w-full bg-[#1a2332] border border-cyan-900/30 rounded px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="11"
                />
                <div className="text-xs text-zinc-500 mt-1">Minimum 11 USDC (cannot below 11 pos not accepted)</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  TP %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tpPercent}
                  onChange={(e) => setTpPercent(e.target.value)}
                  className="w-full bg-[#1a2332] border border-cyan-900/30 rounded px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="3.5"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  CSLR Mode
                </label>
                <select
                  className="w-full bg-[#1a2332] border border-cyan-900/30 rounded px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option>Auto (Top 01)</option>
                  <option>Auto (Top 02)</option>
                  <option>Auto (Top 03)</option>
                  <option>Manual</option>
                </select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Candle Interval
                </label>
                <select
                  value={candleInterval}
                  onChange={(e) => setCandleInterval(e.target.value)}
                  className="w-full bg-[#1a2332] border border-cyan-900/30 rounded px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  {intervals.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Leverage
                </label>
                <input
                  type="number"
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  className="w-full bg-[#1a2332] border border-cyan-900/30 rounded px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="3"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  SL %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={slPercent}
                  onChange={(e) => setSlPercent(e.target.value)}
                  className="w-full bg-[#1a2332] border border-cyan-900/30 rounded px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="3"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Min Signal Strength %
                </label>
                <input
                  type="number"
                  value={minSignalStrength}
                  onChange={(e) => setMinSignalStrength(e.target.value)}
                  className="w-full bg-[#1a2332] border border-cyan-900/30 rounded px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="60"
                />
                <div className="text-xs text-zinc-500 mt-1">Only trade if signal strength ≥ this % (default: 60)</div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-cyan-950/20 border border-cyan-900/30 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-cyan-400 text-xl">ℹ️</div>
              <div className="text-sm text-zinc-300">
                <strong className="text-cyan-400">Multi-Pair Scanner:</strong> This strategy will scan all supported pairs 
                (BTC, ETH, SOL, DOGE, PENGU, HYPE, PEPE, POPCAT) and automatically trade the <strong>strongest signal</strong>.
              </div>
            </div>
          </div>

          {/* Auto Close Option - Removed */}

          {/* Create Button */}
          <div className="flex justify-end pt-4 border-t border-cyan-900/30">
            <button
              onClick={handleCreate}
              disabled={creating || !selectedAgent || !selectedStrategy}
              className={`px-8 py-3 rounded-lg font-semibold uppercase tracking-wider transition-all ${
                creating || !selectedAgent || !selectedStrategy
                  ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"
              }`}
            >
              {creating ? "Creating..." : "Create Bot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
