// frontend/src/pages/RegistryPrograms.jsx
//
// Data-entry clerk's flat Programs registry (design "clerk › Programs").
// Search + country + center filters, "+ Add program" (direct create, cap 100),
// and per-row view + edit. Every edit/delete is analyzer-approved via the
// book-of-changes flow (ApprovalModal). Contract: GET /api/programs,
// /api/registry/centers, /api/registry/specialties, /api/registry/users.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import RevealOnScroll from '../components/RevealOnScroll';
import Pagination from '../components/Pagination';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconEye, IconEdit } from '../components/icons';
import {
  SearchBox, AddProgramModal, ApprovalModal, ViewModal, useCanWriteRegistry,
  normId, refName, fmtDate, toDateInput, histLine,
} from './registryShared';
import api from '../api/axios';
import './registry.css';

const PAGE = 10;
const STR = {
  ar: {
    add: 'إضافة برنامج', count: (n) => `${n} برنامج`, search: 'ابحث باسم البرنامج…',
    allCountries: 'الدولة: الكل', allCenters: 'المركز: الكل',
    cName: 'البرنامج', cId: 'المعرّف', cSpecialty: 'الاختصاص', cCenter: 'المركز', cPd: 'المدير',
    cCapacity: 'الطاقة', cDuration: 'المدة', empty: 'لا توجد برامج بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    view: 'عرض', edit: 'تعديل', created: 'تمت إضافة البرنامج', submitted: 'أُرسل للموافقة',
    perYr: '/ سنة', yrs: 'سنوات', name: 'الاسم', center: 'المركز', specialty: 'الاختصاص', pd: 'المدير',
    subPd: 'النائب', capacity: 'الطاقة السنوية', duration: 'المدة (سنوات)', accType: 'نوع الاعتماد',
    partly: 'جزئي', fully: 'كامل', accId: 'رقم الاعتماد', accDate: 'تاريخ الاعتماد', withdrawn: 'الاعتماد مسحوب',
    trainingStart: 'بدء التدريب', renewal: 'تاريخ التجديد', status: 'الحالة', loadFailed: 'فشل التحميل', editRecord: 'تعديل البرنامج',
  },
  en: {
    add: 'Add program', count: (n) => `${n} programs`, search: 'Search by program name…',
    allCountries: 'Country: All', allCenters: 'Center: All',
    cName: 'Program', cId: 'ID', cSpecialty: 'Specialty', cCenter: 'Center', cPd: 'PD',
    cCapacity: 'Capacity', cDuration: 'Duration', empty: 'No programs yet.', noMatch: 'No matching results.',
    view: 'View', edit: 'Edit', created: 'Program added', submitted: 'Submitted for approval',
    perYr: '/ yr', yrs: 'yrs', name: 'Name', center: 'Training center', specialty: 'Specialty', pd: 'Program Director',
    subPd: 'Sub-PD', capacity: 'Yearly capacity', duration: 'Duration (years)', accType: 'Accreditation type',
    partly: 'Partly', fully: 'Fully', accId: 'Accreditation ID', accDate: 'Date of accreditation', withdrawn: 'Accreditation withdrawn',
    trainingStart: 'Training start', renewal: 'Renewal date', status: 'Status', loadFailed: 'Failed to load', editRecord: 'Edit program',
  },
};

