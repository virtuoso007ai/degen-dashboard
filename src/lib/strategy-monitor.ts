/**
 * Trading Strategy Monitor & Auto-Executor
 * Production-ready with error handling, retry logic, and health monitoring
 */

import { getAllEnabledStrategies, updateStrategy } from "./indicators/storage";
import { fetchCandles } from "./indicators/market-data";
import { generateSignal } from "./indicators/engine";
import { hlDirectOpen } from "./hlDirectTrade";
import { parseAgentsFromEnv, getAgentByAlias } from "./agents";
import { postToForum } from "./forum";
import { formatPersonalizedTradeOpen } from "./agent-personalities";
import { getAgentForumId, getAgentSignalsThreadId } from "./agent-forum-ids";
import { appendActivity } from "./redis-activity";

interface ExecutionResult {
  strategyId: string;
  success: boolean;
  error?: string;
  signal?: any;
}

interface MonitorHealth {
  isHealthy: boolean;
  lastRun: string;
  successCount: number;
  errorCount: number;
  activeStrategies: number;
  errors: string[];
}

let monitorHealth: MonitorHealth = {
  isHealthy: true,
  lastRun: new Date().toISOString(),
  successCount: 0,
  errorCount: 0,
  activeStrategies: 0,
  errors: [],
};

/**
 * Calculate TP/SL prices from percentages
 */
function calculateTPSL(
  entryPrice: number,
  tpPercent: number,
  slPercent: number,
  side: "long" | "short"
): { takeProfit: string; stopLoss: string } {
  if (side === "long") {
    const tp = entryPrice * (1 + tpPercent / 100);
    const sl = entryPrice * (1 - slPercent / 100);
    return {
      takeProfit: tp.toFixed(2),
      stopLoss: sl.toFixed(2),
    };
  } else {
    const tp = entryPrice * (1 - tpPercent / 100);
    const sl = entryPrice * (1 + slPercent / 100);
    return {
      takeProfit: tp.toFixed(2),
      stopLoss: sl.toFixed(2),
    };
  }
}

/**
 * Execute a single strategy - scan all configured pairs and take the strongest signal
 */
