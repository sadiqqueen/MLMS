import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import SPECIALTIES from '../data/specialties';
import Sk          from '../components/Skeleton';

const ROWS_OPT = [8, 16, 32];
const API_BASE = '';

const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconUnlock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconDelete = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_OPTS = ['upcoming', 'current', 'completed'];

// ── Student Modal (admin add/edit) ─────────────────────────────────────────
function StudentModal({ editStudent, hospitals, onSave, onClose, saving }) {
  const empty = { name: '', email: '', password: '', phone: '', gender: '', city: '', year: '', studentId: '', specialty: '', hospital: '' };
  const [form,    setForm   ] = useState(editStudent ? {
    name:      editStudent.name      || '',
    email:     editStudent.email     || '',
    phone:     editStudent.phone     || '',
    gender:    editStudent.gender    || '',
    city:      editStudent.city      || '',
    year:      editStudent.year      || '',
    studentId: editStudent.studentId || '',
    specialty: editStudent.specialty || '',
    hospital:  editStudent.hospital?._id || editStudent.hospital || '',
  } : empty);
  const [photo,   setPhoto  ] = useState(null);
  const [preview, setPreview] = useState(editStudent?.photoUrl ? `${API_BASE}${editStudent.photoUrl}` : null);
  const [errors,  setErrors ] = useState({});
  const fileRef = useRef();

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function pickPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function validate() {
    const e = {};
    if (!form.name.trim())  e.name  = true;
    if (!form.email.trim()) e.email = true;
    if (!editStudent && form.password.length < 6) e.password = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    const fd = new FormData();
    fd.append('role', 'student');
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (photo) fd.append('photo', photo);
    onSave(fd);
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
          <div className="admin-modal-title">{editStudent ? 'Edit Student' : 'Add Student'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">

            <div className="admin-field full">
              <label>Profile Photo</label>
              <div className="photo-preview-wrap">
                {preview
                  ? <img src={preview} alt="preview" className="photo-preview" />
                  : <div className="photo-preview-placeholder">👤</div>}
                <button type="button" className="btn-outline" onClick={() => fileRef.current.click()}>
                  {preview ? 'Change Photo' : 'Upload Photo'}
                </button>
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }} onChange={pickPhoto} />
              </div>
            </div>

            <div className="admin-field">
              <label>Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
            </div>

            <div className="admin-field">
              <label>Email *</label>
              <input className={errors.email ? 'invalid' : ''} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@domain.com" />
            </div>

            {!editStudent && (
              <div className="admin-field">
                <label>Password *</label>
                <input className={errors.password ? 'invalid' : ''} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters" />
                {errors.password && <span style={{ fontSize: 11, color: '#e74c3c' }}>At least 6 characters required</span>}
              </div>
            )}

            <div className="admin-field">
              <label>Student ID</label>
              <input value={form.studentId} onChange={e => set('studentId', e.target.value)} placeholder="e.g. STD-001" />
            </div>

            <div className="admin-field">
              <label>Specialty</label>
              <select value={form.specialty} onChange={e => set('specialty', e.target.value)}>
                <option value="">— Select specialty —</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Year</label>
              <input type="number" min="1" max="6" value={form.year} onChange={e => set('year', e.target.value)} placeholder="1–6" />
            </div>

            <div className="admin-field">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 xxx xxx xxxx" />
            </div>

            <div className="admin-field">
              <label>Gender</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="admin-field">
              <label>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>

            <div className="admin-field full">
              <label>Main Hospital</label>
              <select value={form.hospital} onChange={e => set('hospital', e.target.value)}>
                <option value="">— Select hospital —</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
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
  const [studentSearch, setStudentSearch] = useState(item?.student?.name || '');
  const [dropOpen,      setDropOpen     ] = useState(false);
  const [errors, setErrors] = useState({});

  const filteredStudents = studentSearch.trim() === ''
    ? students
    : students.filter(s =>
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (s.studentId || '').toLowerCase().includes(studentSearch.toLowerCase())
      );

  function selectStudent(s) {
    setStudentSearch(s.name);
    setDropOpen(false);
    setForm(f => ({ ...f, student: s._id, hospital: s.hospital?._id || '' }));
    setErrors(e => ({ ...e, student: false }));
  }

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
              <div style={{ position: 'relative' }}>
                <input
                  className={errors.student ? 'invalid' : ''}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Type a name or student ID…"
                  value={studentSearch}
                  autoComplete="off"
                  onFocus={() => setDropOpen(true)}
                  onBlur={() => setTimeout(() => setDropOpen(false), 150)}
                  onChange={e => {
                    setStudentSearch(e.target.value);
                    setForm(f => ({ ...f, student: '' }));
                    setDropOpen(true);
                  }}
                />
                {dropOpen && filteredStudents.length > 0 && (
                  <ul style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 400,
                    margin: 0, padding: 0, listStyle: 'none',
                    background: '#fff', border: '1px solid #e8eaf0', borderRadius: 10,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.13)', maxHeight: 220, overflowY: 'auto',
                  }}>
                    {filteredStudents.map(s => (
                      <li key={s._id}>
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); selectStudent(s); }}
                          style={{
                            width: '100%', textAlign: 'left', background: 'none',
                            border: 'none', borderBottom: '1px solid #f3f3f3',
                            padding: '10px 14px', cursor: 'pointer', display: 'block',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0f3ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                          {s.studentId && <span style={{ marginLeft: 8, fontSize: 12, color: '#aaa' }}>{s.studentId}</span>}
                          {s.year      && <span style={{ marginLeft: 8, fontSize: 12, color: '#aaa' }}>Year {s.year}</span>}
                          {s.hospital?.name && <span style={{ marginLeft: 8, fontSize: 12, color: '#7c6fcd' }}>{s.hospital.name}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
    specialty: item?.specialty?._id  || item?.specialty   || '',
    date:      item?.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    grade:     item?.grade  || '',
    status:    item?.status || 'pending'
  });
  const [studentSearch, setStudentSearch] = useState(item?.student?.name || '');
  const [dropOpen,      setDropOpen     ] = useState(false);
  const [errors, setErrors] = useState({});

  const filteredStudents = studentSearch.trim() === ''
    ? students
    : students.filter(s =>
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (s.studentId || '').toLowerCase().includes(studentSearch.toLowerCase())
      );

  function selectStudent(s) {
    setStudentSearch(s.name);
    setDropOpen(false);
    setForm(f => ({ ...f, student: s._id, hospital: s.hospital?._id || '' }));
    setErrors(e => ({ ...e, student: false }));
  }

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
              <div style={{ position: 'relative' }}>
                <input
                  className={errors.student ? 'invalid' : ''}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Type a name or student ID…"
                  value={studentSearch}
                  autoComplete="off"
                  onFocus={() => setDropOpen(true)}
                  onBlur={() => setTimeout(() => setDropOpen(false), 150)}
                  onChange={e => {
                    setStudentSearch(e.target.value);
                    setForm(f => ({ ...f, student: '' }));
                    setDropOpen(true);
                  }}
                />
                {dropOpen && filteredStudents.length > 0 && (
                  <ul style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 400,
                    margin: 0, padding: 0, listStyle: 'none',
                    background: '#fff', border: '1px solid #e8eaf0', borderRadius: 10,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.13)', maxHeight: 220, overflowY: 'auto',
                  }}>
                    {filteredStudents.map(s => (
                      <li key={s._id}>
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); selectStudent(s); }}
                          style={{
                            width: '100%', textAlign: 'left', background: 'none',
                            border: 'none', borderBottom: '1px solid #f3f3f3',
                            padding: '10px 14px', cursor: 'pointer', display: 'block',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0f3ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                          {s.studentId && <span style={{ marginLeft: 8, fontSize: 12, color: '#aaa' }}>{s.studentId}</span>}
                          {s.year      && <span style={{ marginLeft: 8, fontSize: 12, color: '#aaa' }}>Year {s.year}</span>}
                          {s.hospital?.name && <span style={{ marginLeft: 8, fontSize: 12, color: '#7c6fcd' }}>{s.hospital.name}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
  const isAdmin  = me?.role === 'admin';
  const canEdit  = ['super_admin', 'professor'].includes(me?.role);

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

  // tabbed modals (super_admin / professor)
  const [showModal,  setShowModal] = useState(false);
  const [editItem,   setEditItem ] = useState(null);
  const [saving,     setSaving   ] = useState(false);
  const [delItem,    setDelItem  ] = useState(null);

  // student modal (admin)
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editStudent,      setEditStudent     ] = useState(null);

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

  const isRotations  = tab === 2;
  const isRegistered = tab === 0;
  const data         = isRegistered ? students : isRotations ? rotations : evals;

  const filtered = data.filter(item => {
    const q = search.toLowerCase();
    if (isRegistered) {
      return !q || item.name?.toLowerCase().includes(q) || item.email?.toLowerCase().includes(q) || item.city?.toLowerCase().includes(q);
    } else if (isRotations) {
      return !q || item.student?.name?.toLowerCase().includes(q) || item.hospital?.name?.toLowerCase().includes(q) || item.doctor?.name?.toLowerCase().includes(q);
    } else {
      return !q || item.student?.name?.toLowerCase().includes(q) || item.doctor?.name?.toLowerCase().includes(q) || item.specialty?.toLowerCase().includes(q);
    }
  });

  const totalPages   = Math.max(1, Math.ceil(filtered.length / rows));
  const currentItems = filtered.slice((page - 1) * rows, page * rows);

  // admin: add / edit student
  async function handleSaveStudent(fd) {
    setSaving(true);
    try {
      if (editStudent) {
        const res = await api.put(`/api/users/${editStudent._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setStudents(p => p.map(s => s._id === editStudent._id ? res.data : s));
        showToast('Student updated');
      } else {
        const res = await api.post('/api/users', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setStudents(p => [res.data, ...p]);
        showToast('Student added');
      }
      setShowStudentModal(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

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
    } finally { setSaving(false); }
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
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    try {
      if (isAdmin || isRegistered) {
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
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar">
            <Sk h={36} r={8} style={{ flex: 1, minWidth: 180 }} />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {['#', 'Photo', 'Name', 'Email', 'Hospital', 'City', 'Status', 'Actions'].map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={20}  h={13} /></td>
                    <td><Sk w={36}  h={36} r="50%" /></td>
                    <td><Sk w={130} h={13} /></td>
                    <td><Sk w={160} h={13} /></td>
                    <td><Sk w={110} h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                    <td><Sk w={70}  h={22} r={20} /></td>
                    <td><Sk w={88}  h={28} r={7}  /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );

  // ── Admin view: students only ──────────────────────────────────────────────
  if (isAdmin) {
    const adminFiltered = students.filter(s => {
      const q = search.toLowerCase();
      return !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q);
    });
    const adminPages = Math.max(1, Math.ceil(adminFiltered.length / rows));
    const adminItems = adminFiltered.slice((page - 1) * rows, page * rows);

    return (
      <>
        <Navbar />
        <main className="admin-main">

          <div className="admin-page-header">
            <button className="btn-purple" onClick={() => { setEditStudent(null); setShowStudentModal(true); }}>+ Add Student</button>
          </div>

          <div className="admin-card">
            <div className="admin-toolbar">
              <input className="admin-search" placeholder="Search by name, email, city…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              <select className="rows-select" value={rows} onChange={e => { setRows(+e.target.value); setPage(1); }}>
                {ROWS_OPT.map(r => <option key={r} value={r}>{r} / page</option>)}
              </select>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Photo</th><th>Name</th><th>Email</th>
                    <th>Hospital</th><th>City</th><th>Phone</th><th>Gender</th><th>Year</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminItems.length === 0 && <tr><td colSpan={10} className="admin-empty">No students found</td></tr>}
                  {adminItems.map((s, i) => (
                    <tr key={s._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td><PhotoCell item={s} /></td>
                      <td><strong>{s.name}</strong></td>
                      <td style={{ color: '#666' }}>{s.email}</td>
                      <td>{s.hospital?.name || '—'}</td>
                      <td>{s.city || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{s.gender || '—'}</td>
                      <td>{s.year ? `Year ${s.year}` : '—'}</td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit"   title="Edit"   onClick={() => { setEditStudent(s); setShowStudentModal(true); }}><IconEdit /></button>
                          <button className="btn-action delete" title="Delete" onClick={() => setDelItem(s)}><IconDelete /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-pagination">
              <span>Showing {Math.min((page - 1) * rows + 1, adminFiltered.length)}–{Math.min(page * rows, adminFiltered.length)} of {adminFiltered.length}</span>
              <div className="pagination-btns">
                <button className="pg-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {Array.from({ length: adminPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === adminPages || Math.abs(n - page) <= 1)
                  .map(n => <button key={n} className={`pg-btn${n === page ? ' active-pg' : ''}`} onClick={() => setPage(n)}>{n}</button>)}
                <button className="pg-btn" disabled={page === adminPages} onClick={() => setPage(p => p + 1)}>›</button>
                <button className="pg-btn" disabled={page === adminPages} onClick={() => setPage(adminPages)}>»</button>
              </div>
            </div>
          </div>

          {showStudentModal && (
            <StudentModal
              editStudent={editStudent}
              hospitals={hospitals}
              onSave={handleSaveStudent}
              onClose={() => setShowStudentModal(false)}
              saving={saving}
            />
          )}
          {delItem && (
            <ConfirmDelete name={delItem.name} onConfirm={confirmDelete} onCancel={() => setDelItem(null)} />
          )}
          <Toast toasts={toasts} />
        </main>
      </>
    );
  }

  // ── Super-admin / professor: full tabbed view ──────────────────────────────
  return (
    <>
      <Navbar />
      <main className="admin-main">

        <div className="admin-page-header">
          {!isRegistered && isRotations && canEdit && (
            <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Assign to Hospital</button>
          )}
          {!isRegistered && !isRotations && (
            <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Evaluation</button>
          )}
        </div>

        <div className="admin-card">

          <div className="admin-tabs">
            <button className={`admin-tab${tab === 0 ? ' active' : ''}`} onClick={() => { setTab(0); setPage(1); }}>Students</button>
            <button className={`admin-tab${tab === 1 ? ' active' : ''}`} onClick={() => { setTab(1); setPage(1); }}>Evaluated Students</button>
            <button className={`admin-tab${tab === 2 ? ' active' : ''}`} onClick={() => { setTab(2); setPage(1); }}>Hospital Rotations</button>
          </div>

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

          {/* TABLE — Students */}
          {view === 'table' && isRegistered && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>#</th><th>Photo</th><th>Name</th><th>Email</th><th>City</th><th>Phone</th><th>Gender</th><th>Year</th><th>Actions</th></tr>
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
                          <button className="btn-action lock" title={s.locked ? 'Unlock' : 'Lock'}>{s.locked ? <IconUnlock /> : <IconLock />}</button>
                          {canEdit && <button className="btn-action delete" onClick={() => setDelItem(s)}><IconDelete /></button>}
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
                  <tr><th>#</th><th>Student</th><th>Doctor</th><th>Hospital</th><th>Specialty</th><th>Date</th><th>Grade</th><th>Status</th>{canEdit && <th>Actions</th>}</tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && <tr><td colSpan={9} className="admin-empty">No evaluations found</td></tr>}
                  {currentItems.map((ev, i) => (
                    <tr key={ev._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PhotoCell item={ev.student || {}} /><strong>{ev.student?.name || '—'}</strong></div></td>
                      <td>{ev.doctor?.name   || '—'}</td>
                      <td>{ev.hospital?.name || '—'}</td>
                      <td><span className="specialty-tag">{ev.specialty || '—'}</span></td>
                      <td>{fmtDate(ev.date)}</td>
                      <td><strong>{ev.grade || '—'}</strong></td>
                      <td><span className={ev.status === 'completed' ? 'badge-completed' : 'badge-pending'}>{ev.status}</span></td>
                      {canEdit && <td><div className="action-btns"><button className="btn-action edit" onClick={() => { setEditItem(ev); setShowModal(true); }}><IconEdit /></button><button className="btn-action delete" onClick={() => setDelItem(ev)}><IconDelete /></button></div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW — Students */}
          {view === 'card' && isRegistered && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No students found</div>}
              {currentItems.map(s => {
                const src = s.photoUrl ? `${API_BASE}${s.photoUrl}` : null;
                return (
                  <div className="user-card" key={s._id}>
                    {src ? <img src={src} alt="" className="user-card-photo" /> : <div className="user-card-initials">{s.initials || s.name?.[0] || '?'}</div>}
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
                  <tr><th>#</th><th>Student</th><th>Hospital</th><th>Doctor</th><th>Start</th><th>End</th><th>Status</th><th>Weekly</th><th>Monthly</th><th>Final</th>{canEdit && <th>Actions</th>}</tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && <tr><td colSpan={11} className="admin-empty">No rotations found</td></tr>}
                  {currentItems.map((rot, i) => (
                    <tr key={rot._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PhotoCell item={rot.student || {}} /><strong>{rot.student?.name || '—'}</strong></div></td>
                      <td>{rot.hospital?.name || '—'}</td>
                      <td>{rot.doctor?.name   || '—'}</td>
                      <td>{fmtDate(rot.startDate)}</td>
                      <td>{fmtDate(rot.endDate)}</td>
                      <td><span className={rot.status === 'completed' ? 'badge-completed' : rot.status === 'current' ? 'badge-active' : 'badge-pending'}>{rot.status}</span></td>
                      <td><strong>{rot.weeklyAvg  || '—'}</strong></td>
                      <td><strong>{rot.monthlyAvg || '—'}</strong></td>
                      <td><strong style={{ color: '#185FA5' }}>{rot.finalGrade || '—'}</strong></td>
                      {canEdit && <td><div className="action-btns"><button className="btn-action edit" onClick={() => { setEditItem(rot); setShowModal(true); }}><IconEdit /></button><button className="btn-action delete" onClick={() => setDelItem(rot)}><IconDelete /></button></div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW — Rotations */}
          {view === 'card' && isRotations && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No rotations found</div>}
              {currentItems.map(rot => {
                const st = rot.student || {};
                const src = st.photoUrl ? `${API_BASE}${st.photoUrl}` : null;
                return (
                  <div className="dist-card" key={rot._id}>
                    <div className="dist-card-header">
                      {src ? <img src={src} alt="" className="cell-photo" /> : <div className="cell-initials">{st.initials || st.name?.[0] || '?'}</div>}
                      <div><div className="dist-card-name">{st.name || '—'}</div><div className="dist-card-sub">{rot.hospital?.name || '—'}</div></div>
                    </div>
                    <div className="dist-card-row">
                      <span className={rot.status === 'completed' ? 'badge-completed' : rot.status === 'current' ? 'badge-active' : 'badge-pending'}>{rot.status}</span>
                      {rot.finalGrade && <strong style={{ color: '#185FA5', fontSize: 16 }}>{rot.finalGrade}</strong>}
                    </div>
                    <div className="dist-card-row" style={{ fontSize: 11, color: '#888' }}>{fmtDate(rot.startDate)} → {fmtDate(rot.endDate)}</div>
                    {rot.doctor?.name && <div style={{ fontSize: 12, color: '#666' }}>Dr. {rot.doctor.name}</div>}
                    {canEdit && <div className="dist-card-actions"><button className="btn-action edit" onClick={() => { setEditItem(rot); setShowModal(true); }}><IconEdit /></button><button className="btn-action delete" onClick={() => setDelItem(rot)}><IconDelete /></button></div>}
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
                const st = ev.student || {};
                const src = st.photoUrl ? `${API_BASE}${st.photoUrl}` : null;
                return (
                  <div className="dist-card" key={ev._id}>
                    <div className="dist-card-header">
                      {src ? <img src={src} alt="" className="cell-photo" /> : <div className="cell-initials">{st.initials || st.name?.[0] || '?'}</div>}
                      <div><div className="dist-card-name">{st.name || '—'}</div><div className="dist-card-sub">{ev.doctor?.name || '—'}</div></div>
                    </div>
                    <div className="dist-card-row">
                      <span className="specialty-tag">{ev.specialty || '—'}</span>
                      <span className={ev.status === 'completed' ? 'badge-completed' : 'badge-pending'}>{ev.status}</span>
                    </div>
                    {ev.grade && <div style={{ fontSize: 20, fontWeight: 700, color: '#185FA5' }}>{ev.grade}</div>}
                    <div className="dist-card-row" style={{ fontSize: 11, color: '#888' }}>{fmtDate(ev.date)}</div>
                    {canEdit && <div className="dist-card-actions"><button className="btn-action edit" onClick={() => { setEditItem(ev); setShowModal(true); }}><IconEdit /></button><button className="btn-action delete" onClick={() => setDelItem(ev)}><IconDelete /></button></div>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="admin-pagination">
            <span>Showing {Math.min((page - 1) * rows + 1, filtered.length)}–{Math.min(page * rows, filtered.length)} of {filtered.length}</span>
            <div className="pagination-btns">
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .map(n => <button key={n} className={`pg-btn${n === page ? ' active-pg' : ''}`} onClick={() => setPage(n)}>{n}</button>)}
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>
        </div>
      </main>

      {showModal && isRotations && (
        <RotationModal item={editItem} students={students} hospitals={hospitals} doctors={doctors} onSave={handleSaveRotation} onClose={() => setShowModal(false)} saving={saving} />
      )}
      {showModal && !isRegistered && !isRotations && (
        <EvalModal item={editItem} students={students} doctors={doctors} hospitals={hospitals} canEdit={canEdit} onSave={handleSaveEval} onClose={() => setShowModal(false)} saving={saving} />
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
