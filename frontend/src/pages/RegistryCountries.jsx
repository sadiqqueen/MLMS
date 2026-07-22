// frontend/src/pages/RegistryCountries.jsx
//
// Data-entry clerk's Countries drill-down (design clerk › Countries, lists_views §5):
//   L0 Countries → L1 country's training centers → L2 center's programs.
// A Breadcrumb walks the levels; "+ Add training center" appears at L1 and
// "+ Add program" at L2 (replaced by an at-capacity chip at 100/100). Programs
// edit through the analyzer approval flow. Everything is built from one set of
// fetches (countries + centers + programs) so drilling is instant.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Breadcrumb from '../components/Breadcrumb';
import CapacityBar from '../components/CapacityBar';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconEdit } from '../components/icons';
import {
  AddCenterModal, AddProgramModal, ApprovalModal, normId, refName, toDateInput, useCanWriteRegistry,
} from './registryShared';
import api from '../api/axios';
import './registry.css';

const CAP = 100;
const STR = {
  ar: {
    countries: 'الدول', addCountry: 'إضافة دولة', addCenter: 'إضافة مركز تدريبي', addProgram: 'إضافة برنامج',
    atCapacity: 'المركز مكتمل — 100 / 100', viewCenters: 'عرض المراكز ←', viewPrograms: 'عرض البرامج ←',
    cCountry: 'الدولة', cCode: 'الرمز', cCenters: 'المراكز', cPrograms: 'البرامج',
    cCenter: 'المركز', cId: 'المعرّف', cCity: 'المدينة', cDio: 'DIO',
    cName: 'البرنامج', cSpecialty: 'الاختصاص', cPd: 'المدير', cCapacity: 'الطاقة', cDuration: 'المدة',
    noCountries: 'لا توجد دول بعد.', noCenters: 'لا توجد مراكز في هذه الدولة.', noPrograms: 'لا توجد برامج بعد.',
    edit: 'تعديل', editRecord: 'تعديل البرنامج', perYr: '/ سنة', yrs: 'سنوات', programsWord: 'البرامج',
    centerCreated: 'تمت إضافة المركز', programCreated: 'تمت إضافة البرنامج', countryCreated: 'تمت إضافة الدولة', submitted: 'أُرسل للموافقة', loadFailed: 'فشل التحميل',
    approvalNote: 'تعديل أي سجل يفتح تدفّق الموافقة — تتطلب التغييرات موافقة محلل البيانات قبل أن تُطبّق.',
    name: 'الاسم', specialty: 'الاختصاص', pd: 'المدير', subPd: 'النائب', capacity: 'الطاقة السنوية', duration: 'المدة (سنوات)',
    accType: 'نوع الاعتماد', partly: 'جزئي', fully: 'كامل', accId: 'رقم الاعتماد', accDate: 'تاريخ الاعتماد', withdrawn: 'الاعتماد مسحوب',
  },
  en: {
    countries: 'Countries', addCountry: 'Add country', addCenter: 'Add training center', addProgram: 'Add program',
    atCapacity: 'Center at capacity — 100 / 100', viewCenters: 'View centers →', viewPrograms: 'View programs →',
    cCountry: 'Country', cCode: 'Code', cCenters: 'Training centers', cPrograms: 'Programs',
    cCenter: 'Center', cId: 'ID', cCity: 'City', cDio: 'DIO',
    cName: 'Program', cSpecialty: 'Specialty', cPd: 'PD', cCapacity: 'Capacity', cDuration: 'Duration',
    noCountries: 'No countries yet.', noCenters: 'No centers in this country.', noPrograms: 'No programs yet.',
    edit: 'Edit', editRecord: 'Edit program', perYr: '/ yr', yrs: 'yrs', programsWord: 'Programs',
    centerCreated: 'Center added', programCreated: 'Program added', countryCreated: 'Country added', submitted: 'Submitted for approval', loadFailed: 'Failed to load',
    approvalNote: 'Editing any record opens the edit-with-approval flow — changes require Data Analyzer approval before taking effect.',
    name: 'Name', specialty: 'Specialty', pd: 'Program Director', subPd: 'Sub-PD', capacity: 'Yearly capacity', duration: 'Duration (years)',
    accType: 'Accreditation type', partly: 'Partly', fully: 'Fully', accId: 'Accreditation ID', accDate: 'Date of accreditation', withdrawn: 'Accreditation withdrawn',
  },
};

function capClass(used) {
  return used >= CAP ? 'reg-cap reg-cap--full' : (used / CAP) * 100 > 75 ? 'reg-cap reg-cap--warn' : 'reg-cap';
}