async function executeStrategy(
  strategyId: string,
  retryCount = 0
): Promise<ExecutionResult> {
  const MAX_RETRIES = 3;
  const SUPPORTED_PAIRS = ["BTC", "ETH", "SOL", "DOGE", "PENGU", "HYPE", "PEPE", "POPCAT"];
  
  try {
    const { getStrategy } = await import("./indicators/storage");
    const strategy = await getStrategy(strategyId);
    
    if (!strategy || !strategy.enabled) {
      return {
        strategyId,
        success: false,
        error: "Strategy not found or disabled",
      };
    }

    // Determine which pairs to scan
    const pairsToScan = strategy.pairs && strategy.pairs.length > 0 
      ? strategy.pairs 
      : SUPPORTED_PAIRS;

    console.log(`[executeStrategy] ${strategyId}: Scanning ${pairsToScan.length} pairs...`);

    // Scan all pairs in parallel
    const scanResults = await Promise.all(
      pairsToScan.map(async (pair) => {
        try {
          const candles = await fetchCandles({
            pair,
            interval: strategy.candleInterval,
            limit: 100,
          });

          if (!candles || candles.length < 50) {
            return { pair, signal: null, error: "Insufficient data" };
          }

          const signal = generateSignal(candles, strategy, pair);
          return { pair, signal, error: null };
        } catch (err) {
          return { pair, signal: null, error: String(err) };
        }
      })
    );

    // Filter out holds and errors, find strongest signal
    const validSignals = scanResults
      .filter(r => r.signal && r.signal.signal !== "hold")
      .sort((a, b) => (b.signal?.strength || 0) - (a.signal?.strength || 0));

    if (validSignals.length === 0) {
      console.log(`[executeStrategy] ${strategyId}: No actionable signals across ${pairsToScan.length} pairs`);
      return {
        strategyId,
        success: true,
      };
    }

    // Take the strongest signal
    const best = validSignals[0];
    const signal = best.signal!;
    const pair = best.pair;

    console.log(
      `[executeStrategy] ${strategyId}: Best signal → ${pair} ${signal.signal.toUpperCase()} ` +
      `(strength: ${signal.strength}%) | Reason: ${signal.reason}`
    );

    // Check minimum strength threshold
    const minStrength = strategy.minSignalStrength || 60;
    if (signal.strength < minStrength) {
      console.log(`[executeStrategy] ${strategyId}: Signal strength ${signal.strength}% < threshold ${minStrength}%`);
      return {
        strategyId,
        success: true,
        signal,
      };
    }

    // Get agent info
    const agents = parseAgentsFromEnv();
    const agent = getAgentByAlias(agents, strategy.agentAlias);
    
    if (!agent) {
      return {
        strategyId,
        success: false,
        error: "Agent not found",
      };
    }

    // Calculate TP/SL
    const currentPrice = signal.indicators.price || 0;
    const { takeProfit, stopLoss } = calculateTPSL(
      currentPrice,
      strategy.takeProfitPercent,
      strategy.stopLossPercent,
      signal.signal === "buy" ? "long" : "short"
    );

    let tradeResult: unknown;

    try {
      console.log(`[executeStrategy] ${strategyId}: Opening ${signal.signal === "buy" ? "LONG" : "SHORT"} ${pair} (size: $${strategy.positionSizeUSD}, lev: ${strategy.leverage}x, TP: ${takeProfit}, SL: ${stopLoss})`);

      tradeResult = await hlDirectOpen(agent, {
        pair,
        side: signal.signal === "buy" ? "long" : "short",
        sizeUsd: strategy.positionSizeUSD,
        leverage: strategy.leverage,
        takeProfit,
        stopLoss,
      });

      console.log(`[executeStrategy] ${strategyId}: HL v2 response:`, JSON.stringify(tradeResult, null, 2));
    } catch (tradeError) {
      console.error(`[executeStrategy] ${strategyId}: Trade error:`, tradeError);
      if (retryCount < MAX_RETRIES) {
        console.warn(`[executeStrategy] Retrying trade execution (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 3000 * (retryCount + 1)));
        return executeStrategy(strategyId, retryCount + 1);
      }
      throw new Error(`Trade execution failed after ${MAX_RETRIES} retries: ${tradeError}`);
    }

    // Log activity with full trade result details
    await appendActivity({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      kind: "open",
      alias: strategy.agentAlias,
      pair,
      side: signal.signal === "buy" ? "long" : "short",
      size: strategy.positionSizeUSD.toString(),
      leverage: strategy.leverage,
      ok: true,
      detail: `Strategy: ${strategy.strategyType} | Signal: ${signal.reason} | Strength: ${signal.strength}% | HL v2: ${JSON.stringify(tradeResult || {}).slice(0, 500)}`,
    });

    // Post to forum (non-blocking)
    if (agent.forumApiKey) {
      const agentId = getAgentForumId(strategy.agentAlias);
      const threadId = getAgentSignalsThreadId(strategy.agentAlias);
      
      if (agentId && threadId) {
        postToForum({
          agentId,
          threadId: threadId.toString(),
          ...formatPersonalizedTradeOpen({
            agentAlias: strategy.agentAlias,
            pair,
            side: signal.signal === "buy" ? "long" : "short",
            entryPrice: currentPrice.toString(),
            takeProfit,
            stopLoss,
            leverage: strategy.leverage,
            strategyName: strategy.strategyType,
          }),
          apiKey: agent.forumApiKey,
        }).catch(err => console.error("[executeStrategy] Forum post failed:", err));
      }
    }

    // Update strategy last signal time
    strategy.lastSignalAt = new Date().toISOString();
    await updateStrategy(strategy);

    console.log(`[executeStrategy] ✅ ${strategyId}: ${pair} ${signal.signal.toUpperCase()} executed (strength: ${signal.strength}%)`);

    return {
      strategyId,
      success: true,
      signal,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[executeStrategy] ❌ ${strategyId}:`, errorMsg);
    
    return {
      strategyId,
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Run monitor cycle - execute all enabled strategies
 */
export async function runStrategyMonitor(): Promise<MonitorHealth> {
  console.log("[StrategyMonitor] 🚀 Starting cycle...");
  
  const startTime = Date.now();
  const results: ExecutionResult[] = [];
  
  try {
    // Fetch all enabled strategies
    const strategies = await getAllEnabledStrategies();
    monitorHealth.activeStrategies = strategies.length;
    
    if (strategies.length === 0) {
      console.log("[StrategyMonitor] ⏸️  No active strategies found in Redis");
      monitorHealth.lastRun = new Date().toISOString();
      return monitorHealth;
    }

    console.log(`[StrategyMonitor] 📊 Found ${strategies.length} active strategies:`);
    strategies.forEach(s => {
      const pairInfo = s.pairs && s.pairs.length > 0 
        ? `[${s.pairs.join(',')}]` 
        : '[ALL PAIRS]';
      console.log(`  → ${s.agentAlias}/${s.strategyType} ${pairInfo} (${s.candleInterval}, size: $${s.positionSizeUSD}, lev: ${s.leverage}x)`);
    });

    // Execute strategies in parallel (with concurrency limit)
    const CONCURRENCY = 3; // Max 3 parallel executions
    for (let i = 0; i < strategies.length; i += CONCURRENCY) {
      const batch = strategies.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(s => executeStrategy(s.id))
      );
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (i + CONCURRENCY < strategies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update health metrics
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const errors = results.filter(r => r.error).map(r => `${r.strategyId}: ${r.error}`);
    
    monitorHealth = {
      isHealthy: errorCount < strategies.length * 0.5, // Healthy if < 50% failed
      lastRun: new Date().toISOString(),
      successCount: monitorHealth.successCount + successCount,
      errorCount: monitorHealth.errorCount + errorCount,
      activeStrategies: strategies.length,
      errors: errors.slice(0, 10), // Keep last 10 errors
    };

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[StrategyMonitor] ✅ Cycle complete in ${duration}s (${successCount} success, ${errorCount} errors)`);

  } catch (error) {
    console.error("[StrategyMonitor] ❌ Critical error:", error);
    monitorHealth.isHealthy = false;
    monitorHealth.errorCount++;
    monitorHealth.errors.push(`Critical: ${error}`);
  }

  return monitorHealth;
}

/**
 * Get current monitor health status
 */
export function getMonitorHealth(): MonitorHealth {
  return { ...monitorHealth };
}

/**
 * Reset health metrics
 */
export function resetHealthMetrics() {
  monitorHealth.successCount = 0;
  monitorHealth.errorCount = 0;
  monitorHealth.errors = [];
}
