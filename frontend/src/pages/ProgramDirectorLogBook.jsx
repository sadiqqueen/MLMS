// frontend/src/pages/ProgramDirectorLogBook.jsx
//
// PD Log Book sign-off queue (lists_views.md §7, RULINGS §D20). The Program
// Director is now a log-book reviewer: each pending entry is a card with a
// per-entry note field + Sign off / Reject; a decision resolves the footer to a
// status chip in place. Wired to the shared logbook review endpoints:
//   GET   /api/logbook/review?status=pending   (roles: supervisor, PD, sub_pd)
//   PATCH /api/logbook/:id/review { status, reviewNote }   (PD acts; sub_pd cannot)
// Note-required-on-reject is enforced UI-side (the prototype only shows the copy;
// proto_modals_rules §281). Sub-PD never reaches this route (nav + App.jsx gate),
// so acting is gated on role === 'program_director'.
//
// Backend field map (LogBookEntry): procedureType = the procedure name — used as
// the card TITLE (it is also the trainee-side title); notes = the clinical note
// text; traineeId is populated (name, idNumber, studentId). The model has NO
// separate category or rotation field, so the design's category/rotation chips
// are not rendered (showing procedureType twice would just duplicate the title).
// The category filter narrows by procedureType — the closest categorical field.
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import './pd.css';

const STRINGS = {
  ar: {
    count: (n) => `${n} إدخالات بانتظار التوقيع`, allTrainees: 'كل المتدربين', allCategories: 'كل الأنواع',
    notePh: 'ملاحظة — مطلوبة عند الرفض…', signOff: 'توقيع', reject: 'رفض',
    signedChip: '✓ تم التوقيع — خُتم في دفتر المتدرب', rejectedChip: '✕ مرفوض — أُعيد إلى المتدرب مع ملاحظتك', pendingChip: 'بانتظار المراجعة',
    signedToast: (e) => `تم توقيع الإدخال — ${e}`, rejectedToast: (n) => `تم رفض الإدخال — أُعيد إلى ${n}`,
    noteRequired: 'الملاحظة مطلوبة عند الرفض.', empty: 'لا توجد إدخالات بانتظار التوقيع.', loadFailed: 'فشل التحميل', actionFailed: 'فشل الإجراء', entry: 'إدخال',
  },
  en: {
    count: (n) => `${n} entries awaiting sign-off`, allTrainees: 'All trainees', allCategories: 'All categories',
    notePh: 'Note — required on reject…', signOff: 'Sign off', reject: 'Reject',
    signedChip: '✓ Signed off — stamped to the trainee’s logbook', rejectedChip: '✕ Rejected — returned to the trainee with your note', pendingChip: 'Pending review',
    signedToast: (e) => `Entry signed off — ${e}`, rejectedToast: (n) => `Entry rejected — returned to ${n}`,
    noteRequired: 'A note is required to reject.', empty: 'No entries awaiting sign-off.', loadFailed: 'Failed to load', actionFailed: 'Action failed', entry: 'entry',
  },
};

