import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { useMtToast, MtToastHost } from '../components/MtToast';
import MtModal from '../components/MtModal';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';
import { IconPencil, IconBan } from '../components/icons';
import { specialtyName } from '../utils/specialtyName';
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

// A Program Director is tied to ONE specialty and oversees it across every
// hospital that offers it, so we assign a specialty (not a hospital).
function PDModal({ pd, specialties, onClose, onSaved }) {
  const isEdit = !!pd;
  const [form, setForm] = useState({
    name:        pd?.name        || '',
    email:       pd?.email       || '',
    password:    '',
    phone:       pd?.phone       || '',
    department:  pd?.department   || '',
    specialtyId: pd?.specialtyId?._id || pd?.specialtyId || '',
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
    if (!form.phone.trim())            e.phone       = true;
    if (!form.specialtyId)             e.specialtyId = true;
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
        specialtyId: form.specialtyId,
      };
      if (!isEdit) { payload.email = form.email.trim(); payload.password = form.password; }
      const res = isEdit
        ? await api.patch(`/api/dio/program-directors/${pd._id}`, payload)
        : await api.post('/api/dio/program-directors', payload);
      onSaved(res.data?.data || res.data, isEdit);
      onClose();
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }
  // De-duplicate specialties by name (the DB carries one row per hospital);
  // any row of a given name works — the backend re-expands the scope by name.
  const specialtyOptions = Object.values(
    specialties.reduce((acc, s) => {
      if (s?.name && !acc[s.name]) acc[s.name] = { value: s._id, label: specialtyName(s) };
      return acc;
    }, {})
  ).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <MtModal open title={isEdit ? 'Edit Program Director' : 'Add Program Director'} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Program Director'}
          </button>
        </>
      )}>
      <div className="mt-field-grid">
        <div className="mt-field">
          <label className="mt-label">Full Name <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={{ borderColor: errors.name ? 'var(--danger)' : undefined }}
            value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dr. Ali Hassan" />
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
        <div className="mt-field mt-field-full">
          <label className="mt-label">Specialty <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)}
            options={specialtyOptions} placeholder="Search specialty…" error={errors.specialtyId} />
          <div style={{ fontSize:11.5, color:'var(--text-2)', marginBlockStart:4 }}>
            Oversees this specialty across every hospital that offers it. One Program Director per specialty.
          </div>
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

