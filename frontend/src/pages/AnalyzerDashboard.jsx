// W1-Analyzer — Dashboard (dashboards.md §4.4 + §5). The richest role dashboard:
//   • 12 stat cards            ← GET /api/analyzer/stats
//   • line (change requests)   ← GET /api/analyzer/change-requests  (by month)
//   • bars (programs/country)  ← GET /api/analyzer/programs
//   • 2 donuts (centers/country, programs/specialty) ← centers + programs
//   • 3-line registry growth   ← createdAt of programs / centers / specialties
//   • pending-change previews + "N open" pill ← change-requests (status=pending)
//   • latest-decisions table   ← change-requests (any status)
// All chart data is DERIVED FROM REAL ENDPOINTS — no fabricated numbers
// (RULINGS §34). Deltas are omitted because the stats API returns none. A chart
// hides itself when its source has no data.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext';
import { roleLabel } from '../config/roles';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import GrowthChart from '../components/charts/GrowthChart';
import { IconFileText } from '../components/icons';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import { fmtDate, initialsOf, reqId } from './AnalyzerListKit';
import { specialtyName } from '../utils/specialtyName';
import './Analyzer.css';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 12 stat cards: [key in stats payload, label, nav-icon].
const STAT_CARDS = [
  ['countries', 'Countries', 'globe'],
  ['centers', 'Training centers', 'building'],
  ['dios', 'DIOs', 'brief'],
  ['programs', 'Programs', 'layers'],
  ['programDirectors', 'PDs', 'users'],
  ['clerks', 'Data entry clerks', 'edit'],
  ['hocs', 'HOCs', 'book'],
  ['specialties', 'Specialties', 'book'],
  ['centralSecretaries', 'Central secretaries', 'users'],
  ['trainees', 'Trainees', 'grad'],
  ['certificates', 'Issued certificates', 'award'],
  ['evaluations', 'Evaluations', 'doc'],
];

// ── chart-derivation helpers (all from real createdAt / populated refs) ───────
function lastMonths(n = 12) {
  const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(base.getFullYear(), base.getMonth() - i, 1));
  return out;
}
function bucketIndex(date, months) {
  const t = new Date(date);
  if (Number.isNaN(t.getTime())) return -1;
  if (t < months[0]) return -2; // before the window (cumulative baseline)
  for (let i = 0; i < months.length; i++) {
    const end = i + 1 < months.length ? months[i + 1] : new Date(months[i].getFullYear(), months[i].getMonth() + 1, 1);
    if (t >= months[i] && t < end) return i;
  }
  return -1;
}
function monthLabels(months) { return months.filter((_, i) => i % 2 === 0).map((m) => MONTH[m.getMonth()]); }

function monthlyCounts(items) {
  const months = lastMonths(12);
  const counts = months.map(() => 0);
  (items || []).forEach((it) => { const i = bucketIndex(it.createdAt, months); if (i >= 0) counts[i]++; });
  return { values: counts, labels: monthLabels(months) };
}
function cumulativeSeries(items) {
  const months = lastMonths(12);
  const counts = months.map(() => 0);
  let baseline = 0;
  (items || []).forEach((it) => {
    const i = bucketIndex(it.createdAt, months);
    if (i === -2) baseline++; else if (i >= 0) counts[i]++;
  });
  let run = baseline;
  return months.map((_, i) => (run += counts[i]));
}
function groupCount(items, keyFn) {
  const m = new Map();
  (items || []).forEach((it) => { const k = keyFn(it); if (k) m.set(k, (m.get(k) || 0) + 1); });
  return m;
}
function topN(map, n) {
  const arr = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const items = arr.slice(0, n).map(([l, v]) => ({ l, v }));
  const rest = arr.slice(n).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) items.push({ l: 'Other', v: rest });
  return items;
}
function fieldsChip(cr) {
  if (cr.requestType === 'delete') return 'Deletion request';
  const labels = (cr.display || []).map((d) => d.label);
  if (!labels.length) return 'Record change';
  return `${labels.length} field${labels.length === 1 ? '' : 's'} · ${labels.join(', ')}`;
}

