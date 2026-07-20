// frontend/src/pages/LogBook.jsx
//
// Trainee procedure log book: record entries (date, procedure type, notes) and
// track their review status (pending / signed off / rejected). Pending entries
// can be deleted. Contract (backend/routes/logbook.js):
//   GET    /api/logbook/mine
//   POST   /api/logbook   { date, procedureType, notes }
//   DELETE /api/logbook/:id   (pending entries only)
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import MtToastHost, { useMtToast } from '../components/MtToast';
import Sk from '../components/Skeleton';
import { IconTrash, IconPlus, NavIcon } from '../components/icons';
import api from '../api/axios';
import './trainee.css';

const STRINGS = {
  ar: {
    title: 'سجل الإجراءات',
    intro: 'سجّل الإجراءات التي أجريتها. يراجعها المُقيّم ويعتمدها أو يرفضها.',
    newEntry: 'إضافة إدخال جديد',
    fDate: 'التاريخ', fProcedure: 'نوع الإجراء', fNotes: 'ملاحظات',
    procedurePh: 'مثال: بزل قطني', notesPh: 'ملاحظات إضافية (اختياري)',
    add: 'إضافة إلى السجل', adding: 'جارٍ الإضافة…',
    myEntries: 'سجلّي', none: 'لا توجد إجراءات بعد.',
    statusPending: 'قيد المراجعة', statusSigned: 'معتمد', statusRejected: 'مرفوض',
    reviewNote: 'ملاحظة المراجعة', delete: 'حذف', deleteConfirm: 'حذف هذا الإدخال؟',
    added: 'تمت إضافة الإدخال', deleted: 'تم حذف الإدخال',
    dateReq: 'التاريخ مطلوب', procedureReq: 'نوع الإجراء مطلوب', saveFailed: 'فشل الحفظ',
  },
  en: {
    title: 'Log Book',
    intro: 'Record the procedures you performed. Your evaluator reviews and signs them off or rejects them.',
    newEntry: 'New log book entry',
    fDate: 'Date', fProcedure: 'Procedure type', fNotes: 'Notes',
    procedurePh: 'e.g. Lumbar puncture', notesPh: 'Additional notes (optional)',
    add: 'Add to log book', adding: 'Adding…',
    myEntries: 'My entries', none: 'No entries yet.',
    statusPending: 'Pending', statusSigned: 'Signed off', statusRejected: 'Rejected',
    reviewNote: 'Review note', delete: 'Delete', deleteConfirm: 'Delete this entry?',
    added: 'Entry added', deleted: 'Entry deleted',
    dateReq: 'Date is required', procedureReq: 'Procedure type is required', saveFailed: 'Save failed',
  },
};

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusPill({ status, t }) {
  const map = {
    pending:    { cls: 'mt-pill--warn',     label: t('statusPending') },
    signed_off: { cls: 'mt-pill--active',   label: t('statusSigned') },
    rejected:   { cls: 'mt-pill--rejected', label: t('statusRejected') },
  };
  const s = map[status] || map.pending;
  return <span className={`mt-pill ${s.cls}`}>{s.label}</span>;
}

export default function LogBook() {
  const { user } = useAuth();
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), procedureType: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { toasts, showToast } = useMtToast();

  function load() {
    api.get('/api/logbook/mine', { cache: false })
      .then(r => setItems(r.data?.data || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (user) load(); }, [user]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.date) errs.date = true;
    if (!form.procedureType.trim()) errs.procedureType = true;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const res = await api.post('/api/logbook', {
        date: form.date,
        procedureType: form.procedureType.trim(),
        notes: form.notes.trim(),
      });
      const created = res.data?.data || res.data;
      setItems(prev => [created, ...prev]);
      setForm({ date: new Date().toISOString().slice(0, 10), procedureType: '', notes: '' });
      showToast(t('added'), 'ok');
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'dng');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.delete(`/api/logbook/${id}`);
      setItems(prev => prev.filter(x => x._id !== id));
      showToast(t('deleted'), 'ok');
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'dng');
    }
  }

  return (
    <>
      <Navbar title={t('title')} />
      <main className="mt-content" dir={dir}>

        <div className="mt-card" style={{ marginBlockEnd: 18 }}>
          <div className="mt-card-head mt-card-head--tight">
            <div style={{ minWidth: 0 }}>
              <div className="mt-card-title">{t('newEntry')}</div>
              <div className="mt-card-sub">{t('intro')}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-field-grid" style={{ marginBlockStart: 16, alignItems: 'end' }}>
            <div className="mt-field">
              <label className="mt-label">{t('fDate')} <span className="mt-label-req">*</span></label>
              <input type="date" className="mt-input" style={{ borderColor: errors.date ? 'var(--danger)' : undefined }}
                value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="mt-field">
              <label className="mt-label">{t('fProcedure')} <span className="mt-label-req">*</span></label>
              <input className="mt-input" style={{ borderColor: errors.procedureType ? 'var(--danger)' : undefined }}
                value={form.procedureType} placeholder={t('procedurePh')} onChange={e => set('procedureType', e.target.value)} />
            </div>
            <div className="mt-field mt-field-full">
              <label className="mt-label">{t('fNotes')}</label>
              <textarea className="mt-textarea" value={form.notes} placeholder={t('notesPh')} onChange={e => set('notes', e.target.value)} />
            </div>
            <div className="mt-field-full">
              <button type="submit" className="mt-btn" disabled={saving}>
                <IconPlus size={15} /> {saving ? t('adding') : t('add')}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-card">
          <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
            <div className="mt-card-title">{t('myEntries')}</div>
            <span className="mt-count">{items.length}</span>
          </div>

          {loading ? (
            <div className="tr-rows">
              {[0, 1, 2].map(i => <Sk key={i} h={64} r={10} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="mt-empty">
              <span className="mt-empty-icon"><NavIcon name="book" size={24} /></span>
              <div className="mt-empty-title">{t('none')}</div>
            </div>
          ) : (
            <div className="tr-rows">
              {items.map(it => (
                <div key={it._id} className="tr-row">
                  <div className="tr-row-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="tr-row-title">{it.procedureType}</span>
                      <StatusPill status={it.status} t={t} />
                    </div>
                    <div className="tr-row-meta">{fmt(it.date)}{it.notes ? ` · ${it.notes}` : ''}</div>
                    {it.status === 'rejected' && it.reviewNote && (
                      <div style={{ fontSize: 12, color: 'var(--danger)', marginBlockStart: 6 }}>{t('reviewNote')}: {it.reviewNote}</div>
                    )}
                  </div>
                  {it.status === 'pending' && (
                    <button type="button" className="mt-icon-action mt-icon-action--danger" onClick={() => handleDelete(it._id)}
                      title={t('delete')} aria-label={t('delete')}>
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
