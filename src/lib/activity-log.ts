/**
 * Aç/kapa işlemleri — tarayıcı localStorage (sunucuda DB yok).
 * Sadece bu cihaz + bu tarayıcı; yedek için dışa aktar eklenebilir.
 */

export type ActivityEntry = {
  id: string;
  at: string;
  kind: "open" | "close" | "modify" | "deposit" | "withdraw" | "cancel_limit";
  alias: string;
  pair: string;
  side?: string;
  size?: string;
  leverage?: number;
  ok: boolean;
  detail: string;
};

const KEY = "degen-dashboard-activity-v1";
const MAX = 200;

export function loadActivityLog(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as unknown;
    return Array.isArray(a) ? (a as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: ActivityEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
}

export function appendActivity(
  e: Omit<ActivityEntry, "id" | "at"> & { at?: string }
): ActivityEntry {
  const entry: ActivityEntry = {
    ...e,
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: e.at ?? new Date().toISOString(),
  };
  const prev = loadActivityLog();
  save([entry, ...prev]);
  return entry;
}

export function clearActivityLog(): void {
  localStorage.removeItem(KEY);
}
