// frontend/src/pages/ProgramDirectorDashboard.jsx
//
// Program Director / Sub-PD dashboard for the PD's ONE program, restyled to the
// mt- design system (dashboards.md §4.9): a program header card + 4 stat cards
// + two animated charts (logbook-submissions line, trainees-by-year bars).
// A Sub-PD mirrors its PD (backend scopes via pdId); the page is read-only for
// everyone — no write UI.
//
// Wiring (all pre-existing endpoints, real data only — RULINGS §34, no fake nums):
//   GET /api/program-director/stats            → { program, counts }
//   GET /api/program-director/trainees         → { trainees, distributions } (bars)
//   GET /api/logbook/review?status=all         → entries (pending count + line)
// The design's "Evaluations due" / "Announcements" cards have no PD data source,
// so they are substituted with real counts (evaluations authored, reports to
// grade). 403 / "No program assigned" → friendly empty state.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import AccreditationBadge from '../components/AccreditationBadge';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import './pd.css';

const STRINGS = {
  ar: {
    center: 'المركز', specialty: 'الاختصاص', capacity: 'الطاقة', trainingStart: 'بداية التدريب', dio: 'DIO', subPd: 'نائب مدير البرنامج',
    trainees: 'المتدربون', logbookPending: 'توقيعات دفتر معلّقة', evaluations: 'التقييمات المُنشأة', reports: 'تقارير للتقييم',
    lineTitle: 'إدخالات دفتر التدريب', lineSub: 'آخر ١٤ يومًا',
    barsByYear: 'المتدربون حسب السنة', barsByHospital: 'المتدربون حسب المركز', barsSub: 'برنامجي',
    noProgram: 'لا يوجد برنامج مسند إلى حسابك بعد.', loadFailed: 'فشل تحميل البيانات', noData: 'لا توجد بيانات بعد.',
  },
  en: {
    center: 'Center', specialty: 'Specialty', capacity: 'Capacity', trainingStart: 'Training Start', dio: 'DIO', subPd: 'Sub-PD',
    trainees: 'My Trainees', logbookPending: 'Logbook sign-offs pending', evaluations: 'Evaluations authored', reports: 'Reports to grade',
    lineTitle: 'Logbook submissions', lineSub: 'Last 14 days',
    barsByYear: 'Trainees by year', barsByHospital: 'Trainees by center', barsSub: 'My program',
    noProgram: 'No program is assigned to your account yet.', loadFailed: 'Failed to load data', noData: 'No data yet.',
  },
};

function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}
function unwrap(res) { return res?.data?.data ?? res?.data ?? null; }

// 14-day daily submission series from logbook entries (real data). Returns 14
// values + 5 evenly-spaced date labels (matching the prototype's D14 markers).
function last14Series(entries) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); days.push(d); }
  const counts = days.map(() => 0);
  entries.forEach((e) => {
    const dt = new Date(e.date || e.createdAt);
    if (Number.isNaN(dt.getTime())) return;
    dt.setHours(0, 0, 0, 0);
    const idx = days.findIndex((d) => d.getTime() === dt.getTime());
    if (idx >= 0) counts[idx] += 1;
  });
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { values: counts, labels: [0, 3, 7, 10, 13].map((i) => fmt(days[i])), total: counts.reduce((a, b) => a + b, 0) };
}

// Trainees grouped by training year (Year 1..N), sorted ascending.
function traineesByYear(trainees) {
  const m = new Map();
  trainees.forEach((t) => {
    const y = t.year || t.trainingYear;
    if (!y) return;
    const key = `Year ${y}`;
    m.set(key, (m.get(key) || 0) + 1);
  });
  return [...m.entries()]
    .sort((a, b) => (parseInt(a[0].replace(/\D/g, ''), 10) || 0) - (parseInt(b[0].replace(/\D/g, ''), 10) || 0))
    .map(([l, v]) => ({ l, v }));
}
// Fallback grouping when trainees carry no year: top-6 by hospital.
function traineesByHospital(trainees) {
  const m = new Map();
  trainees.forEach((t) => {
    const h = t.hospitalId?.name || t.hospital?.name;
    if (!h) return;
    m.set(h, (m.get(h) || 0) + 1);
  });
  return [...m.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 6);
}

