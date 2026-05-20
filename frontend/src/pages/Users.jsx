import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import SPECIALTIES from '../data/specialties';
import Sk          from '../components/Skeleton';

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
const IconPassword = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
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

const ROLES    = ['student', 'doctor', 'professor', 'admin', 'super_admin'];
const GENDERS  = ['', 'male', 'female'];
const ROWS_OPT = [8, 16, 32];

const ROLE_BADGE = {
  student:     'badge-role badge-student',
  doctor:      'badge-role badge-doctor',
  professor:   'badge-role badge-professor',
  admin:       'badge-role badge-admin',
  super_admin: 'badge-role badge-super_admin',
};

const API_BASE = '';
function photoSrc(url) { return url ? `${API_BASE}${url}` : null; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }

// ── User / Doctor modal ────────────────────────────────────────────────────
function UserModal({ editUser, hospitals, doctors, isDoctor, onSave, onClose, saving }) {
  const empty = {
    name: '', email: '', password: '',
    role: isDoctor ? 'doctor' : 'student',
    phone: '', gender: '', city: '',
    hospital: '', specialty: '', studentId: '', doctor: ''
  };
  const [form,     setForm    ] = useState(editUser ? {
    name:      editUser.name      || '',
    email:     editUser.email     || '',
    role:      editUser.role      || (isDoctor ? 'doctor' : 'student'),
    phone:     editUser.phone     || '',
    gender:    editUser.gender    || '',
    city:      editUser.city      || '',
    hospital:  editUser.hospital?._id || editUser.hospital || '',
    specialty: editUser.specialty || '',
    studentId: editUser.studentId || '',
    doctor:    editUser.doctor?._id   || editUser.doctor   || ''
  } : empty);
  const [photo,    setPhoto   ] = useState(null);
  const [preview,  setPreview ] = useState(editUser?.photoUrl ? photoSrc(editUser.photoUrl) : null);
  const [errors,   setErrors  ] = useState({});
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
    if (!isDoctor && !form.role) e.role = true;
    if (!editUser && form.password.length < 6) e.password = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (photo) fd.append('photo', photo);
    onSave(fd);
  }

  // Close on Escape
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const showDoctorFields = isDoctor || form.role === 'doctor';

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">

        <div className="admin-modal-header">
          <div className="admin-modal-title">{editUser ? 'Edit User' : 'Add New User'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="admin-modal-body">
          <div className="admin-form-grid">

            {/* Photo */}
            <div className="admin-field full">
              <label>Profile Photo</label>
              <div className="photo-preview-wrap">
                {preview
                  ? <img src={preview} alt="preview" className="photo-preview" />
                  : <div className="photo-preview-placeholder">👤</div>
                }
                <button type="button" className="btn-outline" onClick={() => fileRef.current.click()}>
                  {preview ? 'Change Photo' : 'Upload Photo'}
                </button>
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }} onChange={pickPhoto} />
              </div>
            </div>

            {/* Name */}
            <div className="admin-field">
              <label>Name *</label>
              <input
                className={errors.name ? 'invalid' : ''}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Full name"
              />
            </div>

            {/* Email */}
            <div className="admin-field">
              <label>Email *</label>
              <input
                className={errors.email ? 'invalid' : ''}
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="email@domain.com"
              />
            </div>

            {/* Password (only when creating a new user) */}
            {!editUser && (
              <div className="admin-field">
                <label>Password *</label>
                <input
                  className={errors.password ? 'invalid' : ''}
                  type="password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Min. 6 characters"
                />
                {errors.password && <span style={{ fontSize: 11, color: '#e74c3c' }}>At least 6 characters required</span>}
              </div>
            )}

            {/* Role (only for All Users tab) */}
            {!isDoctor && (
              <div className="admin-field">
                <label>User Type *</label>
                <select className={errors.role ? 'invalid' : ''} value={form.role} onChange={e => set('role', e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
            )}

            {/* Phone */}
            <div className="admin-field">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 xxx xxx xxxx" />
            </div>

            {/* Gender */}
            <div className="admin-field">
              <label>Gender</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            {/* City */}
            <div className="admin-field">
              <label>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>

            {/* ID Number */}
            <div className="admin-field">
              <label>ID Number</label>
              <input value={form.studentId} onChange={e => set('studentId', e.target.value)} placeholder="e.g. STD-001" />
            </div>

            {/* Specialty */}
            <div className="admin-field">
              <label>Specialty</label>
              <select value={form.specialty} onChange={e => set('specialty', e.target.value)}>
                <option value="">— Select specialty —</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Hospital */}
            <div className="admin-field">
              <label>Hospital</label>
              <select value={form.hospital} onChange={e => set('hospital', e.target.value)}>
                <option value="">— Select hospital —</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
            </div>

            {/* Doctor */}
            <div className="admin-field">
              <label>Doctor</label>
              <select value={form.doctor} onChange={e => set('doctor', e.target.value)}>
                <option value="">— Select doctor —</option>
                {doctors.map(d => <option key={d._id} value={d._id}>{d.name}{d.specialty ? ` (${d.specialty})` : ''}</option>)}
              </select>
            </div>

          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Close</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Password Modal ─────────────────────────────────────────────────────────
function PasswordModal({ userId, onClose, showToast }) {
  const [pw,      setPw     ] = useState('');
  const [saving,  setSaving ] = useState(false);

  async function handleSave() {
    if (pw.length < 6) return showToast('Password must be at least 6 characters', 'error');
    setSaving(true);
    try {
      await api.put(`/api/users/${userId}/password`, { newPassword: pw });
      showToast('Password updated');
      onClose();
    } catch { showToast('Failed to update password', 'error'); }
    finally  { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" style={{ maxWidth: 380 }}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">Change Password</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-field">
            <label>New Password (min 6 chars)</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="New password" />
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

// ── Confirm Delete ─────────────────────────────────────────────────────────
function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>Delete User</h3>
        <p>Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red"     onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Users Page ────────────────────────────────────────────────────────
export default function Users() {
  const { user: me } = useAuth();

  const [tab,        setTab       ] = useState(0);       // 0=All, 1=Doctors
  const [users,      setUsers     ] = useState([]);
  const [hospitals,  setHospitals ] = useState([]);
  const [doctors,    setDoctors   ] = useState([]);
  const [loading,    setLoading   ] = useState(true);
  const [view,       setView      ] = useState('table'); // 'table' | 'card'
  const [search,     setSearch    ] = useState('');
  const [page,       setPage      ] = useState(1);
  const [rows,       setRows      ] = useState(16);
  const [toasts,     setToasts    ] = useState([]);

  const [showModal,  setShowModal ] = useState(false);
  const [editUser,   setEditUser  ] = useState(null);
  const [saving,     setSaving    ] = useState(false);

  const [showPass,   setShowPass  ] = useState(false);
  const [passUserId, setPassUserId] = useState(null);

  const [deleteUser, setDeleteUser] = useState(null);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([api.get('/api/users'), api.get('/api/hospitals'), api.get('/api/users/doctors')])
      .then(([u, h, d]) => { setUsers(u.data); setHospitals(h.data); setDoctors(d.data); })
      .catch(() => showToast('Failed to load users', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const isDoctor  = tab === 1;
  const displayed = users
    .filter(u => isDoctor ? u.role === 'doctor' : true)
    .filter(u => {
      const q = search.toLowerCase();
      return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.city?.toLowerCase().includes(q);
    });

  const totalPages   = Math.max(1, Math.ceil(displayed.length / rows));
  const currentItems = displayed.slice((page - 1) * rows, page * rows);

  function openAdd()         { setEditUser(null);  setShowModal(true); }
  function openEdit(u)       { setEditUser(u);     setShowModal(true); }
  function openPass(u)       { setPassUserId(u._id); setShowPass(true); }
  function openDelete(u)     { setDeleteUser(u); }

  async function handleSave(fd) {
    setSaving(true);
    try {
      if (editUser) {
        const res = await api.put(`/api/users/${editUser._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUsers(prev => prev.map(u => u._id === editUser._id ? res.data : u));
        showToast('User updated');
      } else {
        const res = await api.post('/api/users', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUsers(prev => [res.data, ...prev]);
        showToast('User created');
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleLock(u) {
    try {
      const res = await api.put(`/api/users/${u._id}/lock`);
      setUsers(prev => prev.map(x => x._id === u._id ? { ...x, locked: res.data.locked } : x));
      showToast(res.data.locked ? 'User locked' : 'User unlocked');
    } catch { showToast('Failed', 'error'); }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/api/users/${deleteUser._id}`);
      setUsers(prev => prev.filter(u => u._id !== deleteUser._id));
      showToast('User deleted');
    } catch { showToast('Delete failed', 'error'); }
    finally   { setDeleteUser(null); }
  }

  function PhotoCell({ u }) {
    const src = photoSrc(u.photoUrl);
    if (src) return <img src={src} alt="" className="cell-photo" />;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div className="cell-initials">{u.initials || u.name?.[0] || '?'}</div>
        <span className="no-photo-label">NO IMAGE</span>
      </div>
    );
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-tabs" style={{ display: 'flex', gap: 4, padding: '14px 20px 0' }}>
            <Sk w={80} h={14} r={4} />
            <Sk w={90} h={14} r={4} style={{ marginLeft: 8 }} />
          </div>
          <div className="admin-toolbar">
            <Sk h={36} r={8} style={{ flex: 1, minWidth: 180 }} />
            <Sk w={72} h={34} r={8} />
            <Sk w={90} h={34} r={8} />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {['#', 'Name', 'Email', 'Photo', 'Role', 'Phone', 'Gender', 'City', 'Actions'].map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={20}  h={13} /></td>
                    <td><Sk w={130} h={13} /></td>
                    <td><Sk w={160} h={13} /></td>
                    <td><Sk w={36}  h={36} r="50%" /></td>
                    <td><Sk w={70}  h={20} r={20} /></td>
                    <td><Sk w={90}  h={13} /></td>
                    <td><Sk w={60}  h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
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

  return (
    <>
      <Navbar />
      <main className="admin-main">

        <div className="admin-page-header">
          <button className="btn-purple" onClick={openAdd}>+ Add New User</button>
        </div>

        <div className="admin-card">

          {/* Tabs */}
          <div className="admin-tabs">
            <button className={`admin-tab${tab === 0 ? ' active' : ''}`} onClick={() => { setTab(0); setPage(1); }}>All Users</button>
            <button className={`admin-tab${tab === 1 ? ' active' : ''}`} onClick={() => { setTab(1); setPage(1); }}>Doctors Users</button>
          </div>

          {/* Toolbar */}
          <div className="admin-toolbar">
            <input
              className="admin-search"
              placeholder="Search by name, email, city…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <div className="view-toggle">
              <button className={`view-btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')} title="Table view">☰</button>
              <button className={`view-btn${view === 'card'  ? ' active' : ''}`} onClick={() => setView('card')}  title="Card view">⊞</button>
            </div>
            <select className="rows-select" value={rows} onChange={e => { setRows(+e.target.value); setPage(1); }}>
              {ROWS_OPT.map(r => <option key={r} value={r}>{r} / page</option>)}
            </select>
          </div>

          {/* TABLE VIEW */}
          {view === 'table' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Photo</th>
                    {!isDoctor && <th>User Type</th>}
                    <th>Phone</th>
                    <th>Gender</th>
                    <th>City</th>
                    {isDoctor && <th>Specialty</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && (
                    <tr><td colSpan={10} className="admin-empty">No users found</td></tr>
                  )}
                  {currentItems.map((u, i) => (
                    <tr key={u._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td><strong>{u.name}</strong></td>
                      <td style={{ color: '#666' }}>{u.email}</td>
                      <td><PhotoCell u={u} /></td>
                      {!isDoctor && <td><span className={ROLE_BADGE[u.role] || 'badge-role'}>{u.role?.replace('_', ' ')}</span></td>}
                      <td>{u.phone || '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{u.gender || '—'}</td>
                      <td>{u.city || '—'}</td>
                      {isDoctor && <td>{u.specialty || '—'}</td>}
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit"     title="Edit"            onClick={() => openEdit(u)}><IconEdit /></button>
                          <button className="btn-action password" title="Change password" onClick={() => openPass(u)}><IconPassword /></button>
                          <button className="btn-action lock"     title={u.locked ? 'Unlock' : 'Lock'} onClick={() => handleLock(u)}>
                            {u.locked ? <IconUnlock /> : <IconLock />}
                          </button>
                          {u._id !== me?._id && (
                            <button className="btn-action delete" title="Delete" onClick={() => openDelete(u)}><IconDelete /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW */}
          {view === 'card' && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No users found</div>}
              {currentItems.map(u => {
                const src = photoSrc(u.photoUrl);
                return (
                  <div className="user-card" key={u._id}>
                    {src
                      ? <img src={src} alt="" className="user-card-photo" />
                      : <div className="user-card-initials">{u.initials || u.name?.[0] || '?'}</div>
                    }
                    <div className="user-card-name">{u.name}</div>
                    <span className={ROLE_BADGE[u.role] || 'badge-role'}>{u.role?.replace('_', ' ')}</span>
                    <div className="user-card-sub">{u.city || u.specialty || '—'}</div>
                    <div className="user-card-actions">
                      <button className="btn-action edit"   onClick={() => openEdit(u)}><IconEdit /></button>
                      {u._id !== me?._id && (
                        <button className="btn-action delete" onClick={() => openDelete(u)}><IconDelete /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION */}
          <div className="admin-pagination">
            <span>Showing {Math.min((page - 1) * rows + 1, displayed.length)}–{Math.min(page * rows, displayed.length)} of {displayed.length}</span>
            <div className="pagination-btns">
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .map(n => (
                  <button key={n} className={`pg-btn${n === page ? ' active-pg' : ''}`} onClick={() => setPage(n)}>{n}</button>
                ))
              }
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>

        </div>
      </main>

      {/* Modals */}
      {showModal && (
        <UserModal
          editUser={editUser}
          hospitals={hospitals}
          doctors={doctors}
          isDoctor={isDoctor}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}
      {showPass && (
        <PasswordModal
          userId={passUserId}
          onClose={() => setShowPass(false)}
          showToast={showToast}
        />
      )}
      {deleteUser && (
        <ConfirmDelete
          name={deleteUser.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteUser(null)}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}
