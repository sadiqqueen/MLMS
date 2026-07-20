// frontend/src/pages/DioUsers.jsx
//
// Unified DIO "Users" page — merges the former Trainees, Supervisors,
// Program Directors and Secretaries pages into one. Lists every managed user
// from the four DIO list endpoints, with filtering by name, hospital,
// specialty and role. Add/Edit uses one role-config-driven modal that mirrors
// the field rules the backend enforces per role; View is a read-only modal
// built entirely from data the list endpoints already return (the DIO is
// authorized for those), so no per-record fetch and no "Access Denied".
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useBasePath from '../hooks/useBasePath';
import Navbar from '../components/Navbar';
import { useMtToast, MtToastHost } from '../components/MtToast';
import MtModal from '../components/MtModal';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconEye, IconPencil, IconBan } from '../components/icons';
import { roleLabel } from '../config/roles';
import './dio.css';

const API_BASE = '';

// ── Role config: list endpoint per role (labels come from the central roleLabel
// helper; the badge is the shared accent-tint mt- role pill for every role) ──
const ROLE_META = {
  trainee:          { api: 'trainees' },
  supervisor:       { api: 'supervisors' },
  program_director: { api: 'program-directors' },
  secretary:        { api: 'secretaries' },
  president:        { api: 'presidents' },
};
// Display/filter order (president is read-only — see CREATABLE_ROLES).
const ROLE_ORDER = ['trainee', 'supervisor', 'program_director', 'secretary', 'president'];
// Roles the DIO can add/edit/deactivate (president is view-only).
const CREATABLE_ROLES = ['trainee', 'supervisor', 'program_director', 'secretary'];

// ── Helpers ───────────────────────────────────────────────────────────────
function textValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || fallback;
  return fallback;
}
function specialtyName(u) { return textValue(u?.specialtyId || u?.specialty); }
function hospitalName(u)  { return u?.hospitalId?.name || u?.hospital?.name || '—'; }
function hospitalIdOf(u)  { const h = u?.hospitalId || u?.hospital; return (h?._id || h || '').toString(); }
function specialtyIdOf(u) { const s = u?.specialtyId; return (s?._id || s || '').toString(); }
function initialsOf(u)    { return u.initials || u.name?.trim()?.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }
function AvatarCell({ u, size = 34 }) {
  return u.photoUrl
    ? <img src={`${API_BASE}${u.photoUrl}`} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
    : <span className="mt-acct-avatar" style={{ width: size, height: size, fontSize: size < 30 ? 12 : 13 }}>{initialsOf(u)}</span>;
}

// Field schema per role — matches the validation the backend enforces.
function roleFields(role) {
  const name        = { key: 'name',        label: 'Full Name *',              type: 'text',      required: true, placeholder: 'Dr. Jane Smith' };
  const email       = { key: 'email',       label: 'Email *',                  type: 'email',     required: true, createOnly: true };
  const password    = { key: 'password',    label: 'Password * (min 6 chars)', type: 'password',  required: true, createOnly: true, placeholder: '••••••••' };
  const phoneReq    = { key: 'phone',       label: 'Phone *',                  type: 'text',      required: true, placeholder: '+964 …' };
  const phoneOpt    = { key: 'phone',       label: 'Phone',                    type: 'text',      placeholder: '+964 …' };
  const department  = { key: 'department',  label: 'Department',               type: 'text' };
  const hospital    = { key: 'hospitalId',  label: 'Hospital *',               type: 'hospital',  required: true };
  const specReq     = { key: 'specialtyId', label: 'Specialty *',              type: 'specialty', required: true };
  const specOpt     = { key: 'specialtyId', label: 'Assigned Specialty (optional)', type: 'specialty' };
  const studentId   = { key: 'studentId',   label: 'Student ID *',             type: 'text',      required: true, placeholder: 'STD-001' };
  const year        = { key: 'year',        label: 'Year',                     type: 'year' };
  const supervisor  = { key: 'supervisorId',         label: 'Supervisor *',          type: 'supervisor', required: true };
  const researchSup = { key: 'researchSupervisorId', label: 'Research Supervisor',   type: 'supervisor' };

  switch (role) {
    case 'trainee':          return [name, email, password, phoneOpt, studentId, year, hospital, specReq, supervisor, researchSup];
    case 'supervisor':       return [name, email, password, phoneReq, department, hospital, specReq];
    case 'program_director': return [name, email, password, phoneReq, department, hospital];
    case 'secretary':        return [name, email, password, phoneReq, hospital, specOpt];
    default:                 return [name, email, password];
  }
}

