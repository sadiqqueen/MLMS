// frontend/src/pages/DioViewDashboard.jsx
//
// DIO (dio_view) + Sub-DIO (sub_dio) oversight dashboard — restyled to the mt-
// design (dashboards.md §4.8). Four stat cards + a "Trainee intake" line and a
// "Trainees by program" bar chart, both DERIVED from real data — no invented
// API shapes, no faked numbers (RULINGS §34).
//
// Wiring (existing endpoints, unchanged):
//   GET /api/dio-view/stats    → { centers, programs, trainees, trainers,
//                                  programDirectors, certificates } (counts)
//   GET /api/dio-view/trainees → trainees (programId populated, trainingYear +
//                                createdAt) → the two derived charts
//
// A center-scoped caller with no centers gets a 403 → friendly empty state.
// The design's 4th stat ("Active rotations") has no source on /stats, so the
// real "Programs" count is shown in its place (see report QUESTIONS).
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconBuilding } from '../components/icons';
import api from '../api/axios';
import './dioview.css';

const STRINGS = {
  ar: {
    centers: 'مراكز التدريب', programDirectors: 'مدراء البرامج', trainees: 'المتدربون', programs: 'البرامج',
    lineTitle: 'التحاق المتدربين', lineSub: 'شهريًا · مراكزي',
    barTitle: 'المتدربون حسب البرنامج', barSub: 'مراكزي',
    noCenters: 'لا توجد مراكز مسندة إلى حسابك بعد.',
    noCentersSub: 'ستظهر الإحصاءات هنا بمجرد إسناد مركز تدريبي إلى حسابك.',
    loadFailed: 'فشل تحميل الإحصاءات',
  },
  en: {
    centers: 'Training Centers', programDirectors: 'Program Directors', trainees: 'Trainees', programs: 'Programs',
    lineTitle: 'Trainee intake', lineSub: 'Monthly · my centers',
    barTitle: 'Trainees by program', barSub: 'My centers',
    noCenters: 'No centers are assigned to your account yet.',
    noCentersSub: 'Statistics appear here once a training center is assigned to your account.',
    loadFailed: 'Failed to load statistics',
  },
};

// The four stats the DIO dashboard features (dashboards.md §4.8). "Active
// rotations" has no /stats source → the real "Programs" count stands in.
const STAT_CARDS = [
  { key: 'centers',          icon: 'building' },
  { key: 'programDirectors', icon: 'users'    },
  { key: 'trainees',         icon: 'grad'     },
  { key: 'programs',         icon: 'layers'   },
];

// Count trainees per program name → [{ l, v }] sorted high→low, top 6.
function traineesByProgram(trainees) {
  const m = new Map();
  trainees.forEach((tr) => {
    const name = tr.programId?.name;
    if (!name) return;
    m.set(name, (m.get(name) || 0) + 1);
  });
  return [...m.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 6);
}

// Bucket trainee account-creation dates into the last 12 months (oldest→newest).
function monthlyIntake(trainees) {
  const now = new Date();
  const buckets = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }), v: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  trainees.forEach((tr) => {
    if (!tr.createdAt) return;
    const c = new Date(tr.createdAt);
    if (Number.isNaN(c.getTime())) return;
    const k = `${c.getFullYear()}-${c.getMonth()}`;
    if (idx.has(k)) buckets[idx.get(k)].v += 1;
  });
  return buckets;
}

export default function DioViewDashboard() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [stats, setStats] = useState(null);
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noCenters, setNoCenters] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.get('/api/dio-view/stats', { cache: false }),
      api.get('/api/dio-view/trainees'),
    ]).then(([s, tr]) => {
      if (!alive) return;
      if (s.status === 'fulfilled') {
        setStats(s.value.data?.data || s.value.data || null);
      } else if (s.reason?.response?.status === 403) {
        setNoCenters(true);
      } else {
        showToast(t('loadFailed'), 'dng');
      }
      if (tr.status === 'fulfilled') setTrainees(tr.value.data?.data || tr.value.data || []);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byProgram = traineesByProgram(trainees);
  const intake = monthlyIntake(trainees);
  const intakeHasData = intake.some((b) => b.v > 0);

  if (noCenters) {
    return (
      <>
        <Navbar />
        <main className="mt-content" dir={dir}>
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconBuilding size={22} /></div>
            <div className="mt-empty-title">{t('noCenters')}</div>
            <div className="mt-empty-sub">{t('noCentersSub')}</div>
          </div>
          <MtToastHost toasts={toasts} />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        {loading ? (
          <MtSkeleton stats={4} charts={2} table={false} />
        ) : (
          <>
            <div className="mt-stat-grid">
              {STAT_CARDS.map((c, i) => (
                <RevealOnScroll key={c.key} delay={i * 0.055}>
                  <StatCard label={t(c.key)} value={stats?.[c.key] ?? 0} icon={c.icon} />
                </RevealOnScroll>
              ))}
            </div>

            {(intakeHasData || byProgram.length > 0) && (
              <div className="dioview-charts">
                {intakeHasData && (
                  <RevealOnScroll as="section" chart className="mt-card mt-card--chart" delay={0.08}>
                    <div className="mt-card-head">
                      <div>
                        <div className="mt-card-title">{t('lineTitle')}</div>
                        <div className="mt-card-sub">{t('lineSub')}</div>
                      </div>
                      <div className="mt-divider" />
                    </div>
                    <LineChart values={intake.map((b) => b.v)} labels={intake.map((b) => b.label)} />
                  </RevealOnScroll>
                )}
                {byProgram.length > 0 && (
                  <RevealOnScroll as="section" chart className="mt-card mt-card--chart" delay={0.1}>
                    <div className="mt-card-head">
                      <div>
                        <div className="mt-card-title">{t('barTitle')}</div>
                        <div className="mt-card-sub">{t('barSub')}</div>
                      </div>
                      <div className="mt-divider" />
                    </div>
                    <BarChart items={byProgram} />
                  </RevealOnScroll>
                )}
              </div>
            )}
          </>
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
