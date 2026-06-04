import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const API_BASE = '';

// ── Inline SVG icons ──────────────────────────────────────────────────────
const IconPencil = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconBan = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>
);
const IconUserCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="8.5" cy="7" r="4"/>
    <polyline points="17 11 19 13 23 9"/>
  </svg>
);

function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>{title}</h3><p>{message}</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className={confirmClass || 'btn-red'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// NOTE: Program Directors do NOT require specialtyId per backend rules.
function PDModal({ pd, hospitals, onClose, onSaved }) {
  const isEdit = !!pd;
  const [form, setForm] = useState({
    name:       pd?.name        || '',
    email:      pd?.email       || '',
    password:   '',
    phone:      pd?.phone       || '',
    department: pd?.department  || '',
    hospitalId: pd?.hospitalId?._id || pd?.hospital?._id || pd?.hospitalId || '',
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

  function validate() {
    const e = {};
    if (!form.name.trim())             e.name       = true;
    if (!isEdit && !form.email.trim()) e.email      = true;
    if (!isEdit && !form.password)     e.password   = true;
    if (!isEdit && form.password && form.password.length < 8) e.password = true;
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
        name:       form.name.trim(),
        phone:      form.phone,
        department: form.department,
        hospitalId: form.hospitalId,
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
  const hospitalOptions = hospitals.map(h => ({
    value: h._id,
    label: `${h.name}${h.city ? ` (${h.city})` : ''}`,
  }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? 'Edit Program Director' : 'Add Program Director'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Full Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name}
                onChange={e => set('name', e.target.value)} placeholder="Dr. Ali Hassan" />
            </div>
            {!isEdit && (
              <div className="admin-field">
                <label>Email *</label>
                <input className={errors.email ? 'invalid' : ''} type="email" value={form.email}
                  onChange={e => set('email', e.target.value)} />
              </div>
            )}
            {!isEdit && (
              <div className="admin-field">
                <label>Password * (min 8 chars)</label>
                <input className={errors.password ? 'invalid' : ''} type="password" value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </div>
            )}
            <div className="admin-field">
              <label>Phone *</label>
              <input className={errors.phone ? 'invalid' : ''} value={form.phone}
                onChange={e => set('phone', e.target.value)} placeholder="+964 …" />
            </div>
            <div className="admin-field">
              <label>Department</label>
              <input value={form.department} onChange={e => set('department', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label>Hospital *</label>
              <SearchableSelect
                value={form.hospitalId}
                onChange={v => set('hospitalId', v)}
                options={hospitalOptions}
                placeholder="Search hospital..."
                error={errors.hospitalId}
              />
            </div>
          </div>
          {apiErr && (
            <div style={{ marginTop:14, background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
              {apiErr}
            </div>
          )}
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Program Director'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DioProgramDirectors() {
  const [pds,          setPds         ] = useState([]);
  const [hospitals,    setHospitals   ] = useState([]);
  const [loading,      setLoading     ] = useState(true);
  const [view,         setView        ] = useState('list');
  const [search,       setSearch      ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showModal,    setShowModal   ] = useState(false);
  const [editItem,     setEditItem    ] = useState(null);
  const [confirmDeact, setConfirmDeact] = useState(null);
  const [confirmReact, setConfirmReact] = useState(null);
  const [toasts,       setToasts      ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, hRes] = await Promise.all([
        api.get(`/api/dio/program-directors${showInactive ? '?includeInactive=true' : ''}`),
        api.get('/api/hospitals'),
      ]);
      setPds(pRes.data?.data || pRes.data || []);
      setHospitals(hRes.data?.data || hRes.data || []);
    } catch { showToast('Failed to load program directors', 'error'); }
    finally { setLoading(false); }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const filtered = pds.filter(p => {
    const q = search.toLowerCase();
    return !q
      || p.name?.toLowerCase().includes(q)
      || p.email?.toLowerCase().includes(q)
      || (p.department || '').toLowerCase().includes(q)
      || (p.hospitalId?.name || p.hospital?.name || '').toLowerCase().includes(q);
  });

  function handleSaved(saved, isEdit) {
    if (isEdit) { setPds(prev => prev.map(p => p._id === saved._id ? { ...p, ...saved } : p)); showToast('Program Director updated'); }
    else { setPds(prev => [saved, ...prev]); showToast('Program Director created'); }
  }

  async function handleDeactivate() {
    try {
      await api.delete(`/api/dio/program-directors/${confirmDeact._id}`);
      setPds(prev => showInactive
        ? prev.map(p => p._id === confirmDeact._id ? { ...p, isActive: false } : p)
        : prev.filter(p => p._id !== confirmDeact._id));
      showToast(`${confirmDeact.name} deactivated`);
    } catch (err) { showToast(err.response?.data?.message || 'Deactivate failed', 'error'); }
    finally { setConfirmDeact(null); }
  }

  async function handleReactivate() {
    try {
      const res = await api.patch(`/api/dio/program-directors/${confirmReact._id}/reactivate`);
      setPds(prev => prev.map(p => p._id === confirmReact._id ? { ...p, ...(res.data?.data || res.data) } : p));
      showToast(`${confirmReact.name} reactivated`);
    } catch (err) { showToast(err.response?.data?.message || 'Reactivate failed', 'error'); }
    finally { setConfirmReact(null); }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(5)].map((_,i) => (
                <tr key={i}>
                  <td><Sk w={20} h={13} /></td>
                  <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                  <td><Sk w={100} h={13} /></td>
                  <td><Sk w={80} h={13} /></td>
                  <td><Sk w={22} h={22} r={20} /></td>
                  <td><div style={{ display:'flex', gap:6 }}><Sk w={48} h={28} r={6} /><Sk w={60} h={28} r={6} /></div></td>
                </tr>
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
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar">
            <input className="admin-search" style={{ flex:1, minWidth:180 }}
              placeholder="Search by name, email, department…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#4B5563', cursor:'pointer' }}><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive</label>
            <ViewToggle value={view} onChange={setView} />
            <span style={{ fontSize:13, color:'#8B8FA8', flexShrink:0 }}>
              {filtered.length} program director{filtered.length !== 1 ? 's' : ''}
            </span>
            <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Program Director</button>
          </div>
          {view === 'list' && <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Program Director</th><th>Department</th><th>Hospital</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign:'center', padding:40 }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>⭐</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563' }}>
                        {pds.length === 0 ? 'No program directors yet.' : 'No match.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((p, i) => {
                  const active = p.isActive !== false;
                  return (
                    <tr key={p._id} style={{ opacity: active ? 1 : 0.65 }}>
                      <td style={{ color:'#8B8FA8' }}>{i+1}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {p.photoUrl
                            ? <img src={`${API_BASE}${p.photoUrl}`} alt="" className="cell-photo" />
                            : <div className="cell-initials">{p.initials || p.name?.[0] || '?'}</div>
                          }
                          <div>
                            <strong>{p.name}</strong>
                            <div style={{ fontSize:11, color:'#8B8FA8' }}>{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize:13, color:'#4B5563' }}>{p.department || '—'}</td>
                      <td style={{ fontSize:13, color:'#4B5563' }}>{p.hospitalId?.name || p.hospital?.name || '—'}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20,
                          background: active ? '#D1FAE5' : '#FEE2E2',
                          color:      active ? '#065F46' : '#991B1B' }}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit"
                            title="Edit" aria-label={`Edit ${p.name}`}
                            onClick={() => { setEditItem(p); setShowModal(true); }}>
                            <IconPencil />
                          </button>
                          {active
                            ? <button className="btn-action delete"
                                title="Deactivate" aria-label={`Deactivate ${p.name}`}
                                onClick={() => setConfirmDeact(p)}>
                                <IconBan />
                              </button>
                            : <button className="btn-action reactivate"
                                title="Reactivate" aria-label={`Reactivate ${p.name}`}
                                onClick={() => setConfirmReact(p)}>
                                <IconUserCheck />
                              </button>
                          }
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
          {view === 'card' && (
            <div className="management-card-grid">
              {filtered.length === 0 && <div className="admin-empty" style={{ gridColumn:'1/-1' }}>{pds.length === 0 ? 'No program directors yet.' : 'No match.'}</div>}
              {filtered.map(p => {
                const active = p.isActive !== false;
                const hospital = p.hospitalId?.name || p.hospital?.name || '-';
                return (
                  <div className="management-card" key={p._id} style={{ opacity: active ? 1 : 0.65 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>{p.photoUrl ? <img src={`${API_BASE}${p.photoUrl}`} alt="" className="cell-photo" /> : <div className="cell-initials">{p.initials || p.name?.[0] || '?'}</div>}<div><div className="management-card-title">{p.name}</div><div className="management-card-sub">{p.email}</div></div></div>
                    <div className="management-card-sub">{p.department || 'No department'} - {hospital}</div>
                    <div className="management-card-meta"><span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20, background: active ? '#D1FAE5' : '#FEE2E2', color: active ? '#065F46' : '#991B1B' }}>{active ? 'Active' : 'Inactive'}</span></div>
                    <div className="management-card-actions"><button className="btn-action edit" title="Edit" aria-label={`Edit ${p.name}`} onClick={() => { setEditItem(p); setShowModal(true); }}><IconPencil /></button>{active ? <button className="btn-action delete" title="Deactivate" aria-label={`Deactivate ${p.name}`} onClick={() => setConfirmDeact(p)}><IconBan /></button> : <button className="btn-action reactivate" title="Reactivate" aria-label={`Reactivate ${p.name}`} onClick={() => setConfirmReact(p)}><IconUserCheck /></button>}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showModal && (
          <PDModal
            pd={editItem}
            hospitals={hospitals}
            onClose={() => { setShowModal(false); setEditItem(null); }}
            onSaved={handleSaved}
          />
        )}
        {confirmDeact && (
          <ConfirmModal title="Deactivate Program Director"
            message={`Deactivate ${confirmDeact.name}?`}
            confirmLabel="Deactivate" onConfirm={handleDeactivate} onCancel={() => setConfirmDeact(null)} />
        )}
        {confirmReact && (
          <ConfirmModal title="Reactivate Program Director"
            message={`Restore access for ${confirmReact.name}?`}
            confirmLabel="Reactivate" confirmClass="btn-purple"
            onConfirm={handleReactivate} onCancel={() => setConfirmReact(null)} />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
