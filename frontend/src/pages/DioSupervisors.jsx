import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useBasePath from '../hooks/useBasePath';
import Navbar from '../components/Navbar';
import { useMtToast, MtToastHost } from '../components/MtToast';
import MtModal from '../components/MtModal';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';
import { IconPencil, IconBan } from '../components/icons';
import './dio.css';

const API_BASE = '';

function textValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || fallback;
  return fallback;
}
function initialsOf(u) {
  return u.initials || u.name?.trim()?.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}
function AvatarCell({ u, size = 34 }) {
  return u.photoUrl
    ? <img src={`${API_BASE}${u.photoUrl}`} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
    : <span className="mt-acct-avatar" style={{ width: size, height: size, fontSize: size < 30 ? 11 : 13 }}>{initialsOf(u)}</span>;
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <MtModal open title={title} onClose={onCancel}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="mt-btn--danger-solid" onClick={onConfirm}>{confirmLabel}</button>
        </>
      )}>
      <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{message}</div>
    </MtModal>
  );
}

function SupervisorModal({ supervisor, hospitals, specialties, onClose, onSaved }) {
  const isEdit = !!supervisor;
  const [form, setForm] = useState({
    name:        supervisor?.name        || '',
    email:       supervisor?.email       || '',
    password:    '',
    phone:       supervisor?.phone       || '',
    department:  supervisor?.department  || '',
    hospitalId:  supervisor?.hospitalId?._id || supervisor?.hospital?._id || supervisor?.hospitalId || '',
    specialtyId: supervisor?.specialtyId?._id|| supervisor?.specialtyId || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setApiErr(''); }

  function validate() {
    const e = {};
    if (!form.name.trim())           e.name        = true;
    if (!isEdit && !form.email.trim()) e.email      = true;
    if (!isEdit && !form.password)   e.password    = true;
    if (!isEdit && form.password && form.password.length < 6) e.password = true;
    if (!form.phone.trim())          e.phone       = true;
    if (!form.hospitalId)            e.hospitalId  = true;
    if (!form.specialtyId)           e.specialtyId = true;
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name:        form.name.trim(),
        phone:       form.phone,
        department:  form.department,
        hospitalId:  form.hospitalId,
        specialtyId: form.specialtyId,
      };
      if (!isEdit) { payload.email = form.email.trim(); payload.password = form.password; }
      const res = isEdit
        ? await api.patch(`/api/dio/supervisors/${supervisor._id}`, payload)
        : await api.post('/api/dio/supervisors', payload);
      onSaved(res.data?.data || res.data, isEdit);
      onClose();
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }
  const hospitalOptions = hospitals.map(h => ({
    value: h._id,
    label: `${h.name}${h.city ? ` (${h.city})` : ''}`,
  }));
  const specialtyOptions = specialties.map(s => ({ value: s._id, label: s.name }));

  return (
    <MtModal open title={isEdit ? 'Edit Supervisor' : 'Add New Supervisor'} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Supervisor'}
          </button>
        </>
      )}>
      <div className="mt-field-grid">
        <div className="mt-field">
          <label className="mt-label">Full Name <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={{ borderColor: errors.name ? 'var(--danger)' : undefined }}
            value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dr. Jane Smith" />
        </div>
        {!isEdit && (
          <div className="mt-field">
            <label className="mt-label">Email <span className="mt-label-req">*</span></label>
            <input className="mt-input" style={{ borderColor: errors.email ? 'var(--danger)' : undefined }}
              type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
        )}
        {!isEdit && (
          <div className="mt-field">
            <label className="mt-label">Password <span className="mt-label-req">*</span> (min 6 chars)</label>
            <input className="mt-input" style={{ borderColor: errors.password ? 'var(--danger)' : undefined }}
              type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </div>
        )}
        <div className="mt-field">
          <label className="mt-label">Phone <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={{ borderColor: errors.phone ? 'var(--danger)' : undefined }}
            value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 …" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Department</label>
          <input className="mt-input" value={form.department} onChange={e => set('department', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Hospital <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.hospitalId} onChange={v => set('hospitalId', v)}
            options={hospitalOptions} placeholder="Search hospital…" error={errors.hospitalId} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Specialty <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)}
            options={specialtyOptions} placeholder="Search specialty…" error={errors.specialtyId} />
        </div>
      </div>
      {apiErr && (
        <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)', marginBlock: '14px 0' }}>
          {apiErr}
        </div>
      )}
    </MtModal>
  );
}

