// Server-side cache for repair orders to reduce database calls
const cache = new Map<string, { payload: any; at: number }>();

const CACHE_TTL_MS = 10_000; // 10 seconds - Supabase is much faster than Zoho API, so we can refresh more often
const MAX_ENTRIES = 20; // Prevent unbounded growth

export const getCache = (cacheKey: string) => {
  const entry = cache.get(cacheKey);
  if (entry && Date.now() - entry.at < CACHE_TTL_MS) {
    return entry.payload;
  }
  if (entry) cache.delete(cacheKey); // Clean up expired
  return null;
};

export const setCache = (cacheKey: string, payload: any) => {
  // Evict oldest if at capacity
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, { payload, at: Date.now() });
};

export const clearCache = () => {
  cache.clear();
};
