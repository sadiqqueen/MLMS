// frontend/src/pages/CentralTrainees.jsx
//
// Central Secretary — Trainees (the CS's only write surface). Trainees are an
// AccountCard grid with a change-history footer. CREATES apply directly (green
// "saved" toast, neutral banner). EDITS and DELETES are approval-gated: they
// upload a required "book of changes" PDF and return 202 { pending:true } — the
// change is NOT applied until a Data Analyzer approves it (RULINGS §E22/§E24).
//
// Contract (API_CONTRACTS.md · CENTRAL SECRETARY):
//   GET    /api/central/trainees?includeInactive=true
//   GET    /api/central/programs        (PD select is filtered per program)
//   GET    /api/central/countries
//   POST   /api/central/trainees        → 201 (direct create) | 409 { capacityFull }
//   PATCH  /api/central/trainees/:id     multipart bookOfChanges + fields → 202 { pending }
//   DELETE /api/central/trainees/:id     multipart bookOfChanges           → 202 { pending }
//   GET    /api/central/change-requests?status=pending
//   PATCH  /api/central/change-requests/:id/cancel
import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccountCard from '../components/AccountCard';
import MtModal from '../components/MtModal';
import PdfDropzone from '../components/PdfDropzone';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconXCircle } from '../components/icons';
import api from '../api/axios';
import './central.css';

const PAGE_SIZE = 9;

