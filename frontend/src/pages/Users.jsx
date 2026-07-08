import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';
import { IconEdit, IconDelete, IconPassword, IconLock, IconUnlock, IconBan, IconUserCheck } from '../components/icons';
import { baseRole } from '../config/roles';

const ROLES = ['trainee', 'supervisor', 'program_director', 'secretary', 'dio', 'president', 'asg1', 'asg2', 'super_admin'];

// Roles that exist in both portals (Advanced + Basic).
const BASIC_CAPABLE = ['trainee', 'supervisor', 'program_director', 'secretary', 'dio', 'president'];
// Combine a base role + chosen track into the actual role string to submit.
function effectiveRole(baseR, track) {
  return (track === 'basic' && BASIC_CAPABLE.includes(baseR)) ? 'b_' + baseR : baseR;
}

const ROLE_BADGE = {
  trainee:          'badge-role badge-student',
  supervisor:       'badge-role badge-doctor',
  program_director: 'badge-role badge-professor',
  secretary:        'badge-role badge-admin',
  dio:              'badge-role badge-super_admin',
  president:        'badge-role badge-super_admin',
  asg1:             'badge-role badge-super_admin',
  asg2:             'badge-role badge-super_admin',
  super_admin:      'badge-role badge-super_admin',
  b_trainee:          'badge-role badge-student',
  b_supervisor:       'badge-role badge-doctor',
  b_program_director: 'badge-role badge-professor',
  b_secretary:        'badge-role badge-admin',
  b_dio:              'badge-role badge-super_admin',
  b_president:        'badge-role badge-super_admin',
};

const ROLE_FIELDS = {
  trainee:          ['studentId', 'year', 'hospitalId', 'supervisorId', 'specialtyId', 'phone', 'gender', 'city'],
  supervisor:       ['hospitalId', 'specialtyId', 'department', 'phone', 'gender', 'city'],
  program_director: ['hospitalId', 'department', 'phone'],
  secretary:        ['specialtyId', 'phone'],
  dio:              ['phone'],
  president:        ['phone'],
  asg1:             ['phone'],
  asg2:             ['phone'],
  super_admin:      [],
};

function showField(role, field) {
  return (ROLE_FIELDS[role] || []).includes(field);
}

const ROLE_DISPLAY = { asg1: 'ASG.1', asg2: 'ASG.2' };

