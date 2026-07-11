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
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconEye, IconPencil, IconBan } from '../components/icons';

const API_BASE = '';

// ── Role config: display, badge colours, list endpoint, table empty icon ──
const ROLE_META = {
  trainee:          { label: 'Trainee',          api: 'trainees',          icon: '🎓', badge: { bg: 'var(--chip-spec-bg)', color: 'var(--chip-spec-fg)' } },
  supervisor:       { label: 'Supervisor',       api: 'supervisors',       icon: '👨‍⚕️', badge: { bg: 'var(--info-bg)', color: 'var(--info-fg)' } },
  program_director: { label: 'Program Director', api: 'program-directors', icon: '⭐', badge: { bg: 'var(--warning-bg)', color: 'var(--warning-fg)' } },
  secretary:        { label: 'Secretary',        api: 'secretaries',       icon: '📋', badge: { bg: '#FCE7F3', color: '#9D174D' } },
  president:        { label: 'President',        api: 'presidents',        icon: '🏛️', badge: { bg: '#E0E7FF', color: '#3730A3' } },
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

  switch (role) {
    case 'trainee':          return [name, email, password, phoneOpt, studentId, year, hospital, specReq];
    case 'supervisor':       return [name, email, password, phoneReq, department, hospital, specReq];
    case 'program_director': return [name, email, password, phoneReq, department, hospital];
    case 'secretary':        return [name, email, password, phoneReq, hospital, specOpt];
    default:                 return [name, email, password];
  }
}

// ── Confirm modal (deactivate) ────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
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
          <button className="btn-red" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit modal (role-config-driven) ─────────────────────────────────
