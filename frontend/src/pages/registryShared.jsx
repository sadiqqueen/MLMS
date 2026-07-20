// frontend/src/pages/registryShared.jsx
//
// Shared building blocks for the data-entry clerk registry pages (W1-Clerk).
// Owned solely by the clerk workstream; imported only by Registry*.jsx.
//
//   • SearchBox        — mt-search input with leading magnifier.
//   • AddCenterModal   — direct-create training center (neutral banner, green toast).
//   • AddProgramModal  — direct-create program (center fixed or picked; PD filtered
//                        by specialty via /api/programs/pd-candidates). Cap = 100.
//   • ApprovalModal    — edit/delete-with-approval: multipart with a REQUIRED
//                        `bookOfChanges` PDF → 202 { pending }. Submit is disabled
//                        until a PDF is attached; shows the "REQ-…" success panel.
//   • ViewModal        — read-only account/entity detail (eye action).
//   • helpers          — normId, refName, fmtDate, toDateInput, reqIdOf, histLine.
//
// All shared modals take `lang` and resolve their own copy from S().
import { useState, useEffect } from 'react';
import api from '../api/axios';
import MtModal from '../components/MtModal';
import PdfDropzone from '../components/PdfDropzone';
import SearchableSelect from '../components/SearchableSelect';
import { IconCheck } from '../components/icons';

// ── helpers ──────────────────────────────────────────────────────────────────
export function normId(v) { return v && typeof v === 'object' ? (v._id || '') : (v || ''); }
export function refName(v) { return (v && typeof v === 'object' ? v.name : v) || '—'; }
export function toDateInput(v) { return v ? new Date(v).toISOString().slice(0, 10) : ''; }
export function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}
export function reqIdOf(cr) {
  const id = String(cr?._id || '');
  return 'REQ-' + (id.slice(-6) || '——————').toUpperCase();
}
export function histLine(h) {
  const date = fmtDate(h?.date);
  const labels = Array.isArray(h?.labels) && h.labels.length ? h.labels.join(', ') : 'Updated';
  return `${date} — ${labels}${h?.by ? ` — by ${h.by}` : ''}`;
}

// ── shared copy ──────────────────────────────────────────────────────────────
const STR = {
  ar: {
    cancel: 'إلغاء', close: 'إغلاق', done: 'تم', saving: 'جارٍ الحفظ…', create: 'إنشاء',
    createBanner: 'ستتم إضافة هذا السجل إلى السجل مباشرة.',
    name: 'الاسم', country: 'الدولة', city: 'المدينة', idNumber: 'الرقم التعريفي',
    accId: 'رقم الاعتماد', accDate: 'تاريخ الاعتماد', dio: 'DIO', subDio: 'Sub-DIO',
    center: 'المركز التدريبي', specialty: 'الاختصاص', pd: 'مدير البرنامج', subPd: 'نائب المدير',
    capacity: 'الطاقة السنوية', duration: 'المدة (سنوات)', none: '—',
    selectSpecialtyFirst: 'اختر الاختصاص أولاً', noPd: 'بدون مدير برنامج',
    saveFailed: 'فشل الحفظ', required: 'الحقول المطلوبة ناقصة',
    newCenter: 'مركز تدريبي جديد', newCenterSub: 'سجل مركز تدريبي جديد',
    newProgram: 'برنامج جديد', newProgramSub: 'برنامج جديد — يُحتسب ضمن حد 100 برنامج للمركز',
    // approval
    editBanner: 'التعديلات لا تُطبّق فورًا — يُرسَل طلب التغيير إلى محلل البيانات للموافقة، مع إرفاق كتاب التغييرات المطلوب.',
    deleteTitle: 'حذف السجل — يتطلب موافقة', deleteNote: 'سيُحذف هذا السجل بعد موافقة محلل البيانات:',
    requestDeletion: 'طلب الحذف بدلاً من ذلك', backToEdit: 'العودة للتعديل',
    uploadBoc: 'رفع كتاب التغييرات', submitForApproval: 'إرسال للموافقة', submitDeletion: 'إرسال طلب الحذف',
    submitting: 'جارٍ الإرسال…', submitFailed: 'فشل الإرسال', noChanges: 'لا توجد تغييرات للإرسال',
    reqTitle: 'تم إرسال طلب التغيير', reqDelTitle: 'تم إرسال طلب الحذف',
    reqSub: 'سيراجع محلل البيانات الطلب. بعد الموافقة تُطبّق التغييرات وتُختم في سجل تغييرات الحساب.',
    pendingReview: 'بانتظار مراجعة محلل البيانات', changeHistory: 'سجل التغييرات',
  },
  en: {
    cancel: 'Cancel', close: 'Close', done: 'Done', saving: 'Saving…', create: 'Create',
    createBanner: 'This record will be added to the registry.',
    name: 'Name', country: 'Country', city: 'City', idNumber: 'ID',
    accId: 'Accreditation ID', accDate: 'Date of accreditation', dio: 'DIO', subDio: 'Sub-DIO',
    center: 'Training center', specialty: 'Specialty', pd: 'Program Director', subPd: 'Sub-PD',
    capacity: 'Yearly capacity', duration: 'Duration (years)', none: '—',
    selectSpecialtyFirst: 'Select a specialty first', noPd: 'No program director',
    saveFailed: 'Save failed', required: 'Required fields are missing',
    newCenter: 'New training center', newCenterSub: 'New training center record',
    newProgram: 'New program', newProgramSub: 'New program — counts toward the center’s 100-program cap',
    // approval
    editBanner: 'Edits do not take effect immediately — this change request goes to a Data Analyzer for approval, with the required book of changes attached.',
    deleteTitle: 'Delete record — requires approval', deleteNote: 'This record will be removed once a Data Analyzer approves:',
    requestDeletion: 'Request deletion instead', backToEdit: 'Back to editing',
    uploadBoc: 'Upload book of changes', submitForApproval: 'Submit for approval', submitDeletion: 'Submit deletion',
    submitting: 'Submitting…', submitFailed: 'Submit failed', noChanges: 'No changes to submit',
    reqTitle: 'Change request submitted', reqDelTitle: 'Deletion request submitted',
    reqSub: 'A Data Analyzer will review the request. Once approved, the changes apply and are stamped into the account’s change history.',
    pendingReview: 'Pending Data Analyzer review', changeHistory: 'Change history',
  },
};
const S = (lang, k) => STR[lang]?.[k] ?? STR.en[k] ?? k;

