// frontend/src/pages/CentralDashboard.jsx
//
// Central Secretary dashboard (dashboards.md §4.3): 8 stat cards + line (new
// trainees) + bars (trainees by center) + 2 donuts (centers by country, programs
// by specialty) + a "Recently added trainees" summary table.
//
// The /central/stats endpoint serves only the eight counts; the API exposes no
// chart-series or recent-list endpoint, so the charts and the summary table are
// derived client-side from the scoped list endpoints — real data, never
// fabricated (RULINGS §34). Deltas are shown only where derivable from createdAt.
//
// TODO(fable): the dashboard fetches 4 list endpoints to build the charts +
// recent table because /central/stats serves only counts. Confirm client-side
// derivation is acceptable, or ask Agent B to add a /central dashboard-series
// (line/bars/donuts + recent trainees) endpoint for a lighter, canonical load.
// Contract: GET /api/central/stats , /central/centers , /central/programs ,
//           /central/trainees , /central/countries.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import RevealOnScroll from '../components/RevealOnScroll';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import MtSkeleton from '../components/MtSkeleton';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import './central.css';

const STRINGS = {
  ar: {
    title: 'لوحة التحكم', sub: 'السكرتير المركزي',
    centers: 'المراكز التدريبية', dios: 'الـ DIO', programs: 'البرامج', pds: 'مدراء البرامج',
    trainees: 'المتدربون', evaluations: 'التقييمات', researches: 'الأبحاث', certificates: 'الشهادات الصادرة',
    thisYear: n => `+${n} هذا العام`, thisMonth: n => `+${n} هذا الشهر`,
    lineTitle: 'متدربون جدد', lineSub: 'شهرياً · هذا الاختصاص',
    barsTitle: 'المتدربون حسب المركز', barsSub: 'أعلى 6 مراكز',
    donutCentersTitle: 'المراكز حسب الدولة', donutCentersSub: 'ضمن نطاقك',
    donutProgramsTitle: 'البرامج حسب الاختصاص', donutProgramsSub: 'ضمن نطاقك',
    capCenters: 'مراكز', capPrograms: 'برامج',
    recentTitle: 'متدربون أُضيفوا حديثاً', recentSub: 'أحدث الإضافات',
    colTrainee: 'المتدرب', colId: 'الرقم', colCountry: 'الدولة', colProgram: 'البرنامج', colStatus: 'الحالة',
    active: 'نشط', inactive: 'معطّل', other: 'أخرى', unknown: 'غير معروف', na: '—', noRecent: 'لا يوجد متدربون بعد.',
    loadFailed: 'فشل تحميل اللوحة',
  },
  en: {
    title: 'Dashboard', sub: 'Central Secretary',
    centers: 'Training centers', dios: 'DIOs', programs: 'Programs', pds: 'PDs',
    trainees: 'Trainees', evaluations: 'Evaluations', researches: 'Researches', certificates: 'Issued certificates',
    thisYear: n => `+${n} this year`, thisMonth: n => `+${n} this month`,
    lineTitle: 'New trainees', lineSub: 'Monthly · this specialty',
    barsTitle: 'Trainees by training center', barsSub: 'Top 6 centers',
    donutCentersTitle: 'Training centers by country', donutCentersSub: 'Your specialty scope',
    donutProgramsTitle: 'Programs by specialty', donutProgramsSub: 'Your specialty scope',
    capCenters: 'centers', capPrograms: 'programs',
    recentTitle: 'Recently added trainees', recentSub: 'Newest first',
    colTrainee: 'Trainee', colId: 'ID', colCountry: 'Country', colProgram: 'Program', colStatus: 'Status',
    active: 'Active', inactive: 'Inactive', other: 'Other', unknown: 'Unknown', na: '—', noRecent: 'No trainees yet.',
    loadFailed: 'Failed to load the dashboard',
  },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function idOf(v) { return v?._id || v || ''; }

// Group `items` by a label function, count, sort desc, keep top-N and fold the
// remainder into an "Other" slice (donuts). n=0 disables the Other fold (bars).
function topGroups(items, labelFn, n, otherLabel) {
  const counts = new Map();
  items.forEach((it) => {
    const l = labelFn(it);
    if (!l) return;
    counts.set(l, (counts.get(l) || 0) + 1);
  });
  const sorted = Array.from(counts, ([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v);
  // No Other-fold when no label is supplied (bars) or the set already fits.
  if (n <= 0 || sorted.length <= n || !otherLabel) return sorted.slice(0, n > 0 ? n : sorted.length);
  const head = sorted.slice(0, n - 1);
  const rest = sorted.slice(n - 1).reduce((s, x) => s + x.v, 0);
  if (rest > 0) head.push({ l: otherLabel, v: rest });
  return head;
}

// Chart card wrapper: title + sub + accent section-divider, then the chart.
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
      {children}
    </RevealOnScroll>
  );
}

export default function CentralDashboard() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [stats, setStats] = useState(null);
  const [centers, setCenters] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [countryMap, setCountryMap] = useState({});
  const [centerMap, setCenterMap] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, ceRes, pRes, trRes, coRes] = await Promise.allSettled([
      api.get('/api/central/stats'),
      api.get('/api/central/centers'),
      api.get('/api/central/programs'),
      api.get('/api/central/trainees'),
      api.get('/api/central/countries'),
    ]);
    if (sRes.status === 'fulfilled') setStats(sRes.value.data?.data || sRes.value.data || {});
    else { setStats({}); showToast(t('loadFailed'), 'dng'); }
    const ce = ceRes.status === 'fulfilled' ? (ceRes.value.data?.data || ceRes.value.data || []) : [];
    const p = pRes.status === 'fulfilled' ? (pRes.value.data?.data || pRes.value.data || []) : [];
    const tr = trRes.status === 'fulfilled' ? (trRes.value.data?.data || trRes.value.data || []) : [];
    setCenters(ce); setPrograms(p); setTrainees(tr);
    const cmap = {}; ce.forEach(c => { cmap[c._id] = c; }); setCenterMap(cmap);
    const comap = {};
    if (coRes.status === 'fulfilled') (coRes.value.data?.data || coRes.value.data || []).forEach(c => { comap[c._id] = c; });
    setCountryMap(comap);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const countryNameOf = useCallback((entity) => {
    const co = entity?.countryId;
    return co?.name || countryMap[idOf(co)]?.name || null;
  }, [countryMap]);

  // ── Stat cards (8) with honest deltas from createdAt where available ────────
  const statCards = useMemo(() => {
    const s = stats || {};
    const now = new Date();
    const yr = now.getFullYear(), mo = now.getMonth();
    const inYear = d => { if (!d) return false; const x = new Date(d); return x.getFullYear() === yr; };
    const inMonth = d => { if (!d) return false; const x = new Date(d); return x.getFullYear() === yr && x.getMonth() === mo; };
    const centersYr = centers.filter(c => inYear(c.createdAt)).length;
    const programsYr = programs.filter(p => inYear(p.createdAt)).length;
    const traineesMo = trainees.filter(x => inMonth(x.createdAt)).length;
    return [
      { label: t('centers'), value: s.centers, icon: 'building', delta: centersYr ? t('thisYear')(centersYr) : null, tone: 'ok' },
      { label: t('dios'), value: s.dios, icon: 'brief' },
      { label: t('programs'), value: s.programs, icon: 'layers', delta: programsYr ? t('thisYear')(programsYr) : null, tone: 'ok' },
      { label: t('pds'), value: s.programDirectors, icon: 'users' },
      { label: t('trainees'), value: s.trainees, icon: 'grad', delta: traineesMo ? t('thisMonth')(traineesMo) : null, tone: 'ok' },
      { label: t('evaluations'), value: s.evaluations, icon: 'doc' },
      { label: t('researches'), value: s.researches, icon: 'flask' },
      { label: t('certificates'), value: s.certificates, icon: 'award' },
    ];
  }, [stats, centers, programs, trainees, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Line: new trainees per month, last 12 months ───────────────────────────
  const line = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, m: d.getMonth(), v: 0 });
    }
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    trainees.forEach(tr => {
      if (!tr.createdAt) return;
      const x = new Date(tr.createdAt);
      const k = `${x.getFullYear()}-${x.getMonth()}`;
      if (index.has(k)) buckets[index.get(k)].v += 1;
    });
    const values = buckets.map(b => b.v);
    const labels = buckets.filter((_, i) => i % 2 === 0).map(b => MONTHS[b.m]);
    return { values, labels };
  }, [trainees]);

  // ── Bars: trainees by center (top 6) ───────────────────────────────────────
  const bars = useMemo(
    () => topGroups(trainees, tr => tr.hospitalId?.name || centerMap[idOf(tr.hospitalId)]?.name || null, 6, ''),
    [trainees, centerMap], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Donuts: centers by country, programs by specialty (top 5 + Other) ──────
  const donutCenters = useMemo(
    () => topGroups(centers, c => countryNameOf(c) || t('unknown'), 5, t('other')),
    [centers, countryNameOf, lang], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const donutPrograms = useMemo(
    () => topGroups(programs, p => p.specialtyId?.name || t('unknown'), 5, t('other')),
    [programs, lang], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Recent trainees (newest 6) ─────────────────────────────────────────────
  const recent = useMemo(() => {
    return [...trainees]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6);
  }, [trainees]);

  if (loading) {
    return (
      <>
        <Navbar title={t('title')} subtitle={t('sub')} />
        <main className="mt-content" dir={dir}>
          <MtSkeleton stats={8} charts={2} table />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar title={t('title')} subtitle={t('sub')} />
      <main className="mt-content" dir={dir}>
        {/* Stat grid */}
        <div className="mt-stat-grid">
          {statCards.map((s, i) => (
            <RevealOnScroll key={s.label} delay={i * 0.055}>
              <StatCard label={s.label} value={s.value || 0} icon={s.icon} delta={s.delta} tone={s.tone} />
            </RevealOnScroll>
          ))}
        </div>

        {/* Charts grid */}
        <div className="cs-charts">
          <ChartCard title={t('lineTitle')} sub={t('lineSub')} delay={0}>
            <LineChart values={line.values} labels={line.labels} />
          </ChartCard>
          <ChartCard title={t('barsTitle')} sub={t('barsSub')} delay={0.08}>
            <BarChart items={bars} />
          </ChartCard>
          <ChartCard title={t('donutCentersTitle')} sub={t('donutCentersSub')} delay={0.1}>
            <DonutChart items={donutCenters} cap={t('capCenters')} />
          </ChartCard>
          <ChartCard title={t('donutProgramsTitle')} sub={t('donutProgramsSub')} delay={0.12}>
            <DonutChart items={donutPrograms} cap={t('capPrograms')} />
          </ChartCard>
        </div>

        {/* Summary table — recently added trainees */}
        <RevealOnScroll as="section" chart delay={0.12} className="mt-card cs-section" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="mt-card-head mt-card-head--tight" style={{ padding: '18px 20px 0' }}>
            <div style={{ minWidth: 0 }}>
              <div className="mt-card-title">{t('recentTitle')}</div>
              <div className="mt-card-sub">{t('recentSub')}</div>
            </div>
            <div className="mt-divider" />
          </div>
          <div className="mt-table-wrap" style={{ marginBlockStart: 12 }}>
            <table className="mt-table">
              <thead>
                <tr>
                  <th className="mt-th">{t('colTrainee')}</th>
                  <th className="mt-th">{t('colId')}</th>
                  <th className="mt-th">{t('colCountry')}</th>
                  <th className="mt-th">{t('colProgram')}</th>
                  <th className="mt-th">{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td className="mt-td" colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-2)' }}>
                      {t('noRecent')}
                    </td>
                  </tr>
                )}
                {recent.map(tr => {
                  const active = tr.isActive !== false;
                  return (
                    <tr key={tr._id}>
                      <td className="mt-td mt-td--name">{tr.name}</td>
                      <td className="mt-td mt-td--mono">{tr.idNumber || t('na')}</td>
                      <td className="mt-td mt-td--muted">{countryNameOf(tr) || t('na')}</td>
                      <td className="mt-td mt-td--muted">{tr.programId?.name || t('na')}</td>
                      <td className="mt-td">
                        <span className={`mt-pill ${active ? 'mt-pill--active' : 'mt-pill--neutral'}`}>
                          {active ? t('active') : t('inactive')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
