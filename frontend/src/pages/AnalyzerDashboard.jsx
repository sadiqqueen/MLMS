// frontend/src/pages/AnalyzerDashboard.jsx
//
// Data Analyzer's filterable dashboard over the advanced track. Three toolbar
// filters — country (SearchableSelect), city (exact match, applied on
// Enter/blur), specialty (SearchableSelect) — narrow a set of aggregate counts.
// Contract: GET /api/analyzer/stats?countryId=&city=&specialtyId= →
//   { success, data: { trainees, trainers, programDirectors, dios, odios,
//                       centers, programs, specialties, countries } }
// The country dropdown is fed by GET /api/countries (any-auth). The specialty
// dropdown is fed by GET /api/specialties, which is NOT granted to data_analyzer
// in the backend READ_ROLES — so on 403 the specialty filter is hidden.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import SearchableSelect from '../components/SearchableSelect';
import Sk from '../components/Skeleton';
import api from '../api/axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title);

const STRINGS = {
  ar: {
    title: 'لوحة تحليل البيانات',
    allCountries: 'كل الدول', allSpecialties: 'كل الاختصاصات',
    cityPh: 'المدينة (اضغط Enter)', clear: 'مسح الفلاتر',
    chartTitle: 'نظرة عامة على الأعداد', counts: 'الأعداد',
    trainees: 'المتدربون', trainers: 'المدربون', programDirectors: 'مديرو البرامج',
    dios: 'DIOs', odios: 'ODIOs', centers: 'المراكز', programs: 'البرامج',
    specialties: 'الاختصاصات', countries: 'الدول',
    loadFailed: 'فشل تحميل الإحصاءات',
  },
  en: {
    title: 'Analytics Dashboard',
    allCountries: 'All countries', allSpecialties: 'All specialties',
    cityPh: 'City (press Enter)', clear: 'Clear filters',
    chartTitle: 'Counts overview', counts: 'Counts',
    trainees: 'Trainees', trainers: 'Trainers', programDirectors: 'Program Directors',
    dios: 'DIOs', odios: 'ODIOs', centers: 'Centers', programs: 'Programs',
    specialties: 'Specialties', countries: 'Countries',
    loadFailed: 'Failed to load statistics',
  },
};

// key → { icon, cls } (label resolves via STRINGS[key]).
const STAT_CARDS = [
  { key: 'trainees',         icon: '🎓', cls: 'icon-purple' },
  { key: 'trainers',         icon: '👨‍🏫', cls: 'icon-green'  },
  { key: 'programDirectors', icon: '🧑‍💼', cls: 'icon-blue'   },
  { key: 'dios',             icon: '🏛️', cls: 'icon-orange' },
  { key: 'odios',            icon: '🗂️', cls: 'icon-pink'   },
  { key: 'centers',          icon: '🏥', cls: 'icon-teal'   },
  { key: 'programs',         icon: '📚', cls: 'icon-purple' },
  { key: 'specialties',      icon: '🔬', cls: 'icon-green'  },
  { key: 'countries',        icon: '🌍', cls: 'icon-blue'   },
];

// Which counts feed the bar chart (the primary entities).
const CHART_KEYS = ['trainees', 'trainers', 'programDirectors', 'dios', 'odios', 'centers', 'programs'];