export default function DioProgramDirectors() {
  const [pds,          setPds         ] = useState([]);
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
      const [pRes, sRes] = await Promise.all([
        api.get(`/api/dio/program-directors${showInactive ? '?includeInactive=true' : ''}`),
        api.get('/api/specialties'),
      ]);
      setPds(pRes.data?.data || pRes.data || []);
      setSpecialties((sRes.data?.data || sRes.data || []).filter(s => s.isActive !== false));
    } catch { showToast('Failed to load program directors', 'dng'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const filtered = pds.filter(p => {
    const q = search.toLowerCase();
    return !q
      || p.name?.toLowerCase().includes(q)
      || p.email?.toLowerCase().includes(q)
      || (p.department || '').toLowerCase().includes(q)
      || (specialtyName(p.specialtyId) || '').toLowerCase().includes(q);
  });

  function handleSaved(saved, isEdit) {
    if (isEdit) { setPds(prev => prev.map(p => p._id === saved._id ? { ...p, ...saved } : p)); showToast('Program Director updated', 'ok'); }
    else { setPds(prev => [saved, ...prev]); showToast('Program Director created', 'ok'); }
  }

  async function handleDeactivate() {
    try {
      await api.delete(`/api/dio/program-directors/${confirmDeact._id}`);
      setPds(prev => showInactive
        ? prev.map(p => p._id === confirmDeact._id ? { ...p, isActive: false } : p)
        : prev.filter(p => p._id !== confirmDeact._id));
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
              <input placeholder="Search by name, email, department…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <label className="mt-check-label"><input className="mt-check" type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive</label>
            <div className="mt-filterbar-spacer" />
            <ViewToggle value={view} onChange={setView} />
            <span className="mt-count">{filtered.length} program director{filtered.length !== 1 ? 's' : ''}</span>
            <button className="mt-btn mt-btn--small" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Program Director</button>
          </div>

          {view === 'list' && <div className="mt-table-wrap">
            <table className="mt-table mt-table--stack">
              <thead>
                <tr>
                  <th className="mt-th">#</th><th className="mt-th">Program Director</th><th className="mt-th">Department</th>
                  <th className="mt-th">Specialty</th><th className="mt-th">Status</th><th className="mt-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td className="mt-td mt-td--muted" colSpan={6} style={{ textAlign:'center', padding:32 }}>
                    {pds.length === 0 ? 'No program directors yet.' : 'No match.'}
                  </td></tr>
                )}
                {filtered.map((p, i) => {
                  const active = p.isActive !== false;
                  return (
                    <tr key={p._id} style={{ opacity: active ? 1 : 0.65 }}>
                      <td className="mt-td mt-td--muted">{i+1}</td>
                      <td className="mt-td" data-label="Program Director">
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <AvatarCell u={p} />
                          <div>
                            <div style={{ fontWeight:600, color:'var(--text)' }}>{p.name}</div>
                            {p.email && <div className="mt-acct-id">{p.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="mt-td mt-td--muted" data-label="Department">{p.department || '—'}</td>
                      <td className="mt-td" data-label="Specialty">
                        {specialtyName(p.specialtyId)
                          ? <span className="mt-pill mt-pill--role">{specialtyName(p.specialtyId)}</span>
                          : <span className="mt-td--muted">—</span>}
                      </td>
                      <td className="mt-td" data-label="Status">
                        <span className={`mt-pill ${active ? 'mt-pill--active' : 'mt-pill--rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="mt-td mt-td--actions" data-label="Actions">
                        <div className="mt-row-actions">
                          <button className="mt-icon-action" title="Edit" aria-label={`Edit ${p.name}`}
                            onClick={() => { setEditItem(p); setShowModal(true); }}><IconPencil size={15} /></button>
                          {active && (
                            <button className="mt-icon-action mt-icon-action--danger" title="Deactivate" aria-label={`Deactivate ${p.name}`}
                              onClick={() => setConfirmDeact(p)}><IconBan size={15} /></button>
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
              {filtered.length === 0 && <div className="mt-empty" style={{ gridColumn:'1/-1' }}><div className="mt-empty-sub">{pds.length === 0 ? 'No program directors yet.' : 'No match.'}</div></div>}
              {filtered.map(p => {
                const active = p.isActive !== false;
                const specialty = specialtyName(p.specialtyId) || 'No specialty';
                return (
                  <div className="mt-card" key={p._id} style={{ opacity: active ? 1 : 0.65, display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <AvatarCell u={p} />
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{p.name}</div>
                        <div className="mt-acct-id">{p.email}</div>
                      </div>
                    </div>
                    <div className="mt-card-sub">{p.department || 'No department'} · {specialty}</div>
                    <div className="dio-chip-row">
                      <span className={`mt-pill ${active ? 'mt-pill--active' : 'mt-pill--rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="mt-row-actions" style={{ justifyContent:'flex-start' }}>
                      <button className="mt-icon-action" title="Edit" aria-label={`Edit ${p.name}`} onClick={() => { setEditItem(p); setShowModal(true); }}><IconPencil size={15} /></button>
                      {active && <button className="mt-icon-action mt-icon-action--danger" title="Deactivate" aria-label={`Deactivate ${p.name}`} onClick={() => setConfirmDeact(p)}><IconBan size={15} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showModal && (
          <PDModal
            pd={editItem}
            specialties={specialties}
            onClose={() => { setShowModal(false); setEditItem(null); }}
            onSaved={handleSaved}
          />
        )}
        {confirmDeact && (
          <ConfirmModal title="Deactivate Program Director"
            message={`Deactivate ${confirmDeact.name}?`}
            confirmLabel="Deactivate" onConfirm={handleDeactivate} onCancel={() => setConfirmDeact(null)} />
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
