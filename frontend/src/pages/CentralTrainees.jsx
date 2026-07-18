// frontend/src/pages/CentralTrainees.jsx
//
// Central Secretary's global trainee management. Trainees are created against a
// PROGRAM (which fixes the center/country/specialty); the trainer is OPTIONAL
// and the research trainer defaults to the program's PD. Edits are NOT applied
// directly — they queue as ChangeRequests approved by the center's ODIO.
// Contract (backend/routes/centralSecretary.js):
//   GET  /api/central/trainees[?includeInactive=true]  (injects trainingYear)
//   GET  /api/central/programs   (picker: center/country/PD/capacity per program)
//   GET  /api/central/trainers?programId=   (optional trainer picker)
//   POST /api/central/trainees   → 409 { capacityFull, used, capacity } when full
//   PATCH /api/central/trainees/:id → 202 { pending:true } (queued for ODIO)
//   GET  /api/central/change-requests?status=pending
//   PATCH /api/central/change-requests/:id/cancel
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import Sk from '../components/Skeleton';
import { IconPencil, IconXCircle } from '../components/icons';
import api from '../api/axios';

const STRINGS = {
  ar: {
    title: 'المتدربون', search: 'ابحث بالاسم أو الرقم التعريفي…',
    allPrograms: 'كل البرامج', includeInactive: 'إظهار المعطّلين',
    addTrainee: 'إضافة متدرب', newTrainee: 'متدرب جديد', editTrainee: 'تعديل المتدرب',
    name: 'الاسم', idNumber: 'الرقم التعريفي', password: 'كلمة المرور',
    email: 'البريد الإلكتروني', phone: 'الهاتف', city: 'المدينة',
    gender: 'الجنس', selectGender: '— اختر —', male: 'ذكر', female: 'أنثى',
    program: 'البرنامج', selectProgram: 'اختر برنامجاً…',
    trainer: 'المدرب', noTrainerYet: 'لا يوجد مدرب بعد',
    researchTrainer: 'مدرب الأبحاث', researchHint: '(الافتراضي: مدير البرنامج)',
    pd: 'مدير البرنامج', center: 'المركز', country: 'الدولة', capacity: 'السعة',
    year: 'السنة', trainerCol: 'المدرب', active: 'الحالة',
    statusActive: 'نشط', statusInactive: 'معطّل',
    none: 'لا يوجد متدربون بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…', create: 'إنشاء',
    created: 'تمت إضافة المتدرب', pendingApproval: 'تم إرسال التغيير إلى الـ ODIO للموافقة',
    loadFailed: 'فشل التحميل', passwordHint: '(6 أحرف على الأقل)',
    programFull: 'البرنامج ممتلئ', action: 'الإجراء',
    pendingTitle: 'الطلبات المعلّقة', pendingNone: 'لا توجد طلبات معلّقة.',
    cancelReq: 'إلغاء الطلب', reqCancelled: 'تم إلغاء الطلب', noChanges: 'لا تغييرات',
  },
  en: {
    title: 'Trainees', search: 'Search by name or ID number…',
    allPrograms: 'All programs', includeInactive: 'Show inactive',
    addTrainee: 'Add Trainee', newTrainee: 'New Trainee', editTrainee: 'Edit Trainee',
    name: 'Name', idNumber: 'ID Number', password: 'Password',
    email: 'Email', phone: 'Phone', city: 'City',
    gender: 'Gender', selectGender: '— Select —', male: 'Male', female: 'Female',
    program: 'Program', selectProgram: 'Select a program…',
    trainer: 'Trainer', noTrainerYet: 'No trainer yet',
    researchTrainer: 'Research Trainer', researchHint: '(defaults to the Program Director)',
    pd: 'Program Director', center: 'Center', country: 'Country', capacity: 'Capacity',
    year: 'Year', trainerCol: 'Trainer', active: 'Status',
    statusActive: 'Active', statusInactive: 'Inactive',
    none: 'No trainees yet.', noMatch: 'No matching results.',
    cancel: 'Cancel', save: 'Save', saving: 'Saving…', create: 'Create',
    created: 'Trainee added', pendingApproval: 'Sent to the ODIO for approval',
    loadFailed: 'Failed to load', passwordHint: '(min 6 chars)',
    programFull: 'Program is full', action: 'Action',
    pendingTitle: 'Pending requests', pendingNone: 'No pending requests.',
    cancelReq: 'Cancel request', reqCancelled: 'Request cancelled', noChanges: 'No changes',
  },
};

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{msg}</div>;
}