// ── SearchBox ────────────────────────────────────────────────────────────────
export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="mt-search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ── AddCenterModal (direct create) ───────────────────────────────────────────
export function AddCenterModal({ open, lang, countries = [], dios = [], subDios = [], fixedCountryId, onClose, onSaved }) {
  const tr = (k) => S(lang, k);
  const [form, setForm] = useState({
    name: '', countryId: fixedCountryId || '', city: '', idNumber: '',
    accreditationNumber: '', accreditationGrantDate: '', dioId: '', subDioId: '',
  });
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');
  function set(k, v) { setForm((s) => ({ ...s, [k]: v })); setErr((e) => ({ ...e, [k]: false })); setApiErr(''); }

  async function save() {
    if (!form.name.trim()) { setErr({ name: true }); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(), countryId: form.countryId || undefined, city: form.city.trim() || undefined,
        idNumber: form.idNumber.trim() || undefined, accreditationNumber: form.accreditationNumber.trim() || undefined,
        accreditationGrantDate: form.accreditationGrantDate || undefined,
        dioId: form.dioId || undefined, subDioId: form.subDioId || undefined,
      };
      const res = await api.post('/api/registry/centers', payload);
      onSaved(res.data?.data || res.data);
    } catch (e) { setApiErr(e.response?.data?.message || tr('saveFailed')); } finally { setSaving(false); }
  }

  const countryOpts = countries.map((c) => ({ value: c._id, label: `${c.name} (${c.code})` }));
  const dioOpts = dios.map((d) => ({ value: d._id, label: d.name }));
  const subDioOpts = subDios.map((d) => ({ value: d._id, label: d.name }));

  return (
    <MtModal open={open} title={tr('newCenter')} sub={tr('newCenterSub')} onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>{tr('cancel')}</button>
        <button type="button" className="mt-btn" onClick={save} disabled={saving}>{saving ? tr('saving') : tr('create')}</button>
      </>}>
      <div className="mt-banner">{tr('createBanner')}</div>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">{tr('name')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" value={form.name} onChange={(e) => set('name', e.target.value)}
            style={err.name ? { borderColor: 'var(--danger)' } : undefined} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{tr('country')}</label>
          <SearchableSelect value={form.countryId} onChange={(v) => set('countryId', v)} options={countryOpts}
            placeholder={tr('country')} disabled={!!fixedCountryId} />
        </div>
        <div className="mt-field"><label className="mt-label">{tr('city')}</label>
          <input className="mt-input" value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
        <div className="mt-field"><label className="mt-label">{tr('idNumber')}</label>
          <input className="mt-input mt-input--mono" value={form.idNumber} placeholder="TC-…" onChange={(e) => set('idNumber', e.target.value)} /></div>
        <div className="mt-field"><label className="mt-label">{tr('accId')}</label>
          <input className="mt-input mt-input--mono" value={form.accreditationNumber} placeholder="ACC-…" onChange={(e) => set('accreditationNumber', e.target.value)} /></div>
        <div className="mt-field"><label className="mt-label">{tr('accDate')}</label>
          <input className="mt-input" type="date" value={form.accreditationGrantDate} onChange={(e) => set('accreditationGrantDate', e.target.value)} /></div>
        <div className="mt-field">
          <label className="mt-label">{tr('dio')}</label>
          <SearchableSelect value={form.dioId} onChange={(v) => set('dioId', v)} options={dioOpts} placeholder={tr('dio')} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{tr('subDio')}</label>
          <SearchableSelect value={form.subDioId} onChange={(v) => set('subDioId', v)} options={subDioOpts} placeholder={tr('subDio')} />
        </div>
      </div>
      {apiErr && <div className="reg-del-note" style={{ marginBlockStart: 14, marginBlockEnd: 0 }}>{apiErr}</div>}
    </MtModal>
  );
}

