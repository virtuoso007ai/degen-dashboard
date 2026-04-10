"use client";

import { useEffect, useState } from "react";
import { StrategyConfig } from "@/lib/indicators/types";

export default function StrategyList() {
  const [strategies, setStrategies] = useState<StrategyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStrategies = async () => {
    try {
      const res = await fetch("/api/strategies");
      if (res.ok) {
        const data = await res.json();
        setStrategies(data);
      } else {
        setError("Failed to load strategies");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, []);

  const toggleStrategy = async (strategy: StrategyConfig) => {
    try {
      const res = await fetch("/api/strategies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...strategy,
          enabled: !strategy.enabled,
        }),
      });

      if (res.ok) {
        await loadStrategies();
      } else {
        alert("Failed to toggle strategy");
      }
    } catch (e) {
      alert(`Error: ${e}`);
    }
  };

  const deleteStrategy = async (strategy: StrategyConfig) => {
    if (!confirm(`Delete strategy for ${strategy.agentAlias}?`)) return;

    try {
      const res = await fetch(`/api/strategies?id=${strategy.id}&agent=${strategy.agentAlias}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await loadStrategies();
      } else {
        alert("Failed to delete strategy");
      }
    } catch (e) {
      alert(`Error: ${e}`);
    }
  };

  const testStrategy = async (strategy: StrategyConfig) => {
    try {
      const res = await fetch("/api/strategies/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: strategy.id,
          pair: "BTC",
        }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(
          `Signal: ${result.signal.signal.toUpperCase()}\n` +
          `Strength: ${result.signal.strength}%\n` +
          `Reason: ${result.signal.reason}\n` +
          `Latest Price: $${result.latestPrice}`
        );
      } else {
        alert("Test failed");
      }
    } catch (e) {
      alert(`Error: ${e}`);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <p className="text-zinc-400 text-center">Loading strategies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
        <p className="text-zinc-400">No strategies yet</p>
        <p className="text-xs text-zinc-600 mt-2">Click "Strategy Bot" to create one</p>
      </div>
    );
  }

  const strategyTypeNames: Record<string, string> = {
    rsi_reversal: "RSI Reversal",
    ema_cross: "EMA Cross",
    macd_histogram: "MACD Histogram",
    macd_crossover: "MACD Crossover",
    trendtrader_combined: "TrendTrader Combined",
    rsi_divergence: "RSI Divergence",
  };

  return (
    <div className="space-y-3">
      {strategies.map((s) => (
        <div
          key={s.id}
          className={`rounded-2xl border p-4 transition-all ${
            s.enabled
              ? "border-cyan-500/30 bg-cyan-950/10"
              : "border-zinc-800/80 bg-zinc-900/30"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Left: Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm text-amber-400">@{s.agentAlias}</span>
                <span className="text-white font-semibold">{strategyTypeNames[s.strategyType] || s.strategyType}</span>
                <span className="px-2 py-0.5 text-xs font-mono bg-zinc-800 text-cyan-400 rounded border border-cyan-900/30">
                  ALL PAIRS
                </span>
                {s.enabled && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                    ACTIVE
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-zinc-400">
                <div>
                  <span className="text-zinc-600">Size:</span> ${s.positionSizeUSD}
                </div>
                <div>
                  <span className="text-zinc-600">Leverage:</span> {s.leverage}x
                </div>
                <div>
                  <span className="text-zinc-600">TP:</span> {s.takeProfitPercent}%
                </div>
                <div>
                  <span className="text-zinc-600">SL:</span> {s.stopLossPercent}%
                </div>
              </div>

              {s.lastSignalAt && (
                <p className="text-xs text-zinc-600 mt-2">
                  Last signal: {new Date(s.lastSignalAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => toggleStrategy(s)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  s.enabled
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {s.enabled ? "Disable" : "Enable"}
              </button>

              <button
                onClick={() => testStrategy(s)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
              >
                Test
              </button>

              <button
                onClick={() => deleteStrategy(s)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