function idOf(v) { return v?._id || v || ''; }
function countryLabel(c) { return c ? `${c.name} (${c.code})` : '—'; }
function programOptionLabel(p) { return `${p.name}${p.trainingCenterId?.name ? ` — ${p.trainingCenterId.name}` : ''}`; }
function trainerOptionLabel(tr) { return `${tr.name}${tr.idNumber ? ` (${tr.idNumber})` : ''}`; }

// Read-only info block for a chosen program.
function ProgramInfo({ program, t }) {
  if (!program) return null;
  const rows = [
    [t('pd'), program.programDirectorId?.name || '—'],
    [t('center'), program.trainingCenterId?.name || '—'],
    [t('country'), program.trainingCenterId?.countryId ? countryLabel(program.trainingCenterId.countryId) : '—'],
    [t('capacity'), `${program.capacityUsed ?? 0} / ${program.yearlyCapacity ?? 0}`],
  ];
  return (
    <div style={{ marginTop: 4, background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0' }}>
          <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          <span style={{ color: 'var(--text-2)', textAlign: 'end', fontWeight: 500 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// Fetch the trainers of a program (for the optional trainer/research pickers).
function useProgramTrainers(programId) {
  const [trainers, setTrainers] = useState([]);
  useEffect(() => {
    if (!programId) { setTrainers([]); return; }
    let cancelled = false;
    api.get('/api/central/trainers', { params: { programId } })
      .then(r => { if (!cancelled) setTrainers(r.data?.data || r.data || []); })
      .catch(() => { if (!cancelled) setTrainers([]); });
    return () => { cancelled = true; };
  }, [programId]);
  return trainers;
}

function AddTraineeModal({ programs, t, dir, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', idNumber: '', password: '', email: '', phone: '', city: '', gender: '',
    programId: '', supervisorId: '', researchSupervisorId: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const trainers = useProgramTrainers(form.programId);
  const selectedProgram = programs.find(p => p._id === form.programId) || null;

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function set(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v };
      // Changing the program invalidates the trainer selections.
      if (k === 'programId') { next.supervisorId = ''; next.researchSupervisorId = ''; }
      return next;
    });
    setErrors(e => ({ ...e, [k]: false })); setApiErr('');
  }

  async function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.idNumber.trim()) e.idNumber = true;
    if (!form.password || form.password.length < 6) e.password = true;
    if (!form.programId) e.programId = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(),
        idNumber: form.idNumber.trim(),
        password: form.password,
        programId: form.programId,
        phone: form.phone.trim(),
        city: form.city.trim(),
        gender: form.gender,
        supervisorId: form.supervisorId || null,
        researchSupervisorId: form.researchSupervisorId || null,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      const res = await api.post('/api/central/trainees', payload);
      onSaved(res.data?.data || res.data);
    } catch (err) {
      const rd = err.response?.data;
      if (err.response?.status === 409 && rd?.capacityFull) {
        setApiErr(`${t('programFull')}: ${rd.used}/${rd.capacity}`);
      } else {
        setApiErr(rd?.message || 'Save failed');
      }
    } finally { setSaving(false); }
  }

  const programOptions = programs.map(p => ({ value: p._id, label: programOptionLabel(p) }));
  const trainerOptions = trainers.map(tr => ({ value: tr._id, label: trainerOptionLabel(tr) }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg" dir={dir} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('newTrainee')}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>{t('name')} *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('idNumber')} *</label>
              <input className={errors.idNumber ? 'invalid' : ''} value={form.idNumber} onChange={e => set('idNumber', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('password')} * <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>{t('passwordHint')}</span></label>
              <input type="password" autoComplete="new-password" className={errors.password ? 'invalid' : ''} value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('phone')}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('email')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('city')}</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('gender')}</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">{t('selectGender')}</option>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
              </select>
            </div>

            <div className="admin-field full">
              <label>{t('program')} *</label>
              <SearchableSelect value={form.programId} onChange={v => set('programId', v)} options={programOptions} placeholder={t('selectProgram')} error={errors.programId} />
              {selectedProgram && <ProgramInfo program={selectedProgram} t={t} />}
            </div>

            <div className="admin-field">
              <label>{t('trainer')}</label>
              <SearchableSelect value={form.supervisorId} onChange={v => set('supervisorId', v)} options={trainerOptions} placeholder={t('noTrainerYet')} disabled={!form.programId} />
            </div>
            <div className="admin-field">
              <label>{t('researchTrainer')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>{t('researchHint')}</span></label>
              <SearchableSelect value={form.researchSupervisorId} onChange={v => set('researchSupervisorId', v)} options={trainerOptions} placeholder={t('researchTrainer')} disabled={!form.programId} />
            </div>
          </div>
          <ErrBox msg={apiErr} />
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('create')}</button>
        </div>
      </div>
    </div>
  );
}

