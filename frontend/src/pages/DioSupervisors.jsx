import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';
import { IconPencil, IconBan } from '../components/icons';

const API_BASE = '';

function textValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || fallback;
  return fallback;
}

function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className={confirmClass || 'btn-red'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
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

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

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
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? 'Edit Supervisor' : 'Add New Supervisor'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Full Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name}
                onChange={e => set('name', e.target.value)} placeholder="Dr. Jane Smith" />
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
                <label>Password * (min 6 chars)</label>
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
            <div className="admin-field">
              <label>Hospital *</label>
              <SearchableSelect
                value={form.hospitalId}
                onChange={v => set('hospitalId', v)}
                options={hospitalOptions}
                placeholder="Search hospital..."
                error={errors.hospitalId}
              />
            </div>
            <div className="admin-field">
              <label>Specialty *</label>
              <SearchableSelect
                value={form.specialtyId}
                onChange={v => set('specialtyId', v)}
                options={specialtyOptions}
                placeholder="Search specialty..."
                error={errors.specialtyId}
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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Supervisor'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DioSupervisors() {
  const [supervisors,   setSupervisors  ] = useState([]);
  const [hospitals,     setHospitals    ] = useState([]);
  const [specialties,   setSpecialties  ] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [view,         setView        ] = useState('list');
  const [search,        setSearch       ] = useState('');
  const [showInactive,  setShowInactive ] = useState(false);
  const [showModal,     setShowModal    ] = useState(false);
  const [editItem,      setEditItem     ] = useState(null);
  const [confirmDeact,  setConfirmDeact ] = useState(null);
  const [toasts,        setToasts       ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, hRes, spRes] = await Promise.all([
        api.get(`/api/dio/supervisors${showInactive ? '?includeInactive=true' : ''}`),
        api.get('/api/hospitals'),
        api.get('/api/specialties'),
      ]);
      setSupervisors(sRes.data?.data || sRes.data || []);
      setHospitals(hRes.data?.data || hRes.data || []);
      setSpecialties(spRes.data?.data || spRes.data || []);
    } catch { showToast('Failed to load supervisors', 'error'); }
    finally { setLoading(false); }
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
      showToast('Supervisor updated');
    } else {
      setSupervisors(prev => [saved, ...prev]);
      showToast('Supervisor created');
    }
  }

  async function handleDeactivate() {
    try {
      await api.delete(`/api/dio/supervisors/${confirmDeact._id}`);
      setSupervisors(prev => showInactive
        ? prev.map(s => s._id === confirmDeact._id ? { ...s, isActive: false } : s)
        : prev.filter(s => s._id !== confirmDeact._id));
      showToast(`${confirmDeact.name} deactivated`);
    } catch (err) { showToast(err.response?.data?.message || 'Deactivate failed', 'error'); }
    finally { setConfirmDeact(null); }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(7)].map((_,i) => (
                <tr key={i}>
                  <td><Sk w={20} h={13} /></td>
                  <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                  <td><Sk w={90} h={22} r={20} /></td>
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
              placeholder="Search by name, email, specialty, department…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#4B5563', cursor:'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
            <ViewToggle value={view} onChange={setView} />
            <span style={{ fontSize:13, color:'#8B8FA8', flexShrink:0 }}>
              {filtered.length} supervisor{filtered.length !== 1 ? 's' : ''}
            </span>
            <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Supervisor</button>
          </div>
          {view === 'list' && <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Supervisor</th><th>Specialty</th><th>Hospital</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign:'center', padding:40 }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>👨‍⚕️</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563' }}>
                        {supervisors.length === 0 ? 'No supervisors yet.' : 'No match.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => {
                  const active = s.isActive !== false;
                  return (
                    <tr key={s._id} style={{ opacity: active ? 1 : 0.65 }}>
                      <td style={{ color:'#8B8FA8' }}>{i+1}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {s.photoUrl
                            ? <img src={`${API_BASE}${s.photoUrl}`} alt="" className="cell-photo" />
                            : <div className="cell-initials">{s.initials || s.name?.[0] || '?'}</div>
                          }
                          <div>
                            <strong>{s.name}</strong>
                            <div style={{ fontSize:11, color:'#8B8FA8' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>
                          {textValue(s.specialtyId || s.specialty)}
                        </span>
                      </td>
                      <td style={{ fontSize:13, color:'#4B5563' }}>{s.hospitalId?.name || s.hospital?.name || '—'}</td>
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
                            title="Edit" aria-label={`Edit ${s.name}`}
                            onClick={() => { setEditItem(s); setShowModal(true); }}>
                            <IconPencil />
                          </button>
                          {active && (
                            <button className="btn-action delete"
                              title="Deactivate" aria-label={`Deactivate ${s.name}`}
                              onClick={() => setConfirmDeact(s)}>
                              <IconBan />
                            </button>
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
            <div className="management-card-grid">
              {filtered.length === 0 && <div className="admin-empty" style={{ gridColumn:'1/-1' }}>{supervisors.length === 0 ? 'No supervisors yet.' : 'No match.'}</div>}
              {filtered.map(s => {
                const active = s.isActive !== false;
                const specialty = textValue(s.specialtyId || s.specialty, '-');
                const hospital = s.hospitalId?.name || s.hospital?.name || '-';
                return (
                  <div className="management-card" key={s._id} style={{ opacity: active ? 1 : 0.65 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {s.photoUrl ? <img src={`${API_BASE}${s.photoUrl}`} alt="" className="cell-photo" /> : <div className="cell-initials">{s.initials || s.name?.[0] || '?'}</div>}
                      <div><div className="management-card-title">{s.name}</div><div className="management-card-sub">{s.email}</div></div>
                    </div>
                    <div className="management-card-meta"><span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>{specialty}</span><span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20, background: active ? '#D1FAE5' : '#FEE2E2', color: active ? '#065F46' : '#991B1B' }}>{active ? 'Active' : 'Inactive'}</span></div>
                    <div className="management-card-sub">{hospital}</div>
                    <div className="management-card-actions"><button className="btn-action edit" title="Edit" aria-label={`Edit ${s.name}`} onClick={() => { setEditItem(s); setShowModal(true); }}><IconPencil /></button>{active && <button className="btn-action delete" title="Deactivate" aria-label={`Deactivate ${s.name}`} onClick={() => setConfirmDeact(s)}><IconBan /></button>}</div>
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
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