// ── Confirm modal (deactivate) ────────────────────────────────────────────
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

// ── Add / Edit modal (role-config-driven) ─────────────────────────────────
function UserFormModal({ user, initialRole, hospitals, specialties, supervisors, onClose, onSaved }) {
  const isEdit = !!user;
  const [role, setRole] = useState(user?.role || initialRole || 'trainee');
  const [form, setForm] = useState(() => ({
    name:        user?.name        || '',
    email:       user?.email       || '',
    password:    '',
    phone:       user?.phone       || '',
    department:  user?.department  || '',
    studentId:   user?.studentId   || '',
    year:        user?.year        || '',
    hospitalId:  user?.hospitalId?._id || user?.hospital?._id || user?.hospitalId || '',
    specialtyId: user?.specialtyId?._id || user?.specialtyId || '',
    supervisorId:         user?.supervisorId?._id         || user?.supervisorId         || '',
    researchSupervisorId: user?.researchSupervisorId?._id || user?.researchSupervisorId || '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const fields = roleFields(role);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setApiErr(''); }

  function validate() {
    const e = {};
    fields.forEach(f => {
      if (f.createOnly && isEdit) return;
      const v = form[f.key];
      if (f.required && (v === undefined || v === null || String(v).trim() === '')) e[f.key] = true;
    });
    if (!isEdit && form.password && form.password.length < 6) e.password = true;
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {};
      fields.forEach(f => {
        if (f.createOnly && isEdit) return;
        let v = form[f.key];
        // Send null (not undefined) for cleared optional fields so the value is
        // present in the JSON body and the backend unsets it instead of keeping
        // the previous value.
        if (f.type === 'year')       v = v ? Number(v) : null;
        if (f.key === 'specialtyId' && !f.required && !v) v = null;
        // Cleared optional reference fields → null so Mongoose unsets rather than
        // trying to cast '' to an ObjectId.
        if (f.type === 'supervisor' && !f.required && !v) v = null;
        if (f.key === 'name')        v = String(v || '').trim();
        if (f.key === 'studentId')   v = v ? String(v).trim() : v;
        if (f.key === 'email')       v = v ? String(v).trim() : v;
        payload[f.key] = v;
      });
      const apiName = ROLE_META[role].api;
      const res = isEdit
        ? await api.patch(`/api/dio/${apiName}/${user._id}`, payload)
        : await api.post(`/api/dio/${apiName}`, payload);
      onSaved(res.data?.data || res.data, isEdit, role);
      onClose();
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  const hospitalOptions  = hospitals.map(h => ({ value: h._id, label: `${h.name}${h.city ? ` (${h.city})` : ''}` }));
  const specialtyOptions = specialties.map(s => ({ value: s._id, label: s.name }));

  // Supervisor options, narrowed to the chosen hospital/specialty when possible.
  // Falls back to the full list if the filter would be empty, so the field is
  // never a dead end.
  const allSupervisors = (supervisors || []);
  const filteredSupervisors = allSupervisors.filter(s => {
    if (form.hospitalId && hospitalIdOf(s) && hospitalIdOf(s) !== form.hospitalId) return false;
    if (form.specialtyId && specialtyIdOf(s) && specialtyIdOf(s) !== form.specialtyId) return false;
    return true;
  });
  const supervisorPool = filteredSupervisors.length ? filteredSupervisors : allSupervisors;
  const supervisorOptions = supervisorPool.map(s => ({
    value: s._id,
    label: `${s.name}${hospitalName(s) !== '—' ? ` · ${hospitalName(s)}` : ''}`,
  }));

  function renderField(f) {
    if (f.createOnly && isEdit) return null;
    let control;
    if (f.type === 'hospital') {
      control = <SearchableSelect value={form.hospitalId} onChange={v => set('hospitalId', v)} options={hospitalOptions} placeholder="Search hospital…" error={errors.hospitalId} />;
    } else if (f.type === 'specialty') {
      control = <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)} options={specialtyOptions} placeholder="Search specialty…" error={errors.specialtyId} />;
    } else if (f.type === 'supervisor') {
      control = <SearchableSelect value={form[f.key]} onChange={v => set(f.key, v)} options={supervisorOptions} placeholder="Search supervisor…" error={errors[f.key]} />;
    } else if (f.type === 'year') {
      control = (
        <select className="mt-select" value={form.year} onChange={e => set('year', e.target.value)}>
          <option value="">— select —</option>
          {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
      );
    } else {
      control = <input className="mt-input" style={{ borderColor: errors[f.key] ? 'var(--danger)' : undefined }}
        type={f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : 'text'}
        value={form[f.key]} placeholder={f.placeholder || ''}
        autoComplete={f.type === 'password' ? 'new-password' : 'off'}
        onChange={e => set(f.key, e.target.value)} />;
    }
    return (
      <div className="mt-field" key={f.key}>
        <label className="mt-label">{f.label}</label>
        {control}
      </div>
    );
  }

  return (
    <MtModal open title={isEdit ? `Edit ${roleLabel(role)}` : `Add ${roleLabel(role)}`} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : `Create ${roleLabel(role)}`}
          </button>
        </>
      )}>
      {!isEdit && (
        <div className="mt-field" style={{ marginBlockEnd: 14 }}>
          <label className="mt-label">User Type <span className="mt-label-req">*</span></label>
          <select className="mt-select" value={role} onChange={e => setRole(e.target.value)}>
            {CREATABLE_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>
      )}
      <div className="mt-field-grid">
        {fields.map(renderField)}
      </div>
      {apiErr && (
        <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)', marginBlock: '14px 0' }}>
          {apiErr}
        </div>
      )}
    </MtModal>
  );
}

