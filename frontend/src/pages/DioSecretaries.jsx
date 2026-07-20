import { useState, useEffect, useCallback } from 'react';
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

function initialsOf(u) {
  return u.initials || u.name?.trim()?.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}
function AvatarCell({ u }) {
  return u.photoUrl
    ? <img src={`${API_BASE}${u.photoUrl}`} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
    : <span className="mt-acct-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{initialsOf(u)}</span>;
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

function SecretaryModal({ secretary, hospitals, specialties, onClose, onSaved }) {
  const isEdit = !!secretary;
  const [form, setForm] = useState({
    name:        secretary?.name        || '',
    email:       secretary?.email       || '',
    password:    '',
    phone:       secretary?.phone       || '',
    hospitalId:  secretary?.hospitalId?._id || secretary?.hospital?._id || secretary?.hospitalId || '',
    specialtyId: secretary?.specialtyId?._id || secretary?.specialtyId || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setApiErr(''); }

  function validate() {
    const e = {};
    if (!form.name.trim())             e.name       = true;
    if (!isEdit && !form.email.trim()) e.email      = true;
    if (!isEdit && !form.password)     e.password   = true;
    if (!isEdit && form.password && form.password.length < 6) e.password = true;
    if (!form.phone.trim())            e.phone      = true;
    if (!form.hospitalId)              e.hospitalId = true;
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
        hospitalId:  form.hospitalId,
        specialtyId: form.specialtyId || undefined,
      };
      if (!isEdit) { payload.email = form.email.trim(); payload.password = form.password; }
      const res = isEdit
        ? await api.patch(`/api/dio/secretaries/${secretary._id}`, payload)
        : await api.post('/api/dio/secretaries', payload);
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
    <MtModal open title={isEdit ? 'Edit Secretary' : 'Add Secretary'} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Secretary'}
          </button>
        </>
      )}>
      <div className="mt-field-grid">
        <div className="mt-field">
          <label className="mt-label">Full Name <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={{ borderColor: errors.name ? 'var(--danger)' : undefined }}
            value={form.name} onChange={e => set('name', e.target.value)} placeholder="Name" />
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
          <label className="mt-label">Hospital <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.hospitalId} onChange={v => set('hospitalId', v)}
            options={hospitalOptions} placeholder="Search hospital…" error={errors.hospitalId} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Assigned Specialty (optional)</label>
          <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)}
            options={specialtyOptions} placeholder="Search specialty or leave empty…" />
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

export default function DioSecretaries() {
  const [secretaries,  setSecretaries ] = useState([]);
  const [hospitals,    setHospitals   ] = useState([]);
  const [specialties,  setSpecialties ] = useState([]);
  const [loading,      setLoading     ] = useState(true);
  const [view,         setView        ] = useState('list');
  const [search,       setSearch      ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showModal,    setShowModal   ] = useState(false);
  const [editItem,     setEditItem    ] = useState(null);
  const [confirmDeact, setConfirmDeact] = useState(null);
  const { toasts, showToast } = useMtToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, hRes, spRes] = await Promise.all([
        api.get(`/api/dio/secretaries${showInactive ? '?includeInactive=true' : ''}`),
        api.get('/api/hospitals'),
        api.get('/api/specialties'),
      ]);
      setSecretaries(sRes.data?.data || sRes.data || []);
      setHospitals(hRes.data?.data || hRes.data || []);
      setSpecialties(spRes.data?.data || spRes.data || []);
    } catch { showToast('Failed to load secretaries', 'dng'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const filtered = secretaries.filter(s => {
    const q = search.toLowerCase();
    return !q
      || s.name?.toLowerCase().includes(q)
      || s.email?.toLowerCase().includes(q)
      || (s.specialtyId?.name || '').toLowerCase().includes(q)
      || (s.hospitalId?.name || s.hospital?.name || '').toLowerCase().includes(q);
  });

  function handleSaved(saved, isEdit) {
    if (isEdit) { setSecretaries(prev => prev.map(s => s._id === saved._id ? { ...s, ...saved } : s)); showToast('Secretary updated', 'ok'); }
    else { setSecretaries(prev => [saved, ...prev]); showToast('Secretary created', 'ok'); }
  }

  async function handleDeactivate() {
    try {
      await api.delete(`/api/dio/secretaries/${confirmDeact._id}`);
      setSecretaries(prev => showInactive
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
          {[...Array(5)].map((_,i) => <Sk key={i} h={44} r={8} style={{ marginBottom:8 }} />)}
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
              <input placeholder="Search by name, email, specialty…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <label className="mt-check-label"><input className="mt-check" type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive</label>
            <div className="mt-filterbar-spacer" />
            <ViewToggle value={view} onChange={setView} />
            <span className="mt-count">{filtered.length} secretar{filtered.length !== 1 ? 'ies' : 'y'}</span>
            <button className="mt-btn mt-btn--small" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Secretary</button>
          </div>

          {view === 'list' && <div className="mt-table-wrap">
            <table className="mt-table mt-table--stack">
              <thead>
                <tr>
                  <th className="mt-th">#</th><th className="mt-th">Secretary</th><th className="mt-th">Specialty</th>
                  <th className="mt-th">Hospital</th><th className="mt-th">Status</th><th className="mt-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td className="mt-td mt-td--muted" colSpan={6} style={{ textAlign:'center', padding:32 }}>
                    {secretaries.length === 0 ? 'No secretaries yet.' : 'No match.'}
                  </td></tr>
                )}
                {filtered.map((s, i) => {
                  const active  = s.isActive !== false;
                  const specName = s.specialtyId?.name || '—';
                  return (
                    <tr key={s._id} style={{ opacity: active ? 1 : 0.65 }}>
                      <td className="mt-td mt-td--muted">{i+1}</td>
                      <td className="mt-td" data-label="Secretary">
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <AvatarCell u={s} />
                          <div>
                            <div style={{ fontWeight:600, color:'var(--text)' }}>{s.name}</div>
                            {s.email && <div className="mt-acct-id">{s.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="mt-td" data-label="Specialty">
                        <span className={`mt-pill ${specName === '—' ? 'mt-pill--neutral' : 'mt-pill--role'}`}>{specName}</span>
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
              {filtered.length === 0 && <div className="mt-empty" style={{ gridColumn:'1/-1' }}><div className="mt-empty-sub">{secretaries.length === 0 ? 'No secretaries yet.' : 'No match.'}</div></div>}
              {filtered.map(s => {
                const active = s.isActive !== false;
                const specName = s.specialtyId?.name || '—';
                const hospital = s.hospitalId?.name || s.hospital?.name || '—';
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
                      <span className={`mt-pill ${specName === '—' ? 'mt-pill--neutral' : 'mt-pill--role'}`}>{specName}</span>
                      <span className={`mt-pill ${active ? 'mt-pill--active' : 'mt-pill--rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="mt-card-sub">{hospital}</div>
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
          <SecretaryModal
            secretary={editItem}
            hospitals={hospitals}
            specialties={specialties}
            onClose={() => { setShowModal(false); setEditItem(null); }}
            onSaved={handleSaved}
          />
        )}
        {confirmDeact && (
          <ConfirmModal title="Deactivate Secretary"
            message={`Deactivate ${confirmDeact.name}?`}
            confirmLabel="Deactivate" onConfirm={handleDeactivate} onCancel={() => setConfirmDeact(null)} />
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
