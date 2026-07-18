// frontend/src/pages/ProgramDirectorDashboard.jsx
//
// Program Director / Sub-PD dashboard for the PD's ONE program: a program header
// card + stat cards. A Sub-PD mirrors its PD.
// Contract: GET /api/program-director/stats →
//   { program: {..withAccreditation, trainingCenterId, specialtyId, programDirectorId},
//     counts: { trainees, trainers, pendingFinalReports, evaluationsAuthored,
//               capacityUsed, yearlyCapacity } }
// 403 / 'No program assigned' → friendly empty state.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccreditationBadge from '../components/AccreditationBadge';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    center: 'المركز', specialty: 'الاختصاص', capacity: 'الطاقة', trainingStart: 'بداية التدريب',
    trainees: 'المتدربون', trainers: 'المدربون', pendingFinalReports: 'تقارير نهائية معلّقة', evaluationsAuthored: 'التقييمات المُنشأة',
    noProgram: 'لا يوجد برنامج مسند إلى حسابك بعد.', loadFailed: 'فشل تحميل البيانات',
  },
  en: {
    center: 'Center', specialty: 'Specialty', capacity: 'Capacity', trainingStart: 'Training Start',
    trainees: 'Trainees', trainers: 'Trainers', pendingFinalReports: 'Pending Final Reports', evaluationsAuthored: 'Evaluations Authored',
    noProgram: 'No program is assigned to your account yet.', loadFailed: 'Failed to load data',
  },
};

const STAT_CARDS = [
  { key: 'trainees',            icon: '🎓', cls: 'icon-green' },
  { key: 'trainers',            icon: '👨‍🏫', cls: 'icon-blue' },
  { key: 'pendingFinalReports', icon: '📄', cls: 'icon-orange' },
  { key: 'evaluationsAuthored', icon: '📝', cls: 'icon-purple' },
];

function fmtDate(v) { return v ? new Date(v).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

export default function ProgramDirectorDashboard() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noProgram, setNoProgram] = useState(false);

  useEffect(() => {
    api.get('/api/program-director/stats', { cache: false })
      .then(r => setData(r.data?.data || r.data || null))
      .catch(err => { if (err.response?.status === 403) setNoProgram(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card" style={{ padding: 20, marginBottom: 16 }}><Sk w={220} h={22} /><div style={{ height: 12 }} /><Sk w="60%" h={14} /></div>
        <div className="stat-cards-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card"><Sk w={46} h={46} r={10} /><div className="stat-info" style={{ flex: 1 }}><Sk w="55%" h={24} style={{ marginBottom: 8 }} /><Sk w="75%" h={11} /></div></div>
          ))}
        </div>
      </main>
    </>
  );

  if (noProgram || !data?.program) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-empty" style={{ padding: 56, textAlign: 'center' }}>{t('noProgram')}</div>
      </main>
    </>
  );

  const p = data.program;
  const c = data.counts || {};

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        {/* Program header card */}
        <div className="admin-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-secondary)' }}>{p.name}</div>
            <AccreditationBadge status={p.accreditationStatus} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px 18px' }}>
            {[
              [t('center'), p.trainingCenterId?.name ? `${p.trainingCenterId.name}${p.trainingCenterId.city ? ` · ${p.trainingCenterId.city}` : ''}` : '—'],
              [t('specialty'), p.specialtyId?.name || '—'],
              [t('capacity'), `${c.capacityUsed ?? 0} / ${c.yearlyCapacity ?? p.yearlyCapacity ?? 0}`],
              [t('trainingStart'), fmtDate(p.trainingStartDate)],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--brand-secondary)', fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="stat-cards-grid">
          {STAT_CARDS.map(card => (
            <div className="stat-card" key={card.key}>
              <div className={`stat-icon ${card.cls}`}>{card.icon}</div>
              <div className="stat-info">
                <div className="stat-value">{c[card.key] ?? 0}</div>
                <div className="stat-label">{t(card.key)}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