// ── Read-only View modal (built from list data — no backend fetch) ─────────
function UserViewModal({ user, trainees, onTraineeClick, onBack, onClose, onFullProfile }) {
  const active = user.isActive !== false;
  const rows = [
    ['Email', user.email],
    ['Phone', user.phone],
    ['Hospital', hospitalName(user)],
    ['Specialty', specialtyName(user)],
    ['Department', user.department],
    user.role === 'trainee' ? ['Student ID', user.studentId] : null,
    user.role === 'trainee' ? ['Year', user.year ? `Year ${user.year}` : '—'] : null,
    user.role === 'trainee' ? ['Supervisor', user.supervisorId?.name || user.supervisor?.name] : null,
    user.role === 'trainee' ? ['Research Supervisor', user.researchSupervisorId?.name] : null,
    ['Status', active ? 'Active' : 'Inactive'],
  ].filter(Boolean);

  const titleNode = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <AvatarCell u={user} size={40} />
      <span>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{user.name}</span>
        <span className="mt-pill mt-pill--role" style={{ marginBlockStart: 3 }}>{roleLabel(user.role)}</span>
      </span>
    </span>
  );

  return (
    <MtModal open title={titleNode} onClose={onBack || onClose}
      footer={(
        <>
          {onBack && <button className="mt-btn--cancel" onClick={onBack}>← Back to supervisor</button>}
          {user.role === 'trainee' && <button className="mt-btn--outline" onClick={onFullProfile}>Open full profile →</button>}
          <button className="mt-btn" onClick={onClose}>Close</button>
        </>
      )}>
      <div className="dio-kv-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="mt-acct-k">{label}</div>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{textValue(value)}</div>
          </div>
        ))}
      </div>

      {/* Supervisor → assigned trainees (click one to view their card in this panel) */}
      {user.role === 'supervisor' && (
        <div style={{ marginBlockStart: 20 }}>
          <div className="mt-acct-k" style={{ marginBlockEnd: 8 }}>
            Assigned Trainees{Array.isArray(trainees) ? ` (${trainees.length})` : ''}
          </div>
          {trainees === null ? (
            <div className="mt-card-sub">Could not load assigned trainees.</div>
          ) : trainees.length === 0 ? (
            <div className="mt-card-sub">No trainees assigned.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {trainees.map(t => (
                <button type="button" key={t._id}
                  onClick={() => onTraineeClick(t)}
                  aria-label={`View ${t.name}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'start',
                    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '7px 10px', cursor: 'pointer' }}>
                  <AvatarCell u={t} size={28} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                    <div className="mt-acct-id">{t.studentId || t.specialty || ''}</div>
                  </div>
                  <span style={{ fontSize: 16, color: 'var(--text-2)', flexShrink: 0 }}>›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </MtModal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DioUsers() {
  const navigate = useNavigate();
  const location = useLocation();
  const bp = useBasePath();

  const [users,        setUsers       ] = useState([]);
  const [hospitals,    setHospitals   ] = useState([]);
  const [specialties,  setSpecialties ] = useState([]);
  const [loading,      setLoading     ] = useState(true);
  const [view,         setView        ] = useState('list');
  const [search,       setSearch      ] = useState('');
  const [roleFilter,   setRoleFilter  ] = useState('all');
  const [hospitalFilter,   setHospitalFilter  ] = useState('');
  const [specialtyFilter,  setSpecialtyFilter ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formModal,    setFormModal   ] = useState(null);   // { user? } | null
  const [viewUser,     setViewUser    ] = useState(null);
  const [viewFrom,     setViewFrom    ] = useState(null);   // supervisor to return to when viewing one of their trainees
  const [traineesBySup, setTraineesBySup] = useState(null); // { supId: [trainee] } | null (null = not loaded / failed)
  const [confirmDeact, setConfirmDeact] = useState(null);
  const { toasts, showToast } = useMtToast();

  const load = useCallback(async () => {
    setLoading(true);
    const inactive = showInactive ? '?includeInactive=true' : '';
    const results = await Promise.allSettled([
      ...ROLE_ORDER.map(r => api.get(`/api/dio/${ROLE_META[r].api}${inactive}`)),
      api.get('/api/hospitals'),
      api.get('/api/specialties'),
      // Bulk { supervisorId: [trainee] } map, so a supervisor's card can list
      // their assigned trainees. Isolated: a failure here must not blank users.
      api.get('/api/dio/supervisors/trainees-map'),
    ]);
    const merged = [];
    let anyFail = false;
    ROLE_ORDER.forEach((r, i) => {
      const res = results[i];
      if (res.status === 'fulfilled') {
        const list = res.value.data?.data || res.value.data || [];
        // Tag with the base role of the list it came from (so b_* track users
        // still map to ROLE_META and the filters/badges by base role).
        list.forEach(u => merged.push({ ...u, role: r }));
      } else { anyFail = true; }
    });
    const hRes = results[ROLE_ORDER.length];
    const spRes = results[ROLE_ORDER.length + 1];
    const tmRes = results[ROLE_ORDER.length + 2];
    if (hRes.status === 'fulfilled')  setHospitals(hRes.value.data?.data || hRes.value.data || []);
    if (spRes.status === 'fulfilled') setSpecialties(spRes.value.data?.data || spRes.value.data || []);
    // null = failed/unavailable (modal shows a fallback line); {} = loaded-empty.
    setTraineesBySup(tmRes.status === 'fulfilled' ? (tmRes.value.data?.data || {}) : null);
    setUsers(merged);
    if (anyFail) showToast('Some users could not be loaded', 'dng');
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  // Deep-link ?edit=<id> (e.g. from the trainee card's "Edit Trainee" action):
  // once the user lists are loaded, open the edit modal for that user, then
  // strip the param so a refresh doesn't reopen it.
  useEffect(() => {
    const editId = new URLSearchParams(location.search).get('edit');
    if (!editId || loading) return;
    const target = users.find(u => u._id === editId && CREATABLE_ROLES.includes(u.role));
    if (target) setFormModal({ user: target });
    navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, loading, users, navigate]);

  // Role counts across the loaded set (respecting show-inactive).
  const roleCounts = useMemo(() => {
    const c = { all: users.length };
    ROLE_ORDER.forEach(r => { c[r] = users.filter(u => u.role === r).length; });
    return c;
  }, [users]);

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (hospitalFilter && hospitalIdOf(u) !== hospitalFilter) return false;
    if (specialtyFilter && specialtyIdOf(u) !== specialtyFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !(
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.studentId || '').toLowerCase().includes(q)
    )) return false;
    return true;
  });

  function handleSaved(saved, isEdit) {
    // Simplest correct path: refetch so cross-list state stays consistent.
    load();
    showToast(isEdit ? 'User updated' : 'User created', 'ok');
  }

  async function handleDeactivate() {
    const u = confirmDeact;
    try {
      await api.delete(`/api/dio/${ROLE_META[u.role].api}/${u._id}`);
      setUsers(prev => showInactive
        ? prev.map(x => x._id === u._id ? { ...x, isActive: false } : x)
        : prev.filter(x => x._id !== u._id));
      showToast(`${u.name} deactivated`, 'ok');
    } catch (err) { showToast(err.response?.data?.message || 'Deactivate failed', 'dng'); }
    finally { setConfirmDeact(null); }
  }

  const hospitalFilterOptions  = [{ value: '', label: 'All Hospitals' }, ...hospitals.map(h => ({ value: h._id, label: h.name }))];
  const specialtyFilterOptions = [{ value: '', label: 'All Specialties' }, ...specialties.map(s => ({ value: s._id, label: s.name }))];

  function rowActions(u, active) {
    return (
      <div className="mt-row-actions">
        <button className="mt-icon-action" title="View details" aria-label={`View ${u.name}`} onClick={() => setViewUser(u)}><IconEye size={15} /></button>
        {u.role !== 'president' && (
          <button className="mt-icon-action" title="Edit" aria-label={`Edit ${u.name}`} onClick={() => setFormModal({ user: u })}><IconPencil size={15} /></button>
        )}
        {u.role !== 'president' && active && (
          <button className="mt-icon-action mt-icon-action--danger" title="Deactivate" aria-label={`Deactivate ${u.name}`} onClick={() => setConfirmDeact(u)}><IconBan size={15} /></button>
        )}
      </div>
    );
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="dio-tabs">{[...Array(5)].map((_, i) => <Sk key={i} w={90} h={32} r={6} style={{ marginInlineEnd: 6 }} />)}</div>
        <div className="mt-card">
          <div className="mt-filterbar"><Sk h={38} r={8} style={{ flex: 1 }} /></div>
          {[...Array(8)].map((_, i) => <Sk key={i} h={44} r={8} style={{ marginBottom: 8 }} />)}
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="mt-content">

        {/* Role filter tabs */}
        <div className="dio-tabs">
          <button className={`dio-tab${roleFilter === 'all' ? ' is-active' : ''}`} onClick={() => setRoleFilter('all')}>
            All<span className="dio-tab-badge">{roleCounts.all}</span>
          </button>
          {ROLE_ORDER.map(r => (
            <button key={r} className={`dio-tab${roleFilter === r ? ' is-active' : ''}`} onClick={() => setRoleFilter(r)}>
              {roleLabel(r)}s<span className="dio-tab-badge">{roleCounts[r] || 0}</span>
            </button>
          ))}
        </div>

        <div className="mt-card">
          <div className="mt-filterbar">
            <div className="mt-search">
              <input placeholder="Search by name, email, student ID…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ minWidth: 170 }}>
              <SearchableSelect value={hospitalFilter} onChange={setHospitalFilter} options={hospitalFilterOptions} placeholder="All Hospitals" />
            </div>
            <div style={{ minWidth: 170 }}>
              <SearchableSelect value={specialtyFilter} onChange={setSpecialtyFilter} options={specialtyFilterOptions} placeholder="All Specialties" />
            </div>
            <label className="mt-check-label"><input className="mt-check" type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive</label>
            <div className="mt-filterbar-spacer" />
            <ViewToggle value={view} onChange={setView} />
            <span className="mt-count">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
            <button className="mt-btn mt-btn--small"
              onClick={() => setFormModal({ user: null, initialRole: CREATABLE_ROLES.includes(roleFilter) ? roleFilter : 'trainee' })}>
              + Add User
            </button>
          </div>

          {/* Keyed wrapper → subtle crossfade when filters/view change */}
          <div key={`${roleFilter}|${hospitalFilter}|${specialtyFilter}|${search}|${view}`} style={{ animation: 'fadeIn .18s ease-out' }}>
          {view === 'list' && (
            <div className="mt-table-wrap">
              <table className="mt-table mt-table--stack">
                <thead>
                  <tr>
                    <th className="mt-th">#</th><th className="mt-th">User</th><th className="mt-th">Role</th>
                    <th className="mt-th">Specialty</th><th className="mt-th">Hospital</th><th className="mt-th">Status</th><th className="mt-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td className="mt-td mt-td--muted" colSpan={7} style={{ textAlign: 'center', padding: 32 }}>
                      {users.length === 0 ? 'No users yet.' : 'No users match your filters.'}
                    </td></tr>
                  )}
                  {filtered.map((u, i) => {
                    const active = u.isActive !== false;
                    return (
                      <tr key={u._id} style={{ opacity: active ? 1 : 0.65 }}>
                        <td className="mt-td mt-td--muted">{i + 1}</td>
                        <td className="mt-td" data-label="User">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <AvatarCell u={u} />
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{u.name}</div>
                              {u.email && <div className="mt-acct-id">{u.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="mt-td" data-label="Role"><span className="mt-pill mt-pill--role">{roleLabel(u.role)}</span></td>
                        <td className="mt-td" data-label="Specialty"><span className="mt-pill mt-pill--neutral">{specialtyName(u)}</span></td>
                        <td className="mt-td mt-td--muted" data-label="Hospital">{hospitalName(u)}</td>
                        <td className="mt-td" data-label="Status">
                          <span className={`mt-pill ${active ? 'mt-pill--active' : 'mt-pill--rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td className="mt-td mt-td--actions" data-label="Actions">{rowActions(u, active)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {view === 'card' && (
            <div className="mt-acct-grid">
              {filtered.length === 0 && (
                <div className="mt-empty" style={{ gridColumn: '1/-1' }}>
                  <div className="mt-empty-sub">{users.length === 0 ? 'No users yet.' : 'No users match your filters.'}</div>
                </div>
              )}
              {filtered.map(u => {
                const active = u.isActive !== false;
                return (
                  <div className="mt-card" key={u._id} style={{ opacity: active ? 1 : 0.65, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AvatarCell u={u} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{u.name}</div>
                        <div className="mt-acct-id">{u.email}</div>
                      </div>
                    </div>
                    <div className="dio-chip-row">
                      <span className="mt-pill mt-pill--role">{roleLabel(u.role)}</span>
                      <span className={`mt-pill ${active ? 'mt-pill--active' : 'mt-pill--rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="mt-card-sub">{specialtyName(u)} · {hospitalName(u)}</div>
                    <div className="mt-row-actions" style={{ justifyContent: 'flex-start' }}>{rowActions(u, active)}</div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {formModal && (
          <UserFormModal
            user={formModal.user}
            initialRole={formModal.initialRole}
            hospitals={hospitals}
            specialties={specialties}
            supervisors={users.filter(u => u.role === 'supervisor' && u.isActive !== false)}
            onClose={() => setFormModal(null)}
            onSaved={handleSaved}
          />
        )}
        {viewUser && (
          <UserViewModal
            user={viewUser}
            trainees={viewUser.role === 'supervisor'
              ? (traineesBySup ? (traineesBySup[viewUser._id] || []) : null)
              : undefined}
            onTraineeClick={t => {
              // Prefer the fuller trainee object already loaded into `users`; fall
              // back to the lightweight map object so the card still renders.
              const full = users.find(u => u.role === 'trainee' && u._id === t._id);
              setViewFrom(viewUser);
              setViewUser(full || { ...t, role: 'trainee' });
            }}
            onBack={viewFrom ? () => { setViewUser(viewFrom); setViewFrom(null); } : undefined}
            onClose={() => { setViewUser(null); setViewFrom(null); }}
            onFullProfile={() => { const id = viewUser._id; setViewUser(null); setViewFrom(null); navigate(bp + `/dio/users/${id}`); }}
          />
        )}
        {confirmDeact && (
          <ConfirmModal
            title={`Deactivate ${confirmDeact.role ? roleLabel(confirmDeact.role) : 'User'}`}
            message={`Deactivate ${confirmDeact.name}? They will lose portal access but their data is preserved.`}
            confirmLabel="Deactivate"
            onConfirm={handleDeactivate}
            onCancel={() => setConfirmDeact(null)}
          />
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
