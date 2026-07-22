// frontend/src/pages/RegistryDashboard.jsx
//
// Data-entry clerk dashboard (design role "clerk"). Four registry stat cards
// from GET /api/registry/stats, plus charts computed from the real registry:
//   • line   — Programs added, last 14 days (from Program.createdAt)
//   • bars   — Center capacity used, top 6 centers (programs / 100)
//   • donuts — Training centers by country · Programs by specialty
// No fabricated numbers (RULINGS §34): every series is derived from live data;
// undeliverable "+N this year" deltas are omitted.
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import RevealOnScroll from '../components/RevealOnScroll';
import StatCard from '../components/StatCard';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { refName } from './registryShared';
import api from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import './registry.css';

const STRINGS = {
  ar: {
    centers: 'المراكز التدريبية', dios: 'مديرو التدريب (DIOs)', programs: 'البرامج', pds: 'مدراء البرامج',
    capRule: 'حد أقصى 100 لكل مركز',
    lineTitle: 'السجلات المضافة', lineSub: 'آخر 14 يومًا',
    barsTitle: 'استخدام سعة المراكز', barsSub: 'برامج لكل مركز · % من 100',
    donut1Title: 'المراكز حسب الدولة', donut1Sub: 'كل الدول', capCenters: 'مركز',
    donut2Title: 'البرامج حسب الاختصاص', donut2Sub: 'كل الاختصاصات', capPrograms: 'برنامج',
    loadFailed: 'فشل التحميل', other: 'أخرى', empty: 'لا توجد بيانات بعد.',
  },
  en: {
    centers: 'Training centers', dios: 'DIOs', programs: 'Programs', pds: 'PDs',
    capRule: 'max 100 per center',
    lineTitle: 'Records added', lineSub: 'Last 14 days',
    barsTitle: 'Center capacity used', barsSub: 'Programs per center · % of 100',
    donut1Title: 'Training centers by country', donut1Sub: 'All countries', capCenters: 'centers',
    donut2Title: 'Programs by specialty', donut2Sub: 'All specialties', capPrograms: 'programs',
    loadFailed: 'Failed to load', other: 'Other', empty: 'No data yet.',
  },
};

// Group an array by a key function → [{ l, v }] sorted desc, top N + "Other".
function topGroups(rows, keyFn, topN, otherLabel) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r) || '—';
    map.set(k, (map.get(k) || 0) + 1);
  }
  const sorted = [...map.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v);
  if (sorted.length <= topN) return sorted;
  const head = sorted.slice(0, topN);
  const rest = sorted.slice(topN).reduce((s, x) => s + x.v, 0);
  return [...head, { l: otherLabel, v: rest }];
}

// 14-day added-per-day buckets from createdAt, with 5 evenly spaced date labels.
function last14(rows) {
  const days = [];
  const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push(d); }
  const counts = days.map((d) => {
    const next = new Date(d); next.setDate(next.getDate() + 1);
    return rows.filter((r) => { const c = new Date(r.createdAt); return c >= d && c < next; }).length;
  });
  const labels = [0, 3, 6, 10, 13].map((i) =>
    days[i].toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  return { values: counts, labels };
}

function DashSkeleton() {
  return (
    <>
      <div className="mt-skel-stat-grid">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton mt-skel mt-skel-stat" style={{ animationDelay: `${i * 0.1}s` }} />)}
      </div>
      <div className="mt-skel-charts">
        {[0, 1].map((i) => <div key={i} className="skeleton mt-skel mt-skel-chart" style={{ animationDelay: `${0.15 + i * 0.1}s` }} />)}
      </div>
    </>
  );
}

export default function RegistryDashboard() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.en[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [stats, setStats] = useState(null);
  const [centers, setCenters] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, c, p] = await Promise.allSettled([
      api.get('/api/registry/stats'),
      api.get('/api/registry/centers'),
      api.get('/api/programs'),
    ]);
    if (s.status === 'fulfilled') setStats(s.value.data?.data || s.value.data || {});
    else showToast(t('loadFailed'), 'dng');
    if (c.status === 'fulfilled') setCenters(c.value.data?.data || c.value.data || []);
    if (p.status === 'fulfilled') setPrograms(p.value.data?.data || p.value.data || []);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const line = last14(programs);
  const bars = topGroups(programs, (p) => refName(p.trainingCenterId), 6, t('other')).slice(0, 6);
  const donutCountries = topGroups(centers, (c) => refName(c.countryId), 5, t('other'));
  const donutSpecialties = topGroups(programs, (p) => specialtyName(p.specialtyId), 5, t('other'));

  const cards = stats ? [
    { label: t('centers'), value: stats.centers, icon: 'building' },
    { label: t('dios'), value: stats.dios, icon: 'brief' },
    { label: t('programs'), value: stats.programs, icon: 'layers', delta: t('capRule'), tone: 'warn' },
    { label: t('pds'), value: stats.pds, icon: 'users' },
  ] : [];

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        {loading ? <DashSkeleton /> : (
          <>
            <div className="mt-stat-grid">
              {cards.map((c, i) => (
                <RevealOnScroll key={c.label} delay={i * 0.055}>
                  <StatCard label={c.label} value={c.value} icon={c.icon} delta={c.delta} tone={c.tone} />
                </RevealOnScroll>
              ))}
            </div>

            <div className="reg-charts">
              <RevealOnScroll as="section" chart className="mt-card mt-card--chart">
                <div className="mt-card-head mt-card-head--tight">
                  <div>
                    <div className="mt-card-title">{t('lineTitle')}</div>
                    <div className="mt-card-sub">{t('lineSub')}</div>
                  </div>
                  <span className="mt-divider" />
                </div>
                <LineChart values={line.values} labels={line.labels} />
              </RevealOnScroll>

              <RevealOnScroll as="section" chart delay={0.08} className="mt-card mt-card--chart">
                <div className="mt-card-head mt-card-head--tight">
                  <div>
                    <div className="mt-card-title">{t('barsTitle')}</div>
                    <div className="mt-card-sub">{t('barsSub')}</div>
                  </div>
                  <span className="mt-divider" />
                </div>
                {bars.length ? <BarChart items={bars} /> : <div className="mt-count">{t('empty')}</div>}
              </RevealOnScroll>

              <RevealOnScroll as="section" chart delay={0.1} className="mt-card mt-card--chart">
                <div className="mt-card-head mt-card-head--tight">
                  <div>
                    <div className="mt-card-title">{t('donut1Title')}</div>
                    <div className="mt-card-sub">{t('donut1Sub')}</div>
                  </div>
                  <span className="mt-divider" />
                </div>
                {donutCountries.length ? <DonutChart items={donutCountries} cap={t('capCenters')} /> : <div className="mt-count">{t('empty')}</div>}
              </RevealOnScroll>

              <RevealOnScroll as="section" chart delay={0.12} className="mt-card mt-card--chart">
                <div className="mt-card-head mt-card-head--tight">
                  <div>
                    <div className="mt-card-title">{t('donut2Title')}</div>
                    <div className="mt-card-sub">{t('donut2Sub')}</div>
                  </div>
                  <span className="mt-divider" />
                </div>
                {donutSpecialties.length ? <DonutChart items={donutSpecialties} cap={t('capPrograms')} /> : <div className="mt-count">{t('empty')}</div>}
              </RevealOnScroll>
            </div>
          </>
        )}
      </main>
      <MtToastHost toasts={toasts} />
    </>
  );
}
