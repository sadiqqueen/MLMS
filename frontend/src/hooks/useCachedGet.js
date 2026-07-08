import { useEffect, useState, useCallback, useRef } from 'react';
import {
  readCache, isFresh, fetchDeduped, subscribe, DEFAULT_CACHE_TTL,
} from '../api/cache';

/**
 * Stale-while-revalidate GET backed by the in-memory cache.
 *
 *   const { data, loading, error, refresh } = useCachedGet(
 *     user ? `trainee-reports:${user._id}` : null,          // key (null = disabled)
 *     () => api.get('/api/trainee/reports').then(r => r.data), // fetcher → data
 *     { ttl: 60000 },
 *   );
 *
 * Behaviour:
 *   • cached + fresh → returns instantly, loading=false, no network hit.
 *   • cached + stale → returns cached data instantly, revalidates in background.
 *   • not cached     → loading=true, fetches, then caches.
 *
 * `refresh()` forces a revalidation (use after mutations, or with cache.invalidate).
 * Concurrent components with the same key share one request and stay in sync.
 */
export default function useCachedGet(key, fetcher, options = {}) {
  const { ttl = DEFAULT_CACHE_TTL, enabled = true } = options;
  const active = enabled && !!key;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const initial = active ? readCache(key) : null;
  const [data, setData]       = useState(initial?.data);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(active && !initial);

  const run = useCallback((force) => {
    if (!active) return Promise.resolve();
    const cached = readCache(key);
    if (cached && cached.data !== undefined) { setData(cached.data); setLoading(false); }
    if (!force && isFresh(cached, ttl)) return Promise.resolve(cached.data);
    if (!cached || cached.data === undefined) setLoading(true);
    return fetchDeduped(key, () => fetcherRef.current())
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e))
      .finally(() => setLoading(false));
  }, [key, ttl, active]);

  useEffect(() => {
    if (!active) { setData(undefined); setError(null); setLoading(false); return undefined; }
    const unsub = subscribe(key, () => {
      const c = readCache(key);
      if (c && c.data !== undefined) setData(c.data);
      else run(true); // key was invalidated → refetch
    });
    run(false);
    return unsub;
  }, [key, active, run]);

  const refresh = useCallback(() => run(true), [run]);

  return { data, loading, error, refresh };
}
