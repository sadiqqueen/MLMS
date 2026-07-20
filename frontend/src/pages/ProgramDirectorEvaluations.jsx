// frontend/src/pages/ProgramDirectorEvaluations.jsx
//
// Program Director evaluations (lists_views.md §PD evaluations, proto_modals §New
// evaluation). A table of the PD's authored evaluations + a "New evaluation"
// modal (proto field-set). Restyled to the mt- system. program_director is now
// an evaluation author (RULINGS §D20 / API_CONTRACTS §PD). Direct create — PD
// writes are NOT approval-gated (that is clerk/CS only, §E22).
//   GET  /api/program-director/evaluations                    → authored evals
//   GET  /api/program-director/trainees                       → modal Trainee pool
//   POST /api/program-director/trainees/:id/evaluations       → create (201)
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import MtModal from '../components/MtModal';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import Pagination from '../components/Pagination';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import './pd.css';

const PAGE_SIZE = 10;
const EVAL_TYPES = ['End-of-rotation', 'Mid-year assessment', 'Skills OSCE', 'Probation review'];
const ROTATIONS = ['ICU', 'Wards', 'Clinic', 'CCU', 'Emergency'];
const RESULTS = ['Pass', 'Borderline', 'Fail'];

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

const STRINGS = {
  ar: {
    countCompleted: (n) => `${n} مكتملة`, newEval: '+ تقييم جديد', searchPh: 'ابحث باسم المتدرب…',
    allResults: 'كل النتائج', colTrainee: 'المتدرب', colEval: 'التقييم', colRotation: 'التدوير', colDate: 'التاريخ', colResult: 'النتيجة', colStatus: 'الحالة',
    completed: 'مكتمل', empty: 'لا توجد تقييمات بعد.', noMatch: 'لا يوجد تطابق مع بحثك.', loadFailed: 'فشل التحميل',
    mTitle: 'تقييم جديد', mSub: 'إنشاء تقييم لمتدرب', mMeta: 'مدير البرنامج',
    fTrainee: 'المتدرب', fType: 'نوع التقييم', fRotation: 'التدوير', fDate: 'التاريخ', fResult: 'النتيجة', fComments: 'الملاحظات',
    selectTrainee: '— اختر متدربًا —', selectType: '— اختر النوع —', selectRotation: '— لا شيء —', commentsPh: 'نقاط القوة والملاحظات والتوصيات…',
    cancel: 'إلغاء', save: 'حفظ التقييم', saved: 'تم حفظ التقييم', reqFields: 'يرجى اختيار المتدرب والنوع والتاريخ.', saveFailed: 'فشل حفظ التقييم',
  },
  en: {
    countCompleted: (n) => `${n} completed`, newEval: '+ New evaluation', searchPh: 'Search by trainee name…',
    allResults: 'All results', colTrainee: 'Trainee', colEval: 'Evaluation', colRotation: 'Rotation', colDate: 'Date', colResult: 'Result', colStatus: 'Status',
    completed: 'Completed', empty: 'No evaluations yet.', noMatch: 'No match for your search.', loadFailed: 'Failed to load',
    mTitle: 'New evaluation', mSub: 'Create a trainee evaluation', mMeta: 'Program Director',
    fTrainee: 'Trainee', fType: 'Evaluation type', fRotation: 'Rotation', fDate: 'Date', fResult: 'Result', fComments: 'Comments',
    selectTrainee: '— Select a trainee —', selectType: '— Select type —', selectRotation: '— None —', commentsPh: 'Observed strengths, gaps, and recommendations…',
    cancel: 'Cancel', save: 'Save evaluation', saved: 'Evaluation saved', reqFields: 'Please choose a trainee, type, and date.', saveFailed: 'Failed to save evaluation',
  },
};

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function evName(ev) { return ev.student?.name || ev.traineeId?.name || ev.evaluateeId?.name || '—'; }
function resultTone(r) {
  const v = String(r || '').toLowerCase();
  if (v.startsWith('pass') || v === 'competent') return 'mt-pill--active';
  if (v.startsWith('fail') || v === 'not-competent') return 'mt-pill--rejected';
  if (v) return 'mt-pill--warn';
  return 'mt-pill--neutral';
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { traineeId: '', evaluationType: '', rotation: '', date: todayISO(), result: '', comments: '' };

export default function ProgramDirectorEvaluations() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [evals, setEvals] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/program-director/evaluations'),
      api.get('/api/program-director/trainees'),
    ]).then(([e, tr]) => {
      if (e.status === 'fulfilled') {
        const d = e.value.data?.data || e.value.data || [];
        setEvals(Array.isArray(d) ? d : []);
      } else showToast(t('loadFailed'), 'dng');
      if (tr.status === 'fulfilled') {
        const d = tr.value.data?.data || tr.value.data || {};
        setTrainees(Array.isArray(d) ? d : (d.trainees || []));
      }
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Only trainee-subject evaluations belong in this list (a legacy row with no
  // evaluateeRole is treated as a trainee; supervisor rows are excluded).
  const traineeEvals = evals.filter((ev) => (ev.evaluateeRole || 'trainee') !== 'supervisor');
  const completedCount = traineeEvals.length;

  const filtered = traineeEvals.filter((ev) => {
    if (resultFilter !== 'all' && String(ev.grade || '').toLowerCase() !== resultFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || evName(ev).toLowerCase().includes(q) || (ev.evaluationType || '').toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function openModal() { setForm(EMPTY_FORM); setModal(true); }
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.traineeId || !form.evaluationType || !form.date) { showToast(t('reqFields'), 'dng'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/api/program-director/trainees/${form.traineeId}/evaluations`, {
        evaluationType: form.evaluationType,
        type: form.evaluationType,
        date: form.date,
        grade: form.result,
        comments: form.comments,
        notes: form.comments,
        formData: { rotation: form.rotation },
      });
      const created = res.data?.data || res.data;
      if (created && typeof created === 'object') setEvals((prev) => [created, ...prev]);
      showToast(t('saved'), 'ok');
      setModal(false);
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'dng');
    } finally { setSaving(false); }
  }

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
          <span className="mt-count">{t('countCompleted')(completedCount)}</span>
          <span className="mt-filterbar-spacer" />
          <span className="mt-search">
            <SearchIcon />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('searchPh')} aria-label={t('searchPh')} />
          </span>
          <select className="mt-filter" value={resultFilter} onChange={(e) => { setResultFilter(e.target.value); setPage(1); }} aria-label={t('allResults')}>
            <option value="all">{t('allResults')}</option>
            {RESULTS.map((r) => <option key={r} value={r.toLowerCase()}>{r}</option>)}
          </select>
          <button type="button" className="mt-btn" onClick={openModal}>{t('newEval')}</button>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-empty" style={{ padding: 48 }}>
            <div className="mt-empty-title">{traineeEvals.length === 0 ? t('empty') : t('noMatch')}</div>
          </div>
        ) : (
          <RevealOnScroll className="mt-card" style={{ padding: 0 }}>
            <div className="mt-table-wrap">
              <table className="mt-table mt-table--stack">
                <thead>
                  <tr>
                    <th className="mt-th">{t('colTrainee')}</th>
                    <th className="mt-th">{t('colEval')}</th>
                    <th className="mt-th">{t('colRotation')}</th>
                    <th className="mt-th">{t('colDate')}</th>
                    <th className="mt-th">{t('colResult')}</th>
                    <th className="mt-th">{t('colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((ev) => (
                    <tr key={ev._id}>
                      <td className="mt-td mt-td--name" data-label={t('colTrainee')}>{evName(ev)}</td>
                      <td className="mt-td" data-label={t('colEval')}>{ev.evaluationType || '—'}</td>
                      <td className="mt-td mt-td--muted" data-label={t('colRotation')}>{ev.formData?.rotation || '—'}</td>
                      <td className="mt-td mt-td--muted" data-label={t('colDate')}>{fmtDate(ev.date || ev.createdAt)}</td>
                      <td className="mt-td" data-label={t('colResult')}>
                        {ev.grade ? <span className={`mt-pill ${resultTone(ev.grade)}`}>{ev.grade}</span> : '—'}
                      </td>
                      <td className="mt-td" data-label={t('colStatus')}><span className="mt-pill mt-pill--active">{t('completed')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RevealOnScroll>
        )}
        {filtered.length > 0 && (
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPrev={() => setPage((n) => Math.max(1, n - 1))} onNext={() => setPage((n) => Math.min(totalPages, n + 1))} />
        )}

        <MtModal
          open={modal}
          title={t('mTitle')}
          sub={t('mSub')}
          meta={t('mMeta')}
          onClose={() => setModal(false)}
          footer={<>
            <button type="button" className="mt-btn--cancel" onClick={() => setModal(false)}>{t('cancel')}</button>
            <button type="button" className="mt-btn" onClick={save} disabled={saving}>{t('save')}</button>
          </>}
        >
          <div className="mt-field-grid">
            <div className="mt-field">
              <label className="mt-label">{t('fTrainee')}<span className="mt-label-req">*</span></label>
              <select className="mt-select" value={form.traineeId} onChange={(e) => setField('traineeId', e.target.value)}>
                <option value="">{t('selectTrainee')}</option>
                {trainees.map((tr) => <option key={tr._id} value={tr._id}>{tr.name}{tr.studentId ? ` · ${tr.studentId}` : ''}</option>)}
              </select>
            </div>
            <div className="mt-field">
              <label className="mt-label">{t('fType')}<span className="mt-label-req">*</span></label>
              <select className="mt-select" value={form.evaluationType} onChange={(e) => setField('evaluationType', e.target.value)}>
                <option value="">{t('selectType')}</option>
                {EVAL_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div className="mt-field">
              <label className="mt-label">{t('fRotation')}</label>
              <select className="mt-select" value={form.rotation} onChange={(e) => setField('rotation', e.target.value)}>
                <option value="">{t('selectRotation')}</option>
                {ROTATIONS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div className="mt-field">
              <label className="mt-label">{t('fDate')}<span className="mt-label-req">*</span></label>
              <input type="date" className="mt-input" value={form.date} onChange={(e) => setField('date', e.target.value)} />
            </div>
            <div className="mt-field mt-field-full">
              <label className="mt-label">{t('fResult')}</label>
              <div className="mt-radio-group">
                {RESULTS.map((r) => (
                  <label key={r} className="mt-check-label">
                    <input type="radio" className="mt-check" name="pd-eval-result" checked={form.result === r} onChange={() => setField('result', r)} />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-field mt-field-full">
              <label className="mt-label">{t('fComments')}</label>
              <textarea className="mt-textarea" value={form.comments} onChange={(e) => setField('comments', e.target.value)} placeholder={t('commentsPh')} />
            </div>
          </div>
        </MtModal>

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
