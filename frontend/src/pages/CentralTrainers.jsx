// frontend/src/pages/CentralTrainers.jsx
//
// Central Secretary's global trainer (supervisor) management. Trainers are
// created against a PROGRAM (one program each); the program fixes the
// center/country/specialty. Edits queue as ODIO-approved ChangeRequests.
// Contract (backend/routes/centralSecretary.js):
//   GET  /api/central/trainers[?includeInactive=true]
//   GET  /api/central/programs
//   POST /api/central/trainers  { name, idNumber, password, email?, phone?, city?, gender?, programId }
//   PATCH /api/central/trainers/:id → 202 { pending:true } (queued for ODIO)
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import Sk from '../components/Skeleton';
import { IconPencil } from '../components/icons';
import api from '../api/axios';

const STRINGS = {
  ar: {
    title: 'المدربون', search: 'ابحث بالاسم أو الرقم التعريفي…',
    allPrograms: 'كل البرامج', includeInactive: 'إظهار المعطّلين',
    addTrainer: 'إضافة مدرب', newTrainer: 'مدرب جديد', editTrainer: 'تعديل المدرب',
    name: 'الاسم', idNumber: 'الرقم التعريفي', password: 'كلمة المرور',
    email: 'البريد الإلكتروني', phone: 'الهاتف', city: 'المدينة',
    gender: 'الجنس', selectGender: '— اختر —', male: 'ذكر', female: 'أنثى',
    program: 'البرنامج', selectProgram: 'اختر برنامجاً…',
    pd: 'مدير البرنامج', center: 'المركز', country: 'الدولة', capacity: 'السعة',
    active: 'الحالة', statusActive: 'نشط', statusInactive: 'معطّل', action: 'الإجراء',
    none: 'لا يوجد مدربون بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…', create: 'إنشاء',
    created: 'تمت إضافة المدرب', pendingApproval: 'تم إرسال التغيير إلى الـ ODIO للموافقة',
    loadFailed: 'فشل التحميل', passwordHint: '(6 أحرف على الأقل)',
  },
  en: {
    title: 'Trainers', search: 'Search by name or ID number…',
    allPrograms: 'All programs', includeInactive: 'Show inactive',
    addTrainer: 'Add Trainer', newTrainer: 'New Trainer', editTrainer: 'Edit Trainer',
    name: 'Name', idNumber: 'ID Number', password: 'Password',
    email: 'Email', phone: 'Phone', city: 'City',
    gender: 'Gender', selectGender: '— Select —', male: 'Male', female: 'Female',
    program: 'Program', selectProgram: 'Select a program…',
    pd: 'Program Director', center: 'Center', country: 'Country', capacity: 'Capacity',
    active: 'Status', statusActive: 'Active', statusInactive: 'Inactive', action: 'Action',
    none: 'No trainers yet.', noMatch: 'No matching results.',
    cancel: 'Cancel', save: 'Save', saving: 'Saving…', create: 'Create',
    created: 'Trainer added', pendingApproval: 'Sent to the ODIO for approval',
    loadFailed: 'Failed to load', passwordHint: '(min 6 chars)',
  },
};

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{msg}</div>;
}

function idOf(v) { return v?._id || v || ''; }
function countryLabel(c) { return c ? (c.code ? `${c.name} (${c.code})` : c.name) : '—'; }
function programOptionLabel(p) { return `${p.name}${p.trainingCenterId?.name ? ` — ${p.trainingCenterId.name}` : ''}`; }

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

function AddTrainerModal({ programs, t, dir, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', idNumber: '', password: '', email: '', phone: '', city: '', gender: '', programId: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const selectedProgram = programs.find(p => p._id === form.programId) || null;

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setApiErr(''); }

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
      };
      if (form.email.trim()) payload.email = form.email.trim();
      const res = await api.post('/api/central/trainers', payload);
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  const programOptions = programs.map(p => ({ value: p._id, label: programOptionLabel(p) }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg" dir={dir} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('newTrainer')}</div>
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

function EditTrainerModal({ trainer, t, dir, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: trainer.name || '',
    phone: trainer.phone || '',
    city: trainer.city || '',
    gender: trainer.gender || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

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
      };
      const res = await api.patch(`/api/central/trainers/${trainer._id}`, payload);
      onSaved(res.data || {});
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" dir={dir}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('editTrainer')} · {trainer.name}</div>
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

export default function CentralTrainers() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [trainers, setTrainers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [countryMap, setCountryMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTrainer, setEditTrainer] = useState(null);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/central/programs').then(r => setPrograms(r.data?.data || r.data || [])).catch(() => setPrograms([]));
    api.get('/api/countries').then(r => {
      const map = {};
      (r.data?.data || r.data || []).forEach(c => { map[c._id] = c; });
      setCountryMap(map);
    }).catch(() => setCountryMap({}));
  }, []);

  const loadTrainers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/central/trainers', { params: includeInactive ? { includeInactive: 'true' } : {}, cache: false });
      setTrainers(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'error'); }
    setLoading(false);
  }, [includeInactive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadTrainers(); }, [loadTrainers]);

  const programFilterOptions = [{ value: '', label: t('allPrograms') }, ...programs.map(p => ({ value: p._id, label: programOptionLabel(p) }))];

  const filtered = trainers.filter(tr => {
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
              {[...Array(6)].map((_, i) => (
                <tr key={i}><td><Sk w={130} h={13} /></td><td><Sk w={80} h={13} /></td><td><Sk w={120} h={13} /></td><td><Sk w={110} h={13} /></td><td><Sk w={90} h={13} /></td><td><Sk w={60} h={22} r={20} /></td><td><Sk w={36} h={36} r={8} /></td></tr>
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
            <button className="btn-primary" onClick={() => setAddOpen(true)}>+ {t('addTrainer')}</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('name')}</th><th>{t('idNumber')}</th><th>{t('program')}</th>
                  <th>{t('center')}</th><th>{t('country')}</th><th>{t('active')}</th><th>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{trainers.length === 0 ? t('none') : t('noMatch')}</td></tr>
                )}
                {filtered.map(tr => {
                  const active = tr.isActive !== false;
                  const country = countryMap[idOf(tr.countryId)];
                  return (
                    <tr key={tr._id}>
                      <td><strong>{tr.name}</strong></td>
                      <td>{tr.idNumber || '—'}</td>
                      <td>{tr.programId?.name || '—'}</td>
                      <td>{tr.hospitalId?.name || '—'}</td>
                      <td>{country ? countryLabel(country) : '—'}</td>
                      <td>
                        <span className={`badge ${active ? 'badge-green' : 'badge-blue'}`} style={active ? {} : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {active ? t('statusActive') : t('statusInactive')}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit" title={t('editTrainer')} aria-label={t('editTrainer')} onClick={() => setEditTrainer(tr)}><IconPencil /></button>
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
          <AddTrainerModal programs={programs} t={t} dir={dir}
            onClose={() => setAddOpen(false)}
            onSaved={() => { setAddOpen(false); loadTrainers(); showToast(t('created')); }} />
        )}
        {editTrainer && (
          <EditTrainerModal trainer={editTrainer} t={t} dir={dir}
            onClose={() => setEditTrainer(null)}
            onSaved={(res) => {
              setEditTrainer(null);
              if (res?.pending) showToast(t('pendingApproval'));
              else loadTrainers();
            }} />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