// ── AddProgramModal (direct create) ──────────────────────────────────────────
// `fixedCenter` (object) locks the center; otherwise pass `centers` for the picker.
export function AddProgramModal({ open, lang, centers = [], specialties = [], subPds = [], fixedCenter, onClose, onSaved }) {
  const tr = (k) => S(lang, k);
  const [form, setForm] = useState({
    name: '', trainingCenterId: fixedCenter?._id || '', specialtyId: '', programDirectorId: '',
    subProgramDirectorId: '', yearlyCapacity: '', durationYears: '', accreditationNumber: '', accreditationGrantDate: '',
  });
  const [pdCands, setPdCands] = useState([]);
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    if (!form.specialtyId) { setPdCands([]); return undefined; }
    let cancel = false;
    api.get('/api/programs/pd-candidates', { params: { specialtyId: form.specialtyId } })
      .then((r) => { if (!cancel) setPdCands(r.data?.data || r.data || []); })
      .catch(() => { if (!cancel) setPdCands([]); });
    return () => { cancel = true; };
  }, [form.specialtyId]);

  function set(k, v) { setForm((s) => ({ ...s, [k]: v })); setErr((e) => ({ ...e, [k]: false })); setApiErr(''); }
  function setSpecialty(v) { setForm((s) => ({ ...s, specialtyId: v, programDirectorId: '' })); setErr((e) => ({ ...e, specialtyId: false })); }

  async function save() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.trainingCenterId) e.trainingCenterId = true;
    if (!form.specialtyId) e.specialtyId = true;
    if (form.yearlyCapacity === '' || Number(form.yearlyCapacity) < 0) e.yearlyCapacity = true;
    if (form.durationYears === '' || Number(form.durationYears) < 1) e.durationYears = true;
    if (Object.keys(e).length) { setErr(e); setApiErr(tr('required')); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(), trainingCenterId: form.trainingCenterId, specialtyId: form.specialtyId,
        yearlyCapacity: Number(form.yearlyCapacity), durationYears: Number(form.durationYears),
        programDirectorId: form.programDirectorId || undefined, subProgramDirectorId: form.subProgramDirectorId || undefined,
        accreditationNumber: form.accreditationNumber.trim() || undefined,
        accreditationGrantDate: form.accreditationGrantDate || undefined,
      };
      const res = await api.post('/api/programs', payload);
      onSaved(res.data?.data || res.data);
    } catch (ex) { setApiErr(ex.response?.data?.message || tr('saveFailed')); } finally { setSaving(false); }
  }

  const centerOpts = centers.map((c) => ({ value: c._id, label: c.name }));
  const specialtyOpts = specialties.map((s) => ({ value: s._id, label: s.name }));
  const pdOpts = pdCands.map((p) => ({ value: p._id, label: `${p.name}${p.idNumber ? ` · ${p.idNumber}` : ''}` }));
  const subPdOpts = subPds.map((p) => ({ value: p._id, label: p.name }));

  return (
    <MtModal open={open} title={tr('newProgram')} sub={tr('newProgramSub')}
      meta={fixedCenter ? fixedCenter.name : undefined} onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>{tr('cancel')}</button>
        <button type="button" className="mt-btn" onClick={save} disabled={saving}>{saving ? tr('saving') : tr('create')}</button>
      </>}>
      <div className="mt-banner">{tr('createBanner')}</div>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">{tr('name')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" value={form.name} onChange={(e) => set('name', e.target.value)}
            style={err.name ? { borderColor: 'var(--danger)' } : undefined} />
        </div>
        {!fixedCenter && (
          <div className="mt-field mt-field-full">
            <label className="mt-label">{tr('center')}<span className="mt-label-req">*</span></label>
            <SearchableSelect value={form.trainingCenterId} onChange={(v) => set('trainingCenterId', v)}
              options={centerOpts} placeholder={tr('center')} error={err.trainingCenterId} />
          </div>
        )}
        <div className="mt-field mt-field-full">
          <label className="mt-label">{tr('specialty')}<span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.specialtyId} onChange={setSpecialty} options={specialtyOpts}
            placeholder={tr('specialty')} error={err.specialtyId} />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">{tr('pd')}</label>
          <SearchableSelect value={form.programDirectorId} onChange={(v) => set('programDirectorId', v)} options={pdOpts}
            placeholder={form.specialtyId ? tr('noPd') : tr('selectSpecialtyFirst')} disabled={!form.specialtyId} />
        </div>
        {subPds.length > 0 && (
          <div className="mt-field mt-field-full">
            <label className="mt-label">{tr('subPd')}</label>
            <SearchableSelect value={form.subProgramDirectorId} onChange={(v) => set('subProgramDirectorId', v)} options={subPdOpts} placeholder={tr('subPd')} />
          </div>
        )}
        <div className="mt-field">
          <label className="mt-label">{tr('capacity')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" type="number" min="0" placeholder="e.g. 24" value={form.yearlyCapacity}
            onChange={(e) => set('yearlyCapacity', e.target.value)} style={err.yearlyCapacity ? { borderColor: 'var(--danger)' } : undefined} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{tr('duration')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" type="number" min="1" placeholder="e.g. 4" value={form.durationYears}
            onChange={(e) => set('durationYears', e.target.value)} style={err.durationYears ? { borderColor: 'var(--danger)' } : undefined} />
        </div>
        <div className="mt-field"><label className="mt-label">{tr('accId')}</label>
          <input className="mt-input mt-input--mono" value={form.accreditationNumber} placeholder="ACC-…" onChange={(e) => set('accreditationNumber', e.target.value)} /></div>
        <div className="mt-field"><label className="mt-label">{tr('accDate')}</label>
          <input className="mt-input" type="date" value={form.accreditationGrantDate} onChange={(e) => set('accreditationGrantDate', e.target.value)} /></div>
      </div>
      {apiErr && <div className="reg-del-note" style={{ marginBlockStart: 14, marginBlockEnd: 0 }}>{apiErr}</div>}
    </MtModal>
  );
}

