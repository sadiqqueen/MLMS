// W1-Analyzer — shared Add/Edit modal for the two staff roles the analyzer
// manages: data entry clerks + central secretaries. Wired to the existing
//   POST  /api/analyzer/staff  { role, name, idNumber, password, email?, phone?,
//                                secretaryType?, councilId? }
//   PATCH /api/analyzer/staff/:id  { name?, phone?, email?, locked?, isActive? }
// Add collects the full account (CS also picks Specialty/Sub-specialty + council);
// Edit covers name/phone/email/active/locked (the PATCH contract).
import { useState } from 'react';
import MtModal from '../components/MtModal';
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

export function StaffFormModal({ role, mode, staff, councils = [], onClose, onSaved }) {
  const isCS = role === 'central_secretary';
  const isEdit = mode === 'edit';
  const roleName = isCS ? 'Central secretary' : 'Data entry clerk';

  const [form, setForm] = useState(
    isEdit
      ? {
          name: staff.name || '', phone: staff.phone || '', email: staff.email || '',
          locked: !!staff.locked, isActive: staff.isActive !== false,
        }
      : { name: '', idNumber: '', password: '', phone: '', email: '', secretaryType: 'main', councilId: '' },
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
      if (isCS && form.secretaryType === 'main' && !form.councilId) e.councilId = true;
    }
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      let res;
      if (isEdit) {
        const payload = { name: form.name.trim(), phone: form.phone.trim(), locked: form.locked, isActive: form.isActive };
        const em = form.email.trim();
        if (em) payload.email = em; else if (staff.email) payload.email = '';
        res = await api.patch(`/api/analyzer/staff/${staff._id}`, payload);
      } else {
        const payload = { role, name: form.name.trim(), idNumber: form.idNumber.trim(), password: form.password };
        if (form.phone.trim()) payload.phone = form.phone.trim();
        if (form.email.trim()) payload.email = form.email.trim();
        if (isCS) {
          payload.secretaryType = form.secretaryType;
          if (form.secretaryType === 'main') payload.councilId = form.councilId;
        }
        res = await api.post('/api/analyzer/staff', payload);
      }
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <MtModal open title={isEdit ? `Edit · ${staff.name}` : `New ${roleName.toLowerCase()}`} sub={roleName} meta="Data Analyzer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save' : 'Create')}</button>
      </>}>
      <div className="mt-field-grid">
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

        {isCS && !isEdit && (
          <>
            <div className="mt-field mt-field-full">
              <label className="mt-label">Type</label>
              <div className="mt-radio-group">
                <label className="mt-check-label"><input type="radio" className="mt-check" name="secType" checked={form.secretaryType === 'main'} onChange={() => set('secretaryType', 'main')} /> Specialty</label>
                <label className="mt-check-label"><input type="radio" className="mt-check" name="secType" checked={form.secretaryType === 'precise'} onChange={() => set('secretaryType', 'precise')} /> Sub-specialty</label>
              </div>
            </div>
            {form.secretaryType === 'main' ? (
              <div className="mt-field mt-field-full">
                <label className="mt-label">Specialty (council) <span className="mt-label-req">*</span></label>
                <select className="mt-select" style={errStyle(errors.councilId)} value={form.councilId} onChange={(e) => set('councilId', e.target.value)}>
                  <option value="">— Select —</option>
                  {councils.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            ) : (
              <div className="mt-field mt-field-full"><span style={{ fontSize: 12, color: 'var(--text-2)' }}>A sub-specialty secretary covers every sub-specialty — no council needed.</span></div>
            )}
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
