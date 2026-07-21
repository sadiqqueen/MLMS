// frontend/src/pages/RegistryCenterDetail.jsx
//
// One training center + its programs (design clerk drill leaf). mt- header card,
// a n/100 CapacityBar, and the programs table. "+ Add program" is a direct
// create, blocked with an at-capacity chip once the center hits 100 programs.
// Editing a program routes through the analyzer approval flow (book-of-changes).
// Contract: GET /api/registry/centers/:id, /api/registry/specialties,
// /api/registry/users?role=program_director|sub_pd; POST /api/programs.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Breadcrumb from '../components/Breadcrumb';
import CapacityBar from '../components/CapacityBar';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconEdit } from '../components/icons';
import {
  AddProgramModal, ApprovalModal, normId, refName, fmtDate, toDateInput, histLine, useCanWriteRegistry,
} from './registryShared';
import api from '../api/axios';
import './registry.css';

const CAP = 100;
const STR = {
  ar: {
    centers: 'المراكز التدريبية', back: 'رجوع', notFound: 'المركز غير موجود',
    country: 'الدولة', city: 'المدينة', address: 'العنوان', email: 'البريد الإلكتروني', phone: 'الهاتف',
    idNumber: 'المعرّف', accId: 'رقم الاعتماد', accDate: 'تاريخ منح الاعتماد', accExpiry: 'انتهاء الاعتماد',
    programs: 'البرامج', addProgram: 'إضافة برنامج', atCapacity: 'المركز مكتمل — 100 / 100',
    cName: 'البرنامج', cId: 'المعرّف', cSpecialty: 'الاختصاص', cPd: 'المدير', cCapacity: 'الطاقة', cDuration: 'المدة',
    noPrograms: 'لا توجد برامج بعد.', edit: 'تعديل', editRecord: 'تعديل البرنامج', perYr: '/ سنة', yrs: 'سنوات',
    created: 'تمت إضافة البرنامج', submitted: 'أُرسل للموافقة', loadFailed: 'فشل التحميل',
    approvalNote: 'تعديل أي سجل يفتح تدفّق الموافقة — تتطلب التغييرات موافقة محلل البيانات قبل أن تُطبّق.',
    changeHistory: 'سجل التغييرات',
    name: 'الاسم', specialty: 'الاختصاص', pd: 'المدير', subPd: 'النائب', capacity: 'الطاقة السنوية', duration: 'المدة (سنوات)',
    accType: 'نوع الاعتماد', partly: 'جزئي', fully: 'كامل', withdrawn: 'الاعتماد مسحوب', trainingStart: 'بدء التدريب', renewal: 'التجديد',
  },
  en: {
    centers: 'Training Centers', back: 'Back', notFound: 'Training center not found',
    country: 'Country', city: 'City', address: 'Address', email: 'Email', phone: 'Phone',
    idNumber: 'ID', accId: 'Accreditation ID', accDate: 'Accreditation grant date', accExpiry: 'Accreditation expiry',
    programs: 'Programs', addProgram: 'Add program', atCapacity: 'Center at capacity — 100 / 100',
    cName: 'Program', cId: 'ID', cSpecialty: 'Specialty', cPd: 'PD', cCapacity: 'Capacity', cDuration: 'Duration',
    noPrograms: 'No programs yet.', edit: 'Edit', editRecord: 'Edit program', perYr: '/ yr', yrs: 'yrs',
    created: 'Program added', submitted: 'Submitted for approval', loadFailed: 'Failed to load',
    approvalNote: 'Editing any record opens the edit-with-approval flow — changes require Data Analyzer approval before taking effect.',
    changeHistory: 'Change history',
    name: 'Name', specialty: 'Specialty', pd: 'Program Director', subPd: 'Sub-PD', capacity: 'Yearly capacity', duration: 'Duration (years)',
    accType: 'Accreditation type', partly: 'Partly', fully: 'Fully', withdrawn: 'Accreditation withdrawn', trainingStart: 'Training start', renewal: 'Renewal date',
  },
};

