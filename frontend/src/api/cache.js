// ── Lightweight in-memory stale-while-revalidate cache for API GETs ──────────
//
// Why in-memory only (a module-scoped Map, never localStorage/sessionStorage):
//   • It survives SPA route navigations — which is exactly what removes the
//     "every page refetches on each visit" problem — but is cleared on a full
//     reload or when the tab closes.
//   • Sensitive medical / training data therefore never lands in browser
//     storage, honouring the project's privacy rules.
//
// Model per key: { data, ts, error, promise }
//   fresh  -> (now - ts) < ttl            → serve from cache, no network
//   stale  -> (now - ts) >= ttl           → serve cached immediately, revalidate
//   missing-> no entry                     → fetch, show skeleton

const store = new Map();
export const DEFAULT_CACHE_TTL = 60_000; // 60s

// ── read / write ─────────────────────────────────────────────────────────────
export function readCache(key) {
  return store.get(key) || null;
}

export function writeCache(key, data) {
  const entry = store.get(key) || {};
  entry.data = data;
  entry.ts = Date.now();
  entry.error = null;
  store.set(key, entry);
  emit(key);
  return data;
}

export function isFresh(entry, ttl = DEFAULT_CACHE_TTL) {
  return !!entry && entry.data !== undefined && (Date.now() - entry.ts) < ttl;
}

// ── invalidation (call after a mutation) ─────────────────────────────────────
// invalidate()            → clear everything
// invalidate('reports')   → drop every key === 'reports' or starting 'reports'
export function invalidate(prefix) {
  if (prefix == null) { store.clear(); emitAll(); return; }
  for (const key of [...store.keys()]) {
    if (key === prefix || key.startsWith(prefix)) { store.delete(key); emit(key); }
  }
}

// ── deduped fetch: reuse an in-flight request for the same key ────────────────
export function fetchDeduped(key, fetcher) {
  const existing = store.get(key);
  if (existing && existing.promise) return existing.promise;

  const entry = existing || {};
  const p = Promise.resolve()
    .then(fetcher)
    .then(data => { writeCache(key, data); return data; })
    .catch(err => {
      const e = store.get(key) || {};
      e.error = err;
      store.set(key, e);
      emit(key);
      throw err;
    })
    .finally(() => {
      const e = store.get(key);
      if (e) { e.promise = null; store.set(key, e); }
    });

  entry.promise = p;
  store.set(key, entry);
  return p;
}

// ── tiny pub/sub so components sharing a key stay in sync ─────────────────────
const subs = new Map(); // key -> Set<fn>

function emit(key) {
  const set = subs.get(key);
  if (set) set.forEach(fn => { try { fn(); } catch { /* ignore subscriber errors */ } });
}
function emitAll() {
  subs.forEach(set => set.forEach(fn => { try { fn(); } catch { /* ignore */ } }));
}

export function subscribe(key, fn) {
  if (!subs.has(key)) subs.set(key, new Set());
  subs.get(key).add(fn);
  return () => {
    const set = subs.get(key);
    if (set) { set.delete(fn); if (!set.size) subs.delete(key); }
  };
}
