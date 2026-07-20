// W2-Developer — Audit Log (lists_views §DEVELOPER audit-log). mt- restyle of the
// existing read-only audit table; all functionality kept (server pagination,
// client search) and the design's Result column added. Audit rows are post-hoc
// records of COMPLETED actions, so Result is truthfully "Success" for every row.
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { roleLabel } from '../config/roles';
import api from '../api/axios';
import { MagnifierIcon } from './devkit';
import './developer.css';

const LIMIT = 30;

function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLog() {
  const { toasts, showToast } = useMtToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/api/admin/audit-log', { params: { page, limit: LIMIT }, cache: false })
      .then((r) => { setLogs(r.data?.data || r.data || []); setTotal(r.data?.total || 0); })
      .catch(() => showToast('Failed to load audit log', 'dng'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const q = search.trim().toLowerCase();
  const filtered = !q ? logs : logs.filter((l) =>
    l.action?.toLowerCase().includes(q) ||
    l.userId?.name?.toLowerCase().includes(q) ||
    l.userId?.email?.toLowerCase().includes(q) ||
    l.targetModel?.toLowerCase().includes(q));

  return (
    <>
      <Navbar title="Audit Log" subtitle="Developer" />
      <main className="mt-content">
        <div className="dev-intro">Every create, update, and delete action across the system.</div>

        <div className="mt-filterbar">
          <div className="mt-search">
            <MagnifierIcon />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, user, or model…" aria-label="Search audit log" />
          </div>
          <span className="mt-filterbar-spacer" />
          <span className="mt-count">{total.toLocaleString('en-US')} events</span>
        </div>

        <RevealOnScroll>
          <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="mt-table-wrap">
              <table className="mt-table">
                <thead>
                  <tr>
                    <th className="mt-th">Time</th><th className="mt-th">User</th>
                    <th className="mt-th">Action</th><th className="mt-th">Target</th>
                    <th className="mt-th">IP</th><th className="mt-th">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td className="mt-td" colSpan={6}><div className="skeleton" style={{ height: 16, borderRadius: 6 }} /></td></tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr><td className="mt-td mt-td--muted" colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                      No audit entries found.
                    </td></tr>
                  )}
                  {!loading && filtered.map((l) => (
                    <tr key={l._id}>
                      <td className="mt-td mt-td--mono">{fmt(l.createdAt)}</td>
                      <td className="mt-td">
                        <div className="mt-td--name">{l.userId?.name || 'System'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBlockStart: 3 }}>
                          {l.userId?.role && <span className="mt-pill mt-pill--neutral">{roleLabel(l.userId.role)}</span>}
                          {l.userId?.email && <span className="mt-td--muted" style={{ fontSize: 11 }}>{l.userId.email}</span>}
                        </div>
                      </td>
                      <td className="mt-td">{(l.action || '').replace(/_/g, ' ') || '—'}</td>
                      <td className="mt-td mt-td--muted">
                        {l.targetModel || '—'}{l.metadata?.name ? ` — ${l.metadata.name}` : ''}
                      </td>
                      <td className="mt-td mt-td--mono">{l.ip || '—'}</td>
                      <td className="mt-td"><span className="mt-pill mt-pill--active">Success</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </RevealOnScroll>

        {!loading && total > LIMIT && (
          <Pagination
            page={page} pageSize={LIMIT} total={total}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
