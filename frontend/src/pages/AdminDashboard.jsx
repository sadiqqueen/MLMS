// W2-Developer — Dashboard (dashboards.md §4.1). Design REPLACE of the old
// gradient-stat/doughnut layout with the prototype developer dashboard:
//   • 4 stat cards            ← GET /api/admin/stats + /api/admin/users (total)
//   • line  (audit activity)  ← GET /api/admin/audit-log  (grouped by day)
//   • bars  (active by role)  ← active users grouped by role
//   • table (latest audit)    ← most-recent audit-log rows
// "Active sessions" → "Active users" (isActive count) per RULINGS §34. Deltas are
// only shown where derivable from createdAt (never fabricated); a chart hides
// itself when its source has no data.
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import { roleLabel, baseRole } from '../config/roles';
import api from '../api/axios';
import './developer.css';

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Audit-log rows per day for the last 14 days → LineChart values + sparse labels.
function auditByDay(logs, days = 14) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => new Date(start.getTime() - (days - 1 - i) * DAY_MS));
  const values = buckets.map(() => 0);
  (logs || []).forEach((l) => {
    const t = new Date(l.createdAt).getTime();
    if (Number.isNaN(t)) return;
    const idx = Math.floor((t - buckets[0].getTime()) / DAY_MS);
    if (idx >= 0 && idx < days) values[idx] += 1;
  });
  const labels = buckets
    .filter((_, i) => i % 3 === 0)
    .map((d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
  return { values, labels };
}

// Active users grouped by (base) role → top-6 BarChart items.
function activeByRole(users) {
  const m = new Map();
  (users || []).forEach((u) => {
    if (u.isActive === false) return;
    const r = baseRole(u.role);
    if (!r) return;
    m.set(r, (m.get(r) || 0) + 1);
  });
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([r, v]) => ({ l: roleLabel(r), v }));
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const grab = (url, params) =>
        api.get(url, { params, cache: false }).then((r) => r.data).catch(() => null);
      const [s, u, a] = await Promise.all([
        grab('/api/admin/stats'),
        grab('/api/admin/users', { limit: 500 }),
        grab('/api/admin/audit-log', { limit: 500 }),
      ]);
      if (!alive) return;
      setStats(s?.data ?? s ?? {});
      const uArr = u?.data ?? [];
      setUsers(Array.isArray(uArr) ? uArr : []);
      setTotalUsers(u?.total ?? (Array.isArray(uArr) ? uArr.length : 0));
      const aArr = a?.data ?? a ?? [];
      setLogs(Array.isArray(aArr) ? aArr : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <>
        <Navbar title="Dashboard" subtitle="Developer" />
        <main className="mt-content"><MtSkeleton /></main>
      </>
    );
  }

  // Derived, truthful figures.
  const now = Date.now();
  const events24h = logs.filter((l) => now - new Date(l.createdAt).getTime() <= DAY_MS).length;
  const newThisWeek = users.filter((u) => now - new Date(u.createdAt).getTime() <= 7 * DAY_MS).length;
  const line = auditByDay(logs);
  const bars = activeByRole(users);
  const recent = logs.slice(0, 8);
  const hasLine = line.values.some((v) => v > 0);

  return (
    <>
      <Navbar title="Dashboard" subtitle="Developer" />
      <main className="mt-content">

        {/* ── STAT GRID ── */}
        <div className="mt-stat-grid">
          <RevealOnScroll delay={0}>
            <StatCard label="Total users" value={totalUsers} icon="users"
              delta={newThisWeek > 0 ? `+${newThisWeek} this week` : undefined} tone="ok" />
          </RevealOnScroll>
          <RevealOnScroll delay={0.055}>
            <StatCard label="Specialties" value={stats?.specialties ?? 0} icon="book" />
          </RevealOnScroll>
          <RevealOnScroll delay={0.11}>
            <StatCard label="Audit events · 24 h" value={events24h} icon="list" />
          </RevealOnScroll>
          <RevealOnScroll delay={0.165}>
            <StatCard label="Active users" value={stats?.users ?? 0} icon="check" />
          </RevealOnScroll>
        </div>

        {/* ── CHARTS ── */}
        <div className="dev-charts">
          {hasLine && (
            <ChartCard title="Audit activity" sub="Last 14 days · all actions" delay={0}>
              <LineChart values={line.values} labels={line.labels} />
            </ChartCard>
          )}
          {bars.length > 0 && (
            <ChartCard title="Active users by role" sub="Across the system" delay={0.08}>
              <BarChart items={bars} />
            </ChartCard>
          )}
        </div>

        {/* ── LATEST AUDIT EVENTS ── */}
        <div className="dev-section">
          <span className="dev-section-title">Latest audit events</span>
          <span className="dev-section-spacer" />
        </div>
        <RevealOnScroll>
          <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="mt-table-wrap">
              <table className="mt-table">
                <thead>
                  <tr>
                    <th className="mt-th">Time</th><th className="mt-th">User</th>
                    <th className="mt-th">Action</th><th className="mt-th">Target</th>
                    <th className="mt-th">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 && (
                    <tr><td className="mt-td mt-td--muted" colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                      No audit events yet.
                    </td></tr>
                  )}
                  {recent.map((l) => (
                    <tr key={l._id}>
                      <td className="mt-td mt-td--mono">{fmtDateTime(l.createdAt)}</td>
                      <td className="mt-td mt-td--name">{l.userId?.name || 'System'}</td>
                      <td className="mt-td">{(l.action || '').replace(/_/g, ' ') || '—'}</td>
                      <td className="mt-td mt-td--muted">
                        {l.targetModel || '—'}{l.metadata?.name ? ` — ${l.metadata.name}` : ''}
                      </td>
                      <td className="mt-td"><span className="mt-pill mt-pill--active">Success</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </RevealOnScroll>

      </main>
    </>
  );
}

// Chart card: title + sub + accent-fade divider, then the chart (matches the
// shell_tokens chart-card chrome used across the redesigned dashboards).
function ChartCard({ title, sub, delay, children }) {
  return (
    <RevealOnScroll as="section" chart delay={delay} className="mt-card mt-card--chart">
      <div className="mt-card-head mt-card-head--tight">
        <div style={{ minWidth: 0 }}>
          <div className="mt-card-title">{title}</div>
          {sub && <div className="mt-card-sub">{sub}</div>}
        </div>
        <div className="mt-divider" />
      </div>
      <div style={{ marginBlockStart: 14 }}>{children}</div>
    </RevealOnScroll>
  );
}