// ── ApprovalModal (edit / delete with book-of-changes PDF) ───────────────────
export function ApprovalModal({
  open, onClose, lang, routeKey, entityId, entityLabel,
  title, sub, meta, fields = [], initialValues = {}, allowDelete = true, onSubmitted,
}) {
  const tr = (k) => S(lang, k);
  const [form, setForm] = useState(() => {
    const f = {};
    for (const fl of fields) f[fl.key] = initialValues[fl.key] ?? (fl.type === 'checkbox' ? false : '');
    return f;
  });
  const [delMode, setDelMode] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  function set(k, v) { setForm((s) => ({ ...s, [k]: v })); setErr(''); }

  function changedFields() {
    const out = {};
    for (const fl of fields) {
      if (fl.type === 'checkbox') {
        if (Boolean(form[fl.key]) !== Boolean(initialValues[fl.key])) out[fl.key] = form[fl.key] ? 'true' : 'false';
      } else {
        const a = form[fl.key] ?? ''; const b = initialValues[fl.key] ?? '';
        if (String(a) !== String(b)) out[fl.key] = a;
      }
    }
    return out;
  }

  async function submit() {
    if (!pdf) return;
    const fd = new FormData();
    if (!delMode) {
      const changed = changedFields();
      if (!Object.keys(changed).length) { setErr(tr('noChanges')); return; }
      for (const [k, v] of Object.entries(changed)) fd.append(k, v);
    }
    fd.append('bookOfChanges', pdf);
    setSaving(true); setErr('');
    try {
      const url = `/api/registry/${routeKey}/${entityId}`;
      const res = delMode ? await api.delete(url, { data: fd }) : await api.patch(url, fd);
      const reqId = reqIdOf(res.data?.data || res.data);
      setDone(reqId);
      onSubmitted && onSubmitted(reqId, delMode ? 'delete' : 'edit');
    } catch (e) { setErr(e.response?.data?.message || tr('submitFailed')); } finally { setSaving(false); }
  }

  if (!open) return null;

  if (done) {
    return (
      <MtModal open title={delMode ? tr('reqDelTitle') : tr('reqTitle')} onClose={onClose}
        footer={<button type="button" className="mt-btn" onClick={onClose}>{tr('done')}</button>}>
        <div className="reg-req-done">
          <div className="reg-req-check"><IconCheck size={26} /></div>
          <div className="reg-req-title">{delMode ? tr('reqDelTitle') : tr('reqTitle')}</div>
          <div className="reg-req-sub">{tr('reqSub')}</div>
          <span className="mt-pill mt-pill--pending">{tr('pendingReview')} · {done}</span>
        </div>
      </MtModal>
    );
  }

  const footer = (
    <>
      {allowDelete && (
        <button type="button" className="reg-del-toggle" onClick={() => { setDelMode((v) => !v); setErr(''); }}>
          {delMode ? tr('backToEdit') : tr('requestDeletion')}
        </button>
      )}
      <button type="button" className="mt-btn--cancel" onClick={onClose}>{tr('cancel')}</button>
      <button type="button" className="mt-btn" onClick={submit} disabled={saving || !pdf}>
        {saving ? tr('submitting') : delMode ? tr('submitDeletion') : tr('submitForApproval')}
      </button>
    </>
  );

  return (
    <MtModal open title={delMode ? tr('deleteTitle') : title} sub={sub} meta={meta} onClose={onClose} footer={footer}>
      {delMode
        ? <div className="reg-del-note">{tr('deleteNote')} <b>{entityLabel}</b></div>
        : <div className="mt-banner">{tr('editBanner')}</div>}

      {!delMode && (
        <div className="mt-field-grid">
          {fields.map((fl) => (
            <div key={fl.key} className={'mt-field' + (fl.full ? ' mt-field-full' : '')}>
              {fl.type === 'checkbox' ? (
                <label className="mt-check-label">
                  <input type="checkbox" className="mt-check" checked={!!form[fl.key]}
                    onChange={(e) => set(fl.key, e.target.checked)} />
                  {fl.label}
                </label>
              ) : (
                <>
                  <label className="mt-label">{fl.label}{fl.required && <span className="mt-label-req">*</span>}</label>
                  {fl.type === 'select' ? (
                    <select className="mt-select" value={form[fl.key] || ''} onChange={(e) => set(fl.key, e.target.value)}>
                      {!fl.required && <option value="">—</option>}
                      {(fl.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input className={'mt-input' + (fl.mono ? ' mt-input--mono' : '')}
                      type={fl.type === 'number' ? 'number' : fl.type === 'date' ? 'date' : 'text'}
                      value={form[fl.key] ?? ''} placeholder={fl.placeholder || ''}
                      onChange={(e) => set(fl.key, e.target.value)} />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBlockStart: 15 }}>
        <PdfDropzone file={pdf} onFile={setPdf} onRemove={() => setPdf(null)} label={tr('uploadBoc')} />
      </div>
      {err && <div className="reg-del-note" style={{ marginBlockStart: 14, marginBlockEnd: 0 }}>{err}</div>}
    </MtModal>
  );
}

// ── ViewModal (read-only detail) ─────────────────────────────────────────────
export function ViewModal({ open, lang, title, sub, meta, rows = [], history = [], onClose }) {
  const tr = (k) => S(lang, k);
  if (!open) return null;
  return (
    <MtModal open title={title} sub={sub} meta={meta} onClose={onClose}
      footer={<button type="button" className="mt-btn--cancel" onClick={onClose}>{tr('close')}</button>}>
      <div className="reg-view-rows">
        {rows.map((r, i) => (
          <div key={i} className={r.full ? 'reg-view-row-full' : ''}>
            <div className="reg-view-k">{r.label}</div>
            <div className="reg-view-v">{r.value ?? '—'}</div>
          </div>
        ))}
      </div>
      {history.length > 0 && (
        <div className="reg-hist" style={{ marginBlockStart: 16 }}>
          <div className="reg-hist-title">{tr('changeHistory')}</div>
          {history.map((h, i) => <div key={i} className="reg-hist-line">{h}</div>)}
        </div>
      )}
    </MtModal>
  );
}
