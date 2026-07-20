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
import { useMtToast, MtToastHost } from '../components/MtToast';
import MtModal from '../components/MtModal';
import SearchableSelect from '../components/SearchableSelect';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconPencil, IconPlus, IconBuilding } from '../components/icons';
import './dio.css';

function idOf(v) { return (v?._id || v || '').toString(); }

// ── Capacity strings (bilingual — used here and in DioHospitalDetail) ────────
const CAP_STRINGS = {
  ar: {
    annualCapacity: 'السعة السنوية', trainingDuration: 'مدة التدريب', years: 'سنوات',
    notSet: 'غير محدد', thisYear: 'هذه السنة', traineesThisYear: 'متدرب هذه السنة',
    exceptions: 'استثناءات', capacityTitle: 'السعة السنوية ومدة التدريب',
    editCapacity: 'تعديل السعة', save: 'حفظ', cancel: 'إلغاء', saving: 'جارٍ الحفظ…',
    capacitySaved: 'تم حفظ الإعدادات', capacitySaveFailed: 'فشل حفظ الإعدادات',
    emptyClears: 'اترك حقل السعة/المدة فارغاً لإلغاء التحديد («غير محدد»).',
    invalidNumber: 'أدخل رقماً صحيحاً موجباً',
    specialty: 'التخصص',
    panelTitle: 'إعدادات السعة والسكرتارية', panelSubtitle: 'حدّد السعة السنوية ومدة التدريب والسكرتير لكل تخصص في هذا المستشفى.',
    secretary: 'السكرتير', unassigned: '— بدون سكرتير —', noConfigurableSpecs: 'لا توجد تخصصات قابلة للإعداد.',
    someFailed: 'تعذّر حفظ بعض التغييرات',
  },
  en: {
    annualCapacity: 'Annual Capacity', trainingDuration: 'Training Duration', years: 'Years',
    notSet: 'Not set', thisYear: 'this year', traineesThisYear: 'trainees this year',
    exceptions: 'exceptions', capacityTitle: 'Annual Capacity & Training Duration',
    editCapacity: 'Edit Capacity', save: 'Save', cancel: 'Cancel', saving: 'Saving…',
    capacitySaved: 'Settings saved', capacitySaveFailed: 'Failed to save settings',
    emptyClears: 'Leave a capacity/duration field empty to clear it ("Not set").',
    invalidNumber: 'Enter a valid non-negative number',
    specialty: 'Specialty',
    panelTitle: 'Capacity & Secretary Settings', panelSubtitle: 'Set the annual capacity, training duration and secretary for each specialty at this hospital.',
    secretary: 'Secretary', unassigned: '— No secretary —', noConfigurableSpecs: 'No configurable specialties.',
    someFailed: 'Some changes could not be saved',
  },
};
export const capT = (lang, k) => CAP_STRINGS[lang]?.[k] ?? CAP_STRINGS.en[k] ?? k;

