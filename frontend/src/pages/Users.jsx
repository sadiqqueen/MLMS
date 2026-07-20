// W2-Developer — Users (lists_views §DEVELOPER users). mt- restyle of the full
// user CRUD (create/edit any role, photo, password, lock/unlock, deactivate/
// reactivate, permanent-delete with structural blockers) PLUS the two NEW
// council-role create flows (RULINGS §12/§17/§39/§40, API_CONTRACTS §DEVELOPER):
//   • Add HOC              → POST /api/admin/hocs
//   • Add Central Secretary → POST /api/admin/central-secretaries  (Main/Precise)
// Both use the 20 Scientific Councils from GET /api/admin/councils as the "Main
// specialty" list. Creates apply directly (green toast); a soft-uniqueness
// `warning` from the server surfaces as a warn toast.
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MtModal from '../components/MtModal';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconPencil, IconDelete, IconPassword, IconLock, IconUnlock, IconBan, IconUserCheck } from '../components/icons';
import { baseRole, roleLabel } from '../config/roles';
import api from '../api/axios';
import { MagnifierIcon, initialsOf } from './devkit';
import './developer.css';

const ROLES = [
  'trainee', 'supervisor', 'program_director', 'sub_pd', 'secretary', 'data_entry',
  'central_secretary', 'hoc', 'dio', 'dio_view', 'sub_dio', 'president', 'asg1', 'asg2',
  'data_analyzer', 'assistant_secretary', 'secretary_general', 'super_admin',
];
const BASIC_CAPABLE = ['trainee', 'supervisor', 'program_director', 'secretary', 'dio', 'president'];
const effectiveRole = (baseR, track) => (track === 'basic' && BASIC_CAPABLE.includes(baseR) ? 'b_' + baseR : baseR);

const ROLE_FIELDS = {
  trainee: ['studentId', 'year', 'hospitalId', 'supervisorId', 'specialtyId', 'phone', 'gender', 'city'],
  supervisor: ['hospitalId', 'specialtyId', 'department', 'phone', 'gender', 'city'],
  program_director: ['hospitalId', 'department', 'phone'],
  sub_pd: ['phone'], secretary: ['specialtyId', 'phone'], data_entry: ['phone'],
  central_secretary: ['phone'], hoc: ['phone'], dio: ['phone'], dio_view: ['phone'], sub_dio: ['phone'],
  president: ['phone'], asg1: ['phone'], asg2: ['phone'], data_analyzer: ['phone'],
  assistant_secretary: ['phone'], secretary_general: ['phone'], super_admin: [],
};
const showField = (role, field) => (ROLE_FIELDS[role] || []).includes(field);
const BLOCKER_LABELS = { odios: 'ODIO accounts', subDios: 'Sub-DIO accounts', subPds: 'Sub-PD accounts' };
const ROWS_OPT = [8, 16, 32];
const photoSrc = (url) => (url ? `${url}` : null);
const councilLabel = (c) => `${c.name}${c.nameEn ? ` — ${c.nameEn}` : ''}`;

