import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useBasePath from '../hooks/useBasePath';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';
import { IconEye, IconPencil, IconBan } from '../components/icons';

const API_BASE = '';

// ── helpers ───────────────────────────────────────────────────────────────
function getSpecialty(t) {
  return t?.specialtyId?.name || t?.specialty || '—';
}
function getHospital(t) {
  return t?.hospitalId?.name || t?.hospital?.name || '—';
}

// ── Confirm modal ─────────────────────────────────────────────────────────
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

// ── Trainee Form Modal ────────────────────────────────────────────────────
function TraineeModal({ trainee, hospitals, specialties, onClose, onSaved }) {
  const isEdit = !!trainee;
  const [form, setForm] = useState({
    name:       trainee?.name        || '',
    email:      trainee?.email       || '',
    password:   '',
    phone:      trainee?.phone       || '',
    hospitalId: trainee?.hospitalId?._id || trainee?.hospital?._id || trainee?.hospitalId || '',
    specialtyId:trainee?.specialtyId?._id|| trainee?.specialtyId || '',
    studentId:  trainee?.studentId   || '',
    year:       trainee?.year        || '',
  });
  const [errors,  setErrors ] = useState({});
  const [saving,  setSaving ] = useState(false);
  const [apiErr,  setApiErr ] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: false }));
    setApiErr('');
  }

  function validate() {
    const e = {};
    if (!form.name.trim())        e.name        = true;
    if (!isEdit && !form.email.trim()) e.email   = true;
    if (!isEdit && !form.password) e.password   = true;
    if (!isEdit && form.password && form.password.length < 6) e.password = true;
    if (!form.hospitalId)          e.hospitalId = true;
    if (!form.specialtyId)         e.specialtyId= true;
    if (!form.studentId.trim())    e.studentId  = true;
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiErr('');
    try {
      const payload = {
        name:        form.name.trim(),
        phone:       form.phone,
        hospitalId:  form.hospitalId,
        specialtyId: form.specialtyId,
        studentId:   form.studentId.trim(),
        year:        form.year ? Number(form.year) : undefined,
      };
      if (!isEdit) {
        payload.email    = form.email.trim();
        payload.password = form.password;
      }

      let res;
      if (isEdit) {
        res = await api.patch(`/api/dio/trainees/${trainee._id}`, payload);
      } else {
        res = await api.post('/api/dio/trainees', payload);
      }
      onSaved(res.data?.data || res.data, isEdit);
      onClose();
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
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
          <div className="admin-modal-title">{isEdit ? 'Edit Trainee' : 'Add New Trainee'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">

            <div className="admin-field">
              <label>Full Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name}
                onChange={e => set('name', e.target.value)} placeholder="Dr. John Doe" />
            </div>

            {!isEdit && (
              <div className="admin-field">
                <label>Email *</label>
                <input className={errors.email ? 'invalid' : ''} type="email" value={form.email}
                  onChange={e => set('email', e.target.value)} placeholder="trainee@hospital.com" />
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
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 …" />
            </div>

            <div className="admin-field">
              <label>Student ID *</label>
              <input className={errors.studentId ? 'invalid' : ''} value={form.studentId}
                onChange={e => set('studentId', e.target.value)} placeholder="STD-001" />
            </div>

            <div className="admin-field">
              <label>Year</label>
              <select value={form.year} onChange={e => set('year', e.target.value)}>
                <option value="">— select —</option>
                {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
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
            <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              {apiErr}
            </div>
          )}
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Trainee'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function DioTrainees() {
  const navigate = useNavigate();
  const bp = useBasePath();

  const [trainees,      setTrainees     ] = useState([]);
  const [hospitals,     setHospitals    ] = useState([]);
  const [specialties,   setSpecialties  ] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [view,          setView         ] = useState('list');
  const [search,        setSearch       ] = useState('');
  const [specFilter,    setSpecFilter   ] = useState('All');
  const [showInactive,  setShowInactive ] = useState(false);
  const [showModal,     setShowModal    ] = useState(false);
  const [editTrainee,   setEditTrainee  ] = useState(null);
  const [confirmDeact,  setConfirmDeact ] = useState(null);   // user obj
  const [toasts,        setToasts       ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, hRes, spRes] = await Promise.all([
        api.get(`/api/dio/trainees${showInactive ? '?includeInactive=true' : ''}`),
        api.get('/api/hospitals'),
        api.get('/api/specialties'),
      ]);
      setTrainees(tRes.data?.data || tRes.data || []);
      setHospitals(hRes.data?.data || hRes.data || []);
      setSpecialties(spRes.data?.data || spRes.data || []);
    } catch {
      showToast('Failed to load trainees', 'error');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  // specialty filter tabs
  const specCounts = {};
  trainees.forEach(t => {
    const s = getSpecialty(t);
    specCounts[s] = (specCounts[s] || 0) + 1;
  });
  const specOptions = ['All', ...Object.keys(specCounts).filter(k => k !== '—').sort()];

  const filtered = trainees.filter(t => {
    const q = search.toLowerCase();
    const matchSpec = specFilter === 'All' || getSpecialty(t) === specFilter;
    const matchSearch = !q
      || t.name?.toLowerCase().includes(q)
      || (t.studentId || '').toLowerCase().includes(q)
      || t.email?.toLowerCase().includes(q)
      || getSpecialty(t).toLowerCase().includes(q);
    return matchSpec && matchSearch;
  });

  function openAdd() { setEditTrainee(null); setShowModal(true); }
  function openEdit(t) { setEditTrainee(t); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditTrainee(null); }

  function handleSaved(saved, isEdit) {
    if (isEdit) {
      setTrainees(prev => prev.map(t => t._id === saved._id ? { ...t, ...saved } : t));
      showToast('Trainee updated');
    } else {
      setTrainees(prev => [saved, ...prev]);
      showToast('Trainee created');
    }
  }

  async function handleDeactivate() {
    try {
      await api.delete(`/api/dio/trainees/${confirmDeact._id}`);
      setTrainees(prev => showInactive
        ? prev.map(t => t._id === confirmDeact._id ? { ...t, isActive: false } : t)
        : prev.filter(t => t._id !== confirmDeact._id)
      );
      showToast(`${confirmDeact.name} deactivated`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Deactivate failed', 'error');
    } finally {
      setConfirmDeact(null);
    }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(8)].map((_,i) => (
                  <tr key={i}>
                    <td><Sk w={20} h={13} /></td>
                    <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={90} h={22} r={20} /></td>
                    <td><Sk w={110} h={13} /></td>
                    <td><Sk w={70} h={13} /></td>
                    <td><Sk w={22} h={22} r={20} /></td>
                    <td><div style={{ display:'flex', gap:6 }}><Sk w={48} h={28} r={6} /><Sk w={60} h={28} r={6} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">
        {/* Specialty filter tabs */}
        <div className="filter-tabs" style={{ marginBottom: 14 }}>
          {specOptions.map(s => (
            <button key={s} className={`filter-tab${specFilter === s ? ' active' : ''}`}
              onClick={() => setSpecFilter(s)}>
              {s === 'All' ? `All (${trainees.length})` : `${s} (${specCounts[s] || 0})`}
            </button>
          ))}
        </div>

        <div className="admin-card">
          <div className="admin-toolbar">
            <input className="admin-search" style={{ flex:1, minWidth:180 }}
              placeholder="Search by name, student ID, email, specialty…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-2)', cursor:'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
            <ViewToggle value={view} onChange={setView} />
            <span style={{ fontSize:13, color:'var(--text-muted)', flexShrink:0 }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
            <button className="btn-purple" onClick={openAdd}>+ Add Trainee</button>
          </div>

          {view === 'list' && <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Trainee</th><th>Specialty</th><th>Hospital</th><th>Student ID</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>🎓</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'var(--text-2)' }}>
                        {trainees.length === 0 ? 'No trainees yet. Click "+ Add Trainee" to begin.' : 'No trainees match your search.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((t, i) => {
                  const active = t.isActive !== false;
                  return (
                    <tr key={t._id} style={{ opacity: active ? 1 : 0.65 }}>
                      <td style={{ color:'var(--text-muted)' }}>{i+1}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}
                          onClick={() => navigate(bp + `/dio/trainees/${t._id}`)}>
                          {t.photoUrl
                            ? <img src={`${API_BASE}${t.photoUrl}`} alt="" className="cell-photo" />
                            : <div className="cell-initials">{t.initials || t.name?.[0] || '?'}</div>
                          }
                          <div>
                            <strong>{t.name}</strong>
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{t.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'var(--chip-spec-bg)', color:'var(--chip-spec-fg)' }}>
                          {getSpecialty(t)}
                        </span>
                      </td>
                      <td style={{ fontSize:13, color:'var(--text-2)' }}>{getHospital(t)}</td>
                      <td style={{ fontSize:13, color:'var(--text-2)' }}>{t.studentId || '—'}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20,
                          background: active ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color:      active ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action view"
                            title="View details" aria-label={`View details for ${t.name}`}
                            onClick={() => navigate(bp + `/dio/trainees/${t._id}`)}>
                            <IconEye />
                          </button>
                          <button className="btn-action edit"
                            title="Edit" aria-label={`Edit ${t.name}`}
                            onClick={() => openEdit(t)}>
                            <IconPencil />
                          </button>
                          {active && (
                            <button className="btn-action delete"
                              title="Deactivate" aria-label={`Deactivate ${t.name}`}
                              onClick={() => setConfirmDeact(t)}>
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
              {filtered.length === 0 && (
                <div className="admin-empty" style={{ gridColumn:'1/-1' }}>
                  {trainees.length === 0 ? 'No trainees yet. Click "+ Add Trainee" to begin.' : 'No trainees match your search.'}
                </div>
              )}
              {filtered.map(t => {
                const active = t.isActive !== false;
                return (
                  <div className="management-card" key={t._id} style={{ opacity: active ? 1 : 0.65 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {t.photoUrl
                        ? <img src={`${API_BASE}${t.photoUrl}`} alt="" className="cell-photo" />
                        : <div className="cell-initials">{t.initials || t.name?.[0] || '?'}</div>
                      }
                      <div>
                        <div className="management-card-title">{t.name}</div>
                        <div className="management-card-sub">{t.email}</div>
                      </div>
                    </div>
                    <div className="management-card-meta">
                      <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'var(--chip-spec-bg)', color:'var(--chip-spec-fg)' }}>{getSpecialty(t)}</span>
                      <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20, background: active ? 'var(--success-bg)' : 'var(--danger-bg)', color: active ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="management-card-sub">{getHospital(t)} - {t.studentId || 'No ID'}</div>
                    <div className="management-card-actions">
                      <button className="btn-action view" title="View details" aria-label={`View details for ${t.name}`} onClick={() => navigate(bp + `/dio/trainees/${t._id}`)}><IconEye /></button>
                      <button className="btn-action edit" title="Edit" aria-label={`Edit ${t.name}`} onClick={() => openEdit(t)}><IconPencil /></button>
                      {active && <button className="btn-action delete" title="Deactivate" aria-label={`Deactivate ${t.name}`} onClick={() => setConfirmDeact(t)}><IconBan /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modals */}
        {showModal && (
          <TraineeModal
            trainee={editTrainee}
            hospitals={hospitals}
            specialties={specialties}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        )}

        {confirmDeact && (
          <ConfirmModal
            title="Deactivate Trainee"
            message={`Deactivate ${confirmDeact.name}? They will lose portal access but their data will be preserved.`}
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