const STRINGS = {
  ar: {
    title: 'المتدربون', sub: 'السكرتير المركزي',
    search: 'ابحث بالاسم أو الرقم…', allPrograms: 'كل البرامج',
    allStatus: 'كل الحالات', active: 'نشط', inactive: 'معطّل',
    addTrainee: 'إضافة متدرب', count: n => `${n} متدرب`,
    role: 'متدرب', country: 'الدولة', city: 'المدينة', program: 'البرنامج', email: 'البريد', na: '—',
    // add modal
    newTrainee: 'متدرب جديد', createBanner: 'سيُضاف هذا السجل إلى السجل مباشرة.',
    name: 'الاسم', idNumber: 'الرقم التعريفي', password: 'كلمة المرور', phone: 'الهاتف',
    gender: 'الجنس', selectGender: '— اختر —', male: 'ذكر', female: 'أنثى',
    selectProgram: 'اختر برنامجاً…', pd: 'مدير البرنامج', pdHint: 'مُرشّح حسب البرنامج المختار',
    startDate: 'تاريخ البدء', passwordHint: '(6 أحرف على الأقل)',
    pdName: 'مدير البرنامج', center: 'المركز', capacity: 'السعة',
    cancel: 'إلغاء', create: 'إنشاء متدرب', saving: 'جارٍ الحفظ…', created: 'تمت إضافة المتدرب',
    programFull: 'البرنامج ممتلئ',
    // edit / delete approval
    editTitle: 'تعديل السجل — يتطلب موافقة', deleteTitle: 'حذف السجل — يتطلب موافقة',
    editBanner: 'لا تُطبَّق التعديلات فوراً — يُرسَل طلب التغيير إلى محلّل البيانات للموافقة، مع إرفاق سجل التغييرات المطلوب.',
    deleteBanner: 'لا يُطبَّق الحذف فوراً — يُرسَل طلب الحذف إلى محلّل البيانات للموافقة، مع إرفاق سجل التغييرات المطلوب.',
    deleteConfirm: n => `أنت على وشك طلب حذف حساب المتدرب «${n}». ارفع سجل التغييرات للمتابعة.`,
    requestDeletion: 'طلب الحذف بدلاً من ذلك', backToEdit: '‹ العودة إلى التعديل',
    submitEdit: 'إرسال للموافقة', submitDelete: 'إرسال طلب الحذف', submitting: 'جارٍ الإرسال…',
    noChanges: 'لا توجد تغييرات لإرسالها.',
    submittedEdit: id => `تم إرسال طلب التغيير للموافقة · ${id}`,
    submittedDelete: id => `تم إرسال طلب الحذف للموافقة · ${id}`,
    // pending panel
    pendingTitle: n => `طلبات معلّقة (${n})`, cancelReq: 'إلغاء الطلب',
    reqCancelled: 'تم إلغاء الطلب', typeEdit: 'تعديل', typeDelete: 'حذف',
    none: 'لا يوجد متدربون بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    loadFailed: 'فشل التحميل', saveFailed: 'فشل الحفظ',
  },
  en: {
    title: 'Trainees', sub: 'Central Secretary',
    search: 'Search by name or ID…', allPrograms: 'All programs',
    allStatus: 'All statuses', active: 'Active', inactive: 'Inactive',
    addTrainee: 'Add Trainee', count: n => `${n} trainee${n === 1 ? '' : 's'}`,
    role: 'Trainee', country: 'Country', city: 'City', program: 'Program', email: 'Email', na: '—',
    newTrainee: 'New Trainee', createBanner: 'This record will be added to the registry.',
    name: 'Name', idNumber: 'ID Number', password: 'Password', phone: 'Phone',
    gender: 'Gender', selectGender: '— Select —', male: 'Male', female: 'Female',
    selectProgram: 'Select a program…', pd: 'PD', pdHint: 'Filtered by the chosen program',
    startDate: 'Start date', passwordHint: '(min 6 chars)',
    pdName: 'Program Director', center: 'Center', capacity: 'Capacity',
    cancel: 'Cancel', create: 'Create trainee', saving: 'Saving…', created: 'Trainee added',
    programFull: 'Program is full',
    editTitle: 'Edit record — requires approval', deleteTitle: 'Delete record — requires approval',
    editBanner: 'Edits do not take effect immediately — this change request goes to a Data Analyzer for approval, with the required book of changes attached.',
    deleteBanner: 'Deletions do not take effect immediately — this delete request goes to a Data Analyzer for approval, with the required book of changes attached.',
    deleteConfirm: n => `You are about to request deletion of the trainee account “${n}”. Upload the book of changes to proceed.`,
    requestDeletion: 'Request deletion instead', backToEdit: '‹ Back to edit',
    submitEdit: 'Submit for approval', submitDelete: 'Submit deletion', submitting: 'Submitting…',
    noChanges: 'No changes to submit.',
    submittedEdit: id => `Change request submitted for approval · ${id}`,
    submittedDelete: id => `Delete request submitted for approval · ${id}`,
    pendingTitle: n => `Pending requests (${n})`, cancelReq: 'Cancel request',
    reqCancelled: 'Request cancelled', typeEdit: 'Edit', typeDelete: 'Delete',
    none: 'No trainees yet.', noMatch: 'No matching results.',
    loadFailed: 'Failed to load', saveFailed: 'Save failed',
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────
function idOf(v) { return v?._id || v || ''; }
function reqId(cr) { return 'REQ-' + String(cr?._id || '').slice(-6).toUpperCase(); }
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
// change-history footer lines: "12 Mar 2026 — Phone, City — by Sara Mahmoud"
function historyLines(changeHistory = []) {
  return changeHistory.map(h => {
    const labels = Array.isArray(h.labels) ? h.labels.join(', ') : (h.labels || '');
    return `${fmtDate(h.date)} — ${labels}${h.by ? ` — by ${h.by}` : ''}`.trim();
  });
}
// PD options for a program come from its PD + Sub-PD (RULINGS §D19 — filtered by
// the chosen program; default = the program's programDirectorId).
// TODO(fable): there is no CS "PD candidates" endpoint, so the PD select is
// built from the program payload's programDirectorId + subProgramDirectorId
// (1–2 options). Also: the design's Add-Trainee shows an editable Country* field,
// but country is derived from the chosen program here (read-only ProgramInfo),
// and idNumber is required (no TR- auto-generation). Confirm all three.
function pdOptionsFromProgram(program) {
  if (!program) return [];
  const out = [];
  const seen = new Set();
  [program.programDirectorId, program.subProgramDirectorId].forEach(pd => {
    const pid = idOf(pd);
    if (pd && pid && !seen.has(pid)) { seen.add(pid); out.push({ value: pid, label: pd.name || pid }); }
  });
  return out;
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{ marginBlockStart: 12, background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{msg}</div>;
}

const errStyle = { borderColor: 'var(--danger)', boxShadow: '0 0 0 3px var(--danger-bg)' };

function ProgramInfo({ program, t }) {
  if (!program) return null;
  const co = program.trainingCenterId?.countryId;
  const rows = [
    [t('pdName'), program.programDirectorId?.name || t('na')],
    [t('center'), program.trainingCenterId?.name || t('na')],
    [t('country'), co?.name ? `${co.name}${co.code ? ` (${co.code})` : ''}` : t('na')],
    [t('capacity'), `${program.capacityUsed ?? 0} / ${program.yearlyCapacity ?? 0}`],
  ];
  return (
    <div className="cs-proginfo">
      {rows.map(([k, v]) => (
        <div className="cs-proginfo-row" key={k}>
          <span className="cs-proginfo-k">{k}</span>
          <span className="cs-proginfo-v">{v}</span>
        </div>
      ))}
    </div>
  );
}

// ── Add trainee (direct create) ─────────────────────────────────────────────
function AddTraineeModal({ programs, t, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', idNumber: '', password: '', email: '', phone: '', city: '', gender: '',
    programId: '', pdId: '', startDate: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const program = programs.find(p => p._id === form.programId) || null;
  const pdOptions = useMemo(() => pdOptionsFromProgram(program), [program]);

  function set(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'programId') {
        const p = programs.find(x => x._id === v) || null;
        next.pdId = idOf(p?.programDirectorId) || ''; // default to the program's PD
      }
      return next;
    });
    setErrors(e => ({ ...e, [k]: false })); setApiErr('');
  }

  async function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.idNumber.trim()) e.idNumber = true;
    if (!form.password || form.password.length < 6) e.password = true;
    if (!form.programId) e.programId = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(), idNumber: form.idNumber.trim(), password: form.password,
        programId: form.programId,
      };
      if (form.pdId) payload.pdId = form.pdId;
      if (form.startDate) payload.startDate = form.startDate;
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.city.trim()) payload.city = form.city.trim();
      if (form.gender) payload.gender = form.gender;
      await api.post('/api/central/trainees', payload);
      onSaved();
    } catch (err) {
      const rd = err.response?.data;
      if (err.response?.status === 409 && rd?.capacityFull) setApiErr(`${t('programFull')}: ${rd.used}/${rd.capacity}`);
      else setApiErr(rd?.message || t('saveFailed'));
    } finally { setSaving(false); }
  }

  return (
    <MtModal open title={t('newTrainee')} sub={t('sub')} meta={t('role')} onClose={onClose}
      footer={(
        <>
          <button type="button" className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
          <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('create')}</button>
        </>
      )}>
      <div className="mt-banner cs-modal-banner">{t('createBanner')}</div>
      <div className="mt-field-grid">
        <div className="mt-field">
          <label className="mt-label">{t('name')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" style={errors.name ? errStyle : undefined} value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('idNumber')}<span className="mt-label-req">*</span></label>
          <input className="mt-input mt-input--mono" style={errors.idNumber ? errStyle : undefined} value={form.idNumber} onChange={e => set('idNumber', e.target.value)} placeholder="TR-…" />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('password')}<span className="mt-label-req">*</span> <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>{t('passwordHint')}</span></label>
          <input type="password" autoComplete="new-password" className="mt-input" style={errors.password ? errStyle : undefined} value={form.password} onChange={e => set('password', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('phone')}</label>
          <input className="mt-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('email')}</label>
          <input type="email" className="mt-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@mtms.med" />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('city')}</label>
          <input className="mt-input" value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('gender')}</label>
          <select className="mt-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
            <option value="">{t('selectGender')}</option>
            <option value="male">{t('male')}</option>
            <option value="female">{t('female')}</option>
          </select>
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('startDate')}</label>
          <input type="date" className="mt-input" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">{t('program')}<span className="mt-label-req">*</span></label>
          <select className="mt-select" style={errors.programId ? errStyle : undefined} value={form.programId} onChange={e => set('programId', e.target.value)}>
            <option value="">{t('selectProgram')}</option>
            {programs.map(p => (
              <option key={p._id} value={p._id}>{p.name}{p.trainingCenterId?.name ? ` — ${p.trainingCenterId.name}` : ''}</option>
            ))}
          </select>
          <ProgramInfo program={program} t={t} />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">{t('pd')} <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>{t('pdHint')}</span></label>
          <select className="mt-select" value={form.pdId} onChange={e => set('pdId', e.target.value)} disabled={!form.programId || pdOptions.length === 0}>
            <option value="">{t('selectGender')}</option>
            {pdOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <ErrBox msg={apiErr} />
    </MtModal>
  );
}

