// frontend/src/pages/DioViewDashboard.jsx
//
// DIO (dio_view) + Sub-DIO (sub_dio) oversight dashboard — read-only stat cards
// scoped to the caller's assigned training-center set.
// Contract: GET /api/dio-view/stats →
//   { centers, programs, trainees, trainers, programDirectors, certificates }
// A center-scoped caller with no centers gets a 403 → friendly empty state.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    centers: 'المراكز', programs: 'البرامج', trainees: 'المتدربون',
    trainers: 'المدربون', programDirectors: 'مدراء البرامج', certificates: 'الشهادات',
    noCenters: 'لا توجد مراكز مسندة إلى حسابك بعد.', loadFailed: 'فشل تحميل الإحصاءات',
  },
  en: {
    centers: 'Centers', programs: 'Programs', trainees: 'Trainees',
    trainers: 'Trainers', programDirectors: 'Program Directors', certificates: 'Certificates',
    noCenters: 'No centers are assigned to your account yet.', loadFailed: 'Failed to load statistics',
  },
};

const STAT_CARDS = [
  { key: 'centers',          icon: '🏥', cls: 'icon-teal' },
  { key: 'programs',         icon: '📚', cls: 'icon-purple' },
  { key: 'trainees',         icon: '🎓', cls: 'icon-green' },
  { key: 'trainers',         icon: '👨‍🏫', cls: 'icon-blue' },
  { key: 'programDirectors', icon: '🧑‍💼', cls: 'icon-orange' },
  { key: 'certificates',     icon: '🏆', cls: 'icon-pink' },
];

export default function DioViewDashboard() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noCenters, setNoCenters] = useState(false);

  useEffect(() => {
    api.get('/api/dio-view/stats', { cache: false })
      .then(r => setStats(r.data?.data || r.data || null))
      .catch(err => { if (err.response?.status === 403) setNoCenters(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="stat-cards-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card">
              <Sk w={46} h={46} r={10} />
              <div className="stat-info" style={{ flex: 1 }}><Sk w="55%" h={24} style={{ marginBottom: 8 }} /><Sk w="75%" h={11} /></div>
            </div>
          ))}
        </div>
      </main>
    </>
  );

  if (noCenters) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-empty" style={{ padding: 56, textAlign: 'center' }}>{t('noCenters')}</div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="stat-cards-grid">
          {STAT_CARDS.map(card => (
            <div className="stat-card" key={card.key}>
              <div className={`stat-icon ${card.cls}`}>{card.icon}</div>
              <div className="stat-info">
                <div className="stat-value">{stats?.[card.key] ?? 0}</div>
                <div className="stat-label">{t(card.key)}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
