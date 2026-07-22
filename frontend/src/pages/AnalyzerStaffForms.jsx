// W1-Analyzer — shared Add/Edit modal for the two staff roles the analyzer
// manages: data entry clerks + central secretaries. Wired to the existing
//   POST  /api/analyzer/staff  { role, name, idNumber, password, email?, phone?,
//                                specialtyIds? }
//   PATCH /api/analyzer/staff/:id  { name?, phone?, email?, locked?, isActive?,
//                                    specialtyIds? }
// Add collects the full account (a CS also picks one-or-more specialties — any
// mix of main + sub-specialty); Edit covers name/phone/email/active/locked and,
// for a CS, its specialty scope (the PATCH contract).
import { useState } from 'react';
import MtModal from '../components/MtModal';
import SpecialtyMultiPicker from '../components/SpecialtyMultiPicker';
import { specialtyName } from '../utils/specialtyName';
import api from '../api/axios';

const errStyle = (bad) => (bad ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 3px var(--danger-bg)' } : undefined);

function ApiErr({ msg }) {
  if (!msg) return null;
  return (
    <div className="mt-banner" style={{ marginBlockStart: 12, marginBlockEnd: 0, background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger-fg)' }}>
      {msg}
    </div>
  );
}

export function StaffFormModal({ role: roleProp, mode, staff, specialties = [], onClose, onSaved }) {
  const isEdit = mode === 'edit';
  // The add form lets the analyzer toggle which staff role it is creating
  // (design form 2). Edit locks the role to the account being edited.
  const [role, setRole] = useState(roleProp);
  const isCS = role === 'central_secretary';
  const roleName = isCS ? 'Central secretary' : 'Data entry clerk';

  // A legacy CS was scoped by council/type and carries no explicit specialtyIds.
  // Editing one must NOT force a re-scope: unrelated edits (phone, lock, active)
  // leave its specialty list untouched unless the analyzer deliberately adds some.
  const isLegacyCs = isCS && isEdit && (staff?.specialtyIds || []).length === 0;
  const legacyScopeLabel = staff?.councilId?.name
    || (staff?.secretaryType === 'precise' ? 'all sub-specialties' : null);

  // Include the account's currently-assigned specialties in the option list so
  // their chips always resolve a label — even one later deactivated (and thus
  // absent from the active-specialty picker source).
  const specialtyOptions = (() => {
    if (!isCS) return specialties;
    const seen = new Set(specialties.map((o) => String(o.value)));
    const extra = (isEdit ? staff?.specialtyIds || [] : [])
      .filter((s) => s && s._id && !seen.has(String(s._id)))
      .map((s) => ({ value: s._id, label: s.type === 'precise' ? `${specialtyName(s)} (sub)` : specialtyName(s) }));
    return [...specialties, ...extra];
  })();

  const [form, setForm] = useState(
    isEdit
      ? {
          name: staff.name || '', phone: staff.phone || '', email: staff.email || '',
          locked: !!staff.locked, isActive: staff.isActive !== false,
          specialtyIds: (staff.specialtyIds || []).map((s) => s?._id || s).filter(Boolean),
        }
      : { name: '', idNumber: '', password: '', phone: '', email: '', specialtyIds: [] },
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: false })); setApiErr(''); };

  async function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!isEdit) {
      if (!form.idNumber.trim()) e.idNumber = true;
      if (!form.password || form.password.length < 6) e.password = true;
    }
    // A central secretary must be scoped to at least one specialty — except a
    // legacy account (council/type scoped) being edited for something unrelated.
    if (isCS && !isLegacyCs && (form.specialtyIds || []).length === 0) e.specialtyIds = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      let res;
      if (isEdit) {
        const payload = { name: form.name.trim(), phone: form.phone.trim(), locked: form.locked, isActive: form.isActive };
        const em = form.email.trim();
        if (em) payload.email = em; else if (staff.email) payload.email = '';
        // Legacy CS: send specialties only if the analyzer actually assigned some
        // (which migrates it); otherwise omit so its council scope is preserved.
        if (isCS && (!isLegacyCs || form.specialtyIds.length > 0)) payload.specialtyIds = form.specialtyIds;
        res = await api.patch(`/api/analyzer/staff/${staff._id}`, payload);
      } else {
        const payload = { role, name: form.name.trim(), idNumber: form.idNumber.trim(), password: form.password };
        if (form.phone.trim()) payload.phone = form.phone.trim();
        if (form.email.trim()) payload.email = form.email.trim();
        if (isCS) payload.specialtyIds = form.specialtyIds;
        res = await api.post('/api/analyzer/staff', payload);
      }
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <MtModal open tone="user" title={isEdit ? `Edit · ${staff.name}` : `New ${roleName.toLowerCase()}`} sub={roleName} meta="Data Analyzer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save' : 'Create')}</button>
      </>}>
      <div className="mt-field-grid">
        {!isEdit && (
          <div className="mt-field-full" style={{ display: 'flex', gap: 8 }}>
            {[['data_entry', 'Data entry clerk'], ['central_secretary', 'Central secretary']].map(([r, label]) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                style={{
                  padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${role === r ? 'var(--brand-primary)' : 'var(--border)'}`,
                  background: role === r ? 'var(--brand-primary)' : 'var(--surface)',
                  color: role === r ? '#fff' : 'var(--text)',
                }}>{label}</button>
            ))}
          </div>
        )}
        <div className="mt-field mt-field-full">
          <label className="mt-label">Name <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={errStyle(errors.name)} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        {!isEdit && (
          <>
            <div className="mt-field">
              <label className="mt-label">ID number <span className="mt-label-req">*</span></label>
              <input className="mt-input mt-input--mono" style={errStyle(errors.idNumber)} value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} />
            </div>
            <div className="mt-field">
              <label className="mt-label">Password <span className="mt-label-req">*</span> <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(min 6 chars)</span></label>
              <input type="password" autoComplete="new-password" className="mt-input" style={errStyle(errors.password)} value={form.password} onChange={(e) => set('password', e.target.value)} />
            </div>
          </>
        )}

        <div className="mt-field"><label className="mt-label">Phone</label><input className="mt-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="mt-field"><label className="mt-label">Email</label><input type="email" className="mt-input" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>

        {isCS && (
          <>
            {/* blank space — separates the account fields from the specialty scope */}
            <div className="mt-field-full" aria-hidden="true"
              style={{ marginBlockStart: 4, borderBlockStart: '1px solid var(--border)' }} />
            {isLegacyCs && (
              <div className="mt-field-full" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Legacy account currently scoped to <b>{legacyScopeLabel || 'a council'}</b>. Leave the
                specialties empty to keep that scope, or add specialties to re-scope it.
              </div>
            )}
            <SpecialtyMultiPicker
              options={specialtyOptions}
              value={form.specialtyIds}
              onChange={(ids) => set('specialtyIds', ids)}
              error={errors.specialtyIds}
              required={!isLegacyCs}
            />
          </>
        )}

        {isEdit && (
          <>
            <label className="mt-check-label mt-field-full"><input type="checkbox" className="mt-check" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Account active</label>
            <label className="mt-check-label mt-field-full"><input type="checkbox" className="mt-check" checked={form.locked} onChange={(e) => set('locked', e.target.checked)} /> Account locked</label>
          </>
        )}
      </div>
      <ApiErr msg={apiErr} />
    </MtModal>
  );
}
