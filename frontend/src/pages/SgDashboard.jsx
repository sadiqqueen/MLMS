// frontend/src/pages/SgDashboard.jsx
//
// Secretary General / Assistant Secretary read-only overview. Aggregate stat
// cards over the advanced track (no filters this phase).
// Contract: GET /api/sg/stats →
//   { trainees, trainers, programDirectors, dios, odios, centers, programs,
//     specialties, countries }
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    trainees: 'المتدربون', trainers: 'المدربون', programDirectors: 'مدراء البرامج',
    dios: 'DIOs', odios: 'ODIOs', centers: 'المراكز', programs: 'البرامج',
    specialties: 'الاختصاصات', countries: 'الدول', loadFailed: 'فشل تحميل الإحصاءات',
  },
  en: {
    trainees: 'Trainees', trainers: 'Trainers', programDirectors: 'Program Directors',
    dios: 'DIOs', odios: 'ODIOs', centers: 'Centers', programs: 'Programs',
    specialties: 'Specialties', countries: 'Countries', loadFailed: 'Failed to load statistics',
  },
};

const STAT_CARDS = [
  { key: 'trainees',         icon: '🎓', cls: 'icon-green' },
  { key: 'trainers',         icon: '👨‍🏫', cls: 'icon-blue' },
  { key: 'programDirectors', icon: '🧑‍💼', cls: 'icon-orange' },
  { key: 'dios',             icon: '🏛️', cls: 'icon-purple' },
  { key: 'odios',            icon: '🗂️', cls: 'icon-pink' },
  { key: 'centers',          icon: '🏥', cls: 'icon-teal' },
  { key: 'programs',         icon: '📚', cls: 'icon-purple' },
  { key: 'specialties',      icon: '🔬', cls: 'icon-green' },
  { key: 'countries',        icon: '🌍', cls: 'icon-blue' },
];

export default function SgDashboard() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/sg/stats', { cache: false })
      .then(r => setStats(r.data?.data || r.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="stat-cards-grid">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="stat-card">
              <Sk w={46} h={46} r={10} />
              <div className="stat-info" style={{ flex: 1 }}><Sk w="55%" h={24} style={{ marginBottom: 8 }} /><Sk w="75%" h={11} /></div>
            </div>
          ))}
        </div>
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
