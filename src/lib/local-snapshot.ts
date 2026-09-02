import { ApiError } from './api-client';

const PREFIX = 'demo_snap_';

export const SNAP_KEYS = {
  activeRepairOrders: `${PREFIX}active_repair_orders`,
  // Keyed by page size: different pages request different amounts, and a
  // shared key would let a 50-row fetch clobber a 100-row snapshot.
  repairOrdersEnriched: (perPage: number) => `${PREFIX}repair_orders_enriched_p${perPage}`,
} as const;

type Snapshot<T> = {
  data: T;
  timestamp: number;
};

export function saveSnapshot<T>(key: string, data: T): void {
  try {
    const snapshot: Snapshot<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Silently fail — storage full, private mode, SSR, etc.
  }
}

export function loadSnapshot<T>(key: string): Snapshot<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot<T>;
    if (!parsed?.data || !parsed?.timestamp) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Decides whether a failed request should fall back to cached data.
 *
 * Auth failures must surface so the user can log in again — showing stale
 * data behind an "offline" banner would hide an expired session. Other 4xx
 * responses are client/logic errors that stale data would also mask.
 * Network failures and 5xx are genuine outages, which is what the cache is for.
 */
export function shouldFallBackToSnapshot(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return false;
    if (err.status >= 400 && err.status < 500) return false;
    return true;
  }
  return true;
}

export function formatSnapshotAge(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
