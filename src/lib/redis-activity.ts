import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN environment variables gerekli");
  }

  redis = new Redis({ url, token });
  return redis;
}

export type ActivityEntry = {
  id: string;
  at: string;
  kind:
    | "open"
    | "close"
    | "modify"
    | "deposit"
    | "withdraw"
    | "cancel_limit"
    | "cancel_open_orders";
  alias: string;
  pair?: string;
  side?: string;
  size?: string;
  leverage?: number;
  ok: boolean;
  detail: string;
};

const ACTIVITY_KEY = "degen:activity";
const MAX_ENTRIES = 200;

/**
 * Activity log'a yeni entry ekle (Redis'e LPUSH + LTRIM)
 */
export async function appendActivity(entry: ActivityEntry): Promise<void> {
  const client = getRedisClient();
  await client.lpush(ACTIVITY_KEY, JSON.stringify(entry));
  await client.ltrim(ACTIVITY_KEY, 0, MAX_ENTRIES - 1);
}

/**
 * Activity log'u getir (en yeni → en eski)
 */
export async function getActivity(limit = 100): Promise<ActivityEntry[]> {
  const client = getRedisClient();
  const items = await client.lrange(ACTIVITY_KEY, 0, limit - 1);
  
  // Upstash SDK zaten deserialize ediyor, ama string olarak gelirse parse et
  return items.map((item) => {
    if (typeof item === "string") {
      return JSON.parse(item) as ActivityEntry;
    }
    return item as ActivityEntry;
  });
}

/**
 * Activity log'u temizle
 */
export async function clearActivity(): Promise<void> {
  const client = getRedisClient();
  await client.del(ACTIVITY_KEY);
}