function initialsOf(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function traineeOf(e) { return e.traineeId || {}; }

export default function ProgramDirectorLogBook() {
  const { user: me } = useAuth();
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const canAct = me?.role === 'program_director';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});   // entryId → review-note draft
  const [busy, setBusy] = useState(null);
  const [traineeFilter, setTraineeFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/logbook/review', { params: { status: 'pending' }, cache: false });
      setEntries(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'dng'); }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function decide(entry, status) {
    const note = (notes[entry._id] || '').trim();
    if (status === 'rejected' && !note) { showToast(t('noteRequired'), 'dng'); return; }
    setBusy(entry._id);
    try {
      const res = await api.patch(`/api/logbook/${entry._id}/review`, { status, reviewNote: note });
      const updated = res.data?.data || res.data || {};
      // Keep the row in place with its populated trainee so the resolved card
      // still shows the name/id (the review response omits traineeId populate).
      setEntries((prev) => prev.map((e) => (e._id === entry._id ? { ...e, ...updated, traineeId: e.traineeId } : e)));
      if (status === 'signed_off') showToast(t('signedToast')(entry.procedureType || t('entry')), 'ok');
      else showToast(t('rejectedToast')(traineeOf(entry).name || '—'), 'dng');
    } catch (err) {
      showToast(err.response?.data?.message || t('actionFailed'), 'dng');
    } finally { setBusy(null); }
  }

  // Filter option pools (from the loaded queue).
  const traineeOpts = [...new Map(entries.map((e) => [traineeOf(e)._id, traineeOf(e)]).filter(([id]) => id)).values()];
  const catOpts = [...new Set(entries.map((e) => e.procedureType).filter(Boolean))].sort();

  const shown = entries.filter((e) => {
    if (traineeFilter !== 'all' && traineeOf(e)._id !== traineeFilter) return false;
    if (catFilter !== 'all' && e.procedureType !== catFilter) return false;
    return true;
  });
  const pendingCount = shown.filter((e) => e.status === 'pending').length;

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content"><MtSkeleton stats={0} charts={0} table /></main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-filterbar">
          <span className="mt-count">{t('count')(pendingCount)}</span>
          <span className="mt-filterbar-spacer" />
          <select className="mt-filter" value={traineeFilter} onChange={(e) => setTraineeFilter(e.target.value)} aria-label={t('allTrainees')}>
            <option value="all">{t('allTrainees')}</option>
            {traineeOpts.map((tr) => <option key={tr._id} value={tr._id}>{tr.name}</option>)}
          </select>
          <select className="mt-filter" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label={t('allCategories')}>
            <option value="all">{t('allCategories')}</option>
            {catOpts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {shown.length === 0 ? (
          <div className="mt-empty" style={{ padding: 48 }}><div className="mt-empty-title">{t('empty')}</div></div>
        ) : (
          <div className="pd-signlist">
            {shown.map((e, i) => {
              const tr = traineeOf(e);
              const sub = [tr.name, tr.studentId || tr.idNumber].filter(Boolean).join(' · ');
              return (
                <RevealOnScroll key={e._id} delay={i * 0.07} className="pd-sign">
                  <div className="pd-sign-head">
                    <div className="pd-sign-avatar">{initialsOf(tr.name)}</div>
                    <div className="pd-sign-idwrap">
                      <div className="pd-sign-title" title={e.procedureType}>{e.procedureType || t('entry')}</div>
                      <div className="pd-sign-sub">{sub || '—'}</div>
                    </div>
                    <div className="pd-sign-head-spacer" />
                    <span className="pd-sign-date">{fmtDate(e.date)}</span>
                  </div>

                  {e.notes && <div className="pd-sign-note">{e.notes}</div>}

                  <div className="pd-sign-foot">
                    {e.status === 'signed_off' ? (
                      <span className="pd-sign-chip mt-pill--active">{t('signedChip')}</span>
                    ) : e.status === 'rejected' ? (
                      <span className="pd-sign-chip mt-pill--rejected">{t('rejectedChip')}</span>
                    ) : canAct ? (
                      <>
                        <input
                          className="mt-input"
                          placeholder={t('notePh')}
                          value={notes[e._id] || ''}
                          onChange={(ev) => setNotes((n) => ({ ...n, [e._id]: ev.target.value }))}
                          aria-label={t('notePh')}
                        />
                        <button type="button" className="mt-btn" disabled={busy === e._id} onClick={() => decide(e, 'signed_off')}>{t('signOff')}</button>
                        <button type="button" className="mt-btn--danger" disabled={busy === e._id} onClick={() => decide(e, 'rejected')}>{t('reject')}</button>
                      </>
                    ) : (
                      <span className="pd-sign-chip mt-pill--pending">{t('pendingChip')}</span>
                    )}
                  </div>
                </RevealOnScroll>
              );
            })}
          </div>
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
