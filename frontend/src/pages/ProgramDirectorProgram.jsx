// frontend/src/pages/ProgramDirectorProgram.jsx
//
// Program Director / Sub-PD "My Program" — a read-only facts table of the PD's
// single program (lists_views.md §PD my-program), restyled to the mt- system.
// Same endpoint as the dashboard. Read-only for PD and Sub-PD alike.
//   GET /api/program-director/stats → { program, counts }
// 403 / "No program assigned" → friendly empty state.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import AccreditationBadge from '../components/AccreditationBadge';
import api from '../api/axios';
import './pd.css';

const STRINGS = {
  ar: {
    program: 'البرنامج', programNo: 'رقم البرنامج', center: 'المركز', country: 'الدولة', specialty: 'الاختصاص',
    pd: 'مدير البرنامج', dio: 'DIO', subPd: 'نائب مدير البرنامج',
    accType: 'نوع الاعتماد', partly: 'جزئي (سنتان)', fully: 'كامل (٦ سنوات)',
    accNo: 'رقم الاعتماد', accGrant: 'تاريخ منح الاعتماد', accExpiry: 'تاريخ الانتهاء',
    capacity: 'الطاقة السنوية', duration: 'المدة', years: 'سنوات', trainingStart: 'بداية التدريب', renewal: 'تاريخ طلب التجديد',
    withdrawn: 'الاعتماد مسحوب', yes: 'نعم', no: 'لا', field: 'الحقل', value: 'القيمة',
    noProgram: 'لا يوجد برنامج مسند إلى حسابك بعد.',
  },
  en: {
    program: 'Program', programNo: 'Program No.', center: 'Center', country: 'Country', specialty: 'Specialty',
    pd: 'Program Director', dio: 'DIO', subPd: 'Sub-PD',
    accType: 'Accreditation Type', partly: 'Partly (2 years)', fully: 'Fully (6 years)',
    accNo: 'Accreditation No.', accGrant: 'Grant Date', accExpiry: 'Expiry',
    capacity: 'Yearly Capacity', duration: 'Duration', years: 'years', trainingStart: 'Training Start', renewal: 'Renewal Application',
    withdrawn: 'Accreditation withdrawn', yes: 'Yes', no: 'No', field: 'Field', value: 'Value',
    noProgram: 'No program is assigned to your account yet.',
  },
};

function fmtDate(v) { return v ? new Date(v).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

export default function ProgramDirectorProgram() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noProgram, setNoProgram] = useState(false);

  useEffect(() => {
    api.get('/api/program-director/stats', { cache: false })
      .then((r) => setData(r.data?.data || r.data || null))
      .catch((err) => { if (err.response?.status === 403) setNoProgram(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content"><MtSkeleton stats={0} charts={0} table /></main>
    </>
  );

  if (noProgram || !data?.program) return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-empty" style={{ padding: 56 }}><div className="mt-empty-title">{t('noProgram')}</div></div>
      </main>
    </>
  );

  const p = data.program;
  const c = data.counts || {};
  const country = p.trainingCenterId?.countryId;

  // Field / value rows (mono flag renders the value in the mono ID style).
  const rows = [
    { label: t('program'), value: p.name },
    { label: t('programNo'), value: p.accreditationNumber || '—', mono: true },
    { label: t('center'), value: p.trainingCenterId?.name ? `${p.trainingCenterId.name}${p.trainingCenterId.city ? ` · ${p.trainingCenterId.city}` : ''}` : '—' },
    { label: t('country'), value: country?.name ? `${country.name}${country.code ? ` (${country.code})` : ''}` : '—' },
    { label: t('specialty'), value: p.specialtyId?.name || '—' },
    { label: t('pd'), value: p.programDirectorId?.name || '—' },
    { label: t('odio'), value: p.trainingCenterId?.dioId?.name || '—' },
    { label: t('subPd'), value: p.subProgramDirectorId?.name || '—' },
    { label: t('capacity'), value: `${c.capacityUsed ?? 0} / ${c.yearlyCapacity ?? p.yearlyCapacity ?? 0}` },
    { label: t('duration'), value: p.durationYears ? `${p.durationYears} ${t('years')}` : '—' },
    { label: t('accType'), value: p.accreditationType === 'fully' ? t('fully') : p.accreditationType === 'partly' ? t('partly') : '—' },
    { label: t('accNo'), value: p.accreditationNumber || '—', mono: true },
    { label: t('accGrant'), value: fmtDate(p.accreditationGrantDate) },
    { label: t('accExpiry'), value: fmtDate(p.accreditationExpiry) },
    { label: t('trainingStart'), value: fmtDate(p.trainingStartDate) },
    { label: t('renewal'), value: fmtDate(p.renewalApplicationDate) },
    { label: t('withdrawn'), value: p.accreditationWithdrawn ? t('yes') : t('no') },
  ];

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <RevealOnScroll className="mt-card">
          <div className="pd-prog">
            <div className="pd-prog-name">{p.name}</div>
            <AccreditationBadge status={p.accreditationStatus} />
          </div>
          <div className="mt-table-wrap">
            <table className="mt-table mt-table--stack" style={{ minWidth: 0 }}>
              <thead>
                <tr><th className="mt-th">{t('field')}</th><th className="mt-th">{t('value')}</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td className="mt-td mt-td--name" data-label={t('field')}>{r.label}</td>
                    <td className={`mt-td${r.mono ? ' mt-td--mono' : ''}`} data-label={t('value')}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>
      </main>
    </>
  );
}
