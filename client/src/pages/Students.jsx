import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';

const ROWS_OPT = [8, 16, 32];
const API_BASE = 'http://localhost:5000';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_OPTS = ['upcoming', 'current', 'completed'];

// ── Rotation Modal ─────────────────────────────────────────────────────────
function RotationModal({ item, students, hospitals, doctors, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    student:    item?.student?._id   || item?.student   || '',
    hospital:   item?.hospital?._id  || item?.hospital  || '',
    doctor:     item?.doctor?._id    || item?.doctor    || '',
    startDate:  item?.startDate ? item.startDate.slice(0, 10) : '',
    endDate:    item?.endDate   ? item.endDate.slice(0, 10)   : '',
    status:     item?.status    || 'upcoming',
    weeklyAvg:  item?.weeklyAvg  || '',
    monthlyAvg: item?.monthlyAvg || '',
    finalGrade: item?.finalGrade || '',
  });
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function handleSave() {
    const e = {};
    if (!form.student)   e.student   = true;
    if (!form.hospital)  e.hospital  = true;
    if (!form.startDate) e.startDate = true;
    if (!form.endDate)   e.endDate   = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave(form);
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{item ? 'Edit Rotation' : 'Assign Student to Hospital'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">

            <div className="admin-field full">
              <label>Student *</label>
              <select className={errors.student ? 'invalid' : ''} value={form.student} onChange={e => set('student', e.target.value)}>
                <option value="">— Select student —</option>
                {students.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Hospital *</label>
              <select className={errors.hospital ? 'invalid' : ''} value={form.hospital} onChange={e => set('hospital', e.target.value)}>
                <option value="">— Select hospital —</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Supervising Doctor</label>
              <select value={form.doctor} onChange={e => set('doctor', e.target.value)}>
                <option value="">— Select doctor —</option>
                {doctors.map(d => <option key={d._id} value={d._id}>{d.name}{d.specialty ? ` (${d.specialty})` : ''}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Start Date *</label>
              <input type="date" className={errors.startDate ? 'invalid' : ''} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>

            <div className="admin-field">
              <label>End Date *</label>
              <input type="date" className={errors.endDate ? 'invalid' : ''} value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>

            <div className="admin-field full">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Weekly Avg Grade</label>
              <input value={form.weeklyAvg} onChange={e => set('weeklyAvg', e.target.value)} placeholder="e.g. A, B+, 85" />
            </div>

            <div className="admin-field">
              <label>Monthly Avg Grade</label>
              <input value={form.monthlyAvg} onChange={e => set('monthlyAvg', e.target.value)} placeholder="e.g. A, B+, 85" />
            </div>

            <div className="admin-field full">
              <label>Final Grade</label>
              <input value={form.finalGrade} onChange={e => set('finalGrade', e.target.value)} placeholder="e.g. A, B+, 85" />
            </div>

          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Close</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Evaluation Modal ───────────────────────────────────────────────────────
function EvalModal({ item, students, doctors, hospitals, canEdit, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    student:   item?.student?._id   || item?.student   || '',
    doctor:    item?.doctor?._id    || item?.doctor     || '',
    hospital:  item?.hospital?._id  || item?.hospital   || '',
    specialty: item?.specialty  || '',
    date:      item?.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    grade:     item?.grade  || '',
    status:    item?.status || 'pending'
  });
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function handleSave() {
    const e = {};
    if (!form.student) e.student = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave(form);
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{item ? 'Edit Evaluation' : 'Add Evaluation'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>Student *</label>
              <select className={errors.student ? 'invalid' : ''} value={form.student} onChange={e => set('student', e.target.value)}>
                <option value="">— Select student —</option>
                {students.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label>Doctor</label>
              <select value={form.doctor} onChange={e => set('doctor', e.target.value)}>
                <option value="">— Select doctor —</option>
                {doctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label>Hospital</label>
              <select value={form.hospital} onChange={e => set('hospital', e.target.value)}>
                <option value="">— Select hospital —</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label>Specialty</label>
              <input value={form.specialty} onChange={e => set('specialty', e.target.value)} placeholder="e.g. Surgery" />
            </div>
            <div className="admin-field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>Grade</label>
              <input value={form.grade} onChange={e => set('grade', e.target.value)} placeholder="e.g. A, B+, 85" disabled={!canEdit} />
            </div>
            <div className="admin-field full">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} disabled={!canEdit}>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Close</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>Delete Record</h3>
        <p>Delete <strong>{name}</strong>? This cannot be undone.</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red"     onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Students() {
  const { user: me } = useAuth();
  const canEdit      = ['super_admin', 'professor'].includes(me?.role);

  const [tab,        setTab      ] = useState(0);
  const [students,   setStudents ] = useState([]);
  const [evals,      setEvals    ] = useState([]);
  const [rotations,  setRotations] = useState([]);
  const [doctors,    setDoctors  ] = useState([]);
  const [hospitals,  setHospitals] = useState([]);
  const [loading,    setLoading  ] = useState(true);
  const [view,       setView     ] = useState('table');
  const [search,     setSearch   ] = useState('');
  const [page,       setPage     ] = useState(1);
  const [rows,       setRows     ] = useState(16);
  const [toasts,     setToasts   ] = useState([]);
  const [showModal,  setShowModal] = useState(false);
  const [editItem,   setEditItem ] = useState(null);
  const [saving,     setSaving   ] = useState(false);
  const [delItem,    setDelItem  ] = useState(null);

  function showToast(msg, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/users'),
      api.get('/api/evaluations'),
      api.get('/api/rotations'),
      api.get('/api/users/doctors'),
      api.get('/api/hospitals')
    ]).then(([u, ev, rot, d, h]) => {
      setStudents(u.data.filter(x => x.role === 'student'));
      setEvals(ev.data);
      setRotations(rot.data);
      setDoctors(d.data);
      setHospitals(h.data);
    }).catch(() => showToast('Failed to load', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const isRegistered = tab === 0;
  const isRotations  = tab === 2;
  const data         = isRegistered ? students : isRotations ? rotations : evals;

  const filtered = data.filter(item => {
    const q = search.toLowerCase();
    if (isRegistered) {
      return !q || item.name?.toLowerCase().includes(q) || item.email?.toLowerCase().includes(q) || item.city?.toLowerCase().includes(q);
    } else if (isRotations) {
      return !q ||
        item.student?.name?.toLowerCase().includes(q) ||
        item.hospital?.name?.toLowerCase().includes(q) ||
        item.doctor?.name?.toLowerCase().includes(q);
    } else {
      return !q ||
        item.student?.name?.toLowerCase().includes(q) ||
        item.doctor?.name?.toLowerCase().includes(q)  ||
        item.specialty?.toLowerCase().includes(q);
    }
  });

  const totalPages   = Math.max(1, Math.ceil(filtered.length / rows));
  const currentItems = filtered.slice((page - 1) * rows, page * rows);

  async function handleSaveEval(payload) {
    setSaving(true);
    try {
      if (editItem) {
        const res = await api.put(`/api/evaluations/${editItem._id}`, payload);
        setEvals(p => p.map(e => e._id === editItem._id ? res.data : e));
        showToast('Evaluation updated');
      } else {
        const res = await api.post('/api/evaluations', payload);
        setEvals(p => [res.data, ...p]);
        showToast('Evaluation created');
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRotation(payload) {
    setSaving(true);
    try {
      if (editItem) {
        const res = await api.put(`/api/rotations/${editItem._id}`, payload);
        setRotations(p => p.map(r => r._id === editItem._id ? res.data : r));
        showToast('Rotation updated');
      } else {
        const res = await api.post('/api/rotations', payload);
        setRotations(p => [res.data, ...p]);
        showToast('Student assigned to hospital');
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      if (isRegistered) {
        await api.delete(`/api/users/${delItem._id}`);
        setStudents(p => p.filter(s => s._id !== delItem._id));
      } else if (isRotations) {
        await api.delete(`/api/rotations/${delItem._id}`);
        setRotations(p => p.filter(r => r._id !== delItem._id));
      } else {
        await api.delete(`/api/evaluations/${delItem._id}`);
        setEvals(p => p.filter(e => e._id !== delItem._id));
      }
      showToast('Deleted');
    } catch { showToast('Delete failed', 'error'); }
    finally   { setDelItem(null); }
  }

  function PhotoCell({ item }) {
    const src = item.photoUrl ? `${API_BASE}${item.photoUrl}` : null;
    if (src) return <img src={src} alt="" className="cell-photo" />;
    return <div className="cell-initials">{item.initials || item.name?.[0] || '?'}</div>;
  }

  if (loading) return (
    <><Navbar /><main className="admin-main"><div className="loading">Loading…</div></main></>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">
              {isRegistered ? 'Registered Students' : isRotations ? 'Hospital Rotations' : 'Evaluated Students'}
            </div>
            <div className="admin-page-sub">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
          </div>
          {!isRegistered && isRotations && canEdit && (
            <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Assign to Hospital</button>
          )}
          {!isRegistered && !isRotations && (
            <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Evaluation</button>
          )}
        </div>

        <div className="admin-card">

          {/* Tabs */}
          <div className="admin-tabs">
            <button className={`admin-tab${tab === 0 ? ' active' : ''}`} onClick={() => { setTab(0); setPage(1); }}>Registered Students</button>
            <button className={`admin-tab${tab === 1 ? ' active' : ''}`} onClick={() => { setTab(1); setPage(1); }}>Evaluated Students</button>
            <button className={`admin-tab${tab === 2 ? ' active' : ''}`} onClick={() => { setTab(2); setPage(1); }}>Hospital Rotations</button>
          </div>

          {/* Toolbar */}
          <div className="admin-toolbar">
            <input className="admin-search" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            <div className="view-toggle">
              <button className={`view-btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}>☰</button>
              <button className={`view-btn${view === 'card'  ? ' active' : ''}`} onClick={() => setView('card')}>⊞</button>
            </div>
            <select className="rows-select" value={rows} onChange={e => { setRows(+e.target.value); setPage(1); }}>
              {ROWS_OPT.map(r => <option key={r} value={r}>{r} / page</option>)}
            </select>
          </div>

          {/* TABLE — Registered Students */}
          {view === 'table' && isRegistered && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Photo</th><th>Name</th><th>Email</th>
                    <th>City</th><th>Phone</th><th>Gender</th><th>Year</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && <tr><td colSpan={9} className="admin-empty">No students found</td></tr>}
                  {currentItems.map((s, i) => (
                    <tr key={s._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td><PhotoCell item={s} /></td>
                      <td><strong>{s.name}</strong></td>
                      <td style={{ color: '#666' }}>{s.email}</td>
                      <td>{s.city || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{s.gender || '—'}</td>
                      <td>{s.year ? `Year ${s.year}` : '—'}</td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action lock"   title={s.locked ? 'Unlock' : 'Lock'}>
                            {s.locked ? '🔓' : '🔒'}
                          </button>
                          {canEdit && <button className="btn-action delete" onClick={() => setDelItem(s)}>🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TABLE — Evaluated Students */}
          {view === 'table' && !isRegistered && !isRotations && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Student</th><th>Doctor</th><th>Hospital</th>
                    <th>Specialty</th><th>Date</th><th>Grade</th><th>Status</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && <tr><td colSpan={9} className="admin-empty">No evaluations found</td></tr>}
                  {currentItems.map((ev, i) => (
                    <tr key={ev._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <PhotoCell item={ev.student || {}} />
                          <strong>{ev.student?.name || '—'}</strong>
                        </div>
                      </td>
                      <td>{ev.doctor?.name   || '—'}</td>
                      <td>{ev.hospital?.name || '—'}</td>
                      <td><span className="specialty-tag">{ev.specialty || '—'}</span></td>
                      <td>{fmtDate(ev.date)}</td>
                      <td><strong>{ev.grade || '—'}</strong></td>
                      <td>
                        <span className={ev.status === 'completed' ? 'badge-completed' : 'badge-pending'}>
                          {ev.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td>
                          <div className="action-btns">
                            <button className="btn-action edit"   onClick={() => { setEditItem(ev); setShowModal(true); }}>✏️</button>
                            <button className="btn-action delete" onClick={() => setDelItem(ev)}>🗑️</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW — Registered */}
          {view === 'card' && isRegistered && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No students found</div>}
              {currentItems.map(s => {
                const src = s.photoUrl ? `${API_BASE}${s.photoUrl}` : null;
                return (
                  <div className="user-card" key={s._id}>
                    {src ? <img src={src} alt="" className="user-card-photo" />
                         : <div className="user-card-initials">{s.initials || s.name?.[0] || '?'}</div>}
                    <div className="user-card-name">{s.name}</div>
                    <span className="badge-role badge-student">Student</span>
                    <div className="user-card-sub">{s.city || '—'} {s.year ? `· Year ${s.year}` : ''}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE — Hospital Rotations */}
          {view === 'table' && isRotations && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Student</th><th>Hospital</th><th>Doctor</th>
                    <th>Start</th><th>End</th><th>Status</th>
                    <th>Weekly</th><th>Monthly</th><th>Final</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && <tr><td colSpan={11} className="admin-empty">No rotations found</td></tr>}
                  {currentItems.map((rot, i) => (
                    <tr key={rot._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <PhotoCell item={rot.student || {}} />
                          <strong>{rot.student?.name || '—'}</strong>
                        </div>
                      </td>
                      <td>{rot.hospital?.name || '—'}</td>
                      <td>{rot.doctor?.name   || '—'}</td>
                      <td>{fmtDate(rot.startDate)}</td>
                      <td>{fmtDate(rot.endDate)}</td>
                      <td>
                        <span className={
                          rot.status === 'completed' ? 'badge-completed' :
                          rot.status === 'current'   ? 'badge-active'   : 'badge-pending'
                        }>{rot.status}</span>
                      </td>
                      <td><strong>{rot.weeklyAvg  || '—'}</strong></td>
                      <td><strong>{rot.monthlyAvg || '—'}</strong></td>
                      <td><strong style={{ color: '#185FA5' }}>{rot.finalGrade || '—'}</strong></td>
                      {canEdit && (
                        <td>
                          <div className="action-btns">
                            <button className="btn-action edit"   onClick={() => { setEditItem(rot); setShowModal(true); }}>✏️</button>
                            <button className="btn-action delete" onClick={() => setDelItem(rot)}>🗑️</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW — Hospital Rotations */}
          {view === 'card' && isRotations && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No rotations found</div>}
              {currentItems.map(rot => {
                const st  = rot.student || {};
                const src = st.photoUrl ? `${API_BASE}${st.photoUrl}` : null;
                return (
                  <div className="dist-card" key={rot._id}>
                    <div className="dist-card-header">
                      {src ? <img src={src} alt="" className="cell-photo" />
                           : <div className="cell-initials">{st.initials || st.name?.[0] || '?'}</div>}
                      <div>
                        <div className="dist-card-name">{st.name || '—'}</div>
                        <div className="dist-card-sub">{rot.hospital?.name || '—'}</div>
                      </div>
                    </div>
                    <div className="dist-card-row">
                      <span className={
                        rot.status === 'completed' ? 'badge-completed' :
                        rot.status === 'current'   ? 'badge-active'   : 'badge-pending'
                      }>{rot.status}</span>
                      {rot.finalGrade && <strong style={{ color: '#185FA5', fontSize: 16 }}>{rot.finalGrade}</strong>}
                    </div>
                    <div className="dist-card-row" style={{ fontSize: 11, color: '#888' }}>
                      {fmtDate(rot.startDate)} → {fmtDate(rot.endDate)}
                    </div>
                    {rot.doctor?.name && <div style={{ fontSize: 12, color: '#666' }}>Dr. {rot.doctor.name}</div>}
                    {canEdit && (
                      <div className="dist-card-actions">
                        <button className="btn-action edit"   onClick={() => { setEditItem(rot); setShowModal(true); }}>✏️</button>
                        <button className="btn-action delete" onClick={() => setDelItem(rot)}>🗑️</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CARD VIEW — Evaluated */}
          {view === 'card' && !isRegistered && !isRotations && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No evaluations found</div>}
              {currentItems.map(ev => {
                const st  = ev.student || {};
                const src = st.photoUrl ? `${API_BASE}${st.photoUrl}` : null;
                return (
                  <div className="dist-card" key={ev._id}>
                    <div className="dist-card-header">
                      {src ? <img src={src} alt="" className="cell-photo" />
                           : <div className="cell-initials">{st.initials || st.name?.[0] || '?'}</div>}
                      <div>
                        <div className="dist-card-name">{st.name || '—'}</div>
                        <div className="dist-card-sub">{ev.doctor?.name || '—'}</div>
                      </div>
                    </div>
                    <div className="dist-card-row">
                      <span className="specialty-tag">{ev.specialty || '—'}</span>
                      <span className={ev.status === 'completed' ? 'badge-completed' : 'badge-pending'}>{ev.status}</span>
                    </div>
                    {ev.grade && <div style={{ fontSize: 20, fontWeight: 700, color: '#185FA5' }}>{ev.grade}</div>}
                    <div className="dist-card-row" style={{ fontSize: 11, color: '#888' }}>{fmtDate(ev.date)}</div>
                    {canEdit && (
                      <div className="dist-card-actions">
                        <button className="btn-action edit"   onClick={() => { setEditItem(ev); setShowModal(true); }}>✏️</button>
                        <button className="btn-action delete" onClick={() => setDelItem(ev)}>🗑️</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION */}
          <div className="admin-pagination">
            <span>Showing {Math.min((page - 1) * rows + 1, filtered.length)}–{Math.min(page * rows, filtered.length)} of {filtered.length}</span>
            <div className="pagination-btns">
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .map(n => <button key={n} className={`pg-btn${n === page ? ' active-pg' : ''}`} onClick={() => setPage(n)}>{n}</button>)
              }
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>

        </div>
      </main>

      {showModal && isRotations && (
        <RotationModal
          item={editItem}
          students={students}
          hospitals={hospitals}
          doctors={doctors}
          onSave={handleSaveRotation}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}
      {showModal && !isRegistered && !isRotations && (
        <EvalModal
          item={editItem}
          students={students}
          doctors={doctors}
          hospitals={hospitals}
          canEdit={canEdit}
          onSave={handleSaveEval}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}
      {delItem && (
        <ConfirmDelete
          name={isRegistered ? delItem.name : isRotations ? (delItem.student?.name || 'this rotation') : (delItem.student?.name || 'this evaluation')}
          onConfirm={confirmDelete}
          onCancel={() => setDelItem(null)}
        />
      )}
      <Toast toasts={toasts} />
    </>
  );
}