// ── Edit / delete with approval (required book-of-changes PDF) ───────────────
function ApprovalModal({ trainee, program, t, onClose, onSubmitted }) {
  const [mode, setMode] = useState('edit'); // 'edit' | 'delete'
  const [form, setForm] = useState({
    name: trainee.name || '', email: trainee.email || '', phone: trainee.phone || '',
    city: trainee.city || '', gender: trainee.gender || '', pdId: idOf(trainee.pdId),
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const pdOptions = useMemo(() => {
    const base = pdOptionsFromProgram(program);
    // Ensure the trainee's current PD is selectable even if not the program PD/Sub-PD.
    const cur = idOf(trainee.pdId);
    if (cur && !base.some(o => o.value === cur)) base.unshift({ value: cur, label: trainee.pdId?.name || cur });
    return base;
  }, [program, trainee]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setApiErr(''); }

  // Only the fields that actually changed are sent (the backend builds the diff).
  function changedFields() {
    const orig = {
      name: trainee.name || '', email: trainee.email || '', phone: trainee.phone || '',
      city: trainee.city || '', gender: trainee.gender || '', pdId: idOf(trainee.pdId),
    };
    const out = {};
    Object.keys(form).forEach(k => { if ((form[k] || '') !== (orig[k] || '')) out[k] = form[k]; });
    return out;
  }

  async function submit() {
    if (!file) return; // submit is disabled without the PDF anyway
    if (mode === 'edit' && Object.keys(changedFields()).length === 0) { setApiErr(t('noChanges')); return; }
    setSaving(true); setApiErr('');
    try {
      const fd = new FormData();
      fd.append('bookOfChanges', file);
      let res;
      if (mode === 'edit') {
        Object.entries(changedFields()).forEach(([k, v]) => fd.append(k, v ?? ''));
        res = await api.patch(`/api/central/trainees/${trainee._id}`, fd);
      } else {
        res = await api.delete(`/api/central/trainees/${trainee._id}`, { data: fd });
      }
      const cr = res.data?.data || {};
      onSubmitted(mode, reqId(cr));
    } catch (err) {
      setApiErr(err.response?.data?.message || t('saveFailed'));
    } finally { setSaving(false); }
  }

  const isEdit = mode === 'edit';
  return (
    <MtModal open title={isEdit ? t('editTitle') : t('deleteTitle')} sub={trainee.name} meta={t('role')} onClose={onClose}
      footer={(
        <>
          <button type="button" className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
          {isEdit
            ? <button type="button" className="mt-btn--danger" onClick={() => { setMode('delete'); setApiErr(''); }}>{t('requestDeletion')}</button>
            : <button type="button" className="mt-btn--ghost" onClick={() => { setMode('edit'); setApiErr(''); }}>{t('backToEdit')}</button>}
          <button type="button" className="mt-btn" onClick={submit} disabled={!file || saving}>
            {saving ? t('submitting') : (isEdit ? t('submitEdit') : t('submitDelete'))}
          </button>
        </>
      )}>
      <div className="mt-banner cs-modal-banner">{isEdit ? t('editBanner') : t('deleteBanner')}</div>

      {isEdit ? (
        <div className="mt-field-grid" style={{ marginBlockEnd: 15 }}>
          <div className="mt-field">
            <label className="mt-label">{t('name')}</label>
            <input className="mt-input" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="mt-field">
            <label className="mt-label">{t('email')}</label>
            <input type="email" className="mt-input" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="mt-field">
            <label className="mt-label">{t('phone')}</label>
            <input className="mt-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div className="mt-field">
            <label className="mt-label">{t('city')}</label>
            <input className="mt-input" value={form.city} onChange={e => set('city', e.target.value)} />
          </div>
          <div className="mt-field">
            <label className="mt-label">{t('gender')}</label>
            <select className="mt-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">{t('selectGender')}</option>
              <option value="male">{t('male')}</option>
              <option value="female">{t('female')}</option>
            </select>
          </div>
          <div className="mt-field">
            <label className="mt-label">{t('pd')}</label>
            <select className="mt-select" value={form.pdId} onChange={e => set('pdId', e.target.value)} disabled={pdOptions.length === 0}>
              <option value="">{t('selectGender')}</option>
              {pdOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="cs-delete-note">{t('deleteConfirm')(trainee.name)}</div>
      )}

      <PdfDropzone file={file} onFile={setFile} onRemove={() => setFile(null)} />
      <ErrBox msg={apiErr} />
    </MtModal>
  );
}

// ── Pending-requests panel (the CS's own queued edit/delete requests) ───────
function PendingPanel({ items, t, onCancel }) {
  if (!items.length) return null;
  return (
    <RevealOnScroll className="mt-card cs-section" style={{ marginBlockStart: 0, marginBlockEnd: 16 }}>
      <div className="mt-card-head mt-card-head--tight">
        <div className="mt-card-title">{t('pendingTitle')(items.length)}</div>
        <div className="mt-divider" />
      </div>
      <div className="cs-pending-list" style={{ marginBlockStart: 12 }}>
        {items.map(cr => {
          const summary = Array.isArray(cr.display) && cr.display.length
            ? cr.display.map(d => `${d.label}: ${d.from ?? '—'} → ${d.to ?? '—'}`).join('  ·  ')
            : (cr.requestType === 'delete' ? t('typeDelete') : t('typeEdit'));
          return (
            <div className="cs-pending-row" key={cr._id}>
              <div className="cs-pending-main">
                <div className="cs-pending-target">
                  <span className="mt-pill mt-pill--pending" style={{ marginInlineEnd: 8 }}>{reqId(cr)}</span>
                  {cr.targetLabel || '—'}
                </div>
                <div className="cs-pending-summary">{summary}</div>
              </div>
              <button type="button" className="mt-btn--small-outline" onClick={() => onCancel(cr)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                <IconXCircle size={14} /> {t('cancelReq')}
              </button>
            </div>
          );
        })}
      </div>
    </RevealOnScroll>
  );
}

function GridSkeleton() {
  return (
    <div>
      <div className="mt-filterbar">
        <div className="skeleton" style={{ height: 38, borderRadius: 8, flex: 1, minWidth: 200, maxWidth: 300 }} />
        <div className="skeleton" style={{ height: 38, width: 160, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 38, width: 140, borderRadius: 8 }} />
      </div>
      <div className="mt-acct-grid">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 210, borderRadius: 12 }} />)}
      </div>
    </div>
  );
}

