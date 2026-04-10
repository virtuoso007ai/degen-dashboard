/**
 * Strategy Storage using Upstash Redis
 * Stores and retrieves trading strategy configurations
 */

import { getRedisClient } from "../redis-activity";
import { StrategyConfig } from "./types";

const STRATEGY_KEY_PREFIX = "strategy:";
const AGENT_STRATEGIES_KEY = "agent_strategies:";

/**
 * Save a strategy configuration
 */
export async function saveStrategy(strategy: StrategyConfig): Promise<boolean> {
  try {
    const client = getRedisClient();
    const key = `${STRATEGY_KEY_PREFIX}${strategy.id}`;
    
    await client.set(key, JSON.stringify(strategy));
    
    // Also add to agent's strategy list
    const agentKey = `${AGENT_STRATEGIES_KEY}${strategy.agentAlias}`;
    await client.sadd(agentKey, strategy.id);
    
    console.log(`[saveStrategy] Saved strategy ${strategy.id} for ${strategy.agentAlias}`);
    return true;
  } catch (error) {
    console.error("[saveStrategy] Error:", error);
    return false;
  }
}

/**
 * Get a strategy by ID
 */
export async function getStrategy(strategyId: string): Promise<StrategyConfig | null> {
  try {
    const client = getRedisClient();
    const key = `${STRATEGY_KEY_PREFIX}${strategyId}`;
    const data = await client.get(key);
    
    if (!data) return null;
    
    return (typeof data === "string" ? JSON.parse(data) : data) as StrategyConfig;
  } catch (error) {
    console.error("[getStrategy] Error:", error);
    return null;
  }
}

/**
 * Get all strategies for an agent
 */
export async function getAgentStrategies(agentAlias: string): Promise<StrategyConfig[]> {
  try {
    const client = getRedisClient();
    const agentKey = `${AGENT_STRATEGIES_KEY}${agentAlias}`;
    const strategyIds = await client.smembers(agentKey);
    
    if (!strategyIds || strategyIds.length === 0) return [];
    
    const strategies: StrategyConfig[] = [];
    for (const id of strategyIds) {
      const strategy = await getStrategy(id as string);
      if (strategy) strategies.push(strategy);
    }
    
    return strategies;
  } catch (error) {
    console.error("[getAgentStrategies] Error:", error);
    return [];
  }
}

/**
 * Get all strategies (enabled and disabled)
 */
export async function getAllStrategies(): Promise<StrategyConfig[]> {
  try {
    const client = getRedisClient();
    const keys = await client.keys(`${STRATEGY_KEY_PREFIX}*`);
    
    if (!keys || keys.length === 0) return [];
    
    const strategies: StrategyConfig[] = [];
    for (const key of keys) {
      const data = await client.get(key as string);
      if (!data) continue;
      
      const strategy = (typeof data === "string" ? JSON.parse(data) : data) as StrategyConfig;
      strategies.push(strategy);
    }
    
    return strategies;
  } catch (error) {
    console.error("[getAllStrategies] Error:", error);
    return [];
  }
}

/**
 * Get all enabled strategies (for monitoring)
 */
export async function getAllEnabledStrategies(): Promise<StrategyConfig[]> {
  try {
    const client = getRedisClient();
    const keys = await client.keys(`${STRATEGY_KEY_PREFIX}*`);
    
    if (!keys || keys.length === 0) return [];
    
    const strategies: StrategyConfig[] = [];
    for (const key of keys) {
      const data = await client.get(key as string);
      if (!data) continue;
      
      const strategy = (typeof data === "string" ? JSON.parse(data) : data) as StrategyConfig;
      if (strategy.enabled) strategies.push(strategy);
    }
    
    return strategies;
  } catch (error) {
    console.error("[getAllEnabledStrategies] Error:", error);
    return [];
  }
}

/**
 * Update strategy
 */
export async function updateStrategy(strategy: StrategyConfig): Promise<boolean> {
  return saveStrategy(strategy);
}

/**
 * Delete strategy
 */
export async function deleteStrategy(strategyId: string, agentAlias: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const key = `${STRATEGY_KEY_PREFIX}${strategyId}`;
    const agentKey = `${AGENT_STRATEGIES_KEY}${agentAlias}`;
    
    await client.del(key);
    await client.srem(agentKey, strategyId);
    
    console.log(`[deleteStrategy] Deleted strategy ${strategyId}`);
    return true;
  } catch (error) {
    console.error("[deleteStrategy] Error:", error);
    return false;
  }
}

/**
 * Toggle strategy enabled/disabled
 */
export async function toggleStrategy(strategyId: string): Promise<boolean> {
  try {
    const strategy = await getStrategy(strategyId);
    if (!strategy) return false;
    
    strategy.enabled = !strategy.enabled;
    return await updateStrategy(strategy);
  } catch (error) {
    console.error("[toggleStrategy] Error:", error);
    return false;
  }
}
