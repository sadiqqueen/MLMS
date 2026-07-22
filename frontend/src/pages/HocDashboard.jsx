// frontend/src/pages/HocDashboard.jsx
//
// Head of Council (role `hoc`) — read-only council-scoped overview.
// Everything on this page is derived from the three read-only HOC endpoints:
//   GET /api/hoc/stats     → { council, specialties, mainSpecialties,
//                              preciseSpecialties, centers, programs,
//                              programDirectors, trainees }
//   GET /api/hoc/centers   → [{ ...center, countryId:{name}, programs:[…] }]
//   GET /api/hoc/programs  → [{ ...program, specialtyId:{name,type},
//                              trainingCenterId:{name,countryId:{name}}, capacityUsed }]
//
// No write UI (RULINGS §12/§43). Stat cards + custom animated charts (mt- shell).
// NOTE: /hoc/stats carries no central-secretary count and no monthly trainee
// time-series, so the dashboards.md §4.2 "Central secretaries" card is
// substituted by "Specialties" (which carries the real main/precise breakdown)
// and the "New trainees" line is replaced by a real chart. The "DIOs" card is
// derived from the distinct dioId of the in-scope centers. See W1-HOC report.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import MtToastHost, { useMtToast } from '../components/MtToast';
import api from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import './HocDashboard.css';

const STRINGS = {
  ar: {
    scope: 'إشراف للقراءة فقط على مجلس {council} — الاختصاصات والاختصاصات الفرعية.',
    scopeNoCouncil: 'لم يُسنَد مجلس علمي لهذا الحساب بعد.',
    centers: 'مراكز التدريب', dios: 'DIOs', programs: 'البرامج', programDirectors: 'مدراء البرامج',
    trainees: 'المتدربون', specialties: 'الاختصاصات',
    mainPrecise: '{main} اختصاص · {precise} اختصاص فرعي',
    progBySpecialty: 'البرامج حسب الاختصاص', withinCouncil: 'ضمن المجلس',
    centersByCountry: 'مراكز التدريب حسب الدولة', centersScope: 'نطاق المجلس · {n} مركز',
    progDonut: 'البرامج حسب الاختصاص', progScope: '{n} برنامج',
    topCenters: 'أنشط المراكز', topCentersSub: 'حسب عدد البرامج',
    noData: 'لا توجد بيانات بعد.', capCenters: 'مركز', capPrograms: 'برنامج',
    loadFailed: 'فشل تحميل لوحة المعلومات',
  },
  en: {
    scope: 'Read-only oversight of {council} — specialties + sub-specialties.',
    scopeNoCouncil: 'No Scientific Council is assigned to this account yet.',
    centers: 'Training centers', dios: 'DIOs', programs: 'Programs', programDirectors: 'Program directors',
    trainees: 'Trainees', specialties: 'Specialties',
    mainPrecise: '{main} specialties · {precise} sub-specialties',
    progBySpecialty: 'Programs by specialty', withinCouncil: 'Within the council',
    centersByCountry: 'Training centers by country', centersScope: 'Council scope · {n} centers',
    progDonut: 'Programs by specialty', progScope: '{n} programs',
    topCenters: 'Most active centers', topCentersSub: 'By program count',
    noData: 'No data yet.', capCenters: 'centers', capPrograms: 'programs',
    loadFailed: 'Failed to load the dashboard',
  },
};

// name → { l, v } items, sorted desc, capped to `top`; the remainder folds into
// a single "Other" bucket for donuts (keepOther), or is dropped for bars.
function groupItems(rows, keyFn, { top = 6, other = false, otherLabel = 'Other' } = {}) {
  const map = new Map();
  rows.forEach(r => {
    const k = keyFn(r);
    if (!k) return;
    map.set(k, (map.get(k) || 0) + 1);
  });
  const sorted = [...map.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v);
  if (sorted.length <= top) return sorted;
  const head = sorted.slice(0, other ? top - 1 : top);
  if (other) {
    const rest = sorted.slice(top - 1).reduce((s, d) => s + d.v, 0);
    if (rest > 0) head.push({ l: otherLabel, v: rest });
  }
  return head;
}