function EditTraineeModal({ trainee, t, dir, onClose, onSaved }) {
  const programId = idOf(trainee.programId);
  const [form, setForm] = useState({
    name: trainee.name || '',
    phone: trainee.phone || '',
    city: trainee.city || '',
    gender: trainee.gender || '',
    supervisorId: idOf(trainee.supervisorId),
    researchSupervisorId: idOf(trainee.researchSupervisorId),
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const trainers = useProgramTrainers(programId);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setApiErr(''); }

  async function handleSave() {
    if (!form.name.trim()) { setErrors({ name: true }); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        gender: form.gender,
        supervisorId: form.supervisorId || null,           // clearable → none
        researchSupervisorId: form.researchSupervisorId || null,
      };
      const res = await api.patch(`/api/central/trainees/${trainee._id}`, payload);
      onSaved(res.data || {});
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  const trainerOptions = trainers.map(tr => ({ value: tr._id, label: trainerOptionLabel(tr) }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg" dir={dir} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('editTrainee')} · {trainee.name}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>{t('name')} *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('phone')}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('city')}</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('gender')}</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">{t('selectGender')}</option>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
              </select>
            </div>
            <div className="admin-field">
              <label>{t('trainer')}</label>
              <SearchableSelect value={form.supervisorId} onChange={v => set('supervisorId', v)} options={trainerOptions} placeholder={t('noTrainerYet')} />
            </div>
            <div className="admin-field">
              <label>{t('researchTrainer')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>{t('researchHint')}</span></label>
              <SearchableSelect value={form.researchSupervisorId} onChange={v => set('researchSupervisorId', v)} options={trainerOptions} placeholder={t('researchTrainer')} />
            </div>
          </div>
          <ErrBox msg={apiErr} />
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
        </div>
      </div>
    </div>
  );
}

// Pending change-requests panel (the secretary's own queued edits).
function PendingRequests({ items, t, onCancel }) {
  if (!items.length) return null;
  return (
    <div className="admin-card" style={{ marginBottom: 16 }}>
      <div className="admin-card-header"><div className="admin-card-title">{t('pendingTitle')} ({items.length})</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
        {items.map(cr => {
          const summary = Array.isArray(cr.display) && cr.display.length
            ? cr.display.map(d => `${d.label}: ${d.from} → ${d.to}`).join('  ·  ')
            : t('noChanges');
          return (
            <div key={cr._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{cr.targetLabel || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</div>
              </div>
              <button className="btn-outline" style={{ fontSize: 12, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }} onClick={() => onCancel(cr)}>
                <IconXCircle size={14} /> {t('cancelReq')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CentralTrainees() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [trainees, setTrainees] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [countryMap, setCountryMap] = useState({});
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTrainee, setEditTrainee] = useState(null);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  const loadPending = useCallback(async () => {
    try {
      const r = await api.get('/api/central/change-requests', { params: { status: 'pending' }, cache: false });
      setPending(r.data?.data || r.data || []);
    } catch { /* non-fatal */ }
  }, []);

  // Programs + countries load once.
  useEffect(() => {
    api.get('/api/central/programs').then(r => setPrograms(r.data?.data || r.data || [])).catch(() => setPrograms([]));
    api.get('/api/countries').then(r => {
      const map = {};
      (r.data?.data || r.data || []).forEach(c => { map[c._id] = c; });
      setCountryMap(map);
    }).catch(() => setCountryMap({}));
    loadPending();
  }, [loadPending]);

  const loadTrainees = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/central/trainees', { params: includeInactive ? { includeInactive: 'true' } : {}, cache: false });
      setTrainees(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'error'); }
    setLoading(false);
  }, [includeInactive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadTrainees(); }, [loadTrainees]);

  async function handleCancelRequest(cr) {
    try {
      await api.patch(`/api/central/change-requests/${cr._id}/cancel`);
      setPending(prev => prev.filter(x => x._id !== cr._id));
      showToast(t('reqCancelled'));
    } catch (err) { showToast(err.response?.data?.message || 'Cancel failed', 'error'); }
  }

  const programFilterOptions = [{ value: '', label: t('allPrograms') }, ...programs.map(p => ({ value: p._id, label: programOptionLabel(p) }))];

  const filtered = trainees.filter(tr => {
    if (programFilter && idOf(tr.programId) !== programFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !((tr.name || '').toLowerCase().includes(q) || (tr.idNumber || '').toLowerCase().includes(q))) return false;
    return true;
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /><Sk w={180} h={36} r={8} /><Sk w={130} h={36} r={8} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(7)].map((_, i) => (
                <tr key={i}><td><Sk w={130} h={13} /></td><td><Sk w={80} h={13} /></td><td><Sk w={120} h={13} /></td><td><Sk w={110} h={13} /></td><td><Sk w={90} h={13} /></td><td><Sk w={40} h={22} r={20} /></td><td><Sk w={100} h={13} /></td><td><Sk w={60} h={22} r={20} /></td><td><Sk w={36} h={36} r={8} /></td></tr>
              ))}
            </tbody></table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>

        <PendingRequests items={pending} t={t} onCancel={handleCancelRequest} />

        <div className="admin-card">
          <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input className="admin-search" style={{ flex: 1, minWidth: 200 }} placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ minWidth: 200 }}>
              <SearchableSelect value={programFilter} onChange={setProgramFilter} options={programFilterOptions} placeholder={t('allPrograms')} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
              {t('includeInactive')}
            </label>
            <button className="btn-primary" onClick={() => setAddOpen(true)}>+ {t('addTrainee')}</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('name')}</th><th>{t('idNumber')}</th><th>{t('program')}</th>
                  <th>{t('center')}</th><th>{t('country')}</th><th>{t('year')}</th>
                  <th>{t('trainerCol')}</th><th>{t('active')}</th><th>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{trainees.length === 0 ? t('none') : t('noMatch')}</td></tr>
                )}
                {filtered.map(tr => {
                  const active = tr.isActive !== false;
                  const yr = tr.trainingYear;
                  const country = countryMap[idOf(tr.countryId)];
                  return (
                    <tr key={tr._id}>
                      <td><strong>{tr.name}</strong></td>
                      <td>{tr.idNumber || '—'}</td>
                      <td>{tr.programId?.name || '—'}</td>
                      <td>{tr.hospitalId?.name || '—'}</td>
                      <td>{country ? countryLabel(country) : '—'}</td>
                      <td>{yr >= 1 && yr <= 6 ? <span className="badge badge-blue">Y{yr}</span> : '—'}</td>
                      <td>{tr.supervisorId?.name || '—'}</td>
                      <td>
                        <span className={`badge ${active ? 'badge-green' : 'badge-blue'}`} style={active ? {} : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {active ? t('statusActive') : t('statusInactive')}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit" title={t('editTrainee')} aria-label={t('editTrainee')} onClick={() => setEditTrainee(tr)}><IconPencil /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {addOpen && (
          <AddTraineeModal programs={programs} t={t} dir={dir}
            onClose={() => setAddOpen(false)}
            onSaved={() => { setAddOpen(false); loadTrainees(); showToast(t('created')); }} />
        )}
        {editTrainee && (
          <EditTraineeModal trainee={editTrainee} t={t} dir={dir}
            onClose={() => setEditTrainee(null)}
            onSaved={(res) => {
              setEditTrainee(null);
              if (res?.pending) { showToast(t('pendingApproval')); loadPending(); }
              else loadTrainees();
            }} />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