export default function RegistryCountries() {
  const { lang } = usePrefs();
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [countries, setCountries] = useState([]);
  const [centers, setCenters] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [pds, setPds] = useState([]);
  const [subPds, setSubPds] = useState([]);
  const [dios, setDios] = useState([]);
  const [subDios, setSubDios] = useState([]);
  const [loading, setLoading] = useState(true);

  const [countryId, setCountryId] = useState(null);   // L1 when set
  const [centerId, setCenterId] = useState(null);      // L2 when set
  const [addCenterOpen, setAddCenterOpen] = useState(false);
  const [addProgramOpen, setAddProgramOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const canWrite = useCanWriteRegistry();

  const load = useCallback(async () => {
    setLoading(true);
    const rs = await Promise.allSettled([
      api.get('/api/countries'), api.get('/api/registry/centers'), api.get('/api/programs'),
      api.get('/api/registry/specialties'),
      api.get('/api/registry/users', { params: { role: 'program_director' } }),
      api.get('/api/registry/users', { params: { role: 'sub_pd' } }),
      api.get('/api/registry/users', { params: { role: 'dio' } }),
      api.get('/api/registry/users', { params: { role: 'sub_dio' } }),
    ]);
    const val = (r) => (r.status === 'fulfilled' ? (r.value.data?.data || r.value.data || []) : []);
    if (rs[0].status !== 'fulfilled') showToast(t('loadFailed'), 'dng');
    setCountries(val(rs[0])); setCenters(val(rs[1])); setPrograms(val(rs[2]));
    setSpecialties(val(rs[3])); setPds(val(rs[4])); setSubPds(val(rs[5]));
    setDios(val(rs[6])); setSubDios(val(rs[7]));
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const usedBy = useMemo(() => {
    const m = new Map();
    for (const p of programs) { const k = normId(p.trainingCenterId); m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }, [programs]);
  const centersByCountry = useMemo(() => {
    const m = new Map();
    for (const c of centers) { const k = normId(c.countryId); if (!m.has(k)) m.set(k, []); m.get(k).push(c); }
    return m;
  }, [centers]);

  const country = countries.find((c) => c._id === countryId) || null;
  const countryCenters = country ? (centersByCountry.get(country._id) || []) : [];
  const center = centers.find((c) => c._id === centerId) || null;
  const centerPrograms = center ? programs.filter((p) => normId(p.trainingCenterId) === center._id) : [];
  const used = centerPrograms.length;
  const atCap = used >= CAP;

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
      { key: 'accreditationWithdrawn', label: t('withdrawn'), type: 'checkbox', full: true },
    ];
  }
  function editInitial(p) {
    return {
      name: p.name || '', specialtyId: normId(p.specialtyId), programDirectorId: normId(p.programDirectorId),
      subProgramDirectorId: normId(p.subProgramDirectorId), yearlyCapacity: p.yearlyCapacity ?? '',
      durationYears: p.durationYears ?? '', accreditationType: p.accreditationType || '',
      accreditationGrantDate: toDateInput(p.accreditationGrantDate), accreditationNumber: p.accreditationNumber || '',
      accreditationWithdrawn: !!p.accreditationWithdrawn,
    };
  }

  // ── breadcrumb ──
  const crumbItems = [{ label: t('countries'), onClick: countryId ? () => { setCountryId(null); setCenterId(null); } : undefined }];
  if (country) crumbItems.push({ label: country.name, onClick: centerId ? () => setCenterId(null) : undefined });
  if (center) crumbItems.push({ label: center.name });

  const crumbRight = center
    ? (atCap
      ? <span className="mt-pill mt-pill--rejected">{t('atCapacity')}</span>
      : canWrite && <button type="button" className="mt-btn mt-btn--small" onClick={() => setAddProgramOpen(true)}>+ {t('addProgram')}</button>)
    : (country
      ? (canWrite && <button type="button" className="mt-btn mt-btn--small" onClick={() => setAddCenterOpen(true)}>+ {t('addCenter')}</button>)
      // Countries are added by the Data Analyzer now (Change 1) — no L0 add here.
      : null);

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <Breadcrumb items={crumbItems} right={crumbRight} />

        {loading ? <div className="skeleton mt-skel" style={{ height: 260 }} /> : (
          <>
            {/* L0 — Countries */}
            {!country && (
              <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="mt-table-wrap">
                  <table className="mt-table">
                    <thead><tr>
                      <th className="mt-th">{t('cCountry')}</th><th className="mt-th">{t('cCode')}</th>
                      <th className="mt-th">{t('cCenters')}</th><th className="mt-th">{t('cPrograms')}</th>
                      <th className="mt-th" aria-label="actions" />
                    </tr></thead>
                    <tbody>
                      {countries.length === 0 && (
                        <tr><td className="mt-td mt-td--muted" colSpan={5} style={{ textAlign: 'center', padding: 40 }}>{t('noCountries')}</td></tr>
                      )}
                      {countries.map((co) => {
                        const cc = centersByCountry.get(co._id) || [];
                        const progSum = cc.reduce((s, c) => s + (usedBy.get(c._id) || 0), 0);
                        return (
                          <tr key={co._id} className="reg-row-click" onClick={() => { setCountryId(co._id); setCenterId(null); }}>
                            <td className="mt-td mt-td--name">{co.name}</td>
                            <td className="mt-td mt-td--mono">{co.code || '—'}</td>
                            <td className="mt-td">{cc.length}</td>
                            <td className="mt-td">{progSum}</td>
                            <td className="mt-td" style={{ textAlign: 'end' }}><span className="reg-view-link">{t('viewCenters')}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </RevealOnScroll>
            )}

            {/* L1 — Centers of {country} */}
            {country && !center && (
              <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="mt-table-wrap">
                  <table className="mt-table">
                    <thead><tr>
                      <th className="mt-th">{t('cCenter')}</th><th className="mt-th">{t('cId')}</th>
                      <th className="mt-th">{t('cCity')}</th><th className="mt-th">{t('cDio')}</th>
                      <th className="mt-th">{t('cPrograms')}</th><th className="mt-th" aria-label="actions" />
                    </tr></thead>
                    <tbody>
                      {countryCenters.length === 0 && (
                        <tr><td className="mt-td mt-td--muted" colSpan={6} style={{ textAlign: 'center', padding: 40 }}>{t('noCenters')}</td></tr>
                      )}
                      {countryCenters.map((c) => {
                        const u = usedBy.get(c._id) || 0;
                        return (
                          <tr key={c._id} className="reg-row-click" onClick={() => setCenterId(c._id)}>
                            <td className="mt-td mt-td--name">{c.name}</td>
                            <td className="mt-td mt-td--mono">{c.idNumber || '—'}</td>
                            <td className="mt-td mt-td--muted">{c.city || '—'}</td>
                            <td className="mt-td mt-td--muted">{refName(c.dioId)}</td>
                            <td className="mt-td"><span className={capClass(u)}>{u} / {CAP}</span></td>
                            <td className="mt-td" style={{ textAlign: 'end' }}><span className="reg-view-link">{t('viewPrograms')}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </RevealOnScroll>
            )}

            {/* L2 — Programs of {center} */}
            {center && (
              <>
                <RevealOnScroll className="mt-card" style={{ marginBlockEnd: 16 }}>
                  <CapacityBar used={used} max={CAP} label={t('programsWord')} />
                </RevealOnScroll>
                <RevealOnScroll className="mt-card" delay={0.06} style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="mt-table-wrap">
                    <table className="mt-table">
                      <thead><tr>
                        <th className="mt-th">{t('cName')}</th><th className="mt-th">{t('cId')}</th>
                        <th className="mt-th">{t('cSpecialty')}</th><th className="mt-th">{t('cPd')}</th>
                        <th className="mt-th">{t('cCapacity')}</th><th className="mt-th">{t('cDuration')}</th>
                        <th className="mt-th" aria-label="actions" />
                      </tr></thead>
                      <tbody>
                        {centerPrograms.length === 0 && (
                          <tr><td className="mt-td mt-td--muted" colSpan={7} style={{ textAlign: 'center', padding: 40 }}>{t('noPrograms')}</td></tr>
                        )}
                        {centerPrograms.map((p) => (
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
              </>
            )}
          </>
        )}

        <AddCenterModal open={addCenterOpen} lang={lang} countries={countries} dios={dios} subDios={subDios}
          fixedCountryId={country?._id}
          onClose={() => setAddCenterOpen(false)}
          onSaved={() => { setAddCenterOpen(false); showToast(t('centerCreated'), 'ok'); load(); }} />

        {center && (
          <AddProgramModal open={addProgramOpen} lang={lang} fixedCenter={center} specialties={specialties} subPds={subPds}
            onClose={() => setAddProgramOpen(false)}
            onSaved={() => { setAddProgramOpen(false); showToast(t('programCreated'), 'ok'); load(); }} />
        )}

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
