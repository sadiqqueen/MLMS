// frontend/src/pages/RegistryCenters.jsx
//
// Data-entry clerk's Training Centers registry (design "clerk › Training Centers").
// mt- table: Center · ID · Country · City · DIO · Programs (used/100) · Status.
// "+ Add training center" is a direct create; per-row view opens the center
// detail, edit routes through the analyzer approval flow (book-of-changes PDF).
// Contract: GET /api/registry/centers, /api/programs, /api/countries,
// /api/registry/users?role=dio_view|sub_dio.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import RevealOnScroll from '../components/RevealOnScroll';
import Pagination from '../components/Pagination';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconEye, IconEdit } from '../components/icons';
import {
  SearchBox, AddCenterModal, ApprovalModal, normId, refName, toDateInput,
} from './registryShared';
import api from '../api/axios';
import './registry.css';

const PAGE = 10;
const CAP = 100;
const STR = {
  ar: {
    add: 'إضافة مركز تدريبي', count: (n) => `${n} مركز`, search: 'ابحث باسم المركز…', allCountries: 'الدولة: الكل',
    cName: 'المركز', cId: 'المعرّف', cCountry: 'الدولة', cCity: 'المدينة', cDio: 'DIO', cPrograms: 'البرامج', cStatus: 'الحالة',
    empty: 'لا توجد مراكز بعد.', noMatch: 'لا توجد نتائج مطابقة.', view: 'عرض', edit: 'تعديل',
    created: 'تمت إضافة المركز', submitted: 'أُرسل للموافقة', loadFailed: 'فشل التحميل', editRecord: 'تعديل المركز',
    name: 'الاسم', country: 'الدولة', city: 'المدينة', address: 'العنوان', governorate: 'المحافظة', phone: 'الهاتف',
    email: 'البريد الإلكتروني', idNumber: 'المعرّف', accId: 'رقم الاعتماد', accDate: 'تاريخ منح الاعتماد', accExpiry: 'انتهاء الاعتماد',
    withdrawn: 'الاعتماد مسحوب', dio: 'DIO', subDio: 'Sub-DIO',
    stAccredited: 'معتمد', stExpiring: 'قارب الانتهاء', stExpired: 'منتهٍ', stWithdrawn: 'مسحوب', stNone: 'غير معتمد',
  },
  en: {
    add: 'Add training center', count: (n) => `${n} centers`, search: 'Search by center name…', allCountries: 'Country: All',
    cName: 'Center', cId: 'ID', cCountry: 'Country', cCity: 'City', cDio: 'DIO', cPrograms: 'Programs', cStatus: 'Status',
    empty: 'No centers yet.', noMatch: 'No matching results.', view: 'View', edit: 'Edit',
    created: 'Center added', submitted: 'Submitted for approval', loadFailed: 'Failed to load', editRecord: 'Edit training center',
    name: 'Name', country: 'Country', city: 'City', address: 'Address', governorate: 'Governorate', phone: 'Phone',
    email: 'Email', idNumber: 'ID', accId: 'Accreditation ID', accDate: 'Accreditation grant date', accExpiry: 'Accreditation expiry',
    withdrawn: 'Accreditation withdrawn', dio: 'DIO', subDio: 'Sub-DIO',
    stAccredited: 'Accredited', stExpiring: 'Expiring', stExpired: 'Expired', stWithdrawn: 'Withdrawn', stNone: 'Unaccredited',
  },
};

function statusPill(status, t) {
  switch (status) {
    case 'green': return { cls: 'mt-pill--active', label: t('stAccredited') };
    case 'yellow': return { cls: 'mt-pill--warn', label: t('stExpiring') };
    case 'red': return { cls: 'mt-pill--rejected', label: t('stExpired') };
    case 'black': return { cls: 'mt-pill--rejected', label: t('stWithdrawn') };
    default: return { cls: 'mt-pill--neutral', label: t('stNone') };
  }
}

