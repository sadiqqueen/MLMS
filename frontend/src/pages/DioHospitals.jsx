// frontend/src/pages/DioHospitals.jsx
//
// DIO hospitals management + organisational overview. Per hospital (in the
// DIO's track): program director(s), supervisors, and specialties — each
// specialty with its secretary. The DIO can add/edit hospitals, add specialties
// to a hospital, and add supervisors / program directors to it.
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useBasePath from '../hooks/useBasePath';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconPencil, IconPlus } from '../components/icons';

function idOf(v) { return (v?._id || v || '').toString(); }

// ── Capacity strings (bilingual — used here and in DioHospitalDetail) ────────
const CAP_STRINGS = {
  ar: {
    annualCapacity: 'السعة السنوية', trainingDuration: 'مدة التدريب', months: 'أشهر',
    notSet: 'غير محدد', thisYear: 'هذه السنة', traineesThisYear: 'متدرب هذه السنة',
    exceptions: 'استثناءات', capacityTitle: 'السعة السنوية ومدة التدريب',
    editCapacity: 'تعديل السعة', save: 'حفظ', cancel: 'إلغاء', saving: 'جارٍ الحفظ…',
    capacitySaved: 'تم حفظ إعدادات السعة', capacitySaveFailed: 'فشل حفظ إعدادات السعة',
    emptyClears: 'اترك الحقل فارغاً لإلغاء التحديد («غير محدد»).',
    invalidNumber: 'أدخل رقماً صحيحاً موجباً',
    specialty: 'التخصص',
  },
  en: {
    annualCapacity: 'Annual Capacity', trainingDuration: 'Training Duration', months: 'Months',
    notSet: 'Not set', thisYear: 'this year', traineesThisYear: 'trainees this year',
    exceptions: 'exceptions', capacityTitle: 'Annual Capacity & Training Duration',
    editCapacity: 'Edit Capacity', save: 'Save', cancel: 'Cancel', saving: 'Saving…',
    capacitySaved: 'Capacity settings saved', capacitySaveFailed: 'Failed to save capacity settings',
    emptyClears: 'Leave a field empty to clear it ("Not set").',
    invalidNumber: 'Enter a valid non-negative number',
    specialty: 'Specialty',
  },
};
export const capT = (lang, k) => CAP_STRINGS[lang]?.[k] ?? CAP_STRINGS.en[k] ?? k;

