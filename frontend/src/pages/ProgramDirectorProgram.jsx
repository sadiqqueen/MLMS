// frontend/src/pages/ProgramDirectorProgram.jsx
//
// Program Director / Sub-PD full program card: all accreditation fields, computed
// status, capacity usage and dates. Same endpoint as the PD dashboard.
// Contract: GET /api/program-director/stats → { program, counts }.
// 403 / 'No program assigned' → friendly empty state.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccreditationBadge from '../components/AccreditationBadge';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    pd: 'مدير البرنامج', center: 'المركز', country: 'الدولة', specialty: 'الاختصاص',
    accType: 'نوع الاعتماد', partly: 'جزئي (سنتان)', fully: 'كامل (6 سنوات)',
    accNo: 'رقم اعتماد البرنامج', accGrant: 'تاريخ منح الاعتماد', accExpiry: 'تاريخ الانتهاء',
    capacity: 'الطاقة السنوية', capacityUsed: 'المستخدم', trainingStart: 'تاريخ بدء التدريب', renewal: 'تاريخ طلب التجديد',
    withdrawn: 'الاعتماد مسحوب', yes: 'نعم', no: 'لا',
    noProgram: 'لا يوجد برنامج مسند إلى حسابك بعد.', loadFailed: 'فشل تحميل البيانات',
  },
  en: {
    pd: 'Program Director', center: 'Center', country: 'Country', specialty: 'Specialty',
    accType: 'Accreditation Type', partly: 'Partly (2 years)', fully: 'Fully (6 years)',
    accNo: 'Program Accreditation No.', accGrant: 'Grant Date', accExpiry: 'Expiry',
    capacity: 'Yearly Capacity', capacityUsed: 'Used', trainingStart: 'Training Start Date', renewal: 'Renewal Application Date',
    withdrawn: 'Accreditation withdrawn', yes: 'Yes', no: 'No',
    noProgram: 'No program is assigned to your account yet.', loadFailed: 'Failed to load data',
  },
};

function fmtDate(v) { return v ? new Date(v).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

export default function ProgramDirectorProgram() {
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
        <div className="admin-card" style={{ padding: 20 }}><Sk w={240} h={22} /><div style={{ height: 14 }} /><Sk w="70%" h={14} /><div style={{ height: 10 }} /><Sk w="55%" h={14} /></div>
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
  const country = p.trainingCenterId?.countryId;

  const rows = [
    [t('pd'), p.programDirectorId?.name || '—'],
    [t('center'), p.trainingCenterId?.name ? `${p.trainingCenterId.name}${p.trainingCenterId.city ? ` · ${p.trainingCenterId.city}` : ''}` : '—'],
    [t('country'), country?.name ? `${country.name}${country.code ? ` (${country.code})` : ''}` : '—'],
    [t('specialty'), p.specialtyId?.name || '—'],
    [t('accType'), p.accreditationType === 'fully' ? t('fully') : t('partly')],
    [t('accNo'), p.accreditationNumber || '—'],
    [t('accGrant'), fmtDate(p.accreditationGrantDate)],
    [t('accExpiry'), fmtDate(p.accreditationExpiry)],
    [t('capacity'), p.yearlyCapacity ?? '—'],
    [t('capacityUsed'), `${c.capacityUsed ?? 0} / ${c.yearlyCapacity ?? p.yearlyCapacity ?? 0}`],
    [t('trainingStart'), fmtDate(p.trainingStartDate)],
    [t('renewal'), fmtDate(p.renewalApplicationDate)],
    [t('withdrawn'), p.accreditationWithdrawn ? t('yes') : t('no')],
  ];

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-secondary)' }}>{p.name}</div>
            <AccreditationBadge status={p.accreditationStatus} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px 18px' }}>
            {rows.map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--brand-secondary)', fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