export default function AnalyzerDashboard() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [err, setErr] = useState('');

  const [countries, setCountries] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [specialtyAvailable, setSpecialtyAvailable] = useState(true);

  // Applied filters (drive the stats fetch).
  const [countryId, setCountryId] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [city, setCity] = useState('');
  // City is typed here but only applied (→ setCity) on Enter/blur, because the
  // backend matches city with an exact case-insensitive regex.
  const [cityInput, setCityInput] = useState('');

  // Load filter sources once. Specialties may 403 for data_analyzer.
  useEffect(() => {
    let cancelled = false;
    api.get('/api/countries')
      .then(r => { if (!cancelled) setCountries(r.data?.data || r.data || []); })
      .catch(() => { if (!cancelled) setCountries([]); });
    api.get('/api/specialties')
      .then(r => { if (!cancelled) { setSpecialties(r.data?.data || r.data || []); setSpecialtyAvailable(true); } })
      .catch(e => {
        if (cancelled) return;
        if (e.response?.status === 403) setSpecialtyAvailable(false);
        setSpecialties([]);
      });
    return () => { cancelled = true; };
  }, []);

  const fetchStats = useCallback(async (isFirst) => {
    if (isFirst) setLoading(true); else setRefetching(true);
    setErr('');
    try {
      const params = {};
      if (countryId) params.countryId = countryId;
      if (city) params.city = city;
      if (specialtyId) params.specialtyId = specialtyId;
      const r = await api.get('/api/analyzer/stats', { params, cache: false });
      setStats(r.data?.data || r.data || null);
    } catch {
      setErr(t('loadFailed'));
    } finally {
      setLoading(false); setRefetching(false);
    }
  }, [countryId, city, specialtyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // First load shows the skeleton; later filter-driven refetches just dim.
  const firstLoaded = useRef(false);
  useEffect(() => {
    fetchStats(!firstLoaded.current);
    firstLoaded.current = true;
  }, [fetchStats]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyCity() {
    const v = cityInput.trim();
    if (v !== city) setCity(v);
  }

  function clearFilters() {
    setCountryId(''); setSpecialtyId(''); setCity(''); setCityInput('');
  }

  const countryOptions = [{ value: '', label: t('allCountries') }, ...countries.map(c => ({ value: c._id, label: `${c.name} (${c.code})` }))];
  const specialtyOptions = [{ value: '', label: t('allSpecialties') }, ...specialties.map(s => ({ value: s._id, label: s.name }))];

  const barData = stats ? {
    labels: CHART_KEYS.map(k => t(k)),
    datasets: [{
      label: t('counts'),
      data: CHART_KEYS.map(k => stats[k] ?? 0),
      backgroundColor: '#185FA5',
      borderRadius: 6,
    }],
  } : null;

  const barOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: '#f0f2f5' } },
      x: { grid: { display: false } },
    },
  };

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card" style={{ marginBottom: 16 }}>
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /><Sk h={36} r={8} style={{ flex: 1 }} /><Sk h={36} r={8} style={{ flex: 1 }} /></div>
        </div>
        <div className="stat-cards-grid">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="stat-card">
              <Sk w={46} h={46} r={10} />
              <div className="stat-info" style={{ flex: 1 }}><Sk w="55%" h={24} style={{ marginBottom: 8 }} /><Sk w="75%" h={11} /></div>
            </div>
          ))}
        </div>
        <div className="charts-row"><div className="chart-card"><Sk w="40%" h={16} style={{ marginBottom: 16 }} /><Sk h={220} r={8} /></div></div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>

        {/* ── FILTERS ── */}
        <div className="admin-card" style={{ marginBottom: 16 }}>
          <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <SearchableSelect value={countryId} onChange={setCountryId} options={countryOptions} placeholder={t('allCountries')} />
            </div>
            <input
              className="admin-search"
              style={{ flex: 1, minWidth: 160 }}
              placeholder={t('cityPh')}
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyCity(); }}
              onBlur={applyCity}
            />
            {specialtyAvailable && (
              <div style={{ flex: 1, minWidth: 180 }}>
                <SearchableSelect value={specialtyId} onChange={setSpecialtyId} options={specialtyOptions} placeholder={t('allSpecialties')} />
              </div>
            )}
            {(countryId || specialtyId || city) && (
              <button className="btn-outline" onClick={clearFilters}>{t('clear')}</button>
            )}
          </div>
          {err && (
            <div style={{ marginTop: 12, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{err}</div>
          )}
        </div>

        {/* ── STAT CARDS ── */}
        <div className="stat-cards-grid" style={{ opacity: refetching ? 0.6 : 1 }}>
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

        {/* ── CHART ── */}
        <div className="charts-row">
          <div className="chart-card" style={{ opacity: refetching ? 0.6 : 1 }}>
            <div className="chart-card-title">{t('chartTitle')}</div>
            <div className="chart-wrap">
              {barData ? <Bar data={barData} options={barOptions} /> : <div className="admin-empty">—</div>}
            </div>
          </div>
        </div>

      </main>
    </>
  );
}