function roleLabel(r) {
  if (typeof r === 'string' && r.startsWith('b_')) return 'Basic ' + roleLabel(r.slice(2));
  return ROLE_DISPLAY[r] || r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const ROWS_OPT = [8, 16, 32];
const API_BASE = '';

function photoSrc(url) { return url ? `${API_BASE}${url}` : null; }

// ── User Modal ─────────────────────────────────────────────────────────────
function UserModal({ editUser, hospitals, supervisors, specialties, onSave, onClose, saving }) {
  const [form, setForm] = useState(editUser ? {
    name:         editUser.name         || '',
    email:        editUser.email        || '',
    password:     '',
    role:         baseRole(editUser.role || 'trainee'),
    track:        (editUser.role || '').startsWith('b_') ? 'basic' : 'advanced',
    phone:        editUser.phone        || '',
    gender:       editUser.gender       || '',
    city:         editUser.city         || '',
    studentId:    editUser.studentId    || '',
    year:         editUser.year         || '',
    hospitalId:   editUser.hospitalId?._id  || editUser.hospitalId  || editUser.hospital?._id || editUser.hospital || '',
    supervisorId: editUser.supervisorId?._id || editUser.supervisorId || '',
    specialtyId:  editUser.specialtyId?._id  || editUser.specialtyId || '',
    department:   editUser.department   || '',
  } : {
    name: '', email: '', password: '', role: 'trainee', track: 'advanced',
    phone: '', gender: '', city: '',
    studentId: '', year: '', hospitalId: '', supervisorId: '', specialtyId: '', department: '',
  });
  const [photo,   setPhoto  ] = useState(null);
  const [preview, setPreview] = useState(editUser?.photoUrl ? photoSrc(editUser.photoUrl) : null);
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
    if (!editUser && form.password.length < 6) e.password = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const fd = new FormData();
    // Combine base role + track into the real role; the server derives `track` from it.
    const payload = { ...form, role: effectiveRole(form.role, form.track) };
    delete payload.track;
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) fd.append(k, v);
    });
    if (photo) fd.append('photo', photo);
    onSave(fd);
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const role = form.role;

  // Only offer hospitals/specialties/supervisors from the chosen track so an
  // account is never wired across portals. (advanced = anything not 'basic').
  const inTrack = item => (form.track === 'basic' ? item?.track === 'basic' : item?.track !== 'basic');
  const filteredSupervisors = supervisors.filter(s =>
    inTrack(s) &&
    (!form.specialtyId || (s.specialtyId?._id || s.specialtyId)?.toString() === form.specialtyId)
  );
  const specialtyOptions = specialties.filter(inTrack).map(s => ({ value: s._id, label: s.name }));
  const hospitalOptions = hospitals.filter(inTrack).map(h => ({ value: h._id, label: h.name }));
  const supervisorOptions = filteredSupervisors.map(s => ({ value: s._id, label: s.name }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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

            {/* Role */}
            <div className="admin-field">
              <label>User Type *</label>
              <select value={role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </div>

            {/* Training track (Advanced vs Basic portal) */}
            <div className="admin-field">
              <label>Training Track *</label>
              <select
                value={BASIC_CAPABLE.includes(role) ? form.track : 'advanced'}
                disabled={!BASIC_CAPABLE.includes(role)}
                onChange={e => set('track', e.target.value)}
                title={BASIC_CAPABLE.includes(role) ? 'Which portal this account belongs to' : 'This role exists only in the Advanced portal'}
              >
                <option value="advanced">Advanced</option>
                <option value="basic">Basic</option>
              </select>
            </div>

            {/* Name */}
            <div className="admin-field">
              <label>Full Name *</label>
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

            {/* Password — only when creating */}
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

            {/* Specialty */}
            {showField(role, 'specialtyId') && (
              <div className="admin-field">
                <label>Specialty</label>
                <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)} options={specialtyOptions} placeholder="Search specialty..." />
              </div>
            )}

            {/* Hospital */}
            {showField(role, 'hospitalId') && (
              <div className="admin-field">
                <label>Hospital</label>
                <SearchableSelect value={form.hospitalId} onChange={v => set('hospitalId', v)} options={hospitalOptions} placeholder="Search hospital..." />
              </div>
            )}

            {/* Supervisor (trainee only) */}
            {showField(role, 'supervisorId') && (
              <div className="admin-field">
                <label>Supervisor</label>
                <SearchableSelect value={form.supervisorId} onChange={v => set('supervisorId', v)} options={supervisorOptions} placeholder="Search supervisor..." />
                {form.specialtyId && filteredSupervisors.length === 0 && (
                  <span style={{ fontSize: 11, color: '#8B8FA8' }}>No supervisors for this specialty</span>
                )}
              </div>
            )}

            {/* Student ID */}
            {showField(role, 'studentId') && (
              <div className="admin-field">
                <label>Student ID</label>
                <input value={form.studentId} onChange={e => set('studentId', e.target.value)} placeholder="e.g. STD-001" />
              </div>
            )}

            {/* Year */}
            {showField(role, 'year') && (
              <div className="admin-field">
                <label>Year</label>
                <select value={form.year} onChange={e => set('year', e.target.value)}>
                  <option value="">— Select year —</option>
                  {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
            )}

            {/* Department */}
            {showField(role, 'department') && (
              <div className="admin-field">
                <label>Department</label>
                <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="Department name" />
              </div>
            )}

            {/* Phone */}
            {showField(role, 'phone') && (
              <div className="admin-field">
                <label>Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 xxx xxx xxxx" />
              </div>
            )}

            {/* Gender */}
            {showField(role, 'gender') && (
              <div className="admin-field">
                <label>Gender</label>
                <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            )}

            {/* City */}
            {showField(role, 'city') && (
              <div className="admin-field">
                <label>City</label>
                <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
              </div>
            )}

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
  const [pw,     setPw    ] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (pw.length < 6) return showToast('Password must be at least 6 characters', 'error');
    setSaving(true);
    try {
      await api.put(`/api/users/${userId}/password`, { newPassword: pw });
      showToast('Password updated');
      onClose();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update password', 'error');
    }
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
        <h3>Deactivate User</h3>
        <p>Deactivate <strong>{name}</strong>? The account will no longer be active.</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red"     onClick={onConfirm}>Deactivate</button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Reactivate ─────────────────────────────────────────────────────
function ConfirmReactivate({ name, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>Reactivate User</h3>
        <p>Restore access for <strong>{name}</strong>? The account will be active again.</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-purple"  onClick={onConfirm}>Reactivate</button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Permanent Delete (strong) ──────────────────────────────────────
function ConfirmPermanentDelete({ user, supervisors = [], onConfirm, onCancel }) {
  const [reassignTo, setReassignTo] = useState('');
  const isSupervisor = user?.role === 'supervisor';
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box" style={{ borderTop: '4px solid #B91C1C' }}>
        <h3 style={{ color: '#991B1B' }}>Permanently Delete User</h3>
        <p>
          This will <strong>permanently remove</strong> <strong>{user?.name}</strong> and cannot be undone.
        </p>
        {isSupervisor && (
          <div style={{ margin: '14px 0', textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Move this supervisor&apos;s trainees to:
            </label>
            <select
              value={reassignTo}
              onChange={e => setReassignTo(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
            >
              <option value="">— Don&apos;t move (delete their rotations) —</option>
              {supervisors.map(s => (
                <option key={s._id} value={s._id}>{s.name}{s.email ? ` — ${s.email}` : ''}</option>
              ))}
            </select>
          </div>
        )}
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button
            onClick={() => onConfirm(reassignTo || null)}
            style={{ background: '#B91C1C', color: '#fff', border: 'none', fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Users Page ────────────────────────────────────────────────────────
export default function Users() {
  const { user: me } = useAuth();

  const [roleFilter,  setRoleFilter ] = useState('all');
  const [trackFilter, setTrackFilter] = useState('all');
  const [users,       setUsers      ] = useState([]);
  const [hospitals,   setHospitals  ] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [view,        setView       ] = useState('table');
  const [search,      setSearch     ] = useState('');
  const [page,        setPage       ] = useState(1);
  const [rows,        setRows       ] = useState(16);
  const [toasts,      setToasts     ] = useState([]);
  const [showModal,   setShowModal  ] = useState(false);
  const [editUser,    setEditUser   ] = useState(null);
  const [saving,      setSaving     ] = useState(false);
  const [showPass,    setShowPass   ] = useState(false);
  const [passUserId,  setPassUserId ] = useState(null);
  const [deleteUser,  setDeleteUser ] = useState(null);
  const [reactUser,   setReactUser  ] = useState(null);
  const [purgeUser,   setPurgeUser  ] = useState(null);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/users'),
      api.get('/api/hospitals'),
      api.get('/api/users/supervisors'),
      api.get('/api/specialties'),
    ]).then(([u, h, sv, sp]) => {
      setUsers(u.data?.data || u.data || []);
      setHospitals(h.data?.data || h.data || []);
      setSupervisors(sv.data?.data || sv.data || []);
      setSpecialties(sp.data?.data || sp.data || []);
    }).catch(() => showToast('Failed to load users', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const displayed = users
    .filter(u => roleFilter === 'all' || baseRole(u.role) === roleFilter)
    // Track filter: basic → basic only; advanced → not-basic (incl. legacy); all → both.
    .filter(u => trackFilter === 'all' || (trackFilter === 'basic' ? u.track === 'basic' : u.track !== 'basic'))
    .filter(u => {
      const q = search.toLowerCase();
      return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.city?.toLowerCase().includes(q);
    });

  const totalPages   = Math.max(1, Math.ceil(displayed.length / rows));
  const currentItems = displayed.slice((page - 1) * rows, page * rows);

  async function handleSave(fd) {
    setSaving(true);
    try {
      if (editUser) {
        const res = await api.put(`/api/users/${editUser._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUsers(prev => prev.map(u => u._id === editUser._id ? (res.data?.data || res.data) : u));
        showToast('User updated');
      } else {
        const res = await api.post('/api/users', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUsers(prev => [(res.data?.data || res.data), ...prev]);
        showToast('User created');
      }
      setShowModal(false);
      setEditUser(null);
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
      setUsers(prev => prev.map(u => u._id === deleteUser._id ? { ...u, isActive: false, deletedAt: new Date() } : u));
      showToast('User deactivated');
    } catch (err) { showToast(err.response?.data?.message || 'Deactivate failed', 'error'); }
    finally  { setDeleteUser(null); }
  }

  async function confirmReactivate() {
    try {
      const res = await api.patch(`/api/admin/users/${reactUser._id}/reactivate`);
      const updated = res.data?.data || res.data;
      setUsers(prev => prev.map(u => u._id === reactUser._id ? { ...u, ...updated } : u));
      showToast('User reactivated');
    } catch (err) { showToast(err.response?.data?.message || 'Reactivate failed', 'error'); }
    finally  { setReactUser(null); }
  }

  async function confirmPermanentDelete(reassignTo) {
    try {
      await api.delete(`/api/admin/users/${purgeUser._id}/permanent`, reassignTo ? { data: { reassignTo } } : undefined);
      setUsers(prev => prev.filter(u => u._id !== purgeUser._id));
      showToast(reassignTo ? 'User deleted, trainees reassigned' : 'User permanently deleted');
    } catch (err) {
      const msg = err.response?.data?.message || 'Permanent delete failed';
      const blockers = err.response?.data?.blockers;
      const detail = blockers ? `${msg} (${Object.entries(blockers).map(([k, v]) => `${k}: ${v}`).join(', ')})` : msg;
      showToast(detail, 'error');
    }
    finally  { setPurgeUser(null); }
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
          <div className="admin-toolbar">
            <Sk h={36} r={8} style={{ flex: 1, minWidth: 180 }} />
            <Sk w={72} h={34} r={8} />
            <Sk w={90} h={34} r={8} />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>{['#', 'Name', 'Email', 'Photo', 'Role', 'Phone', 'Actions'].map(col => <th key={col}>{col}</th>)}</tr>
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
        <div className="admin-card">

          {/* Role filter tabs */}
          <div className="admin-tabs" style={{ flexWrap: 'wrap', gap: 4 }}>
            <button
              className={`admin-tab${roleFilter === 'all' ? ' active' : ''}`}
              onClick={() => { setRoleFilter('all'); setPage(1); }}
            >
              All ({users.length})
            </button>
            {ROLES.map(r => {
              const count = users.filter(u => baseRole(u.role) === r).length;
              if (count === 0) return null;
              return (
                <button
                  key={r}
                  className={`admin-tab${roleFilter === r ? ' active' : ''}`}
                  onClick={() => { setRoleFilter(r); setPage(1); }}
                >
                  {roleLabel(r)} ({count})
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="admin-toolbar">
            <input
              className="admin-search"
              placeholder="Search by name, email, city…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <button className="btn-purple" onClick={() => { setEditUser(null); setShowModal(true); }}>+ Add New User</button>
            <ViewToggle value={view} onChange={setView} listValue="table" />
            <select className="rows-select" value={trackFilter} onChange={e => { setTrackFilter(e.target.value); setPage(1); }} title="Filter by training track">
              <option value="all">All tracks</option>
              <option value="advanced">Advanced</option>
              <option value="basic">Basic</option>
            </select>
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
                    <th>#</th><th>Name</th><th>Email</th><th>Photo</th>
                    <th>Role</th><th>Track</th><th>Phone</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && (
                    <tr><td colSpan={9} className="admin-empty">No users found</td></tr>
                  )}
                  {currentItems.map((u, i) => {
                    const active = u.isActive !== false;
                    const isSelf = u._id === me?._id;
                    return (
                    <tr key={u._id} style={{ opacity: active ? 1 : 0.65 }}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td><strong>{u.name}</strong></td>
                      <td style={{ color: '#666' }}>{u.email}</td>
                      <td><PhotoCell u={u} /></td>
                      <td>
                        <span className={ROLE_BADGE[u.role] || 'badge-role'}>
                          {u.role ? roleLabel(u.role) : ''}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: u.track === 'basic' ? 'rgba(254,154,22,0.16)' : 'rgba(12,68,124,0.10)',
                          color:      u.track === 'basic' ? '#b45309' : '#0c447c' }}>
                          {u.track === 'basic' ? 'Basic' : 'Advanced'}
                        </span>
                      </td>
                      <td>{u.phone || '—'}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                          background: active ? '#D1FAE5' : '#FEE2E2',
                          color:      active ? '#065F46' : '#991B1B' }}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit"     title="Edit"            aria-label={`Edit ${u.name}`} onClick={() => { setEditUser(u); setShowModal(true); }}><IconEdit /></button>
                          <button className="btn-action password" title="Change password" aria-label={`Change password for ${u.name}`} onClick={() => { setPassUserId(u._id); setShowPass(true); }}><IconPassword /></button>
                          <button className="btn-action lock"     title={u.locked ? 'Unlock' : 'Lock'} aria-label={`${u.locked ? 'Unlock' : 'Lock'} ${u.name}`} onClick={() => handleLock(u)}>
                            {u.locked ? <IconUnlock /> : <IconLock />}
                          </button>
                          {!isSelf && active && (
                            <button className="btn-action delete" title="Deactivate" aria-label={`Deactivate ${u.name}`} onClick={() => setDeleteUser(u)}><IconBan /></button>
                          )}
                          {!isSelf && !active && (
                            <button className="btn-action reactivate" title="Reactivate" aria-label={`Reactivate ${u.name}`} onClick={() => setReactUser(u)}><IconUserCheck /></button>
                          )}
                          {!isSelf && (
                            <button
                              className="btn-action delete"
                              title={active ? 'Deactivate first' : 'Delete permanently'}
                              aria-label={`Permanently delete ${u.name}`}
                              disabled={active}
                              onClick={() => setPurgeUser(u)}
                              style={{ background: active ? undefined : '#B91C1C', color: active ? undefined : '#fff', opacity: active ? 0.4 : 1, cursor: active ? 'not-allowed' : 'pointer' }}
                            ><IconDelete /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
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
                const active = u.isActive !== false;
                const isSelf = u._id === me?._id;
                return (
                  <div className="user-card" key={u._id} style={{ opacity: active ? 1 : 0.65 }}>
                    {src
                      ? <img src={src} alt="" className="user-card-photo" />
                      : <div className="user-card-initials">{u.initials || u.name?.[0] || '?'}</div>
                    }
                    <div className="user-card-name">{u.name}</div>
                    <span className={ROLE_BADGE[u.role] || 'badge-role'}>{u.role ? roleLabel(u.role) : ''}</span>
                    <div className="user-card-sub">{u.city || '—'}</div>
                    <div style={{ margin: '4px 0' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                        background: active ? '#D1FAE5' : '#FEE2E2',
                        color:      active ? '#065F46' : '#991B1B' }}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="user-card-actions">
                      <button className="btn-action edit" title="Edit" aria-label={`Edit ${u.name}`} onClick={() => { setEditUser(u); setShowModal(true); }}><IconEdit /></button>
                      <button className="btn-action password" title="Change password" aria-label={`Change password for ${u.name}`} onClick={() => { setPassUserId(u._id); setShowPass(true); }}><IconPassword /></button>
                      <button className="btn-action lock" title={u.locked ? 'Unlock' : 'Lock'} aria-label={`${u.locked ? 'Unlock' : 'Lock'} ${u.name}`} onClick={() => handleLock(u)}>
                        {u.locked ? <IconUnlock /> : <IconLock />}
                      </button>
                      {!isSelf && active && (
                        <button className="btn-action delete" title="Deactivate" aria-label={`Deactivate ${u.name}`} onClick={() => setDeleteUser(u)}><IconBan /></button>
                      )}
                      {!isSelf && !active && (
                        <button className="btn-action reactivate" title="Reactivate" aria-label={`Reactivate ${u.name}`} onClick={() => setReactUser(u)}><IconUserCheck /></button>
                      )}
                      {!isSelf && (
                        <button
                          className="btn-action delete"
                          title={active ? 'Deactivate first' : 'Delete permanently'}
                          aria-label={`Permanently delete ${u.name}`}
                          disabled={active}
                          onClick={() => setPurgeUser(u)}
                          style={{ background: active ? undefined : '#B91C1C', color: active ? undefined : '#fff', opacity: active ? 0.4 : 1, cursor: active ? 'not-allowed' : 'pointer' }}
                        ><IconDelete /></button>
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
                .map(n => <button key={n} className={`pg-btn${n === page ? ' active-pg' : ''}`} onClick={() => setPage(n)}>{n}</button>)
              }
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>

        </div>
      </main>

      {showModal && (
        <UserModal
          editUser={editUser}
          hospitals={hospitals}
          supervisors={supervisors}
          specialties={specialties}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditUser(null); }}
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
      {reactUser && (
        <ConfirmReactivate
          name={reactUser.name}
          onConfirm={confirmReactivate}
          onCancel={() => setReactUser(null)}
        />
      )}
      {purgeUser && (
        <ConfirmPermanentDelete
          user={purgeUser}
          supervisors={users.filter(u => u.role === 'supervisor' && u.isActive !== false && u._id !== purgeUser._id)}
          onConfirm={confirmPermanentDelete}
          onCancel={() => setPurgeUser(null)}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}
