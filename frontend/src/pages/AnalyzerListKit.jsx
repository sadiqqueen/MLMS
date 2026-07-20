// W1-Analyzer — shared list scaffolding (co-located helper, owned by W1-Analyzer;
// imported only by the Analyzer* pages). Keeps the ~10 read-only list screens
// DRY: filter bar, skeleton, empty/error states, table-card + account-card grids,
// status pills, and a small fetch/pagination hook. All mt-/mt-az- classes only.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import api from '../api/axios';

export const PAGE_SIZE = 8;

// ── formatting helpers ──────────────────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
export function initialsOf(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '—';
}
// changeHistory:[{date,labels[],by}] → "12 Mar 2026 — Phone, City — by Sara Mahmoud"
export function histLines(changeHistory = []) {
  return (changeHistory || [])
    .filter(Boolean)
    .map((h) => `${fmtDate(h.date)} — ${(h.labels || []).join(', ') || 'Updated'} — by ${h.by || 'Unknown'}`);
}
// "REQ-" + last 6 hex of the ChangeRequest _id, uppercase (contracts §ChangeRequest).
export function reqId(id) {
  return 'REQ-' + String(id || '').slice(-6).toUpperCase();
}

// ── small primitives ────────────────────────────────────────────────────────
export function MagnifierIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="mt-search">
      <MagnifierIcon />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

// options: [{ value, label }]; the leading "{allLabel}" option is added here.
export function FilterSelect({ value, onChange, options = [], allLabel }) {
  return (
    <select className="mt-filter" value={value} onChange={(e) => onChange(e.target.value)} aria-label={allLabel}>
      {allLabel != null && <option value="">{allLabel}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Status pill — tone: 'ok' | 'warn' | 'dng' | 'neutral'.
export function Pill({ tone = 'neutral', children }) {
  const cls = tone === 'ok' ? 'mt-pill--active'
    : tone === 'warn' ? 'mt-pill--warn'
    : tone === 'dng' ? 'mt-pill--rejected'
    : 'mt-pill--neutral';
  return <span className={`mt-pill ${cls}`}>{children}</span>;
}

// Map a computed accreditationStatus → labelled pill.
const ACC_MAP = {
  green: ['ok', 'Operational'], yellow: ['warn', 'Expiring'],
  red: ['dng', 'Expired'], black: ['dng', 'Withdrawn'],
};
export function AccreditationPill({ status }) {
  const m = ACC_MAP[status];
  if (!m) return <span className="mt-td--muted">—</span>;
  return <Pill tone={m[0]}>{m[1]}</Pill>;
}

// ── list skeleton ───────────────────────────────────────────────────────────
export function ListSkeleton({ variant = 'table' }) {
  if (variant === 'cards') {
    return (
      <div className="mt-acct-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton mt-skel" style={{ height: 190, animationDelay: `${(i * 0.08).toFixed(2)}s` }} />
        ))}
      </div>
    );
  }
  return <div className="skeleton mt-skel" style={{ height: 320 }} />;
}

// ── empty state (dashed card) ────────────────────────────────────────────────
export function EmptyState({ icon, title = 'Nothing here yet', sub }) {
  return (
    <div className="mt-empty">
      {icon && <div className="mt-empty-icon">{icon}</div>}
      <div className="mt-empty-title">{title}</div>
      {sub && <div className="mt-empty-sub">{sub}</div>}
    </div>
  );
}

// ── table card (list_views §2) ──────────────────────────────────────────────
// columns: array of header strings; use '' for the trailing actions column.
export function TableCard({ columns = [], children, reveal = true }) {
  const body = (
    <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>{columns.map((c, i) => <th key={i} className="mt-th">{c}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
  return reveal ? <RevealOnScroll>{body}</RevealOnScroll> : body;
}

export function CardGrid({ children }) {
  return <div className="mt-acct-grid">{children}</div>;
}

// ── page shell: Navbar + content + filter bar + body + pagination ────────────
export function ListShell({
  title, subtitle, filters, count, error,
  loading, empty, skeleton = 'table', children,
  page, total, onPrev, onNext, pageInfo, actions,
}) {
  return (
    <>
      <Navbar title={title} subtitle={subtitle} />
      <main className="mt-content">
        {error && (
          <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger-fg)' }}>
            {error}
          </div>
        )}

        <div className="mt-filterbar">
          {filters}
          <span className="mt-filterbar-spacer" />
          {count != null && !loading && <span className="mt-count">{count}</span>}
          {actions}
        </div>

        {loading ? <ListSkeleton variant={skeleton} />
          : empty ? children /* pages pass an EmptyState as children when empty */
          : children}

        {!loading && !empty && total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPrev={onPrev} onNext={onNext} info={pageInfo} />
        )}
      </main>
    </>
  );
}

// ── data hook: fetch an analyzer endpoint, re-fetch on param change ──────────
// Returns the raw `data` payload (array OR object for dios/pds), loading, error.
export function useAnalyzerList(url, params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const key = JSON.stringify(params);
  const first = useRef(true);

  const load = useCallback(async () => {
    if (first.current) setLoading(true);
    setError('');
    try {
      const clean = {};
      Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) clean[k] = v; });
      const res = await api.get(url, { params: clean, cache: false });
      setData(res.data?.data ?? res.data ?? null);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load. Please try again.');
    } finally {
      setLoading(false);
      first.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

// ── filter-option source (best-effort, never blocks the page) ────────────────
// Fetches an array endpoint once and maps rows → [{ value, label }].
export function useOptions(url, toOpt) {
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    let alive = true;
    api.get(url).then((r) => {
      if (!alive) return;
      const d = r.data?.data ?? r.data ?? [];
      const arr = Array.isArray(d) ? d : [];
      setOpts(arr.map(toOpt).filter((o) => o && o.value));
    }).catch(() => {});
    return () => { alive = false; };
  }, [url]);
  return opts;
}

// Distinct non-empty values of a field across rows → [{ value, label }].
export function distinctOptions(rows, field) {
  const seen = new Set();
  const out = [];
  (rows || []).forEach((r) => {
    const v = getField(r, field);
    if (v && !seen.has(v)) { seen.add(v); out.push({ value: v, label: v }); }
  });
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

// ── client-side search + pagination over an already-fetched array ────────────
export function useClientList(rows, { search = '', fields = ['name', 'idNumber'], page = 1 } = {}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => fields.some((f) => String(getField(r, f) ?? '').toLowerCase().includes(q)));
  }, [rows, search, fields]);

  const total = filtered.length;
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  return { pageRows, total, filtered };
}

function getField(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

export { getField };