// ── Edit capacity + training duration + secretary for ALL specialties (DIO) ──
export function HospitalCapacityModal({ hospital, specialties, caps, secretaries, onClose, onSaved, onReload }) {
  const { lang } = usePrefs();
  const t = k => capT(lang, k);

  const rowsSpecs = (specialties || []).filter(sp => sp._id); // only configurable specialties
  const [rows, setRows] = useState(() => Object.fromEntries(rowsSpecs.map(sp => {
    const e = caps?.[idOf(sp)] || {};
    return [idOf(sp), {
      cap: e.annualCapacity ?? '',
      dur: e.trainingDurationYears ?? '',
      secretaryId: idOf(sp.secretary) || '',
    }];
  })));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  function setRow(id, k, v) {
    setRows(r => ({ ...r, [id]: { ...r[id], [k]: v } }));
    setErrors(e => ({ ...e, [id]: { ...e[id], [k]: false } }));
    setApiErr('');
  }

  // '' clears (sent as null); otherwise a non-negative integer. undefined = invalid.
  function parseVal(v) {
    if (v === '' || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
  }

  async function save() {
    const errs = {};
    rowsSpecs.forEach(sp => {
      const id = idOf(sp); const row = rows[id];
      if (parseVal(row.cap) === undefined) errs[id] = { ...errs[id], cap: true };
      if (parseVal(row.dur) === undefined) errs[id] = { ...errs[id], dur: true };
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const calls = [];
    rowsSpecs.forEach(sp => {
      const id = idOf(sp); const row = rows[id];
      const orig = caps?.[id] || {};
      const capVal = parseVal(row.cap), durVal = parseVal(row.dur);
      if ((orig.annualCapacity ?? null) !== capVal || (orig.trainingDurationYears ?? null) !== durVal) {
        calls.push(api.patch(`/api/dio/hospitals/${hospital._id}/specialty-settings`,
          { specialtyId: id, annualCapacity: capVal, trainingDurationYears: durVal }));
      }
      const origSec = idOf(sp.secretary) || '';
      if ((row.secretaryId || '') !== origSec) {
        calls.push(api.patch(`/api/dio/hospitals/${hospital._id}/specialty-secretary`,
          { specialtyId: id, secretaryId: row.secretaryId || null }));
      }
    });

    if (!calls.length) { onClose(); return; }
    setSaving(true); setApiErr('');
    const results = await Promise.allSettled(calls);
    setSaving(false);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      setApiErr(failed[0].reason?.response?.data?.message || t('someFailed'));
      onReload && onReload(); // reflect whatever succeeded
      return;
    }
    onSaved(t('capacitySaved'));
    onClose();
  }

  // A secretary belongs to one specialty — match by specialty name so each row
  // only offers the secretaries assigned to that specialty.
  const norm = v => String(v || '').trim().toLowerCase();
  const secSpecName = s => s.specialtyId?.name || s.specialty || '';

  return (
    <MtModal open title={t('panelTitle')} sub={hospital.name} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
          <button className="mt-btn" onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</button>
        </>
      )}>
      <div className="mt-card-sub" style={{ marginBlockEnd: 12 }}>{t('panelSubtitle')}</div>
      {rowsSpecs.length === 0 ? (
        <div className="mt-card-sub" style={{ padding: '16px 0' }}>{t('noConfigurableSpecs')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rowsSpecs.map(sp => {
            const id = idOf(sp); const row = rows[id]; const err = errors[id] || {};
            const rowOpts = (secretaries || [])
              .filter(s => norm(secSpecName(s)) === norm(sp.name))
              .map(s => ({ id: idOf(s), name: s.name }));
            const cur = row.secretaryId;
            const curInList = !cur || rowOpts.some(o => o.id === cur);
            return (
              <div key={id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface-2)' }}>
                <span className="mt-pill mt-pill--role" style={{ marginBlockEnd: 10 }}>{sp.name}</span>
                <div className="mt-field-grid" style={{ marginBlockStart: 10 }}>
                  <div className="mt-field">
                    <label className="mt-label">{t('annualCapacity')}</label>
                    <input className="mt-input" style={{ borderColor: err.cap ? 'var(--danger)' : undefined }} type="number" min={0} value={row.cap}
                      placeholder={t('notSet')} onChange={e => setRow(id, 'cap', e.target.value)} />
                  </div>
                  <div className="mt-field">
                    <label className="mt-label">{t('trainingDuration')} ({t('years')})</label>
                    <input className="mt-input" style={{ borderColor: err.dur ? 'var(--danger)' : undefined }} type="number" min={0} value={row.dur}
                      placeholder={t('notSet')} onChange={e => setRow(id, 'dur', e.target.value)} />
                  </div>
                  <div className="mt-field">
                    <label className="mt-label">{t('secretary')}</label>
                    <select className="mt-select" value={row.secretaryId} onChange={e => setRow(id, 'secretaryId', e.target.value)}>
                      <option value="">{t('unassigned')}</option>
                      {!curInList && <option value={cur}>{sp.secretary?.name || cur}</option>}
                      {rowOpts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-card-sub" style={{ marginBlockStart: 10 }}>{t('emptyClears')}</div>
      {apiErr && <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)', marginBlock: '14px 0' }}>{apiErr}</div>}
    </MtModal>
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
    <MtModal open title={isEdit ? 'Edit Hospital' : 'Add Hospital'} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Hospital'}</button>
        </>
      )}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">Hospital Name <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={{ borderColor: errors.name ? 'var(--danger)' : undefined }} value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="Hospital name" />
        </div>
        <div className="mt-field">
          <label className="mt-label">City</label>
          <input className="mt-input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Governorate</label>
          <input className="mt-input" value={form.governorate} onChange={e => set('governorate', e.target.value)} placeholder="Governorate" />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Address</label>
          <input className="mt-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address" />
        </div>
      </div>
      {apiErr && <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)', marginBlock: '14px 0' }}>{apiErr}</div>}
    </MtModal>
  );
}

// ── Add specialty to a hospital ────────────────────────────────────────────
export function SpecialtyModal({ hospital, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

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
    <MtModal open title={`Add Specialty · ${hospital.name}`} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Specialty'}</button>
        </>
      )}>
      <div className="mt-field">
        <label className="mt-label">Specialty Name <span className="mt-label-req">*</span></label>
        <input className="mt-input" style={{ borderColor: err ? 'var(--danger)' : undefined }} value={name} autoFocus
          onChange={e => { setName(e.target.value); setErr(false); setApiErr(''); }}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="e.g. Cardiology" />
      </div>
      {apiErr && <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)', marginBlock: '14px 0' }}>{apiErr}</div>}
    </MtModal>
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
    <MtModal open title={`Add ${label} · ${hospital.name}`} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Create ${label}`}</button>
        </>
      )}>
      <div className="mt-field-grid">
        <div className="mt-field">
          <label className="mt-label">Full Name <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={{ borderColor: errors.name ? 'var(--danger)' : undefined }} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dr. …" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Email <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={{ borderColor: errors.email ? 'var(--danger)' : undefined }} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Password <span className="mt-label-req">*</span> (min 6 chars)</label>
          <input className="mt-input" style={{ borderColor: errors.password ? 'var(--danger)' : undefined }} type="password" value={form.password}
            autoComplete="new-password" onChange={e => set('password', e.target.value)} placeholder="••••••••" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Phone <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={{ borderColor: errors.phone ? 'var(--danger)' : undefined }} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 …" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Department</label>
          <input className="mt-input" value={form.department} onChange={e => set('department', e.target.value)} />
        </div>
        {isSup && (
          <div className="mt-field">
            <label className="mt-label">Specialty <span className="mt-label-req">*</span></label>
            <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)}
              options={specOptions} placeholder="Search specialty…" error={errors.specialtyId} />
          </div>
        )}
      </div>
      {isSup && specOptions.length === 0 && (
        <div className="mt-banner" style={{ background: 'var(--warning-bg)', borderInlineStartColor: 'var(--accent)', color: 'var(--warning-fg)', marginBlock: '12px 0' }}>
          This hospital has no specialties yet — add one first, or pick a shared specialty.
        </div>
      )}
      {apiErr && <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)', marginBlock: '14px 0' }}>{apiErr}</div>}
    </MtModal>
  );
}

function Section({ title, count, children }) {
  return (
    <div>
      <div className="mt-acct-k" style={{ marginBlockEnd: 8 }}>{title}{count !== undefined ? ` (${count})` : ''}</div>
      {children}
    </div>
  );
}
function Muted({ children }) { return <div className="mt-card-sub">{children}</div>; }

// Compact one-line capacity summary for a specialty.
function capacitySummary(entry, lang) {
  const t = k => capT(lang, k);
  const capSet = entry != null && entry.annualCapacity != null;
  const durSet = entry != null && entry.trainingDurationYears != null;
  const parts = [
    `${t('annualCapacity')}: ${capSet ? entry.annualCapacity : t('notSet')}`,
    `${t('trainingDuration')}: ${durSet ? `${entry.trainingDurationYears} ${t('years')}` : t('notSet')}`,
  ];
  if (capSet && entry.used != null) parts.push(`${entry.used} / ${entry.annualCapacity} ${t('thisYear')}`);
  return parts.join(' · ');
}

function HospitalCard({ h, caps, onAction, onOpen, onEditCapacity }) {
  const { lang } = usePrefs();
  const location = [h.city, h.governorate].filter(Boolean).join(' · ') || '—';
  return (
    <div className="mt-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px', borderBlockEnd: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={onOpen} title="Open hospital page" role="link">
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{h.name}</div>
          <div className="mt-card-sub" style={{ marginBlockStart: 2 }}>{location} · <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>View page →</span></div>
        </div>
        <button className="mt-icon-action" title="Edit hospital" aria-label={`Edit ${h.name}`} onClick={() => onAction('hospital', h)}>
          <IconPencil size={15} />
        </button>
      </div>

      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="Program Director">
          {h.programDirectors.length === 0
            ? <Muted>Not assigned</Muted>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {h.programDirectors.map(pd => (
                  <div key={pd._id} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{pd.name}
                    {pd.department ? <span className="mt-card-sub"> · {pd.department}</span> : null}</div>
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
                    <div key={sp._id || sp.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span className="mt-pill mt-pill--role">{sp.name}</span>
                        <span style={{ fontSize: 12, color: sp.secretary ? 'var(--text-2)' : 'var(--text-2)', textAlign: 'end' }}>
                          {sp.secretary ? sp.secretary.name : 'No secretary'}
                        </span>
                      </div>
                      <div className="mt-card-sub">
                        {capacitySummary(entry, lang)}
                        {entry?.exceptionsUsed > 0 && (
                          <span style={{ color: 'var(--warning-fg)' }}> · +{entry.exceptionsUsed} {capT(lang, 'exceptions')}</span>
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
                  <span key={s._id} title={s.email || ''} className="mt-pill mt-pill--neutral">
                    {s.name}{s.specialty ? <span style={{ color: 'var(--text-2)' }}> · {s.specialty}</span> : null}
                  </span>
                ))}
              </div>}
        </Section>

        {/* Management actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderBlockStart: '1px solid var(--border)', paddingBlockStart: 12 }}>
          <button className="mt-btn--small-outline" onClick={() => onAction('specialty', h)}><IconPlus size={14} /> Specialty</button>
          <button className="mt-btn--small-outline" onClick={() => onAction('supervisor', h)}><IconPlus size={14} /> Supervisor</button>
          <button className="mt-btn--small-outline" onClick={() => onAction('pd', h)}><IconPlus size={14} /> Program Director</button>
          <button className="mt-btn--small-outline" onClick={() => onEditCapacity(h)}><IconPencil size={13} /> {capT(lang, 'editCapacity')}</button>
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
  const [secretaries, setSecretaries] = useState([]); // for the capacity panel's secretary dropdown
  const [caps, setCaps] = useState({}); // hospitalId → { specialtyId → capacity entry }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { type, hospital, specialty? }
  const { toasts, showToast } = useMtToast();

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
    const [oRes, sRes, secRes] = await Promise.allSettled([
      api.get('/api/dio/hospitals-overview'),
      api.get('/api/specialties'),
      api.get('/api/dio/secretaries'),
    ]);
    if (oRes.status === 'fulfilled') {
      const hs = oRes.value.data?.data || oRes.value.data || [];
      setHospitals(hs);
      loadCaps(hs);
    } else showToast('Failed to load hospitals', 'dng');
    if (sRes.status === 'fulfilled') setSpecialties(sRes.value.data?.data || sRes.value.data || []);
    if (secRes.status === 'fulfilled') setSecretaries(secRes.value.data?.data || secRes.value.data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCaps]);

  useEffect(() => { load(); }, [load]);

  function onSaved(message) { showToast(message, 'ok'); load(); }

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
      <main className="mt-content">
        <div className="mt-filterbar"><Sk h={38} r={8} style={{ flex: 1 }} /><Sk w={130} h={38} r={9} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mt-card">
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
      <main className="mt-content">
        <div className="mt-filterbar">
          <div className="mt-search">
            <input placeholder="Search by hospital, city, specialty or supervisor…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="mt-filterbar-spacer" />
          <span className="mt-count">{filtered.length} hospital{filtered.length !== 1 ? 's' : ''}</span>
          <button className="mt-btn mt-btn--small" onClick={() => setModal({ type: 'hospital', hospital: null })}>+ Add Hospital</button>
        </div>

        {filtered.length === 0 && (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconBuilding size={22} /></div>
            <div className="mt-empty-title">
              {hospitals.length === 0 ? 'No hospitals yet. Click "+ Add Hospital".' : 'No hospitals match your search.'}
            </div>
          </div>
        )}

        <div key={search} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, animation: 'fadeIn .18s ease-out' }}>
          {filtered.map(h => (
            <HospitalCard key={h._id} h={h} caps={caps[h._id]} onAction={handleAction}
              onOpen={() => navigate(bp + `/dio/hospitals/${h._id}`)}
              onEditCapacity={hosp => setModal({ type: 'capacity', hospital: hosp })} />
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
          <HospitalCapacityModal hospital={modal.hospital} specialties={modal.hospital.specialties}
            caps={caps[modal.hospital._id]} secretaries={secretaries}
            onClose={() => setModal(null)}
            onSaved={msg => { showToast(msg, 'ok'); load(); }}
            onReload={() => load()} />
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
