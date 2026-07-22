// frontend/src/pages/SgDashboard.jsx
//
// Secretary General / Assistant Secretary read-only oversight dashboard.
// Restyled to the mt- design: 6 stat cards + charts (bars + two donuts) derived
// from the existing read-only endpoints — real data only, no invented API shapes.
//
// Wiring (unchanged endpoints):
//   GET /api/sg/stats    → { trainees, programDirectors, dios, odios, centers,
//                            programs, specialties, countries, trainers } (counts)
//   GET /api/sg/centers  → centers (countryId populated) → donut "by country"
//   GET /api/sg/programs → programs (specialtyId + trainingCenterId populated)
//                          → bars "by center" + donut "by specialty"
//
// Delta lines are omitted (RULINGS §34 — never fake numbers; /api/sg/stats has no
// time series). The prototype's "Certificates issued" line chart has no SG data
// source and is intentionally left out (see report QUESTIONS).
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import './sg.css';

const STRINGS = {
  ar: {
    centers: 'مراكز التدريب', dios: 'مدراء التدريب', programDirectors: 'مدراء البرامج',
    programs: 'البرامج', specialties: 'الاختصاصات', trainees: 'المتدربون',
    barProgByCenter: 'البرامج حسب المركز', barProgByCenterSub: 'أعلى 6 مراكز',
    donutCentersByCountry: 'مراكز التدريب حسب الدولة', capCenters: 'مركز',
    donutProgBySpecialty: 'البرامج حسب الاختصاص', capPrograms: 'برنامج',
    other: 'أخرى', loadFailed: 'فشل تحميل الإحصاءات',
  },
  en: {
    centers: 'Training Centers', dios: 'DIOs', programDirectors: 'Program Directors',
    programs: 'Programs', specialties: 'Specialties', trainees: 'Trainees',
    barProgByCenter: 'Programs by center', barProgByCenterSub: 'Top 6 centers',
    donutCentersByCountry: 'Training centers by country', capCenters: 'centers',
    donutProgBySpecialty: 'Programs by specialty', capPrograms: 'programs',
    other: 'Other', loadFailed: 'Failed to load statistics',
  },
};

// The six stats the SG dashboard features (dashboards.md §4.6).
const STAT_CARDS = [
  { key: 'centers',          icon: 'building' },
  { key: 'dios',             icon: 'brief'    },
  { key: 'programDirectors', icon: 'users'    },
  { key: 'programs',         icon: 'layers'   },
  { key: 'specialties',      icon: 'book'     },
  { key: 'trainees',         icon: 'grad'     },
];

// Count occurrences by a key, returned as [{ l, v }] sorted high→low.
function tally(items, keyFn) {
  const m = new Map();
  items.forEach((it) => {
    const k = keyFn(it);
    if (!k) return;
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v);
}

// Keep the top `n`, roll the remainder into a single "Other" slice.
function topWithOther(rows, n, otherLabel) {
  if (rows.length <= n) return rows;
  const top = rows.slice(0, n);
  const rest = rows.slice(n).reduce((s, r) => s + r.v, 0);
  if (rest > 0) top.push({ l: otherLabel, v: rest });
  return top;
}

export default function SgDashboard() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [stats, setStats]       = useState(null);
  const [centers, setCenters]   = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.get('/api/sg/stats', { cache: false }),
      api.get('/api/sg/centers'),
      api.get('/api/sg/programs'),
    ]).then(([s, c, p]) => {
      if (!alive) return;
      if (s.status === 'fulfilled') setStats(s.value.data?.data || s.value.data || null);
      else showToast(t('loadFailed'), 'dng');
      if (c.status === 'fulfilled') setCenters(c.value.data?.data || c.value.data || []);
      if (p.status === 'fulfilled') setPrograms(p.value.data?.data || p.value.data || []);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const centersByCountry = topWithOther(tally(centers, (c) => c.countryId?.name), 5, t('other'));
  const progBySpecialty  = topWithOther(tally(programs, (p) => specialtyName(p.specialtyId)), 5, t('other'));
  const progByCenter     = tally(programs, (p) => p.trainingCenterId?.name).slice(0, 6);

  // Only render chart cards that have real data behind them.
  const charts = [];
  if (progByCenter.length) {
    charts.push(
      <RevealOnScroll key="bars" as="section" chart className="mt-card mt-card--chart" delay={0.08}>
        <div className="mt-card-head">
          <div>
            <div className="mt-card-title">{t('barProgByCenter')}</div>
            <div className="mt-card-sub">{t('barProgByCenterSub')}</div>
          </div>
          <div className="mt-divider" />
        </div>
        <BarChart items={progByCenter} />
      </RevealOnScroll>
    );
  }
  if (centersByCountry.length) {
    charts.push(
      <RevealOnScroll key="donut-country" as="section" chart className="mt-card mt-card--chart" delay={0.1}>
        <div className="mt-card-head">
          <div><div className="mt-card-title">{t('donutCentersByCountry')}</div></div>
          <div className="mt-divider" />
        </div>
        <DonutChart items={centersByCountry} cap={t('capCenters')} />
      </RevealOnScroll>
    );
  }
  if (progBySpecialty.length) {
    charts.push(
      <RevealOnScroll key="donut-specialty" as="section" chart className="mt-card mt-card--chart" delay={0.12}>
        <div className="mt-card-head">
          <div><div className="mt-card-title">{t('donutProgBySpecialty')}</div></div>
          <div className="mt-divider" />
        </div>
        <DonutChart items={progBySpecialty} cap={t('capPrograms')} />
      </RevealOnScroll>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mt-content">
        {loading ? (
          <MtSkeleton stats={6} charts={2} table={false} />
        ) : (
          <>
            <div className="mt-stat-grid">
              {STAT_CARDS.map((c, i) => (
                <RevealOnScroll key={c.key} delay={i * 0.055}>
                  <StatCard label={t(c.key)} value={stats?.[c.key] ?? 0} icon={c.icon} />
                </RevealOnScroll>
              ))}
            </div>
            {charts.length > 0 && <div className="sg-charts">{charts}</div>}
          </>
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
