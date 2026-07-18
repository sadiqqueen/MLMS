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
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import { IconTrash, IconPlus } from '../components/icons';
import api from '../api/axios';

const STRINGS = {
  ar: {
    title: 'سجل الإجراءات',
    intro: 'سجّل الإجراءات التي أجريتها. يراجعها مدربك ويعتمدها أو يرفضها.',
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
    intro: 'Record the procedures you performed. Your trainer reviews and signs them off or rejects them.',
    fDate: 'Date', fProcedure: 'Procedure Type', fNotes: 'Notes',
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

function StatusChip({ status, t }) {
  const map = {
    pending:    { label: t('statusPending'),  bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
    signed_off: { label: t('statusSigned'),   bg: 'var(--success-bg)', fg: 'var(--success-fg)' },
    rejected:   { label: t('statusRejected'), bg: 'var(--danger-bg)',  fg: 'var(--danger-fg)' },
  };
  const s = map[status] || map.pending;
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.fg }}>{s.label}</span>;
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
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

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
      showToast(t('added'));
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'error');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.delete(`/api/logbook/${id}`);
      setItems(prev => prev.filter(x => x._id !== id));
      showToast(t('deleted'));
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'error');
    }
  }

  const fieldStyle = { width: '100%', boxSizing: 'border-box', height: 42, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 };

  return (
    <>
      <Navbar />
      <main className="main" dir={dir}>
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>{t('title')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('intro')}</div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>{t('fDate')} *</label>
              <input type="date" style={{ ...fieldStyle, borderColor: errors.date ? 'var(--danger)' : 'var(--border)' }} value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>{t('fProcedure')} *</label>
              <input style={{ ...fieldStyle, borderColor: errors.procedureType ? 'var(--danger)' : 'var(--border)' }} value={form.procedureType} placeholder={t('procedurePh')} onChange={e => set('procedureType', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>{t('fNotes')}</label>
              <textarea style={{ ...fieldStyle, height: 'auto', minHeight: 70, padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit' }} value={form.notes} placeholder={t('notesPh')} onChange={e => set('notes', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn-purple" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconPlus size={15} /> {saving ? t('adding') : t('add')}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>
            {t('myEntries')}
            <span className="badge badge-blue" style={{ marginInlineStart: 8 }}>{items.length}</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => <Sk key={i} h={64} r={10} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 44, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>{t('none')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(it => (
                <div key={it._id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface-2)', borderInlineStart: '4px solid var(--accent)' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{it.procedureType}</span>
                      <StatusChip status={it.status} t={t} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{fmt(it.date)}{it.notes ? ` · ${it.notes}` : ''}</div>
                    {it.status === 'rejected' && it.reviewNote && (
                      <div style={{ fontSize: 12, color: 'var(--danger-fg)', marginTop: 6 }}>{t('reviewNote')}: {it.reviewNote}</div>
                    )}
                  </div>
                  {it.status === 'pending' && (
                    <button type="button" onClick={() => handleDelete(it._id)} title={t('delete')} aria-label={t('delete')}
                      style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--danger-fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