export default function RegistryPrograms() {
  const { lang } = usePrefs();
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [programs, setPrograms] = useState([]);
  const [centers, setCenters] = useState([]);
  const [countries, setCountries] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [pds, setPds] = useState([]);
  const [subPds, setSubPds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryF, setCountryF] = useState('');
  const [centerF, setCenterF] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const canWrite = useCanWriteRegistry();
  const [viewItem, setViewItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c, co, sp, pd, subpd] = await Promise.allSettled([
      api.get('/api/programs'),
      api.get('/api/registry/centers'),
      api.get('/api/countries'),
      api.get('/api/registry/specialties'),
      api.get('/api/registry/users', { params: { role: 'program_director' } }),
      api.get('/api/registry/users', { params: { role: 'sub_pd' } }),
    ]);
    if (p.status === 'fulfilled') setPrograms(p.value.data?.data || p.value.data || []);
    else showToast(t('loadFailed'), 'dng');
    if (c.status === 'fulfilled') setCenters(c.value.data?.data || c.value.data || []);
    if (co.status === 'fulfilled') setCountries(co.value.data?.data || co.value.data || []);
    if (sp.status === 'fulfilled') setSpecialties(sp.value.data?.data || sp.value.data || []);
    if (pd.status === 'fulfilled') setPds(pd.value.data?.data || pd.value.data || []);
    if (subpd.status === 'fulfilled') setSubPds(subpd.value.data?.data || subpd.value.data || []);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, countryF, centerF]);

  // centerId → its country id, so the country filter works whether or not
  // /api/programs deep-populates the center's countryId.
  const centerCountry = useMemo(() => {
    const m = new Map();
    for (const c of centers) m.set(c._id, normId(c.countryId));
    return m;
  }, [centers]);

  const filtered = useMemo(() => programs.filter((p) => {
    if (countryF && centerCountry.get(normId(p.trainingCenterId)) !== countryF) return false;
    if (centerF && normId(p.trainingCenterId) !== centerF) return false;
    const q = search.trim().toLowerCase();
    if (q && !(p.name || '').toLowerCase().includes(q)) return false;
    return true;
  }), [programs, countryF, centerF, search, centerCountry]);

  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);

  const centerOpts = centers.map((c) => ({ value: c._id, label: c.name }));
  const specialtyOpts = specialties.map((s) => ({ value: s._id, label: s.name }));
  const pdOpts = pds.map((p) => ({ value: p._id, label: p.name }));
  const subPdOpts = subPds.map((p) => ({ value: p._id, label: p.name }));

  function editFields() {
    return [
      { key: 'name', label: t('name'), type: 'text', full: true },
      { key: 'trainingCenterId', label: t('center'), type: 'select', options: centerOpts, full: true },
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
      name: p.name || '', trainingCenterId: normId(p.trainingCenterId), specialtyId: normId(p.specialtyId),
      programDirectorId: normId(p.programDirectorId), subProgramDirectorId: normId(p.subProgramDirectorId),
      yearlyCapacity: p.yearlyCapacity ?? '', durationYears: p.durationYears ?? '',
      accreditationType: p.accreditationType || '', accreditationGrantDate: toDateInput(p.accreditationGrantDate),
      accreditationNumber: p.accreditationNumber || '', trainingStartDate: toDateInput(p.trainingStartDate),
      renewalApplicationDate: toDateInput(p.renewalApplicationDate), accreditationWithdrawn: !!p.accreditationWithdrawn,
    };
  }

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <div className="mt-filterbar">
          <SearchBox value={search} onChange={setSearch} placeholder={t('search')} />
          <select className="mt-filter" value={countryF} onChange={(e) => setCountryF(e.target.value)}>
            <option value="">{t('allCountries')}</option>
            {countries.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select className="mt-filter" value={centerF} onChange={(e) => setCenterF(e.target.value)}>
            <option value="">{t('allCenters')}</option>
            {centers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <span className="mt-filterbar-spacer" />
          {canWrite && <button type="button" className="mt-btn" onClick={() => setAddOpen(true)}>+ {t('add')}</button>}
          <span className="mt-count">{t('count')(filtered.length)}</span>
        </div>

        <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="mt-table-wrap">
            <table className="mt-table">
              <thead>
                <tr>
                  <th className="mt-th">{t('cName')}</th><th className="mt-th">{t('cId')}</th>
                  <th className="mt-th">{t('cSpecialty')}</th><th className="mt-th">{t('cCenter')}</th>
                  <th className="mt-th">{t('cPd')}</th><th className="mt-th">{t('cCapacity')}</th>
                  <th className="mt-th">{t('cDuration')}</th><th className="mt-th" aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(6)].map((_, i) => (
                  <tr key={i}>{[...Array(8)].map((__, j) => <td key={j} className="mt-td"><span className="skeleton mt-skel" style={{ display: 'block', height: 13, borderRadius: 4 }} /></td>)}</tr>
                ))}
                {!loading && paged.length === 0 && (
                  <tr><td className="mt-td mt-td--muted" colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                    {programs.length === 0 ? t('empty') : t('noMatch')}
                  </td></tr>
                )}
                {!loading && paged.map((p) => (
                  <tr key={p._id}>
                    <td className="mt-td mt-td--name">{p.name}</td>
                    <td className="mt-td mt-td--mono">{p.idNumber || '—'}</td>
                    <td className="mt-td">{refName(p.specialtyId)}</td>
                    <td className="mt-td mt-td--muted">{refName(p.trainingCenterId)}</td>
                    <td className="mt-td mt-td--muted">{refName(p.programDirectorId)}</td>
                    <td className="mt-td">{p.yearlyCapacity != null ? `${p.yearlyCapacity} ${t('perYr')}` : '—'}</td>
                    <td className="mt-td">{p.durationYears ? `${p.durationYears} ${t('yrs')}` : '—'}</td>
                    <td className="mt-td mt-td--actions">
                      <div className="mt-row-actions">
                        <button type="button" className="mt-icon-action" title={t('view')} aria-label={t('view')}
                          onClick={() => setViewItem(p)}><IconEye size={15} /></button>
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

        {filtered.length > PAGE && (
          <Pagination page={page} pageSize={PAGE} total={filtered.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
        )}

        <AddProgramModal open={addOpen} lang={lang} centers={centers} specialties={specialties} subPds={subPds}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); showToast(t('created'), 'ok'); load(); }} />

        {editItem && (
          <ApprovalModal open lang={lang} routeKey="programs" entityId={editItem._id} entityLabel={editItem.name}
            title={t('editRecord')} sub={editItem.name} fields={editFields()} initialValues={editInitial(editItem)}
            onClose={() => setEditItem(null)}
            onSubmitted={() => { showToast(t('submitted'), 'warn'); load(); }} />
        )}

        {viewItem && (
          <ViewModal open lang={lang} title={viewItem.name} sub={refName(viewItem.trainingCenterId)}
            rows={[
              { label: t('cSpecialty'), value: refName(viewItem.specialtyId) },
              { label: t('cCenter'), value: refName(viewItem.trainingCenterId) },
              { label: t('pd'), value: refName(viewItem.programDirectorId) },
              { label: t('subPd'), value: refName(viewItem.subProgramDirectorId) },
              { label: t('capacity'), value: viewItem.yearlyCapacity != null ? `${viewItem.yearlyCapacity} ${t('perYr')}` : '—' },
              { label: t('duration'), value: viewItem.durationYears ? `${viewItem.durationYears} ${t('yrs')}` : '—' },
              { label: t('accId'), value: viewItem.accreditationNumber || '—' },
              { label: t('accDate'), value: fmtDate(viewItem.accreditationGrantDate) },
            ]}
            history={(viewItem.changeHistory || []).map(histLine)}
            onClose={() => setViewItem(null)} />
        )}
      </main>
      <MtToastHost toasts={toasts} />
    </>
  );
}