export default function HocDashboard() {
  const { lang } = usePrefs();
  const t = (k, vars) => {
    let s = STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
    if (vars) Object.entries(vars).forEach(([n, val]) => { s = s.replace(`{${n}}`, val); });
    return s;
  };
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const otherLabel = lang === 'ar' ? 'أخرى' : 'Other';

  const { toasts, showToast } = useMtToast();
  const [stats, setStats] = useState(null);
  const [centers, setCenters] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const pick = (r, d) => (r.status === 'fulfilled' ? (r.value.data?.data ?? r.value.data ?? d) : d);
    Promise.allSettled([
      api.get('/api/hoc/stats'),
      api.get('/api/hoc/centers'),
      api.get('/api/hoc/programs'),
    ]).then(([s, c, p]) => {
      if (!alive) return;
      setStats(pick(s, null));
      setCenters(pick(c, []));
      setPrograms(pick(p, []));
      if (s.status === 'rejected') showToast(t('loadFailed'), 'dng');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mt-content" dir={dir}>
          <MtSkeleton stats={6} charts={2} table={false} />
        </main>
      </>
    );
  }

  const council = stats?.council || null;
  const councilName = council ? (lang === 'ar' ? council.name : (council.nameEn || council.name)) : '';

  // DIOs overseeing the in-scope centers — distinct dioId on the centers list
  // (dioId is present as a raw id even though /hoc/centers does not populate it).
  const dioCount = new Set(centers.map(c => c.dioId).filter(Boolean).map(String)).size;

  const statCards = [
    { key: 'centers',          value: stats?.centers ?? 0,          icon: 'building' },
    { key: 'dios',             value: dioCount,                     icon: 'brief'    },
    { key: 'programs',         value: stats?.programs ?? 0,         icon: 'layers'   },
    { key: 'programDirectors', value: stats?.programDirectors ?? 0, icon: 'users'    },
    { key: 'trainees',         value: stats?.trainees ?? 0,         icon: 'grad'     },
    {
      key: 'specialties', value: stats?.specialties ?? 0, icon: 'book',
      delta: t('mainPrecise', { main: stats?.mainSpecialties ?? 0, precise: stats?.preciseSpecialties ?? 0 }),
      tone: 'warn',
    },
  ];

  // Chart datasets (all derived from the real lists).
  const progBySpecialtyBars = groupItems(programs, p => p.specialtyId ? specialtyName(p.specialtyId, lang) : '', { top: 6 });
  const progBySpecialtyDonut = groupItems(programs, p => p.specialtyId ? specialtyName(p.specialtyId, lang) : '', { top: 6, other: true, otherLabel });
  const centersByCountry = groupItems(centers, c => c.countryId?.name, { top: 6, other: true, otherLabel });
  const topCenters = groupItems(programs, p => p.trainingCenterId?.name, { top: 6 });

  const emptyMsg = <div className="hoc-chart-empty">{t('noData')}</div>;

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        {/* Read-only scope note */}
        <div className="mt-banner hoc-scope">
          {council ? t('scope', { council: councilName }) : t('scopeNoCouncil')}
        </div>

        {/* Stat cards */}
        <div className="mt-stat-grid">
          {statCards.map((c, i) => (
            <RevealOnScroll key={c.key} delay={i * 0.055}>
              <StatCard
                label={t(c.key)}
                value={c.value}
                icon={c.icon}
                delta={c.delta}
                tone={c.tone || 'ok'}
              />
            </RevealOnScroll>
          ))}
        </div>

        {/* Charts */}
        <div className="hoc-charts">
          <RevealOnScroll chart className="mt-card mt-card--chart hoc-chart" delay={0}>
            <div className="mt-card-head">
              <div style={{ minWidth: 0 }}>
                <div className="mt-card-title">{t('progBySpecialty')}</div>
                <div className="mt-card-sub">{t('withinCouncil')}</div>
              </div>
              <div className="mt-divider" />
            </div>
            {progBySpecialtyBars.length ? <BarChart items={progBySpecialtyBars} /> : emptyMsg}
          </RevealOnScroll>

          <RevealOnScroll chart className="mt-card mt-card--chart hoc-chart" delay={0.08}>
            <div className="mt-card-head">
              <div style={{ minWidth: 0 }}>
                <div className="mt-card-title">{t('centersByCountry')}</div>
                <div className="mt-card-sub">{t('centersScope', { n: stats?.centers ?? centers.length })}</div>
              </div>
              <div className="mt-divider" />
            </div>
            {centersByCountry.length ? <DonutChart items={centersByCountry} cap={t('capCenters')} /> : emptyMsg}
          </RevealOnScroll>

          <RevealOnScroll chart className="mt-card mt-card--chart hoc-chart" delay={0.1}>
            <div className="mt-card-head">
              <div style={{ minWidth: 0 }}>
                <div className="mt-card-title">{t('progDonut')}</div>
                <div className="mt-card-sub">{t('progScope', { n: stats?.programs ?? programs.length })}</div>
              </div>
              <div className="mt-divider" />
            </div>
            {progBySpecialtyDonut.length ? <DonutChart items={progBySpecialtyDonut} cap={t('capPrograms')} /> : emptyMsg}
          </RevealOnScroll>

          <RevealOnScroll chart className="mt-card mt-card--chart hoc-chart" delay={0.12}>
            <div className="mt-card-head">
              <div style={{ minWidth: 0 }}>
                <div className="mt-card-title">{t('topCenters')}</div>
                <div className="mt-card-sub">{t('topCentersSub')}</div>
              </div>
              <div className="mt-divider" />
            </div>
            {topCenters.length ? <BarChart items={topCenters} /> : emptyMsg}
          </RevealOnScroll>
        </div>
      </main>
      <MtToastHost toasts={toasts} />
    </>
  );
}
