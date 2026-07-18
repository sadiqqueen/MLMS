// frontend/src/pages/RegistryCenterDetail.jsx
//
// One training center + its programs (max 70). Header shows "X / 70" and an
// Add-Program button (disabled at the cap). The program modal shows the center's
// accreditation number READ-ONLY and feeds its PD picker from
// GET /api/programs/pd-candidates?specialtyId=<chosen> (refetched on change).
// Contract: GET /api/registry/centers/:id, GET /api/registry/specialties,
// GET /api/programs/pd-candidates, POST/PATCH /api/programs.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import AccreditationBadge from '../components/AccreditationBadge';
import Sk from '../components/Skeleton';
import { IconPencil, IconBack } from '../components/icons';
import api from '../api/axios';

const MAX_PROGRAMS = 70;

const STRINGS = {
  ar: {
    back: 'رجوع',
    country: 'الدولة', city: 'المدينة', address: 'العنوان', email: 'البريد الإلكتروني',
    phone: 'الهاتف', accNo: 'رقم الاعتماد', accGrant: 'تاريخ منح الاعتماد', accExpiry: 'تاريخ الانتهاء',
    status: 'حالة الاعتماد', programs: 'البرامج', addProgram: 'إضافة برنامج', editProgram: 'تعديل البرنامج',
    newProgram: 'برنامج جديد', capReached: 'تم بلوغ الحد الأقصى (70)',
    colName: 'اسم البرنامج', colSpecialty: 'الاختصاص', colPd: 'مدير البرنامج', colType: 'نوع الاعتماد',
    colCapacity: 'الطاقة السنوية', colStart: 'بداية التدريب', colAction: 'الإجراء',
    noPrograms: 'لا توجد برامج بعد.', name: 'اسم البرنامج', specialty: 'الاختصاص',
    centerAccNo: 'رقم اعتماد المركز', accType: 'نوع الاعتماد', partly: 'جزئي (سنتان)', fully: 'كامل (6 سنوات)',
    progAccNo: 'رقم اعتماد البرنامج', capacity: 'الطاقة السنوية', pd: 'مدير البرنامج',
    trainingStart: 'تاريخ بدء التدريب', renewal: 'تاريخ طلب التجديد', selectSpecialtyFirst: 'اختر الاختصاص أولاً',
    noPd: 'بدون مدير برنامج', cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…',
    created: 'تم إنشاء البرنامج', updated: 'تم تحديث البرنامج', loadFailed: 'فشل التحميل',
    notFound: 'المركز غير موجود', edit: 'تعديل',
    nameReq: 'اسم البرنامج مطلوب', specialtyReq: 'الاختصاص مطلوب', typeReq: 'نوع الاعتماد مطلوب',
    grantReq: 'تاريخ منح الاعتماد مطلوب', capReq: 'الطاقة السنوية مطلوبة', startReq: 'تاريخ بدء التدريب مطلوب',
  },
  en: {
    back: 'Back',
    country: 'Country', city: 'City', address: 'Address', email: 'Email',
    phone: 'Phone', accNo: 'Accreditation No.', accGrant: 'Grant Date', accExpiry: 'Expiry',
    status: 'Accreditation Status', programs: 'Programs', addProgram: 'Add Program', editProgram: 'Edit Program',
    newProgram: 'New Program', capReached: 'Maximum of 70 reached',
    colName: 'Program', colSpecialty: 'Specialty', colPd: 'Program Director', colType: 'Accreditation',
    colCapacity: 'Yearly Capacity', colStart: 'Training Start', colAction: 'Action',
    noPrograms: 'No programs yet.', name: 'Program Name', specialty: 'Specialty',
    centerAccNo: 'Center accreditation no.', accType: 'Accreditation Type', partly: 'Partly (2 years)', fully: 'Fully (6 years)',
    progAccNo: 'Program accreditation no.', capacity: 'Yearly Capacity', pd: 'Program Director',
    trainingStart: 'Training Start Date', renewal: 'Renewal Application Date', selectSpecialtyFirst: 'Select a specialty first',
    noPd: 'No program director', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
    created: 'Program created', updated: 'Program updated', loadFailed: 'Failed to load',
    notFound: 'Training center not found', edit: 'Edit',
    nameReq: 'Program name is required', specialtyReq: 'Specialty is required', typeReq: 'Accreditation type is required',
    grantReq: 'Accreditation grant date is required', capReq: 'Yearly capacity is required', startReq: 'Training start date is required',
  },
};

function toDateInput(v) { return v ? new Date(v).toISOString().slice(0, 10) : ''; }
function fmtDate(v) { return v ? new Date(v).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }
function refName(x) { return x?.name || '—'; }