export default function RegistryCenters() {
  const navigate = useNavigate();
  const { lang } = usePrefs();
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [centers, setCenters] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [countries, setCountries] = useState([]);
  const [dios, setDios] = useState([]);
  const [subDios, setSubDios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryF, setCountryF] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, p, co, d, sd] = await Promise.allSettled([
      api.get('/api/registry/centers'),
      api.get('/api/programs'),
      api.get('/api/countries'),
      api.get('/api/registry/users', { params: { role: 'dio_view' } }),
      api.get('/api/registry/users', { params: { role: 'sub_dio' } }),
    ]);
    if (c.status === 'fulfilled') setCenters(c.value.data?.data || c.value.data || []);
    else showToast(t('loadFailed'), 'dng');
    if (p.status === 'fulfilled') setPrograms(p.value.data?.data || p.value.data || []);
    if (co.status === 'fulfilled') setCountries(co.value.data?.data || co.value.data || []);
    if (d.status === 'fulfilled') setDios(d.value.data?.data || d.value.data || []);
    if (sd.status === 'fulfilled') setSubDios(sd.value.data?.data || sd.value.data || []);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, countryF]);

  const usedBy = useMemo(() => {
    const m = new Map();
    for (const p of programs) { const k = normId(p.trainingCenterId); m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }, [programs]);

  const filtered = useMemo(() => centers.filter((c) => {
    if (countryF && normId(c.countryId) !== countryF) return false;
    const q = search.trim().toLowerCase();
    if (q && !(c.name || '').toLowerCase().includes(q)) return false;
    return true;
  }), [centers, countryF, search]);

  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);

  const countryOpts = countries.map((c) => ({ value: c._id, label: `${c.name} (${c.code})` }));
  const dioOpts = dios.map((d) => ({ value: d._id, label: d.name }));
  const subDioOpts = subDios.map((d) => ({ value: d._id, label: d.name }));

  function editFields() {
    return [
      { key: 'name', label: t('name'), type: 'text', full: true },
      { key: 'countryId', label: t('country'), type: 'select', options: countryOpts },
      { key: 'city', label: t('city'), type: 'text' },
      { key: 'address', label: t('address'), type: 'text', full: true },
      { key: 'governorate', label: t('governorate'), type: 'text' },
      { key: 'phone', label: t('phone'), type: 'text' },
      { key: 'email', label: t('email'), type: 'text' },
      { key: 'idNumber', label: t('idNumber'), type: 'text', mono: true },
      { key: 'dioId', label: t('dio'), type: 'select', options: dioOpts },
      { key: 'subDioId', label: t('subDio'), type: 'select', options: subDioOpts },
      { key: 'accreditationNumber', label: t('accId'), type: 'text', mono: true },
      { key: 'accreditationGrantDate', label: t('accDate'), type: 'date' },
      { key: 'accreditationExpiry', label: t('accExpiry'), type: 'date' },
      { key: 'accreditationWithdrawn', label: t('withdrawn'), type: 'checkbox', full: true },
    ];
  }
  function editInitial(c) {
    return {
      name: c.name || '', countryId: normId(c.countryId), city: c.city || '', address: c.address || '',
      governorate: c.governorate || '', phone: c.phone || '', email: c.email || '', idNumber: c.idNumber || '',
      dioId: normId(c.dioId), subDioId: normId(c.subDioId), accreditationNumber: c.accreditationNumber || '',
      accreditationGrantDate: toDateInput(c.accreditationGrantDate), accreditationExpiry: toDateInput(c.accreditationExpiry),
      accreditationWithdrawn: !!c.accreditationWithdrawn,
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
          <span className="mt-filterbar-spacer" />
          <button type="button" className="mt-btn" onClick={() => setAddOpen(true)}>+ {t('add')}</button>
          <span className="mt-count">{t('count')(filtered.length)}</span>
        </div>

        <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="mt-table-wrap">
            <table className="mt-table">
              <thead>
                <tr>
                  <th className="mt-th">{t('cName')}</th><th className="mt-th">{t('cId')}</th>
                  <th className="mt-th">{t('cCountry')}</th><th className="mt-th">{t('cCity')}</th>
                  <th className="mt-th">{t('cDio')}</th><th className="mt-th">{t('cPrograms')}</th>
                  <th className="mt-th">{t('cStatus')}</th><th className="mt-th" aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(6)].map((_, i) => (
                  <tr key={i}>{[...Array(8)].map((__, j) => <td key={j} className="mt-td"><span className="skeleton mt-skel" style={{ display: 'block', height: 13, borderRadius: 4 }} /></td>)}</tr>
                ))}
                {!loading && paged.length === 0 && (
                  <tr><td className="mt-td mt-td--muted" colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                    {centers.length === 0 ? t('empty') : t('noMatch')}
                  </td></tr>
                )}
                {!loading && paged.map((c) => {
                  const used = usedBy.get(c._id) || 0;
                  const capCls = used >= CAP ? 'reg-cap reg-cap--full' : (used / CAP) * 100 > 75 ? 'reg-cap reg-cap--warn' : 'reg-cap';
                  const st = statusPill(c.accreditationStatus, t);
                  return (
                    <tr key={c._id}>
                      <td className="mt-td mt-td--name">{c.name}</td>
                      <td className="mt-td mt-td--mono">{c.idNumber || '—'}</td>
                      <td className="mt-td mt-td--muted">{refName(c.countryId)}</td>
                      <td className="mt-td mt-td--muted">{c.city || '—'}</td>
                      <td className="mt-td mt-td--muted">{refName(c.dioId)}</td>
                      <td className="mt-td"><span className={capCls}>{used} / {CAP}</span></td>
                      <td className="mt-td"><span className={`mt-pill ${st.cls}`}>{st.label}</span></td>
                      <td className="mt-td mt-td--actions">
                        <div className="mt-row-actions">
                          <button type="button" className="mt-icon-action" title={t('view')} aria-label={t('view')}
                            onClick={() => navigate(`/registry/centers/${c._id}`)}><IconEye size={15} /></button>
                          <button type="button" className="mt-icon-action" title={t('edit')} aria-label={t('edit')}
                            onClick={() => setEditItem(c)}><IconEdit size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        {filtered.length > PAGE && (
          <Pagination page={page} pageSize={PAGE} total={filtered.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
        )}

        <AddCenterModal open={addOpen} lang={lang} countries={countries} dios={dios} subDios={subDios}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); showToast(t('created'), 'ok'); load(); }} />

        {editItem && (
          <ApprovalModal open lang={lang} routeKey="centers" entityId={editItem._id} entityLabel={editItem.name}
            title={t('editRecord')} sub={editItem.name} fields={editFields()} initialValues={editInitial(editItem)}
            onClose={() => setEditItem(null)}
            onSubmitted={() => { showToast(t('submitted'), 'warn'); load(); }} />
        )}
      </main>
      <MtToastHost toasts={toasts} />
    </>
  );
}