export default function RegistryCenterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang } = usePrefs();
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [center, setCenter] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [pds, setPds] = useState([]);
  const [subPds, setSubPds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const canWrite = useCanWriteRegistry();

  const load = useCallback(async () => {
    setLoading(true); setNotFound(false);
    const [c, sp, pd, subpd] = await Promise.allSettled([
      api.get(`/api/registry/centers/${id}`),
      api.get('/api/registry/specialties'),
      api.get('/api/registry/users', { params: { role: 'program_director' } }),
      api.get('/api/registry/users', { params: { role: 'sub_pd' } }),
    ]);
    if (c.status === 'fulfilled') setCenter(c.value.data?.data || c.value.data || null);
    else { setNotFound(true); showToast(t('loadFailed'), 'dng'); }
    if (sp.status === 'fulfilled') setSpecialties(sp.value.data?.data || sp.value.data || []);
    if (pd.status === 'fulfilled') setPds(pd.value.data?.data || pd.value.data || []);
    if (subpd.status === 'fulfilled') setSubPds(subpd.value.data?.data || subpd.value.data || []);
    setLoading(false);
  }, [id, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const pdOpts = pds.map((p) => ({ value: p._id, label: p.name }));
  const subPdOpts = subPds.map((p) => ({ value: p._id, label: p.name }));
  const specialtyOpts = specialties.map((s) => ({ value: s._id, label: s.name }));

  function editFields() {
    return [
      { key: 'name', label: t('name'), type: 'text', full: true },
      { key: 'specialtyId', label: t('specialty'), type: 'select', options: specialtyOpts, full: true },
      { key: 'programDirectorId', label: t('pd'), type: 'select', options: pdOpts, full: true },
      { key: 'subProgramDirectorId', label: t('subPd'), type: 'select', options: subPdOpts, full: true },
      { key: 'yearlyCapacity', label: t('capacity'), type: 'number' },
      { key: 'durationYears', label: t('duration'), type: 'number' },
      { key: 'accreditationType', label: t('accType'), type: 'select', options: [{ value: 'partly', label: t('partly') }, { value: 'fully', label: t('fully') }] },
      { key: 'accreditationGrantDate', label: t('accDate'), type: 'date' },
      { key: 'accreditationNumber', label: t('accId'), type: 'text', mono: true },
      { key: 'trainingStartDate', label: t('trainingStart'), type: 'date' },
      { key: 'renewalApplicationDate', label: t('renewal'), type: 'date' },
      { key: 'accreditationWithdrawn', label: t('withdrawn'), type: 'checkbox', full: true },
    ];
  }
  function editInitial(p) {
    return {
      name: p.name || '', specialtyId: normId(p.specialtyId), programDirectorId: normId(p.programDirectorId),
      subProgramDirectorId: normId(p.subProgramDirectorId), yearlyCapacity: p.yearlyCapacity ?? '',
      durationYears: p.durationYears ?? '', accreditationType: p.accreditationType || '',
      accreditationGrantDate: toDateInput(p.accreditationGrantDate), accreditationNumber: p.accreditationNumber || '',
      trainingStartDate: toDateInput(p.trainingStartDate), renewalApplicationDate: toDateInput(p.renewalApplicationDate),
      accreditationWithdrawn: !!p.accreditationWithdrawn,
    };
  }

  const crumbs = (
    <Breadcrumb items={[
      { label: t('centers'), onClick: () => navigate('/registry/centers') },
      { label: center?.name || t('back') },
    ]} />
  );

  if (loading) {
    return (
      <>
        <Navbar title={t('centers')} />
        <main className="mt-content" dir={dir}>
          {crumbs}
          <div className="skeleton mt-skel" style={{ height: 150, marginBlockEnd: 16 }} />
          <div className="skeleton mt-skel" style={{ height: 240 }} />
        </main>
      </>
    );
  }

  if (notFound || !center) {
    return (
      <>
        <Navbar title={t('centers')} />
        <main className="mt-content" dir={dir}>
          {crumbs}
          <div className="mt-empty"><div className="mt-empty-title">{t('notFound')}</div></div>
        </main>
      </>
    );
  }

  const programs = center.programs || [];
  const used = programs.length;
  const atCap = used >= CAP;
  const history = (center.changeHistory || []).map(histLine);

  const detailRows = [
    [t('country'), refName(center.countryId)], [t('city'), center.city || '—'],
    [t('address'), center.address || '—'], [t('email'), center.email || '—'],
    [t('phone'), center.phone || '—'], [t('idNumber'), center.idNumber || '—'],
    [t('accId'), center.accreditationNumber || '—'], [t('accDate'), fmtDate(center.accreditationGrantDate)],
    [t('accExpiry'), fmtDate(center.accreditationExpiry)],
  ];

  return (
    <>
      <Navbar title={center.name} />
      <main className="mt-content" dir={dir}>
        {crumbs}

        <RevealOnScroll className="mt-card" style={{ marginBlockEnd: 16 }}>
          <div className="reg-detail-grid">
            {detailRows.map(([k, v]) => (
              <div key={k}><div className="reg-detail-k">{k}</div><div className="reg-detail-v">{v}</div></div>
            ))}
          </div>
          <div style={{ marginBlockStart: 18 }}>
            <CapacityBar used={used} max={CAP} label={t('programs')} />
          </div>
          {history.length > 0 && (
            <div className="reg-hist">
              <div className="reg-hist-title">{t('changeHistory')}</div>
              {history.map((h, i) => <div key={i} className="reg-hist-line">{h}</div>)}
            </div>
          )}
        </RevealOnScroll>

        <RevealOnScroll className="mt-card" delay={0.06} style={{ padding: 0, overflow: 'hidden' }}>
          <div className="mt-card-head" style={{ padding: '16px 20px 0', marginBlockEnd: 12 }}>
            <div className="mt-card-title">{t('programs')} <span className="mt-count">{used} / {CAP}</span></div>
            <span className="mt-filterbar-spacer" />
            {atCap
              ? <span className="mt-pill mt-pill--rejected">{t('atCapacity')}</span>
              : canWrite && <button type="button" className="mt-btn mt-btn--small" onClick={() => setAddOpen(true)}>+ {t('addProgram')}</button>}
          </div>
          <div className="mt-table-wrap">
            <table className="mt-table">
              <thead>
                <tr>
                  <th className="mt-th">{t('cName')}</th><th className="mt-th">{t('cId')}</th>
                  <th className="mt-th">{t('cSpecialty')}</th><th className="mt-th">{t('cPd')}</th>
                  <th className="mt-th">{t('cCapacity')}</th><th className="mt-th">{t('cDuration')}</th>
                  <th className="mt-th" aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {programs.length === 0 && (
                  <tr><td className="mt-td mt-td--muted" colSpan={7} style={{ textAlign: 'center', padding: 40 }}>{t('noPrograms')}</td></tr>
                )}
                {programs.map((p) => (
                  <tr key={p._id}>
                    <td className="mt-td mt-td--name">{p.name}</td>
                    <td className="mt-td mt-td--mono">{p.idNumber || '—'}</td>
                    <td className="mt-td">{refName(p.specialtyId)}</td>
                    <td className="mt-td mt-td--muted">{refName(p.programDirectorId)}</td>
                    <td className="mt-td">{p.yearlyCapacity != null ? `${p.yearlyCapacity} ${t('perYr')}` : '—'}</td>
                    <td className="mt-td">{p.durationYears ? `${p.durationYears} ${t('yrs')}` : '—'}</td>
                    <td className="mt-td mt-td--actions">
                      <div className="mt-row-actions">
                        {canWrite && (
                          <button type="button" className="mt-icon-action" title={t('edit')} aria-label={t('edit')}
                            onClick={() => setEditItem(p)}><IconEdit size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        <div className="mt-banner" style={{ marginBlockStart: 16, marginBlockEnd: 0 }}>{t('approvalNote')}</div>

        <AddProgramModal open={addOpen} lang={lang} fixedCenter={center} specialties={specialties} subPds={subPds}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); showToast(t('created'), 'ok'); load(); }} />

        {editItem && (
          <ApprovalModal open lang={lang} routeKey="programs" entityId={editItem._id} entityLabel={editItem.name}
            title={t('editRecord')} sub={editItem.name} fields={editFields()} initialValues={editInitial(editItem)}
            onClose={() => setEditItem(null)}
            onSubmitted={() => { showToast(t('submitted'), 'warn'); load(); }} />
        )}
      </main>
      <MtToastHost toasts={toasts} />
    </>
  );
}