function UserFormModal({ user, initialRole, hospitals, specialties, onClose, onSaved }) {
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
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

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

  function renderField(f) {
    if (f.createOnly && isEdit) return null;
    const invalid = errors[f.key] ? 'invalid' : '';
    let control;
    if (f.type === 'hospital') {
      control = <SearchableSelect value={form.hospitalId} onChange={v => set('hospitalId', v)} options={hospitalOptions} placeholder="Search hospital..." error={errors.hospitalId} />;
    } else if (f.type === 'specialty') {
      control = <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)} options={specialtyOptions} placeholder="Search specialty..." error={errors.specialtyId} />;
    } else if (f.type === 'year') {
      control = (
        <select value={form.year} onChange={e => set('year', e.target.value)}>
          <option value="">— select —</option>
          {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
      );
    } else {
      control = <input className={invalid} type={f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : 'text'}
        value={form[f.key]} placeholder={f.placeholder || ''}
        autoComplete={f.type === 'password' ? 'new-password' : 'off'}
        onChange={e => set(f.key, e.target.value)} />;
    }
    return (
      <div className="admin-field" key={f.key}>
        <label>{f.label}</label>
        {control}
      </div>
    );
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? `Edit ${ROLE_META[role].label}` : `Add ${ROLE_META[role].label}`}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          {!isEdit && (
            <div className="admin-field" style={{ marginBottom: 14 }}>
              <label>User Type *</label>
              <select value={role} onChange={e => setRole(e.target.value)}>
                {CREATABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
              </select>
            </div>
          )}
          <div className="admin-form-grid">
            {fields.map(renderField)}
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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : `Create ${ROLE_META[role].label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Read-only View modal (built from list data — no backend fetch) ─────────
// For a supervisor, `trainees` lists their assigned trainees (null = failed to
// load); clicking one calls onTraineeClick(t) to swap this modal in place to the
// trainee's card, with onBack returning to the supervisor.
function UserViewModal({ user, trainees, onTraineeClick, onBack, onClose, onFullProfile }) {
  useEffect(() => {
    // Escape steps back to the supervisor card if we're viewing one of their
    // trainees, otherwise it closes the modal.
    const h = e => { if (e.key === 'Escape') (onBack || onClose)(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, onBack]);

  const meta = ROLE_META[user.role] || { label: user.role, badge: { bg: 'var(--border-soft)', color: 'var(--text-2)' } };
  const active = user.isActive !== false;
  const rows = [
    ['Email', user.email],
    ['Phone', user.phone],
    ['Hospital', hospitalName(user)],
    ['Specialty', specialtyName(user)],
    ['Department', user.department],
    user.role === 'trainee' ? ['Student ID', user.studentId] : null,
    user.role === 'trainee' ? ['Year', user.year ? `Year ${user.year}` : '—'] : null,
    ['Status', active ? 'Active' : 'Inactive'],
  ].filter(Boolean);

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.photoUrl
              ? <img src={`${API_BASE}${user.photoUrl}`} alt="" className="cell-photo" />
              : <div className="cell-initials">{user.initials || user.name?.[0] || '?'}</div>}
            <div>
              <div className="admin-modal-title" style={{ marginBottom: 3 }}>{user.name}</div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: meta.badge.bg, color: meta.badge.color }}>
                {meta.label}
              </span>
            </div>
          </div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px 18px' }}>
            {rows.map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--brand-secondary)', fontWeight: 600 }}>{textValue(value)}</div>
              </div>
            ))}
          </div>

          {/* Supervisor → assigned trainees (click one to view their card in this panel) */}
          {user.role === 'supervisor' && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                Assigned Trainees{Array.isArray(trainees) ? ` (${trainees.length})` : ''}
              </div>
              {trainees === null ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Could not load assigned trainees.</div>
              ) : trainees.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No trainees assigned.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                  {trainees.map(t => (
                    <button type="button" key={t._id}
                      onClick={() => onTraineeClick(t)}
                      aria-label={`View ${t.name}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                        background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 8,
                        padding: '7px 10px', cursor: 'pointer',
                      }}>
                      {t.photoUrl
                        ? <img src={`${API_BASE}${t.photoUrl}`} alt="" className="cell-photo" style={{ width: 28, height: 28 }} />
                        : <div className="cell-initials" style={{ width: 28, height: 28, fontSize: 12 }}>{t.initials || t.name?.[0] || '?'}</div>}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.studentId || t.specialty || ''}</div>
                      </div>
                      <span style={{ fontSize: 16, color: 'var(--text-muted)', flexShrink: 0 }}>›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="admin-modal-footer">
          {onBack && (
            <button className="btn-outline" onClick={onBack}>← Back to supervisor</button>
          )}
          {user.role === 'trainee' && (
            <button className="btn-outline" onClick={onFullProfile}>Open full profile →</button>
          )}
          <button className="btn-purple" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
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
  const [toasts,       setToasts      ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

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
    if (anyFail) showToast('Some users could not be loaded', 'error');
    setLoading(false);
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
    showToast(isEdit ? 'User updated' : 'User created');
  }

  async function handleDeactivate() {
    const u = confirmDeact;
    try {
      await api.delete(`/api/dio/${ROLE_META[u.role].api}/${u._id}`);
      setUsers(prev => showInactive
        ? prev.map(x => x._id === u._id ? { ...x, isActive: false } : x)
        : prev.filter(x => x._id !== u._id));
      showToast(`${u.name} deactivated`);
    } catch (err) { showToast(err.response?.data?.message || 'Deactivate failed', 'error'); }
    finally { setConfirmDeact(null); }
  }

  const hospitalFilterOptions  = [{ value: '', label: 'All Hospitals' }, ...hospitals.map(h => ({ value: h._id, label: h.name }))];
  const specialtyFilterOptions = [{ value: '', label: 'All Specialties' }, ...specialties.map(s => ({ value: s._id, label: s.name }))];

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="filter-tabs" style={{ marginBottom: 14 }}>
          {[...Array(5)].map((_, i) => <Sk key={i} w={90} h={32} r={20} />)}
        </div>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td><Sk w={20} h={13} /></td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                  <td><Sk w={90} h={22} r={20} /></td>
                  <td><Sk w={90} h={22} r={20} /></td>
                  <td><Sk w={90} h={13} /></td>
                  <td><Sk w={70} h={22} r={20} /></td>
                  <td><div style={{ display: 'flex', gap: 6 }}><Sk w={36} h={36} r={8} /><Sk w={36} h={36} r={8} /><Sk w={36} h={36} r={8} /></div></td>
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

        {/* Role filter pills */}
        <div className="filter-tabs" style={{ marginBottom: 14 }}>
          <button className={`filter-tab${roleFilter === 'all' ? ' active' : ''}`} onClick={() => setRoleFilter('all')}>
            All ({roleCounts.all})
          </button>
          {ROLE_ORDER.map(r => (
            <button key={r} className={`filter-tab${roleFilter === r ? ' active' : ''}`} onClick={() => setRoleFilter(r)}>
              {ROLE_META[r].label}s ({roleCounts[r] || 0})
            </button>
          ))}
        </div>

        <div className="admin-card">
          <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input className="admin-search" style={{ flex: 1, minWidth: 200 }}
              placeholder="Search by name, email, student ID…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ minWidth: 170 }}>
              <SearchableSelect value={hospitalFilter} onChange={setHospitalFilter} options={hospitalFilterOptions} placeholder="All Hospitals" />
            </div>
            <div style={{ minWidth: 170 }}>
              <SearchableSelect value={specialtyFilter} onChange={setSpecialtyFilter} options={specialtyFilterOptions} placeholder="All Specialties" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive
            </label>
            <ViewToggle value={view} onChange={setView} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
              {filtered.length} user{filtered.length !== 1 ? 's' : ''}
            </span>
            <button className="btn-purple"
              onClick={() => setFormModal({ user: null, initialRole: CREATABLE_ROLES.includes(roleFilter) ? roleFilter : 'trainee' })}>
              + Add User
            </button>
          </div>

          {/* Keyed wrapper → subtle crossfade when filters/view change */}
          <div key={`${roleFilter}|${hospitalFilter}|${specialtyFilter}|${search}|${view}`} style={{ animation: 'fadeIn .18s ease-out' }}>
          {view === 'list' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>#</th><th>User</th><th>Role</th><th>Specialty</th><th>Hospital</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>
                          {users.length === 0 ? 'No users yet.' : 'No users match your filters.'}
                        </div>
                      </td>
                    </tr>
                  )}
                  {filtered.map((u, i) => {
                    const active = u.isActive !== false;
                    const meta = ROLE_META[u.role] || { label: u.role, badge: { bg: 'var(--border-soft)', color: 'var(--text-2)' } };
                    return (
                      <tr key={u._id} style={{ opacity: active ? 1 : 0.65 }}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {u.photoUrl
                              ? <img src={`${API_BASE}${u.photoUrl}`} alt="" className="cell-photo" />
                              : <div className="cell-initials">{u.initials || u.name?.[0] || '?'}</div>}
                            <div>
                              <strong>{u.name}</strong>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: meta.badge.bg, color: meta.badge.color }}>
                            {meta.label}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'var(--chip-spec-bg)', color: 'var(--chip-spec-fg)' }}>
                            {specialtyName(u)}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{hospitalName(u)}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: active ? 'var(--success-bg)' : 'var(--danger-bg)', color: active ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-action view" title="View details" aria-label={`View ${u.name}`} onClick={() => setViewUser(u)}><IconEye /></button>
                            {u.role !== 'president' && (
                              <button className="btn-action edit" title="Edit" aria-label={`Edit ${u.name}`} onClick={() => setFormModal({ user: u })}><IconPencil /></button>
                            )}
                            {u.role !== 'president' && active && (
                              <button className="btn-action delete" title="Deactivate" aria-label={`Deactivate ${u.name}`} onClick={() => setConfirmDeact(u)}><IconBan /></button>
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

          {view === 'card' && (
            <div className="management-card-grid">
              {filtered.length === 0 && (
                <div className="admin-empty" style={{ gridColumn: '1/-1' }}>
                  {users.length === 0 ? 'No users yet.' : 'No users match your filters.'}
                </div>
              )}
              {filtered.map(u => {
                const active = u.isActive !== false;
                const meta = ROLE_META[u.role] || { label: u.role, badge: { bg: 'var(--border-soft)', color: 'var(--text-2)' } };
                return (
                  <div className="management-card" key={u._id} style={{ opacity: active ? 1 : 0.65 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {u.photoUrl ? <img src={`${API_BASE}${u.photoUrl}`} alt="" className="cell-photo" /> : <div className="cell-initials">{u.initials || u.name?.[0] || '?'}</div>}
                      <div><div className="management-card-title">{u.name}</div><div className="management-card-sub">{u.email}</div></div>
                    </div>
                    <div className="management-card-meta">
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: meta.badge.bg, color: meta.badge.color }}>{meta.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: active ? 'var(--success-bg)' : 'var(--danger-bg)', color: active ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="management-card-sub">{specialtyName(u)} · {hospitalName(u)}</div>
                    <div className="management-card-actions">
                      <button className="btn-action view" title="View details" aria-label={`View ${u.name}`} onClick={() => setViewUser(u)}><IconEye /></button>
                      {u.role !== 'president' && <button className="btn-action edit" title="Edit" aria-label={`Edit ${u.name}`} onClick={() => setFormModal({ user: u })}><IconPencil /></button>}
                      {u.role !== 'president' && active && <button className="btn-action delete" title="Deactivate" aria-label={`Deactivate ${u.name}`} onClick={() => setConfirmDeact(u)}><IconBan /></button>}
                    </div>
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
            title={`Deactivate ${ROLE_META[confirmDeact.role]?.label || 'User'}`}
            message={`Deactivate ${confirmDeact.name}? They will lose portal access but their data is preserved.`}
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