export default function AnalyzerDashboard() {
  const { lang } = usePrefs();
  const navigate = useNavigate();
  const { toasts, showToast } = useMtToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [crs, setCrs] = useState([]);
  const [centers, setCenters] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [specialties, setSpecialties] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const grab = (url, params) => api.get(url, { params, cache: false }).then((r) => r.data?.data ?? r.data).catch(() => null);
      const [s, c, ce, pr, sp] = await Promise.all([
        grab('/api/analyzer/stats'),
        grab('/api/analyzer/change-requests'),
        grab('/api/analyzer/centers'),
        grab('/api/analyzer/programs'),
        grab('/api/analyzer/specialties'),
      ]);
      if (!alive) return;
      setStats(s || {});
      setCrs(Array.isArray(c) ? c : []);
      setCenters(Array.isArray(ce) ? ce : []);
      setPrograms(Array.isArray(pr) ? pr : []);
      setSpecialties(Array.isArray(sp) ? sp : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function approvePreview(cr) {
    try {
      await api.patch(`/api/analyzer/change-requests/${cr._id}/approve`, {});
      showToast(`Approved — changes applied to ${cr.targetLabel || 'the record'}`, 'ok');
      setCrs((list) => list.filter((x) => x._id !== cr._id));
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not apply this change.', 'dng');
    }
  }

  if (loading) {
    return (
      <>
        <Navbar title="Dashboard" subtitle="Data Analyzer" />
        <main className="mt-content"><MtSkeleton /></main>
      </>
    );
  }

  // Derive charts (each hides if empty).
  const line = monthlyCounts(crs);
  const bars = topN(groupCount(programs, (p) => p.trainingCenterId?.countryId?.name), 8);
  const donutCenters = topN(groupCount(centers, (c) => c.countryId?.name), 5);
  const donutPrograms = topN(groupCount(programs, (p) => specialtyName(p.specialtyId)), 5);
  const growSeries = [
    { name: 'Programs', color: 'var(--brand-primary)', values: cumulativeSeries(programs) },
    { name: 'Training centers', color: 'var(--accent)', values: cumulativeSeries(centers) },
    { name: 'Specialties', color: 'var(--success)', values: cumulativeSeries(specialties) },
  ];
  const growHasData = programs.length || centers.length || specialties.length;

  const pending = crs.filter((c) => c.status === 'pending');
  const openCount = stats?.pendingChangeRequests ?? pending.length;
  const preview = pending.slice(0, 3);
  const decisions = [...crs]
    .sort((a, b) => new Date(b.reviewedAt || b.createdAt) - new Date(a.reviewedAt || a.createdAt))
    .slice(0, 6);

  const decisionPill = (st) => st === 'approved'
    ? <span className="mt-pill mt-pill--active">Approved</span>
    : st === 'rejected'
      ? <span className="mt-pill mt-pill--rejected">Rejected</span>
      : <span className="mt-pill mt-pill--pending">Pending</span>;

  return (
    <>
      <Navbar title="Dashboard" subtitle="Data Analyzer" />
      <main className="mt-content">

        {/* ── STAT GRID ── */}
        <div className="mt-stat-grid">
          {STAT_CARDS.map(([key, label, icon], i) => (
            <RevealOnScroll key={key} delay={i * 0.055}>
              <StatCard label={label} value={stats?.[key] ?? 0} icon={icon} active />
            </RevealOnScroll>
          ))}
        </div>

        {/* ── CHARTS ── */}
        <div className="mt-az-charts">
          <ChartCard title="Change requests" sub="Monthly · submitted for approval" delay={0}>
            <LineChart values={line.values} labels={line.labels} />
          </ChartCard>

          {bars.length > 0 && (
            <ChartCard title="Programs by country" sub="Top 8" delay={0.08}>
              <BarChart items={bars} />
            </ChartCard>
          )}

          {donutCenters.length > 0 && (
            <ChartCard title="Training centers by country" sub={`All countries · ${centers.length} centers`} delay={0.1}>
              <DonutChart items={donutCenters} cap="centers" />
            </ChartCard>
          )}

          {donutPrograms.length > 0 && (
            <ChartCard title="Programs by specialty" sub={`All specialties · ${programs.length} programs`} delay={0.1}>
              <DonutChart items={donutPrograms} cap="programs" />
            </ChartCard>
          )}

          {growHasData ? (
            <ChartCard full title="Registry growth — Specialties, Training centers, Programs" sub="Cumulative totals · last 12 months" delay={0.12}>
              <GrowthChart series={growSeries} labels={monthLabels(lastMonths(12))} />
            </ChartCard>
          ) : null}
        </div>

        {/* ── PENDING CHANGES ── */}
        <div className="mt-az-section">
          <span className="mt-az-section-title">Pending changes</span>
          {openCount > 0 && <span className="mt-pill mt-pill--role">{openCount} open</span>}
          <span className="mt-az-section-spacer" />
          <button type="button" className="mt-az-viewall" onClick={() => navigate('/analyzer/pending')}>View all →</button>
        </div>

        {preview.length === 0 ? (
          <div className="mt-empty" style={{ maxWidth: 520 }}>
            <div className="mt-empty-title">No pending changes</div>
            <div className="mt-empty-sub">Clerk and central-secretary edit requests will appear here for review.</div>
          </div>
        ) : (
          <div className="mt-az-preview-grid">
            {preview.map((cr, i) => (
              <RevealOnScroll key={cr._id} delay={0.1 + i * 0.08} className="mt-az-preview">
                <div className="mt-az-preview-head">
                  <div className="mt-az-avatar">{initialsOf(cr.requestedBy?.name)}</div>
                  <div className="mt-az-who">
                    <div className="mt-az-who-name">{cr.requestedBy?.name || 'Unknown'}</div>
                    <div className="mt-az-who-sub">{roleLabel(cr.requestedBy?.role, lang) || cr.requestedBy?.role} · {fmtDate(cr.createdAt)}</div>
                  </div>
                  <div className="mt-az-head-spacer" />
                  <span className="mt-count" title={reqId(cr._id)}>{reqId(cr._id)}</span>
                </div>
                <div className="mt-az-preview-body">
                  <div className="mt-az-preview-target">Target · <b>{cr.targetLabel || '—'}</b></div>
                  <div className="mt-az-chips">
                    <span className="mt-az-chip"><span>{fieldsChip(cr)}</span></span>
                    {cr.bookOfChangesPdf?.fileName && (
                      <span className="mt-az-chip mt-az-chip--file"><IconFileText size={13} /><span>{cr.bookOfChangesPdf.fileName}</span></span>
                    )}
                  </div>
                </div>
                <div className="mt-az-preview-foot">
                  <button type="button" className="mt-btn mt-btn--small" onClick={() => approvePreview(cr)}>Approve</button>
                  <button type="button" className="mt-btn--small-outline" onClick={() => navigate('/analyzer/pending')}>Review →</button>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        )}

        {/* ── LATEST DECISIONS ── */}
        {decisions.length > 0 && (
          <>
            <div className="mt-az-section">
              <span className="mt-az-section-title">Latest decisions</span>
              <span className="mt-az-section-spacer" />
              <button type="button" className="mt-az-viewall" onClick={() => navigate('/analyzer/pending')}>View all →</button>
            </div>
            <RevealOnScroll>
              <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="mt-table-wrap">
                  <table className="mt-table">
                    <thead>
                      <tr>
                        <th className="mt-th">Date</th><th className="mt-th">Requester</th>
                        <th className="mt-th">Target</th><th className="mt-th">Fields</th><th className="mt-th">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decisions.map((cr) => (
                        <tr key={cr._id}>
                          <td className="mt-td mt-td--mono">{fmtDate(cr.reviewedAt || cr.createdAt)}</td>
                          <td className="mt-td mt-td--name">{cr.requestedBy?.name || '—'}</td>
                          <td className="mt-td mt-td--muted">{cr.targetLabel || '—'}</td>
                          <td className="mt-td mt-td--muted">{fieldsChip(cr)}</td>
                          <td className="mt-td">{decisionPill(cr.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </RevealOnScroll>
          </>
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}

function ChartCard({ title, sub, full, delay, children }) {
  return (
    <RevealOnScroll as="section" chart delay={delay} className={`mt-card mt-card--chart${full ? ' mt-az-chart-full' : ''}`}>
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