function ProgramModal({ program, center, specialties, t, dir, onClose, onSaved }) {
  const isEdit = !!program;
  const [form, setForm] = useState(() => ({
    name:                   program?.name || '',
    specialtyId:            program?.specialtyId?._id || program?.specialtyId || '',
    accreditationType:      program?.accreditationType || 'partly',
    accreditationGrantDate: toDateInput(program?.accreditationGrantDate),
    accreditationNumber:    program?.accreditationNumber || '',
    yearlyCapacity:         program?.yearlyCapacity ?? '',
    programDirectorId:      program?.programDirectorId?._id || program?.programDirectorId || '',
    trainingStartDate:      toDateInput(program?.trainingStartDate),
    renewalApplicationDate: toDateInput(program?.renewalApplicationDate),
  }));
  const [pdCandidates, setPdCandidates] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // Refetch PD candidates whenever the specialty changes.
  useEffect(() => {
    if (!form.specialtyId) { setPdCandidates([]); return; }
    let cancelled = false;
    api.get('/api/programs/pd-candidates', { params: { specialtyId: form.specialtyId } })
      .then(r => { if (!cancelled) setPdCandidates(r.data?.data || r.data || []); })
      .catch(() => { if (!cancelled) setPdCandidates([]); });
    return () => { cancelled = true; };
  }, [form.specialtyId]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setApiErr(''); }

  function setSpecialty(v) {
    // Changing specialty invalidates a previously-picked PD (PDs are specialty-scoped).
    setForm(f => ({ ...f, specialtyId: v, programDirectorId: '' }));
    setErrors(e => ({ ...e, specialtyId: false })); setApiErr('');
  }

  async function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.specialtyId) e.specialtyId = true;
    if (!form.accreditationType) e.accreditationType = true;
    if (!form.accreditationGrantDate) e.accreditationGrantDate = true;
    if (form.yearlyCapacity === '' || Number(form.yearlyCapacity) < 0) e.yearlyCapacity = true;
    if (!form.trainingStartDate) e.trainingStartDate = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(),
        specialtyId: form.specialtyId,
        accreditationType: form.accreditationType,
        accreditationGrantDate: form.accreditationGrantDate,
        accreditationNumber: form.accreditationNumber.trim(),
        yearlyCapacity: Number(form.yearlyCapacity),
        programDirectorId: form.programDirectorId || null,
        trainingStartDate: form.trainingStartDate,
        renewalApplicationDate: form.renewalApplicationDate || null,
      };
      const res = isEdit
        ? await api.patch(`/api/programs/${program._id}`, payload)
        : await api.post('/api/programs', { ...payload, trainingCenterId: center._id });
      onSaved(res.data?.data || res.data, isEdit);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  const specialtyOptions = specialties.map(s => ({ value: s._id, label: s.name }));
  // When editing without changing the specialty, the program's current PD is not
  // in the candidate list (candidates exclude PDs already directing a program),
  // so keep that one selectable. If the specialty was changed, the old PD no
  // longer applies and is dropped.
  let pdOptions = pdCandidates.map(p => ({ value: p._id, label: `${p.name}${p.idNumber ? ` · ${p.idNumber}` : ''}` }));
  const origSpecialtyId = program?.specialtyId?._id || program?.specialtyId;
  if (isEdit && program?.programDirectorId && String(form.specialtyId) === String(origSpecialtyId)) {
    const curPdId = program.programDirectorId._id || program.programDirectorId;
    if (!pdOptions.some(o => o.value === curPdId)) {
      pdOptions = [{ value: curPdId, label: program.programDirectorId.name || '—' }, ...pdOptions];
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg" dir={dir} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? t('editProgram') : t('newProgram')}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>{t('name')} *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label>{t('specialty')} *</label>
              <SearchableSelect value={form.specialtyId} onChange={setSpecialty} options={specialtyOptions} placeholder={t('specialty')} error={errors.specialtyId} />
            </div>
            <div className="admin-field full">
              <label>{t('centerAccNo')}</label>
              <input value={center?.accreditationNumber || '—'} disabled readOnly />
            </div>
            <div className="admin-field">
              <label>{t('accType')} *</label>
              <select className={errors.accreditationType ? 'invalid' : ''} value={form.accreditationType} onChange={e => set('accreditationType', e.target.value)}>
                <option value="partly">{t('partly')}</option>
                <option value="fully">{t('fully')}</option>
              </select>
            </div>
            <div className="admin-field">
              <label>{t('accGrant')} *</label>
              <input type="date" className={errors.accreditationGrantDate ? 'invalid' : ''} value={form.accreditationGrantDate} onChange={e => set('accreditationGrantDate', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('progAccNo')}</label>
              <input value={form.accreditationNumber} onChange={e => set('accreditationNumber', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('capacity')} *</label>
              <input type="number" min="0" className={errors.yearlyCapacity ? 'invalid' : ''} value={form.yearlyCapacity} onChange={e => set('yearlyCapacity', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label>{t('pd')}</label>
              <SearchableSelect value={form.programDirectorId} onChange={v => set('programDirectorId', v)} options={pdOptions}
                placeholder={form.specialtyId ? t('noPd') : t('selectSpecialtyFirst')} disabled={!form.specialtyId} />
            </div>
            <div className="admin-field">
              <label>{t('trainingStart')} *</label>
              <input type="date" className={errors.trainingStartDate ? 'invalid' : ''} value={form.trainingStartDate} onChange={e => set('trainingStartDate', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('renewal')}</label>
              <input type="date" value={form.renewalApplicationDate} onChange={e => set('renewalApplicationDate', e.target.value)} />
            </div>
          </div>
          {apiErr && (
            <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{apiErr}</div>
          )}
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
        </div>
      </div>
    </div>
  );
}

export default function RegistryCenterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [center, setCenter] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modal, setModal] = useState(null); // { program? } | null
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id2 = Date.now();
    setToasts(p => [...p, { id: id2, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id2)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true); setNotFound(false);
    const [cRes, spRes] = await Promise.allSettled([
      api.get(`/api/registry/centers/${id}`),
      api.get('/api/registry/specialties'),
    ]);
    if (cRes.status === 'fulfilled') setCenter(cRes.value.data?.data || cRes.value.data || null);
    else { setNotFound(true); showToast(t('loadFailed'), 'error'); }
    if (spRes.status === 'fulfilled') setSpecialties(spRes.value.data?.data || spRes.value.data || []);
    setLoading(false);
  }, [id, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function handleSaved(saved, isEdit) {
    load();
    setModal(null);
    showToast(isEdit ? t('updated') : t('created'));
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card" style={{ padding: 20, marginBottom: 16 }}><Sk w={200} h={22} /><div style={{ height: 12 }} /><Sk w="60%" h={14} /></div>
        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(5)].map((_, i) => (<tr key={i}><td><Sk w={140} h={13} /></td><td><Sk w={90} h={13} /></td><td><Sk w={90} h={13} /></td><td><Sk w={80} h={22} r={20} /></td><td><Sk w={40} h={13} /></td><td><Sk w={80} h={13} /></td></tr>))}
            </tbody></table>
          </div>
        </div>
      </main>
    </>
  );

  if (notFound || !center) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <button className="btn-outline" onClick={() => navigate('/registry/centers')} style={{ marginBottom: 16 }}>← {t('back')}</button>
        <div className="admin-empty">{t('notFound')}</div>
      </main>
    </>
  );

  const programs = center.programs || [];
  const atCap = programs.length >= MAX_PROGRAMS;

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <button className="btn-outline" onClick={() => navigate('/registry/centers')} style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconBack size={16} /> {t('back')}
        </button>

        {/* Center card */}
        <div className="admin-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-secondary)' }}>{center.name}</div>
            <AccreditationBadge status={center.accreditationStatus} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px 18px' }}>
            {[
              [t('country'), center.countryId?.name ? `${center.countryId.name} (${center.countryId.code})` : '—'],
              [t('city'), center.city || '—'],
              [t('address'), center.address || '—'],
              [t('email'), center.email || '—'],
              [t('phone'), center.phone || '—'],
              [t('accNo'), center.accreditationNumber || '—'],
              [t('accGrant'), fmtDate(center.accreditationGrantDate)],
              [t('accExpiry'), fmtDate(center.accreditationExpiry)],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--brand-secondary)', fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Programs */}
        <div className="admin-card">
          <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {t('programs')} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{programs.length} / {MAX_PROGRAMS}</span>
            </div>
            <button className="btn-primary" disabled={atCap} title={atCap ? t('capReached') : ''} onClick={() => setModal({ program: null })}>+ {t('addProgram')}</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('colName')}</th><th>{t('colSpecialty')}</th><th>{t('colPd')}</th>
                  <th>{t('colType')}</th><th>{t('colCapacity')}</th><th>{t('colStart')}</th><th>{t('colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {programs.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t('noPrograms')}</td></tr>
                )}
                {programs.map(p => (
                  <tr key={p._id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{refName(p.specialtyId)}</td>
                    <td>{refName(p.programDirectorId)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="badge badge-blue">{p.accreditationType === 'fully' ? t('fully') : t('partly')}</span>
                        <AccreditationBadge status={p.accreditationStatus} />
                      </div>
                    </td>
                    <td>{p.yearlyCapacity}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.trainingStartDate)}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-action edit" title={t('edit')} aria-label={t('edit')} onClick={() => setModal({ program: p })}><IconPencil /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {modal && (
          <ProgramModal program={modal.program} center={center} specialties={specialties} t={t} dir={dir}
            onClose={() => setModal(null)} onSaved={handleSaved} />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
