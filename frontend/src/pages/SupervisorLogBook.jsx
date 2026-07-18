// frontend/src/pages/SupervisorLogBook.jsx
//
// Trainer's log-book review queue for his assigned trainees. Defaults to pending
// entries; a toggle shows all. Each entry can be signed off or rejected (with a
// note). Contract (backend/routes/logbook.js):
//   GET   /api/logbook/review?status=pending|all
//   PATCH /api/logbook/:id/review  { status:'signed_off'|'rejected', reviewNote }
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import { IconCheck, IconXCircle } from '../components/icons';
import api from '../api/axios';

const STRINGS = {
  ar: {
    filterPending: 'قيد المراجعة', filterAll: 'الكل',
    colTrainee: 'المتدرب', colDate: 'التاريخ', colProcedure: 'نوع الإجراء', colNotes: 'ملاحظات', colStatus: 'الحالة', colAction: 'الإجراء',
    statusPending: 'قيد المراجعة', statusSigned: 'معتمد', statusRejected: 'مرفوض',
    signOff: 'اعتماد', reject: 'رفض', rejectPrompt: 'سبب الرفض (اختياري):',
    none: 'لا توجد إدخالات.', idLabel: 'الرقم التعريفي',
    signed: 'تم اعتماد الإدخال', rejected: 'تم رفض الإدخال', loadFailed: 'فشل التحميل', actionFailed: 'فشل الإجراء',
  },
  en: {
    filterPending: 'Pending', filterAll: 'All',
    colTrainee: 'Trainee', colDate: 'Date', colProcedure: 'Procedure', colNotes: 'Notes', colStatus: 'Status', colAction: 'Action',
    statusPending: 'Pending', statusSigned: 'Signed off', statusRejected: 'Rejected',
    signOff: 'Sign off', reject: 'Reject', rejectPrompt: 'Reason for rejection (optional):',
    none: 'No entries.', idLabel: 'ID',
    signed: 'Entry signed off', rejected: 'Entry rejected', loadFailed: 'Failed to load', actionFailed: 'Action failed',
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

export default function SupervisorLogBook() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending | all
  const [busy, setBusy] = useState(null);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/logbook/review', { params: { status: filter }, cache: false });
      setEntries(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'error'); }
    setLoading(false);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function review(entry, status) {
    let reviewNote = '';
    if (status === 'rejected') {
      const note = window.prompt(t('rejectPrompt'), '');
      if (note === null) return; // cancelled
      reviewNote = note;
    }
    setBusy(entry._id);
    try {
      const res = await api.patch(`/api/logbook/${entry._id}/review`, { status, reviewNote });
      const updated = res.data?.data || res.data || {};
      // The review response does not re-populate traineeId — keep the row's
      // existing populated trainee so the name/id stay visible in the "all" view.
      setEntries(prev => filter === 'pending'
        ? prev.filter(e => e._id !== entry._id)
        : prev.map(e => e._id === entry._id ? { ...e, ...updated, traineeId: e.traineeId } : e));
      showToast(status === 'signed_off' ? t('signed') : t('rejected'));
    } catch (err) {
      showToast(err.response?.data?.message || t('actionFailed'), 'error');
    } finally { setBusy(null); }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk w={200} h={36} r={8} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(6)].map((_, i) => (<tr key={i}><td><Sk w={140} h={13} /></td><td><Sk w={80} h={13} /></td><td><Sk w={120} h={13} /></td><td><Sk w={140} h={13} /></td><td><Sk w={70} h={22} r={20} /></td><td><Sk w={120} h={30} r={8} /></td></tr>))}
            </tbody></table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar">
            <div className="filter-tabs">
              {[['pending', t('filterPending')], ['all', t('filterAll')]].map(([val, label]) => (
                <button key={val} type="button" className={`filter-tab${filter === val ? ' active' : ''}`} onClick={() => setFilter(val)}>{label}</button>
              ))}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{entries.length}</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>{t('colTrainee')}</th><th>{t('colDate')}</th><th>{t('colProcedure')}</th><th>{t('colNotes')}</th><th>{t('colStatus')}</th><th>{t('colAction')}</th></tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t('none')}</td></tr>
                )}
                {entries.map(e => (
                  <tr key={e._id}>
                    <td>
                      <strong>{e.traineeId?.name || '—'}</strong>
                      {(e.traineeId?.studentId || e.traineeId?.idNumber) && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('idLabel')}: {e.traineeId.studentId || e.traineeId.idNumber}</div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt(e.date)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{e.procedureType}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 220 }}>{e.notes || '—'}</td>
                    <td><StatusChip status={e.status} t={t} /></td>
                    <td>
                      {e.status === 'pending' ? (
                        <div className="action-btns">
                          <button className="btn-action" title={t('signOff')} aria-label={t('signOff')} disabled={busy === e._id}
                            onClick={() => review(e, 'signed_off')}
                            style={{ color: 'var(--success-fg)' }}><IconCheck size={16} /></button>
                          <button className="btn-action" title={t('reject')} aria-label={t('reject')} disabled={busy === e._id}
                            onClick={() => review(e, 'rejected')}
                            style={{ color: 'var(--danger-fg)' }}><IconXCircle size={16} /></button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