export default function CentralTrainees() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [trainees, setTrainees] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [countryMap, setCountryMap] = useState({});
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'active' | 'inactive'
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editTrainee, setEditTrainee] = useState(null);

  const programsById = useMemo(() => {
    const m = {}; programs.forEach(p => { m[p._id] = p; }); return m;
  }, [programs]);

  const loadPending = useCallback(async () => {
    try {
      const r = await api.get('/api/central/change-requests', { params: { status: 'pending' }, cache: false });
      setPending(r.data?.data || r.data || []);
    } catch { /* non-fatal */ }
  }, []);

  const loadTrainees = useCallback(async () => {
    try {
      const r = await api.get('/api/central/trainees', { params: { includeInactive: 'true' }, cache: false });
      setTrainees(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'dng'); }
  }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [, , coRes] = await Promise.all([
        loadTrainees(),
        loadPending(),
        api.get('/api/central/countries').catch(() => null),
        api.get('/api/central/programs').then(r => { if (alive) setPrograms(r.data?.data || r.data || []); }).catch(() => {}),
      ]);
      if (alive && coRes) {
        const map = {};
        (coRes.data?.data || coRes.data || []).forEach(c => { map[c._id] = c; });
        setCountryMap(map);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [loadTrainees, loadPending]);

  async function handleCancelRequest(cr) {
    try {
      await api.patch(`/api/central/change-requests/${cr._id}/cancel`);
      setPending(prev => prev.filter(x => x._id !== cr._id));
      showToast(t('reqCancelled'), 'ok');
    } catch (err) { showToast(err.response?.data?.message || t('saveFailed'), 'dng'); }
  }

  // Targets with an in-flight request can't be edited again (one pending per
  // target → 409). Disable their edit pencil; they surface in the pending panel.
  const pendingTargetIds = useMemo(
    () => new Set(pending.map(cr => idOf(cr.targetId)).filter(Boolean)),
    [pending],
  );

  const countryNameOf = useCallback((tr) => {
    const co = tr?.countryId;
    return co?.name || countryMap[idOf(co)]?.name || null;
  }, [countryMap]);

  const filtered = useMemo(() => trainees.filter(tr => {
    if (programFilter && idOf(tr.programId) !== programFilter) return false;
    if (statusFilter === 'active' && tr.isActive === false) return false;
    if (statusFilter === 'inactive' && tr.isActive !== false) return false;
    const q = search.trim().toLowerCase();
    if (q && !((tr.name || '').toLowerCase().includes(q) || (tr.idNumber || '').toLowerCase().includes(q))) return false;
    return true;
  }), [trainees, programFilter, statusFilter, search]);

  useEffect(() => { setPage(1); }, [search, programFilter, statusFilter]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Navbar title={t('title')} subtitle={t('sub')} />
      <main className="mt-content" dir={dir}>
        {loading ? <GridSkeleton /> : (
          <>
            <PendingPanel items={pending} t={t} onCancel={handleCancelRequest} />

            <div className="mt-filterbar">
              <label className="mt-search">
                <SearchIcon />
                <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} aria-label={t('search')} />
              </label>
              <select className="mt-filter" value={programFilter} onChange={e => setProgramFilter(e.target.value)} aria-label={t('program')}>
                <option value="">{t('allPrograms')}</option>
                {programs.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <select className="mt-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label={t('allStatus')}>
                <option value="">{t('allStatus')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
              <span className="mt-filterbar-spacer" />
              <button type="button" className="mt-btn" onClick={() => setAddOpen(true)}>+ {t('addTrainee')}</button>
              <span className="mt-count">{t('count')(filtered.length)}</span>
            </div>

            {pageItems.length === 0 ? (
              <div className="mt-empty">
                <div className="mt-empty-title">{trainees.length === 0 ? t('none') : t('noMatch')}</div>
              </div>
            ) : (
              <div className="mt-acct-grid">
                {pageItems.map((tr, i) => {
                  const hasPending = pendingTargetIds.has(idOf(tr._id));
                  return (
                    <RevealOnScroll key={tr._id} delay={i * 0.06}>
                      <AccountCard
                        name={tr.name}
                        id={tr.idNumber}
                        role={tr.isActive === false ? t('inactive') : t('role')}
                        fields={[
                          { label: t('country'), value: countryNameOf(tr) || t('na') },
                          { label: t('city'), value: tr.city || t('na') },
                          { label: t('program'), value: tr.programId?.name || t('na') },
                          { label: t('email'), value: tr.email || t('na') },
                        ]}
                        canEdit={!hasPending}
                        onEdit={() => setEditTrainee(tr)}
                        history={historyLines(tr.changeHistory)}
                      />
                    </RevealOnScroll>
                  );
                })}
              </div>
            )}

            {filtered.length > PAGE_SIZE && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => p + 1)} />
            )}
          </>
        )}

        {addOpen && (
          <AddTraineeModal programs={programs} t={t}
            onClose={() => setAddOpen(false)}
            onSaved={() => { setAddOpen(false); loadTrainees(); showToast(t('created'), 'ok'); }} />
        )}

        {editTrainee && (
          <ApprovalModal
            trainee={editTrainee}
            program={programsById[idOf(editTrainee.programId)] || null}
            t={t}
            onClose={() => setEditTrainee(null)}
            onSubmitted={(mode, id) => {
              setEditTrainee(null);
              showToast(mode === 'delete' ? t('submittedDelete')(id) : t('submittedEdit')(id), 'warn');
              loadPending();
            }} />
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