export default function DioSupervisors() {
  const navigate = useNavigate();
  const bp = useBasePath();
  const [supervisors,   setSupervisors  ] = useState([]);
  const [traineesBySup, setTraineesBySup] = useState({});
  const [hospitals,     setHospitals    ] = useState([]);
  const [specialties,   setSpecialties  ] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [view,          setView         ] = useState('list');
  const [search,        setSearch       ] = useState('');
  const [showInactive,  setShowInactive ] = useState(false);
  const [showModal,     setShowModal    ] = useState(false);
  const [editItem,      setEditItem     ] = useState(null);
  const [confirmDeact,  setConfirmDeact ] = useState(null);
  const { toasts, showToast } = useMtToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, hRes, spRes, tRes] = await Promise.all([
        api.get(`/api/dio/supervisors${showInactive ? '?includeInactive=true' : ''}`),
        api.get('/api/hospitals'),
        api.get('/api/specialties'),
        // Isolated so a failure here can't blank the whole page.
        api.get('/api/dio/supervisors/trainees-map').catch(() => null),
      ]);
      setSupervisors(sRes.data?.data || sRes.data || []);
      setHospitals(hRes.data?.data || hRes.data || []);
      setSpecialties(spRes.data?.data || spRes.data || []);
      setTraineesBySup(tRes?.data?.data || {});
    } catch { showToast('Failed to load supervisors', 'dng'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const filtered = supervisors.filter(s => {
    const q = search.toLowerCase();
    return !q
      || s.name?.toLowerCase().includes(q)
      || s.email?.toLowerCase().includes(q)
      || textValue(s.specialtyId || s.specialty, '').toLowerCase().includes(q)
      || (s.department || '').toLowerCase().includes(q)
      || (s.hospitalId?.name || s.hospital?.name || '').toLowerCase().includes(q);
  });

  function handleSaved(saved, isEdit) {
    if (isEdit) {
      setSupervisors(prev => prev.map(s => s._id === saved._id ? { ...s, ...saved } : s));
      showToast('Supervisor updated', 'ok');
    } else {
      setSupervisors(prev => [saved, ...prev]);
      showToast('Supervisor created', 'ok');
    }
  }

  async function handleDeactivate() {
    try {
      await api.delete(`/api/dio/supervisors/${confirmDeact._id}`);
      setSupervisors(prev => showInactive
        ? prev.map(s => s._id === confirmDeact._id ? { ...s, isActive: false } : s)
        : prev.filter(s => s._id !== confirmDeact._id));
      showToast(`${confirmDeact.name} deactivated`, 'ok');
    } catch (err) { showToast(err.response?.data?.message || 'Deactivate failed', 'dng'); }
    finally { setConfirmDeact(null); }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-card">
          <div className="mt-filterbar"><Sk h={38} r={8} style={{ flex:1 }} /></div>
          {[...Array(7)].map((_,i) => <Sk key={i} h={44} r={8} style={{ marginBottom:8 }} />)}
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-card">
          <div className="mt-filterbar">
            <div className="mt-search">
              <input placeholder="Search by name, email, specialty, department…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <label className="mt-check-label"><input className="mt-check" type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive</label>
            <div className="mt-filterbar-spacer" />
            <ViewToggle value={view} onChange={setView} />
            <span className="mt-count">{filtered.length} supervisor{filtered.length !== 1 ? 's' : ''}</span>
            <button className="mt-btn mt-btn--small" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Supervisor</button>
          </div>

          {view === 'list' && <div className="mt-table-wrap">
            <table className="mt-table mt-table--stack">
              <thead>
                <tr>
                  <th className="mt-th">#</th><th className="mt-th">Supervisor</th><th className="mt-th">Specialty</th>
                  <th className="mt-th">Hospital</th><th className="mt-th">Status</th><th className="mt-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td className="mt-td mt-td--muted" colSpan={6} style={{ textAlign:'center', padding:32 }}>
                    {supervisors.length === 0 ? 'No supervisors yet.' : 'No match.'}
                  </td></tr>
                )}
                {filtered.map((s, i) => {
                  const active = s.isActive !== false;
                  return (
                    <tr key={s._id} style={{ opacity: active ? 1 : 0.65 }}>
                      <td className="mt-td mt-td--muted">{i+1}</td>
                      <td className="mt-td" data-label="Supervisor">
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <AvatarCell u={s} />
                          <div>
                            <div style={{ fontWeight:600, color:'var(--text)' }}>{s.name}</div>
                            {s.email && <div className="mt-acct-id">{s.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="mt-td" data-label="Specialty">
                        <span className="mt-pill mt-pill--role">{textValue(s.specialtyId || s.specialty)}</span>
                      </td>
                      <td className="mt-td mt-td--muted" data-label="Hospital">{s.hospitalId?.name || s.hospital?.name || '—'}</td>
                      <td className="mt-td" data-label="Status">
                        <span className={`mt-pill ${active ? 'mt-pill--active' : 'mt-pill--rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="mt-td mt-td--actions" data-label="Actions">
                        <div className="mt-row-actions">
                          <button className="mt-icon-action" title="Edit" aria-label={`Edit ${s.name}`}
                            onClick={() => { setEditItem(s); setShowModal(true); }}><IconPencil size={15} /></button>
                          {active && (
                            <button className="mt-icon-action mt-icon-action--danger" title="Deactivate" aria-label={`Deactivate ${s.name}`}
                              onClick={() => setConfirmDeact(s)}><IconBan size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}

          {view === 'card' && (
            <div className="mt-acct-grid">
              {filtered.length === 0 && <div className="mt-empty" style={{ gridColumn:'1/-1' }}><div className="mt-empty-sub">{supervisors.length === 0 ? 'No supervisors yet.' : 'No match.'}</div></div>}
              {filtered.map(s => {
                const active = s.isActive !== false;
                const specialty = textValue(s.specialtyId || s.specialty, '—');
                const hospital = s.hospitalId?.name || s.hospital?.name || '—';
                const list = traineesBySup[s._id] || [];
                return (
                  <div className="mt-card" key={s._id} style={{ opacity: active ? 1 : 0.65, display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <AvatarCell u={s} />
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{s.name}</div>
                        <div className="mt-acct-id">{s.email}</div>
                      </div>
                    </div>
                    <div className="dio-chip-row">
                      <span className="mt-pill mt-pill--role">{specialty}</span>
                      <span className={`mt-pill ${active ? 'mt-pill--active' : 'mt-pill--rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="mt-card-sub">{hospital}</div>
                    <div>
                      <div className="mt-acct-k" style={{ marginBlockEnd: 6 }}>Trainees ({list.length})</div>
                      {list.length === 0 ? (
                        <div className="mt-card-sub">No trainees assigned</div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:180, overflowY:'auto' }}>
                          {list.map(t => (
                            <button type="button" key={t._id}
                              onClick={() => navigate(bp + `/dio/users/${t._id}`)}
                              aria-label={`View ${t.name}`}
                              style={{ display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'start',
                                background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8,
                                padding:'6px 8px', cursor:'pointer' }}>
                              <AvatarCell u={t} size={26} />
                              <div style={{ minWidth:0, flex:1 }}>
                                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.name}</div>
                                <div className="mt-acct-id">{t.studentId || t.specialty || ''}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-row-actions" style={{ justifyContent:'flex-start' }}>
                      <button className="mt-icon-action" title="Edit" aria-label={`Edit ${s.name}`} onClick={() => { setEditItem(s); setShowModal(true); }}><IconPencil size={15} /></button>
                      {active && <button className="mt-icon-action mt-icon-action--danger" title="Deactivate" aria-label={`Deactivate ${s.name}`} onClick={() => setConfirmDeact(s)}><IconBan size={15} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showModal && (
          <SupervisorModal
            supervisor={editItem}
            hospitals={hospitals}
            specialties={specialties}
            onClose={() => { setShowModal(false); setEditItem(null); }}
            onSaved={handleSaved}
          />
        )}
        {confirmDeact && (
          <ConfirmModal
            title="Deactivate Supervisor"
            message={`Deactivate ${confirmDeact.name}? They will lose portal access.`}
            confirmLabel="Deactivate"
            onConfirm={handleDeactivate}
            onCancel={() => setConfirmDeact(null)}
          />
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