// ── generic Add / Edit user modal ────────────────────────────────────────────
function UserModal({ editUser, hospitals, supervisors, specialties, onSave, onClose, saving }) {
  const [form, setForm] = useState(editUser ? {
    name: editUser.name || '', email: editUser.email || '', password: '',
    role: baseRole(editUser.role || 'trainee'), track: (editUser.role || '').startsWith('b_') ? 'basic' : 'advanced',
    phone: editUser.phone || '', gender: editUser.gender || '', city: editUser.city || '',
    studentId: editUser.studentId || '', year: editUser.year || '',
    hospitalId: editUser.hospitalId?._id || editUser.hospitalId || editUser.hospital?._id || editUser.hospital || '',
    supervisorId: editUser.supervisorId?._id || editUser.supervisorId || '',
    specialtyId: editUser.specialtyId?._id || editUser.specialtyId || '', department: editUser.department || '',
  } : {
    name: '', email: '', password: '', role: 'trainee', track: 'advanced', phone: '', gender: '', city: '',
    studentId: '', year: '', hospitalId: '', supervisorId: '', specialtyId: '', department: '',
  });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(editUser?.photoUrl ? photoSrc(editUser.photoUrl) : null);
  const [errors, setErrors] = useState({});
  const fileRef = useRef();
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: false })); };

  function pickPhoto(e) { const file = e.target.files[0]; if (!file) return; setPhoto(file); setPreview(URL.createObjectURL(file)); }
  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.email.trim()) e.email = true;
    if (!editUser && form.password.length < 6) e.password = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  function handleSave() {
    if (!validate()) return;
    const fd = new FormData();
    const payload = { ...form, role: effectiveRole(form.role, form.track) };
    delete payload.track;
    Object.entries(payload).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v); });
    if (photo) fd.append('photo', photo);
    onSave(fd);
  }

  const role = form.role;
  const inTrack = (item) => (form.track === 'basic' ? item?.track === 'basic' : item?.track !== 'basic');
  const filteredSupervisors = supervisors.filter((s) => inTrack(s) && (!form.specialtyId || (s.specialtyId?._id || s.specialtyId)?.toString() === form.specialtyId));
  const specialtyOptions = specialties.filter(inTrack).map((s) => ({ value: s._id, label: s.name }));
  const hospitalOptions = hospitals.filter(inTrack).map((h) => ({ value: h._id, label: h.name }));
  const supervisorOptions = filteredSupervisors.map((s) => ({ value: s._id, label: s.name }));

  return (
    <MtModal open title={editUser ? 'Edit user' : 'Add user'} sub="System account" meta="Developer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editUser ? 'Save' : 'Create user'}</button>
      </>}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">Profile photo</label>
          <div className="dev-photo-wrap">
            {preview ? <img src={preview} alt="preview" className="dev-photo-preview" /> : <div className="dev-photo-placeholder">👤</div>}
            <button type="button" className="mt-btn--small-outline" onClick={() => fileRef.current.click()}>{preview ? 'Change photo' : 'Upload photo'}</button>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }} onChange={pickPhoto} />
          </div>
        </div>

        <div className="mt-field">
          <label className="mt-label">User type <span className="mt-label-req">*</span></label>
          <select className="mt-select" value={role} onChange={(e) => set('role', e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>
        <div className="mt-field">
          <label className="mt-label">Training track <span className="mt-label-req">*</span></label>
          <select className="mt-select" value={BASIC_CAPABLE.includes(role) ? form.track : 'advanced'} disabled={!BASIC_CAPABLE.includes(role)} onChange={(e) => set('track', e.target.value)}>
            <option value="advanced">Advanced</option><option value="basic">Basic</option>
          </select>
        </div>
        <div className="mt-field">
          <label className="mt-label">Full name <span className="mt-label-req">*</span></label>
          <input className={`mt-input${errors.name ? ' dev-invalid' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Email <span className="mt-label-req">*</span></label>
          <input className={`mt-input${errors.email ? ' dev-invalid' : ''}`} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@domain.com" />
        </div>
        {!editUser && (
          <div className="mt-field">
            <label className="mt-label">Password <span className="mt-label-req">*</span></label>
            <input className={`mt-input${errors.password ? ' dev-invalid' : ''}`} type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min. 6 characters" />
            {errors.password && <span className="dev-field-err">At least 6 characters required</span>}
          </div>
        )}
        {showField(role, 'specialtyId') && (
          <div className="mt-field"><label className="mt-label">Specialty</label>
            <SearchableSelect value={form.specialtyId} onChange={(v) => set('specialtyId', v)} options={specialtyOptions} placeholder="Search specialty…" /></div>
        )}
        {showField(role, 'hospitalId') && (
          <div className="mt-field"><label className="mt-label">Hospital</label>
            <SearchableSelect value={form.hospitalId} onChange={(v) => set('hospitalId', v)} options={hospitalOptions} placeholder="Search hospital…" /></div>
        )}
        {showField(role, 'supervisorId') && (
          <div className="mt-field"><label className="mt-label">Trainer</label>
            <SearchableSelect value={form.supervisorId} onChange={(v) => set('supervisorId', v)} options={supervisorOptions} placeholder="Search trainer…" />
            {form.specialtyId && filteredSupervisors.length === 0 && <span className="dev-field-err" style={{ color: 'var(--text-2)' }}>No trainers for this specialty</span>}
          </div>
        )}
        {showField(role, 'studentId') && (
          <div className="mt-field"><label className="mt-label">Student ID</label><input className="mt-input mt-input--mono" value={form.studentId} onChange={(e) => set('studentId', e.target.value)} placeholder="e.g. STD-001" /></div>
        )}
        {showField(role, 'year') && (
          <div className="mt-field"><label className="mt-label">Year</label>
            <select className="mt-select" value={form.year} onChange={(e) => set('year', e.target.value)}>
              <option value="">— Select year —</option>{[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select></div>
        )}
        {showField(role, 'department') && (
          <div className="mt-field"><label className="mt-label">Department</label><input className="mt-input" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Department name" /></div>
        )}
        {showField(role, 'phone') && (
          <div className="mt-field"><label className="mt-label">Phone</label><input className="mt-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+249 …" /></div>
        )}
        {showField(role, 'gender') && (
          <div className="mt-field"><label className="mt-label">Gender</label>
            <select className="mt-select" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">— Select —</option><option value="male">Male</option><option value="female">Female</option>
            </select></div>
        )}
        {showField(role, 'city') && (
          <div className="mt-field"><label className="mt-label">City</label><input className="mt-input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" /></div>
        )}
      </div>
    </MtModal>
  );
}

// ── Add HOC (Head of Council) ────────────────────────────────────────────────
function HocModal({ councils, onCreate, onClose, saving }) {
  const [f, setF] = useState({ name: '', idNumber: '', phone: '', email: '', password: '', councilId: '' });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: false })); };
  function submit() {
    const e = {};
    if (!f.name.trim()) e.name = true;
    if (!f.idNumber.trim()) e.idNumber = true;
    if (f.password.length < 6) e.password = true;
    if (!f.councilId) e.councilId = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onCreate(f);
  }
  return (
    <MtModal open title="Add HOC" sub="Head of Council — one per council" meta="Developer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create HOC'}</button>
      </>}>
      <div className="mt-banner">This record will be added to the registry.</div>
      <div className="mt-field-grid">
        <div className="mt-field"><label className="mt-label">Name <span className="mt-label-req">*</span></label><input className={`mt-input${errors.name ? ' dev-invalid' : ''}`} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Prof. Full Name" /></div>
        <div className="mt-field"><label className="mt-label">ID <span className="mt-label-req">*</span></label><input className={`mt-input mt-input--mono${errors.idNumber ? ' dev-invalid' : ''}`} value={f.idNumber} onChange={(e) => set('idNumber', e.target.value)} placeholder="HOC-…" /></div>
        <div className="mt-field"><label className="mt-label">Phone</label><input className="mt-input" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+249 …" /></div>
        <div className="mt-field"><label className="mt-label">Email</label><input className="mt-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@mtms.med" /></div>
        <div className="mt-field"><label className="mt-label">Password <span className="mt-label-req">*</span></label><input className={`mt-input${errors.password ? ' dev-invalid' : ''}`} type="password" value={f.password} onChange={(e) => set('password', e.target.value)} placeholder="Min. 6 characters" />{errors.password && <span className="dev-field-err">At least 6 characters required</span>}</div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Main specialty <span className="mt-label-req">*</span></label>
          <select className={`mt-select${errors.councilId ? ' dev-invalid' : ''}`} value={f.councilId} onChange={(e) => set('councilId', e.target.value)}>
            <option value="">— Select council —</option>
            {councils.map((c) => <option key={c._id} value={c._id}>{councilLabel(c)}</option>)}
          </select>
          <span className="dev-field-err" style={{ color: 'var(--text-2)' }}>One HOC per council (a warning shows if it already has one).</span>
        </div>
      </div>
    </MtModal>
  );
}

// ── Add Central Secretary (Main / Precise) ───────────────────────────────────
function CentralSecretaryModal({ councils, onCreate, onClose, saving }) {
  const [f, setF] = useState({ name: '', idNumber: '', phone: '', email: '', password: '', secretaryType: 'main', councilId: '' });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: false })); };
  const isMain = f.secretaryType === 'main';
  function submit() {
    const e = {};
    if (!f.name.trim()) e.name = true;
    if (!f.idNumber.trim()) e.idNumber = true;
    if (f.password.length < 6) e.password = true;
    if (isMain && !f.councilId) e.councilId = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onCreate({ ...f, councilId: isMain ? f.councilId : '' });
  }
  return (
    <MtModal open title="Add Central Secretary" sub="Main or precise specialty secretary" meta="Developer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create secretary'}</button>
      </>}>
      <div className="mt-banner">This record will be added to the registry.</div>
      <div className="mt-field-grid">
        <div className="mt-field"><label className="mt-label">Name <span className="mt-label-req">*</span></label><input className={`mt-input${errors.name ? ' dev-invalid' : ''}`} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Full Name" /></div>
        <div className="mt-field"><label className="mt-label">ID <span className="mt-label-req">*</span></label><input className={`mt-input mt-input--mono${errors.idNumber ? ' dev-invalid' : ''}`} value={f.idNumber} onChange={(e) => set('idNumber', e.target.value)} placeholder="CS-…" /></div>
        <div className="mt-field"><label className="mt-label">Phone</label><input className="mt-input" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+249 …" /></div>
        <div className="mt-field"><label className="mt-label">Email</label><input className="mt-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@mtms.med" /></div>
        <div className="mt-field"><label className="mt-label">Password <span className="mt-label-req">*</span></label><input className={`mt-input${errors.password ? ' dev-invalid' : ''}`} type="password" value={f.password} onChange={(e) => set('password', e.target.value)} placeholder="Min. 6 characters" />{errors.password && <span className="dev-field-err">At least 6 characters required</span>}</div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Specialty type</label>
          <div className="mt-radio-group">
            <label className="mt-check-label"><input type="radio" className="mt-check" name="secretaryType" checked={isMain} onChange={() => set('secretaryType', 'main')} /> Main</label>
            <label className="mt-check-label"><input type="radio" className="mt-check" name="secretaryType" checked={!isMain} onChange={() => set('secretaryType', 'precise')} /> Precise</label>
          </div>
        </div>
        {isMain && (
          <div className="mt-field mt-field-full">
            <label className="mt-label">Main specialty <span className="mt-label-req">*</span></label>
            <select className={`mt-select${errors.councilId ? ' dev-invalid' : ''}`} value={f.councilId} onChange={(e) => set('councilId', e.target.value)}>
              <option value="">— Select council —</option>
              {councils.map((c) => <option key={c._id} value={c._id}>{councilLabel(c)}</option>)}
            </select>
            <span className="dev-field-err" style={{ color: 'var(--text-2)' }}>Required when the type is Main.</span>
          </div>
        )}
        {!isMain && <div className="mt-field mt-field-full"><span className="dev-field-err" style={{ color: 'var(--text-2)' }}>A precise secretary covers every precise specialty — no council needed.</span></div>}
      </div>
    </MtModal>
  );
}

function PasswordModal({ userId, onClose, showToast }) {
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  async function handleSave() {
    if (pw.length < 6) return showToast('Password must be at least 6 characters', 'dng');
    setSaving(true);
    try { await api.put(`/api/users/${userId}/password`, { newPassword: pw }); showToast('Password updated', 'ok'); onClose(); }
    catch (err) { showToast(err?.response?.data?.message || 'Failed to update password', 'dng'); } finally { setSaving(false); }
  }
  return (
    <MtModal open title="Change password" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="mt-field mt-field-full">
        <label className="mt-label">New password (min 6 chars)</label>
        <input className="mt-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
      </div>
    </MtModal>
  );
}

function ConfirmSimple({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <MtModal open title={title} onClose={onCancel}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className={danger ? 'mt-btn--danger-solid' : 'mt-btn'} onClick={onConfirm}>{confirmLabel}</button>
      </>}>
      <p className="dev-confirm-text">{body}</p>
    </MtModal>
  );
}

function ConfirmPermanentDelete({ user, supervisors = [], onConfirm, onCancel }) {
  const [reassignTo, setReassignTo] = useState('');
  const isSupervisor = user?.role === 'supervisor';
  return (
    <MtModal open title="Permanently delete user" onClose={onCancel}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="mt-btn--danger-solid" onClick={() => onConfirm(reassignTo || null)}>Delete permanently</button>
      </>}>
      <p className="dev-confirm-text">This will <strong>permanently remove</strong> <strong>{user?.name}</strong> and cannot be undone.</p>
      {isSupervisor && (
        <div className="mt-field mt-field-full" style={{ marginBlockStart: 12 }}>
          <label className="mt-label">Move this trainer&apos;s trainees to:</label>
          <select className="mt-select" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
            <option value="">— Don&apos;t move (delete their rotations) —</option>
            {supervisors.map((s) => <option key={s._id} value={s._id}>{s.name}{s.email ? ` — ${s.email}` : ''}</option>)}
          </select>
        </div>
      )}
    </MtModal>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function Users() {
  const { user: me } = useAuth();
  const { toasts, showToast } = useMtToast();

  const [roleFilter, setRoleFilter] = useState('all');
  const [trackFilter, setTrackFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [users, setUsers] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [councils, setCouncils] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(16);
  const [modal, setModal] = useState(null); // 'user' | 'hoc' | 'cs'
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [passUserId, setPassUserId] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [reactUser, setReactUser] = useState(null);
  const [purgeUser, setPurgeUser] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/users'),
      api.get('/api/hospitals'),
      api.get('/api/users/supervisors'),
      api.get('/api/specialties'),
      api.get('/api/admin/councils').catch(() => ({ data: { data: [] } })),
    ]).then(([u, h, sv, sp, co]) => {
      setUsers(u.data?.data || u.data || []);
      setHospitals(h.data?.data || h.data || []);
      setSupervisors(sv.data?.data || sv.data || []);
      setSpecialties(sp.data?.data || sp.data || []);
      setCouncils(co.data?.data || co.data || []);
    }).catch(() => showToast('Failed to load users', 'dng')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayed = users
    .filter((u) => roleFilter === 'all' || baseRole(u.role) === roleFilter)
    .filter((u) => trackFilter === 'all' || (trackFilter === 'basic' ? u.track === 'basic' : u.track !== 'basic'))
    .filter((u) => statusFilter === 'all' || (statusFilter === 'active' ? u.isActive !== false : u.isActive === false))
    .filter((u) => { const q = search.toLowerCase(); return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.city?.toLowerCase().includes(q) || u.idNumber?.toLowerCase().includes(q); });
  const currentItems = displayed.slice((page - 1) * rows, page * rows);
  const presentRoles = ROLES.filter((r) => users.some((u) => baseRole(u.role) === r));

  async function handleSaveUser(fd) {
    setSaving(true);
    try {
      if (editUser) {
        const res = await api.put(`/api/users/${editUser._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUsers((prev) => prev.map((u) => (u._id === editUser._id ? (res.data?.data || res.data) : u)));
        showToast('User updated', 'ok');
      } else {
        const res = await api.post('/api/users', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUsers((prev) => [(res.data?.data || res.data), ...prev]);
        showToast('User created', 'ok');
      }
      setModal(null); setEditUser(null);
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'dng'); } finally { setSaving(false); }
  }

  async function handleCreateHoc(f) {
    setSaving(true);
    try {
      const res = await api.post('/api/admin/hocs', { name: f.name, idNumber: f.idNumber, phone: f.phone, email: f.email, password: f.password, councilId: f.councilId });
      const created = res.data?.data || res.data;
      setUsers((prev) => [created, ...prev]);
      showToast('HOC created', 'ok');
      if (res.data?.warning) showToast(res.data.warning, 'warn');
      setModal(null);
    } catch (err) { showToast(err.response?.data?.message || 'Could not create HOC', 'dng'); } finally { setSaving(false); }
  }

  async function handleCreateCs(f) {
    setSaving(true);
    try {
      const body = { name: f.name, idNumber: f.idNumber, phone: f.phone, email: f.email, password: f.password, secretaryType: f.secretaryType };
      if (f.secretaryType === 'main') body.councilId = f.councilId;
      const res = await api.post('/api/admin/central-secretaries', body);
      const created = res.data?.data || res.data;
      setUsers((prev) => [created, ...prev]);
      showToast('Central secretary created', 'ok');
      if (res.data?.warning) showToast(res.data.warning, 'warn');
      setModal(null);
    } catch (err) { showToast(err.response?.data?.message || 'Could not create secretary', 'dng'); } finally { setSaving(false); }
  }

  async function handleLock(u) {
    try {
      const res = await api.put(`/api/users/${u._id}/lock`);
      setUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, locked: res.data.locked } : x)));
      showToast(res.data.locked ? 'User locked' : 'User unlocked', 'ok');
    } catch { showToast('Failed', 'dng'); }
  }
  async function confirmDelete() {
    try {
      await api.delete(`/api/users/${deleteUser._id}`);
      setUsers((prev) => prev.map((u) => (u._id === deleteUser._id ? { ...u, isActive: false, deletedAt: new Date() } : u)));
      showToast('User deactivated', 'ok');
    } catch (err) { showToast(err.response?.data?.message || 'Deactivate failed', 'dng'); } finally { setDeleteUser(null); }
  }
  async function confirmReactivate() {
    try {
      const res = await api.patch(`/api/admin/users/${reactUser._id}/reactivate`);
      const updated = res.data?.data || res.data;
      setUsers((prev) => prev.map((u) => (u._id === reactUser._id ? { ...u, ...updated } : u)));
      showToast('User reactivated', 'ok');
    } catch (err) { showToast(err.response?.data?.message || 'Reactivate failed', 'dng'); } finally { setReactUser(null); }
  }
  async function confirmPermanentDelete(reassignTo) {
    try {
      await api.delete(`/api/admin/users/${purgeUser._id}/permanent`, reassignTo ? { data: { reassignTo } } : undefined);
      setUsers((prev) => prev.filter((u) => u._id !== purgeUser._id));
      showToast(reassignTo ? 'User deleted, trainees reassigned' : 'User permanently deleted', 'ok');
    } catch (err) {
      const msg = err.response?.data?.message || 'Permanent delete failed';
      const blockers = err.response?.data?.blockers;
      const parts = blockers ? Object.entries(blockers).filter(([, v]) => v > 0).map(([k, v]) => `${BLOCKER_LABELS[k] || k}: ${v}`) : [];
      showToast(parts.length ? `${msg} (${parts.join(', ')})` : msg, 'dng');
    } finally { setPurgeUser(null); }
  }

  const statusPill = (active) => active
    ? <span className="mt-pill mt-pill--active">Active</span>
    : <span className="mt-pill mt-pill--rejected">Inactive</span>;

  const renderActions = (u) => {
    const active = u.isActive !== false;
    const isSelf = u._id === me?._id;
    return (
      <div className="mt-row-actions">
        <button className="mt-icon-action" title="Edit" aria-label={`Edit ${u.name}`} onClick={() => { setEditUser(u); setModal('user'); }}><IconPencil size={15} /></button>
        <button className="mt-icon-action" title="Change password" aria-label={`Change password for ${u.name}`} onClick={() => setPassUserId(u._id)}><IconPassword size={15} /></button>
        <button className="mt-icon-action" title={u.locked ? 'Unlock' : 'Lock'} aria-label={`${u.locked ? 'Unlock' : 'Lock'} ${u.name}`} onClick={() => handleLock(u)}>{u.locked ? <IconUnlock size={15} /> : <IconLock size={15} />}</button>
        {!isSelf && active && <button className="mt-icon-action dev-act-danger" title="Deactivate" aria-label={`Deactivate ${u.name}`} onClick={() => setDeleteUser(u)}><IconBan size={15} /></button>}
        {!isSelf && !active && <button className="mt-icon-action" title="Reactivate" aria-label={`Reactivate ${u.name}`} onClick={() => setReactUser(u)}><IconUserCheck size={15} /></button>}
        {!isSelf && <button className={`mt-icon-action dev-act${active ? '' : ' dev-act-danger-solid'}`} title={active ? 'Deactivate first' : 'Delete permanently'} aria-label={`Permanently delete ${u.name}`} disabled={active} onClick={() => setPurgeUser(u)}><IconDelete size={15} /></button>}
      </div>
    );
  };

  return (
    <>
      <Navbar title="Users" subtitle="Developer" />
      <main className="mt-content">
        <div className="mt-filterbar">
          <div className="mt-search">
            <MagnifierIcon />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, ID…" aria-label="Search users" />
          </div>
          <select className="mt-filter" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} aria-label="Role filter">
            <option value="all">Role: All</option>
            {presentRoles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          <select className="mt-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Status filter">
            <option value="all">Status: All</option><option value="active">Active</option><option value="inactive">Deactivated</option>
          </select>
          <select className="mt-filter" value={trackFilter} onChange={(e) => { setTrackFilter(e.target.value); setPage(1); }} aria-label="Track filter">
            <option value="all">Track: All</option><option value="advanced">Advanced</option><option value="basic">Basic</option>
          </select>
          <span className="mt-filterbar-spacer" />
          <button className="mt-btn" onClick={() => { setEditUser(null); setModal('user'); }}>+ Add user</button>
          <button className="mt-btn--small-outline" onClick={() => setModal('hoc')}>+ Add HOC</button>
          <button className="mt-btn--small-outline" onClick={() => setModal('cs')}>+ Add Central Secretary</button>
          <ViewToggle value={view} onChange={setView} listValue="table" />
          <select className="mt-filter" value={rows} onChange={(e) => { setRows(+e.target.value); setPage(1); }} aria-label="Rows per page">
            {ROWS_OPT.map((r) => <option key={r} value={r}>{r} / page</option>)}
          </select>
          <span className="mt-count">{displayed.length} users</span>
        </div>

        {loading ? <div className="skeleton mt-skel" style={{ height: 360 }} /> : view === 'table' ? (
          <RevealOnScroll>
            <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead><tr>
                    <th className="mt-th">User</th><th className="mt-th">ID</th><th className="mt-th">Role</th>
                    <th className="mt-th">Email</th><th className="mt-th">Track</th><th className="mt-th">Status</th><th className="mt-th" />
                  </tr></thead>
                  <tbody>
                    {currentItems.length === 0 && (
                      <tr><td className="mt-td mt-td--muted" colSpan={7} style={{ textAlign: 'center', padding: 40 }}>No users found.</td></tr>
                    )}
                    {currentItems.map((u) => {
                      const active = u.isActive !== false;
                      const src = photoSrc(u.photoUrl);
                      return (
                        <tr key={u._id} style={{ opacity: active ? 1 : 0.6 }}>
                          <td className="mt-td">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              {src ? <img src={src} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                                : <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{u.initials || initialsOf(u.name)}</span>}
                              <span className="mt-td--name">{u.name}</span>
                            </div>
                          </td>
                          <td className="mt-td mt-td--mono">{u.idNumber || u.studentId || '—'}</td>
                          <td className="mt-td"><span className="mt-pill mt-pill--role">{roleLabel(u.role)}</span></td>
                          <td className="mt-td mt-td--muted">{u.email || '—'}</td>
                          <td className="mt-td"><span className="mt-pill mt-pill--neutral">{u.track === 'basic' ? 'Basic' : 'Advanced'}</span></td>
                          <td className="mt-td">{statusPill(active)}</td>
                          <td className="mt-td mt-td--actions">{renderActions(u)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </RevealOnScroll>
        ) : (
          <div className="mt-acct-grid">
            {currentItems.length === 0 && <div className="mt-empty"><div className="mt-empty-title">No users found.</div></div>}
            {currentItems.map((u) => {
              const active = u.isActive !== false;
              const src = photoSrc(u.photoUrl);
              return (
                <div className="dev-card" key={u._id} style={{ opacity: active ? 1 : 0.6 }}>
                  {src ? <img src={src} alt="" className="dev-card-avatar" /> : <div className="dev-card-avatar">{u.initials || initialsOf(u.name)}</div>}
                  <div className="dev-card-name">{u.name}</div>
                  <span className="mt-pill mt-pill--role">{roleLabel(u.role)}</span>
                  <div className="dev-card-sub">{u.city || u.email || '—'}</div>
                  {statusPill(active)}
                  <div className="dev-card-actions">{renderActions(u)}</div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && displayed.length > rows && (
          <Pagination page={page} pageSize={rows} total={displayed.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
        )}

        {modal === 'user' && (
          <UserModal editUser={editUser} hospitals={hospitals} supervisors={supervisors} specialties={specialties}
            onSave={handleSaveUser} onClose={() => { setModal(null); setEditUser(null); }} saving={saving} />
        )}
        {modal === 'hoc' && <HocModal councils={councils} onCreate={handleCreateHoc} onClose={() => setModal(null)} saving={saving} />}
        {modal === 'cs' && <CentralSecretaryModal councils={councils} onCreate={handleCreateCs} onClose={() => setModal(null)} saving={saving} />}
        {passUserId && <PasswordModal userId={passUserId} onClose={() => setPassUserId(null)} showToast={showToast} />}
        {deleteUser && <ConfirmSimple title="Deactivate user" danger confirmLabel="Deactivate" onConfirm={confirmDelete} onCancel={() => setDeleteUser(null)}
          body={<>Deactivate <strong>{deleteUser.name}</strong>? The account will no longer be active.</>} />}
        {reactUser && <ConfirmSimple title="Reactivate user" confirmLabel="Reactivate" onConfirm={confirmReactivate} onCancel={() => setReactUser(null)}
          body={<>Restore access for <strong>{reactUser.name}</strong>? The account will be active again.</>} />}
        {purgeUser && <ConfirmPermanentDelete user={purgeUser}
          supervisors={users.filter((u) => u.role === 'supervisor' && u.isActive !== false && u._id !== purgeUser._id)}
          onConfirm={confirmPermanentDelete} onCancel={() => setPurgeUser(null)} />}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