export default function ProgramDirectorDashboard() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [data, setData] = useState(null);
  const [trainees, setTrainees] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noProgram, setNoProgram] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.get('/api/program-director/stats', { cache: false }),
      api.get('/api/program-director/trainees'),
      api.get('/api/logbook/review', { params: { status: 'all' }, cache: false }),
    ]).then(([s, tr, lb]) => {
      if (!alive) return;
      if (s.status === 'fulfilled') {
        setData(unwrap(s.value));
      } else if (s.reason?.response?.status === 403) {
        setNoProgram(true);
      } else {
        showToast(t('loadFailed'), 'dng');
      }
      if (tr.status === 'fulfilled') {
        const d = unwrap(tr.value) || {};
        setTrainees(Array.isArray(d) ? d : (d.trainees || []));
      }
      if (lb.status === 'fulfilled') {
        const d = unwrap(lb.value);
        setEntries(Array.isArray(d) ? d : []);
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content"><MtSkeleton stats={4} charts={2} table={false} /></main>
    </>
  );

  if (noProgram || !data?.program) return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-empty" style={{ padding: 56 }}>
          <div className="mt-empty-title">{t('noProgram')}</div>
        </div>
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );

  const p = data.program;
  const c = data.counts || {};
  const pendingSignoffs = entries.filter((e) => e.status === 'pending').length;
  const line = last14Series(entries);
  const byYear = traineesByYear(trainees);
  const bars = byYear.length ? byYear : traineesByHospital(trainees);
  const barsTitle = byYear.length ? t('barsByYear') : t('barsByHospital');

  const cards = [
    { key: 'trainees',       icon: 'grad',  value: c.trainees ?? trainees.length },
    { key: 'logbookPending', icon: 'book',  value: pendingSignoffs, tone: pendingSignoffs > 0 ? 'warn' : 'ok' },
    { key: 'evaluations',    icon: 'doc',   value: c.evaluationsAuthored ?? 0 },
    { key: 'reports',        icon: 'award', value: c.pendingFinalReports ?? 0 },
  ];

  return (
    <>
      <Navbar />
      <main className="mt-content">
        {/* Program header */}
        <RevealOnScroll className="mt-card" style={{ marginBlockEnd: 16 }}>
          <div className="pd-prog">
            <div className="pd-prog-name">{p.name}</div>
            <AccreditationBadge status={p.accreditationStatus} />
          </div>
          <div className="pd-prog-kv">
            {[
              [t('center'), p.trainingCenterId?.name ? `${p.trainingCenterId.name}${p.trainingCenterId.city ? ` · ${p.trainingCenterId.city}` : ''}` : '—'],
              [t('specialty'), specialtyName(p.specialtyId) || '—'],
              // DIO + Sub-PD fill in once the backend populates them (§Fable fix-wave); hidden until then.
              ...(p.trainingCenterId?.dioId?.name ? [[t('odio'), p.trainingCenterId.dioId.name]] : []),
              ...(p.subProgramDirectorId?.name ? [[t('subPd'), p.subProgramDirectorId.name]] : []),
              [t('capacity'), `${c.capacityUsed ?? 0} / ${c.yearlyCapacity ?? p.yearlyCapacity ?? 0}`],
              [t('trainingStart'), fmtDate(p.trainingStartDate)],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="pd-kv-label">{label}</div>
                <div className="pd-kv-value">{value}</div>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        {/* Stat cards */}
        <div className="mt-stat-grid">
          {cards.map((card, i) => (
            <RevealOnScroll key={card.key} delay={i * 0.055}>
              <StatCard label={t(card.key)} value={card.value} icon={card.icon} tone={card.tone} delta={undefined} />
            </RevealOnScroll>
          ))}
        </div>

        {/* Charts */}
        <div className="pd-charts">
          <RevealOnScroll as="section" chart className="mt-card mt-card--chart" delay={0.08}>
            <div className="mt-card-head">
              <div>
                <div className="mt-card-title">{t('lineTitle')}</div>
                <div className="mt-card-sub">{t('lineSub')}</div>
              </div>
              <div className="mt-divider" />
            </div>
            {line.total > 0
              ? <LineChart values={line.values} labels={line.labels} />
              : <div className="pd-chart-empty">{t('noData')}</div>}
          </RevealOnScroll>

          <RevealOnScroll as="section" chart className="mt-card mt-card--chart" delay={0.1}>
            <div className="mt-card-head">
              <div>
                <div className="mt-card-title">{barsTitle}</div>
                <div className="mt-card-sub">{t('barsSub')}</div>
              </div>
              <div className="mt-divider" />
            </div>
            {bars.length
              ? <BarChart items={bars} />
              : <div className="pd-chart-empty">{t('noData')}</div>}
          </RevealOnScroll>
        </div>

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