// ── Edit per-specialty capacity + training duration (DIO) ────────────────────
export function CapacityModal({ hospital, specialty, entry, onClose, onSaved }) {
  const { lang } = usePrefs();
  const t = k => capT(lang, k);
  const [cap, setCap] = useState(entry?.annualCapacity ?? '');
  const [dur, setDur] = useState(entry?.trainingDurationMonths ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // '' clears the value (sent as null); otherwise it must be a non-negative number.
  function parseVal(v) {
    if (v === '' || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined; // undefined = invalid
  }

  async function save() {
    const capVal = parseVal(cap);
    const durVal = parseVal(dur);
    const e = {};
    if (capVal === undefined) e.cap = true;
    if (durVal === undefined) e.dur = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      await api.patch(`/api/dio/hospitals/${hospital._id}/specialty-settings`, {
        specialtyId: specialty._id,
        annualCapacity: capVal,
        trainingDurationMonths: durVal,
      });
      onSaved(t('capacitySaved'));
      onClose();
    } catch (err) { setApiErr(err.response?.data?.message || t('capacitySaveFailed')); }
    finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('editCapacity')} · {specialty.name}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>🏥 {hospital.name}</div>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>{t('annualCapacity')}</label>
              <input className={errors.cap ? 'invalid' : ''} type="number" min={0} value={cap}
                onChange={e => { setCap(e.target.value); setErrors(x => ({ ...x, cap: false })); setApiErr(''); }}
                placeholder={t('notSet')} />
              {errors.cap && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{t('invalidNumber')}</span>}
            </div>
            <div className="admin-field">
              <label>{t('trainingDuration')} ({t('months')})</label>
              <input className={errors.dur ? 'invalid' : ''} type="number" min={0} value={dur}
                onChange={e => { setDur(e.target.value); setErrors(x => ({ ...x, dur: false })); setApiErr(''); }}
                placeholder={t('notSet')} />
              {errors.dur && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{t('invalidNumber')}</span>}
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>{t('emptyClears')}</div>
          {apiErr && <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{apiErr}</div>}
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-purple" onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit hospital ────────────────────────────────────────────────────
export function HospitalModal({ hospital, onClose, onSaved }) {
  const isEdit = !!hospital?._id;
  const [form, setForm] = useState({
    name: hospital?.name || '', city: hospital?.city || '',
    governorate: hospital?.governorate || '', address: hospital?.address || '',
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

  async function save() {
    if (!form.name.trim()) { setErrors({ name: true }); return; }
    setSaving(true); setApiErr('');
    try {
      if (isEdit) await api.patch(`/api/hospitals/${hospital._id}`, form);
      else await api.post('/api/hospitals', form);
      onSaved(isEdit ? 'Hospital updated' : 'Hospital added');
      onClose();
    } catch (err) { setApiErr(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? 'Edit Hospital' : 'Add Hospital'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>Hospital Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name}
                onChange={e => set('name', e.target.value)} placeholder="Hospital name" />
            </div>
            <div className="admin-field">
              <label>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>
            <div className="admin-field">
              <label>Governorate</label>
              <input value={form.governorate} onChange={e => set('governorate', e.target.value)} placeholder="Governorate" />
            </div>
            <div className="admin-field full">
              <label>Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address" />
            </div>
          </div>
          {apiErr && <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{apiErr}</div>}
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={save} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Hospital'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add specialty to a hospital ────────────────────────────────────────────
export function SpecialtyModal({ hospital, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function save() {
    if (!name.trim()) { setErr(true); return; }
    setSaving(true); setApiErr('');
    try {
      await api.post('/api/specialties', { name: name.trim(), hospitalId: hospital._id });
      onSaved('Specialty added');
      onClose();
    } catch (e) { setApiErr(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div className="admin-modal-title">Add Specialty · {hospital.name}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-field">
            <label>Specialty Name *</label>
            <input className={err ? 'invalid' : ''} value={name} autoFocus
              onChange={e => { setName(e.target.value); setErr(false); setApiErr(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="e.g. Cardiology" />
          </div>
          {apiErr && <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{apiErr}</div>}
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Specialty'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add supervisor / program director to a hospital ────────────────────────
export function StaffModal({ role, hospital, specialties, onClose, onSaved }) {
  const isSup = role === 'supervisor';
  const label = isSup ? 'Supervisor' : 'Program Director';
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', department: '', specialtyId: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setApiErr(''); }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.email.trim()) e.email = true;
    if (!form.password || form.password.length < 6) e.password = true;
    if (!form.phone.trim()) e.phone = true;
    if (isSup && !form.specialtyId) e.specialtyId = true;
    return e;
  }

  async function save() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(), email: form.email.trim(), password: form.password,
        phone: form.phone, department: form.department, hospitalId: hospital._id,
      };
      if (isSup) payload.specialtyId = form.specialtyId;
      const url = isSup ? '/api/dio/supervisors' : '/api/dio/program-directors';
      await api.post(url, payload);
      onSaved(`${label} added`);
      onClose();
    } catch (err) { setApiErr(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  // Offer only this hospital's own specialties (keeps the pick in-track),
  // de-duplicated by name so repeated specialty records show once.
  const specOptions = [];
  const seenSpec = new Set();
  specialties
    .filter(sp => idOf(sp.hospitalId) === hospital._id.toString())
    .forEach(sp => {
      const key = String(sp.name || '').trim().toLowerCase();
      if (!key || seenSpec.has(key)) return;
      seenSpec.add(key);
      specOptions.push({ value: sp._id, label: sp.name });
    });

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">Add {label} · {hospital.name}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Full Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dr. …" />
            </div>
            <div className="admin-field">
              <label>Email *</label>
              <input className={errors.email ? 'invalid' : ''} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>Password * (min 6 chars)</label>
              <input className={errors.password ? 'invalid' : ''} type="password" value={form.password}
                autoComplete="new-password" onChange={e => set('password', e.target.value)} placeholder="••••••••" />
            </div>
            <div className="admin-field">
              <label>Phone *</label>
              <input className={errors.phone ? 'invalid' : ''} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 …" />
            </div>
            <div className="admin-field">
              <label>Department</label>
              <input value={form.department} onChange={e => set('department', e.target.value)} />
            </div>
            {isSup && (
              <div className="admin-field">
                <label>Specialty *</label>
                <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)}
                  options={specOptions} placeholder="Search specialty..." error={errors.specialtyId} />
              </div>
            )}
          </div>
          {isSup && specOptions.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--warning-fg)', background: 'var(--warning-bg)', borderRadius: 8, padding: '8px 12px' }}>
              This hospital has no specialties yet — add one first, or pick a shared specialty.
            </div>
          )}
          {apiErr && <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{apiErr}</div>}
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Create ${label}`}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        {title}{count !== undefined ? ` (${count})` : ''}
      </div>
      {children}
    </div>
  );
}
function Muted({ children }) { return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{children}</div>; }

// Compact one-line capacity summary for a specialty: "Annual Capacity: 10 · Training Duration: 6 Months · 7 / 10 this year"
function capacitySummary(entry, lang) {
  const t = k => capT(lang, k);
  const capSet = entry != null && entry.annualCapacity != null;
  const durSet = entry != null && entry.trainingDurationMonths != null;
  const parts = [
    `${t('annualCapacity')}: ${capSet ? entry.annualCapacity : t('notSet')}`,
    `${t('trainingDuration')}: ${durSet ? `${entry.trainingDurationMonths} ${t('months')}` : t('notSet')}`,
  ];
  if (capSet && entry.used != null) parts.push(`${entry.used} / ${entry.annualCapacity} ${t('thisYear')}`);
  return parts.join(' · ');
}

function HospitalCard({ h, caps, onAction, onOpen, onEditCapacity }) {
  const { lang } = usePrefs();
  const location = [h.city, h.governorate].filter(Boolean).join(' · ') || '—';
  return (
    <div className="admin-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border, #E8E9EF)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={onOpen} title="Open hospital page" role="link">
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-secondary)' }}>🏥 {h.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{location} · <span style={{ color: 'var(--link)', fontWeight: 600 }}>View page →</span></div>
        </div>
        <button className="btn-action edit" title="Edit hospital" aria-label={`Edit ${h.name}`} onClick={() => onAction('hospital', h)}>
          <IconPencil />
        </button>
      </div>

      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="Program Director">
          {h.programDirectors.length === 0
            ? <Muted>Not assigned</Muted>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {h.programDirectors.map(pd => (
                  <div key={pd._id} style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-secondary)' }}>⭐ {pd.name}
                    {pd.department ? <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}> · {pd.department}</span> : null}</div>
                ))}
              </div>}
        </Section>

        <Section title="Specialties" count={h.specialties.length}>
          {h.specialties.length === 0
            ? <Muted>No specialties yet</Muted>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {h.specialties.map(sp => {
                  const entry = sp._id ? caps?.[idOf(sp)] : null;
                  return (
                    <div key={sp._id || sp.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '7px 10px', border: '1px solid var(--border-soft, #F0F0F0)', borderRadius: 8, background: 'var(--surface-2, #FAFAFC)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'var(--chip-spec-bg)', color: 'var(--chip-spec-fg)', whiteSpace: 'nowrap' }}>{sp.name}</span>
                        <span style={{ fontSize: 12, color: sp.secretary ? 'var(--text-2)' : 'var(--text-muted)', textAlign: 'right' }}>
                          {sp.secretary ? `📋 ${sp.secretary.name}` : 'No secretary'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {capacitySummary(entry, lang)}
                          {entry?.exceptionsUsed > 0 && (
                            <span style={{ color: 'var(--warning-fg)' }}> · +{entry.exceptionsUsed} {capT(lang, 'exceptions')}</span>
                          )}
                        </span>
                        {sp._id && (
                          <button className="btn-action edit" style={{ width: 24, height: 24, flexShrink: 0 }}
                            title={capT(lang, 'editCapacity')} aria-label={`${capT(lang, 'editCapacity')} · ${sp.name}`}
                            onClick={() => onEditCapacity(h, sp)}>
                            <IconPencil size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>}
        </Section>

        <Section title="Supervisors" count={h.supervisors.length}>
          {h.supervisors.length === 0
            ? <Muted>None assigned</Muted>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {h.supervisors.map(s => (
                  <span key={s._id} title={s.email || ''} style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                    {s.name}{s.specialty ? <span style={{ color: 'var(--text-muted)' }}> · {s.specialty}</span> : null}
                  </span>
                ))}
              </div>}
        </Section>

        {/* Management actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--border-soft, #F0F0F0)', paddingTop: 12 }}>
          <button className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }} onClick={() => onAction('specialty', h)}><IconPlus size={14} /> Specialty</button>
          <button className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }} onClick={() => onAction('supervisor', h)}><IconPlus size={14} /> Supervisor</button>
          <button className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }} onClick={() => onAction('pd', h)}><IconPlus size={14} /> Program Director</button>
        </div>
      </div>
    </div>
  );
}

export default function DioHospitals() {
  const navigate = useNavigate();
  const bp = useBasePath();
  const [hospitals, setHospitals] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [caps, setCaps] = useState({}); // hospitalId → { specialtyId → capacity entry }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { type, hospital, specialty? }
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  // Per-hospital capacity settings (small N — one call per hospital).
  const loadCaps = useCallback(async (list) => {
    if (!list?.length) { setCaps({}); return; }
    const results = await Promise.allSettled(list.map(h => api.get(`/api/dio/hospitals/${h._id}/capacity`)));
    const map = {};
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      const specs = r.value.data?.data?.specialties || [];
      map[list[i]._id] = Object.fromEntries(specs.map(s => [idOf(s.specialtyId), s]));
    });
    setCaps(map);
  }, []);

  const load = useCallback(async () => {
    const [oRes, sRes] = await Promise.allSettled([
      api.get('/api/dio/hospitals-overview'),
      api.get('/api/specialties'),
    ]);
    if (oRes.status === 'fulfilled') {
      const hs = oRes.value.data?.data || oRes.value.data || [];
      setHospitals(hs);
      loadCaps(hs);
    } else showToast('Failed to load hospitals', 'error');
    if (sRes.status === 'fulfilled') setSpecialties(sRes.value.data?.data || sRes.value.data || []);
    setLoading(false);
  }, [loadCaps]);

  useEffect(() => { load(); }, [load]);

  function onSaved(message) { showToast(message); load(); }

  function handleAction(action, hospital) {
    if (action === 'hospital' || action === 'specialty') setModal({ type: action, hospital });
    else setModal({ type: 'staff', hospital, role: action === 'supervisor' ? 'supervisor' : 'program_director' });
  }

  const filtered = hospitals.filter(h => {
    const q = search.trim().toLowerCase();
    return !q
      || (h.name || '').toLowerCase().includes(q)
      || (h.city || '').toLowerCase().includes(q)
      || (h.governorate || '').toLowerCase().includes(q)
      || h.specialties.some(sp => (sp.name || '').toLowerCase().includes(q))
      || h.supervisors.some(s => (s.name || '').toLowerCase().includes(q));
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-toolbar" style={{ marginBottom: 16 }}><Sk h={36} r={8} style={{ flex: 1 }} /><Sk w={130} h={36} r={8} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="admin-card" style={{ padding: 18 }}>
              <Sk w="60%" h={18} style={{ marginBottom: 8 }} /><Sk w="40%" h={12} style={{ marginBottom: 18 }} />
              <Sk w="100%" h={60} r={8} style={{ marginBottom: 12 }} /><Sk w="100%" h={80} r={8} />
            </div>
          ))}
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-toolbar" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <input className="admin-search" style={{ flex: 1, minWidth: 200 }}
            placeholder="Search by hospital, city, specialty or supervisor…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{filtered.length} hospital{filtered.length !== 1 ? 's' : ''}</span>
          <button className="btn-purple" onClick={() => setModal({ type: 'hospital', hospital: null })}>+ Add Hospital</button>
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>
              {hospitals.length === 0 ? 'No hospitals yet. Click "+ Add Hospital".' : 'No hospitals match your search.'}
            </div>
          </div>
        )}

        <div key={search} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, animation: 'fadeIn .18s ease-out' }}>
          {filtered.map(h => (
            <HospitalCard key={h._id} h={h} caps={caps[h._id]} onAction={handleAction}
              onOpen={() => navigate(bp + `/dio/hospitals/${h._id}`)}
              onEditCapacity={(hosp, sp) => setModal({ type: 'capacity', hospital: hosp, specialty: sp })} />
          ))}
        </div>

        {modal?.type === 'hospital' && (
          <HospitalModal hospital={modal.hospital} onClose={() => setModal(null)} onSaved={onSaved} />
        )}
        {modal?.type === 'specialty' && (
          <SpecialtyModal hospital={modal.hospital} onClose={() => setModal(null)} onSaved={onSaved} />
        )}
        {modal?.type === 'staff' && (
          <StaffModal role={modal.role} hospital={modal.hospital} specialties={specialties} onClose={() => setModal(null)} onSaved={onSaved} />
        )}
        {modal?.type === 'capacity' && (
          <CapacityModal hospital={modal.hospital} specialty={modal.specialty}
            entry={caps[modal.hospital._id]?.[idOf(modal.specialty)]}
            onClose={() => setModal(null)}
            onSaved={msg => { showToast(msg); loadCaps(hospitals); }} />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
