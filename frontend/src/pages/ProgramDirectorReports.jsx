// frontend/src/pages/ProgramDirectorReports.jsx
//
// Program Director final-report grading (lists_views.md §PD reports; the proto
// "Generate report" action maps to this EXISTING feature per RULINGS §32 —
// restyle only, no new semantics). Restyled to the mt- system + tokens (the old
// file was heavy inline hex). The ASR grading modal keeps its clinical English
// copy; page chrome is bilingual. PD-only route.
//   GET   /api/program-director/reports          → final reports
//   PATCH /api/program-director/reports/:id/grade → grade (direct, PD write)
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import Pagination from '../components/Pagination';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconEye } from '../components/icons';
import api from '../api/axios';
import './pd.css';

const PAGE_SIZE = 10;

// Token-driven ASR rating scale (no hardcoded hex — RULINGS §A).
const ASR_CRITERIA = [
  'History Taking', 'Physical Examination', 'Clinical Reasoning', 'Diagnosis & Management',
  'Communication with Patient', 'Communication with Team', 'Professionalism & Ethics', 'Time Management',
];
const RATINGS = [
  { key: 'na',    label: 'N/A',            color: 'var(--text-2)' },
  { key: 'below', label: 'Below Standard', color: 'var(--danger)' },
  { key: 'meets', label: 'Meets Standard', color: 'var(--warning)' },
  { key: 'above', label: 'Above Standard', color: 'var(--success)' },
];
const LETTER_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

const STRINGS = {
  ar: {
    total: 'إجمالي التقارير النهائية', pending: 'بانتظار التقييم', graded: 'مُقيَّمة',
    searchPh: 'ابحث باسم المتدرب أو عنوان التقرير…', allStatus: 'كل الحالات', fPending: 'بانتظار', fGraded: 'مُقيَّمة',
    colTrainee: 'المتدرب', colTitle: 'عنوان التقرير', colDate: 'التاريخ', colFile: 'الملف', colStatus: 'الحالة', colAction: 'الإجراء',
    grade: 'تقييم', none: 'لا يوجد', statusGraded: 'مُقيَّم', statusPending: 'بانتظار',
    empty: 'لا توجد تقارير نهائية في اختصاصك بعد.', noMatch: 'لا يوجد تطابق مع بحثك.', loadFailed: 'فشل تحميل التقارير', gradedToast: 'تم تقييم التقرير — أُبلغ المتدرب',
  },
  en: {
    total: 'Total final reports', pending: 'Pending grading', graded: 'Graded',
    searchPh: 'Search by trainee name or report title…', allStatus: 'All statuses', fPending: 'Pending', fGraded: 'Graded',
    colTrainee: 'Trainee', colTitle: 'Report title', colDate: 'Date', colFile: 'File', colStatus: 'Status', colAction: 'Action',
    grade: 'Grade', none: 'None', statusGraded: 'Graded', statusPending: 'Pending',
    empty: 'No final reports in your specialty yet.', noMatch: 'No match for your search.', loadFailed: 'Failed to load reports', gradedToast: 'Final report graded — trainee notified',
  },
};

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }

function GradeModal({ report, programDirector, onClose, onSaved }) {
  const isGraded = report.status === 'graded';
  const [criteria, setCriteria] = useState(report.assessmentCriteria || {});
  const [globalRating, setGlobalRating] = useState(report.globalRating || '');
  const [letterGrade, setLetterGrade] = useState(
    report.grade && !['Competent', 'Not-Competent', 'graded'].includes(report.grade) ? report.grade : '');
  const [comments, setComments] = useState(report.assessorComments || report.reviewNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function toggleCriteria(name, key) {
    if (isGraded) return;
    setCriteria((p) => ({ ...p, [name]: p[name] === key ? '' : key }));
  }

  async function handleGrade() {
    if (!globalRating) { setError('Please select a global rating (Competent or Not-Competent).'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.patch(`/api/program-director/reports/${report._id}/grade`, {
        grade: letterGrade || (globalRating === 'competent' ? 'Competent' : 'Not-Competent'),
        globalRating, assessmentCriteria: criteria, assessorComments: comments, reviewNote: comments,
      });
      onSaved(res.data?.data || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit grade.');
      setSaving(false);
    }
  }

  const rota = report.rotation;
  const rotaStr = rota ? `${fmtDate(rota.startDate)} – ${fmtDate(rota.endDate)}` : '—';
  const secTitle = { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBlockEnd: 10 };
  const kLabel = { fontSize: 11, color: 'var(--text-2)', marginBlockEnd: 2 };
  const kValue = { fontSize: 13, color: 'var(--text)', fontWeight: 500 };

  return (
    <div className="mt-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mt-modal" role="dialog" aria-modal="true" style={{ maxWidth: 720 }}>
        <div className="mt-modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="mt-modal-title">{isGraded ? 'Final report — graded' : 'Grade final report'}</div>
            <div className="mt-modal-sub">{report.title}</div>
          </div>
          <div className="mt-modal-head-spacer" />
          {isGraded && <span className="mt-modal-meta">Graded</span>}
          <button type="button" className="mt-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="mt-modal-body">
          {!isGraded && (
            <div className="mt-banner">
              <strong>Program Director grading.</strong> You are grading this final report. Weekly and monthly reports are assessed by the supervising physician.
            </div>
          )}

          {/* Trainee info */}
          <div style={secTitle}>Trainee information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBlockEnd: 20 }}>
            {[
              ['Name', report.student?.name || '—'],
              ['Student ID', report.student?.studentId || '—'],
              ['Date submitted', fmtDate(report.date)],
              ['Hospital', report.hospital?.name || '—'],
              ['Rotation', rotaStr],
            ].map(([l, v]) => (<div key={l}><div style={kLabel}>{l}</div><div style={kValue}>{v}</div></div>))}
          </div>

          {/* Assessor */}
          <div style={secTitle}>Program Director (assessor)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBlockEnd: 20 }}>
            {[
              ['Name', programDirector?.name || report.gradedBy?.name || '—'],
              ['Email', programDirector?.email || '—'],
              ['Hospital', report.hospital?.name || '—'],
            ].map(([l, v]) => (<div key={l}><div style={kLabel}>{l}</div><div style={kValue}>{v}</div></div>))}
          </div>

          {report.fileUrl && (
            <div style={{ marginBlockEnd: 20 }}>
              <div style={secTitle}>Report file</div>
              <a href={report.fileUrl} target="_blank" rel="noreferrer" className="mt-btn--small-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
                View final report PDF ↗
              </a>
            </div>
          )}

          {/* ASR criteria matrix */}
          <div style={secTitle}>ASR assessment criteria</div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 460 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 6, marginBlockEnd: 6 }}>
                <div />
                {RATINGS.map((r) => (<div key={r.key} style={{ fontSize: 10, fontWeight: 600, color: r.color, textAlign: 'center' }}>{r.label}</div>))}
              </div>
              {ASR_CRITERIA.map((name, idx) => (
                <div key={name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 6, padding: '8px 0', borderBlockStart: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', alignSelf: 'center' }}>{name}</div>
                  {RATINGS.map((r) => {
                    const sel = criteria[name] === r.key;
                    return (
                      <div key={r.key} style={{ display: 'flex', justifyContent: 'center' }}>
                        <button type="button" disabled={isGraded} onClick={() => toggleCriteria(name, r.key)} aria-label={`${name}: ${r.label}`}
                          style={{ width: 28, height: 28, borderRadius: '50%', border: sel ? `2px solid ${r.color}` : '1.5px solid var(--border)', background: sel ? r.color : 'var(--surface)', cursor: isGraded ? 'default' : 'pointer', opacity: isGraded && !sel ? 0.5 : 1, transition: 'background-color .12s ease, border-color .12s ease' }} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Global rating */}
          <div style={{ margin: '20px 0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBlockEnd: 10 }}>Global rating *</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[['competent', '✓ Competent', 'var(--success)', 'var(--success-bg)'], ['not-competent', '✗ Not-Competent', 'var(--danger)', 'var(--danger-bg)']].map(([val, label, color, bg]) => {
                const active = globalRating === val;
                return (
                  <button key={val} type="button" disabled={isGraded} onClick={() => !isGraded && setGlobalRating(active ? '' : val)}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: active ? `2px solid ${color}` : '1.5px solid var(--border)', background: active ? bg : 'var(--surface)', color: active ? color : 'var(--text-2)', fontWeight: 700, fontSize: 14, cursor: isGraded ? 'default' : 'pointer', transition: 'background-color .15s ease, border-color .15s ease, color .15s ease' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Letter grade */}
          {!isGraded && (
            <div style={{ marginBlockEnd: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBlockEnd: 8 }}>Letter grade (optional)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {LETTER_GRADES.map((g) => {
                  const active = letterGrade === g;
                  return (
                    <button key={g} type="button" onClick={() => setLetterGrade(active ? '' : g)}
                      style={{ width: 40, height: 40, borderRadius: '50%', border: active ? '2px solid var(--brand-primary)' : '1.5px solid var(--border)', background: active ? 'var(--brand-primary)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'background-color .12s ease, border-color .12s ease, color .12s ease' }}>
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comments */}
          <div style={{ marginBlockEnd: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBlockEnd: 6 }}>{isGraded ? 'Assessment notes' : 'Comments / feedback (shown to trainee)'}</div>
            <textarea className="mt-textarea" disabled={isGraded} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Enter feedback for the trainee…" />
          </div>

          {isGraded && (
            <div className="mt-dropzone-strip" style={{ marginBlockEnd: 16 }}>
              <span className="mt-dropzone-ready" style={{ marginInlineStart: 0 }}>✓</span>
              <div>
                <div className="mt-dropzone-file-name">Final report graded</div>
                <div className="mt-dropzone-file-meta">Grade: {report.grade} · Global: {report.globalRating} · By {report.gradedBy?.name || '—'} on {fmtDate(report.gradedAt)}</div>
              </div>
            </div>
          )}

          {error && <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)' }}>{error}</div>}
        </div>

        <div className="mt-modal-foot">
          {!isGraded ? (
            <>
              <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
              <button type="button" className="mt-btn" onClick={handleGrade} disabled={saving}>{saving ? 'Submitting…' : 'Submit grade'}</button>
            </>
          ) : (
            <button type="button" className="mt-btn--cancel" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProgramDirectorReports() {
  const { user: me } = useAuth();
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [gradeModal, setGradeModal] = useState(null);

  useEffect(() => {
    api.get('/api/program-director/reports')
      .then((r) => { const list = r.data?.data || r.data || []; setReports(Array.isArray(list) ? list : []); })
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved(updated) {
    setReports((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    showToast(t('gradedToast'), 'ok');
  }

  const pendingCount = reports.filter((r) => r.status !== 'graded').length;
  const gradedCount = reports.filter((r) => r.status === 'graded').length;

  const displayed = reports.filter((r) => {
    const mf = filter === 'all' ? true : filter === 'pending' ? r.status !== 'graded' : r.status === 'graded';
    const q = search.trim().toLowerCase();
    const ms = !q || r.student?.name?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q) || (r.hospital?.name || '').toLowerCase().includes(q);
    return mf && ms;
  });
  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = displayed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content"><MtSkeleton stats={3} charts={0} table /></main>
    </>
  );

  const stats = [
    { label: t('total'), value: reports.length, icon: 'doc' },
    { label: t('pending'), value: pendingCount, icon: 'clock', tone: pendingCount > 0 ? 'warn' : 'ok' },
    { label: t('graded'), value: gradedCount, icon: 'check' },
  ];

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-stat-grid">
          {stats.map((s, i) => (
            <RevealOnScroll key={s.label} delay={i * 0.055}>
              <StatCard label={s.label} value={s.value} icon={s.icon} tone={s.tone} />
            </RevealOnScroll>
          ))}
        </div>

        <div className="mt-filterbar" style={{ marginBlockStart: 16 }}>
          <span className="mt-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('searchPh')} aria-label={t('searchPh')} />
          </span>
          <span className="mt-filterbar-spacer" />
          <select className="mt-filter" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} aria-label={t('allStatus')}>
            <option value="all">{t('allStatus')}</option>
            <option value="pending">{t('fPending')}</option>
            <option value="graded">{t('fGraded')}</option>
          </select>
        </div>

        {displayed.length === 0 ? (
          <div className="mt-empty" style={{ padding: 48 }}>
            <div className="mt-empty-title">{reports.length === 0 ? t('empty') : t('noMatch')}</div>
          </div>
        ) : (
          <RevealOnScroll className="mt-card" style={{ padding: 0 }}>
            <div className="mt-table-wrap">
              <table className="mt-table mt-table--stack">
                <thead>
                  <tr>
                    <th className="mt-th">{t('colTrainee')}</th>
                    <th className="mt-th">{t('colTitle')}</th>
                    <th className="mt-th">{t('colDate')}</th>
                    <th className="mt-th">{t('colFile')}</th>
                    <th className="mt-th">{t('colStatus')}</th>
                    <th className="mt-th">{t('colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => (
                    <tr key={r._id}>
                      <td className="mt-td mt-td--name" data-label={t('colTrainee')}>
                        {r.student?.name || '—'}
                        {r.student?.studentId && <div className="mt-td--mono" style={{ padding: 0 }}>{r.student.studentId}</div>}
                      </td>
                      <td className="mt-td" data-label={t('colTitle')}>
                        {r.title}
                        {r.hospital?.name && <div className="mt-td--muted" style={{ padding: 0, fontSize: 11 }}>{r.hospital.name}</div>}
                      </td>
                      <td className="mt-td mt-td--muted" data-label={t('colDate')}>{fmtDate(r.date)}</td>
                      <td className="mt-td" data-label={t('colFile')}>
                        {r.fileUrl
                          ? <a href={r.fileUrl} target="_blank" rel="noreferrer" className="mt-icon-action" title="View" aria-label="View" style={{ display: 'inline-flex' }}><IconEye size={15} /></a>
                          : <span className="mt-td--muted">{t('none')}</span>}
                      </td>
                      <td className="mt-td" data-label={t('colStatus')}>
                        {r.status === 'graded'
                          ? <span className="mt-pill mt-pill--active">{t('statusGraded')}{r.grade ? ` · ${r.grade}` : ''}</span>
                          : <span className="mt-pill mt-pill--warn">{t('statusPending')}</span>}
                      </td>
                      <td className="mt-td mt-td--actions" data-label={t('colAction')}>
                        {r.status !== 'graded'
                          ? <button type="button" className="mt-btn mt-btn--small" onClick={() => setGradeModal(r)}>{t('grade')}</button>
                          : <button type="button" className="mt-icon-action" onClick={() => setGradeModal(r)} title="View" aria-label="View"><IconEye size={15} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RevealOnScroll>
        )}
        {displayed.length > 0 && (
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={displayed.length} onPrev={() => setPage((n) => Math.max(1, n - 1))} onNext={() => setPage((n) => Math.min(totalPages, n + 1))} />
        )}

        {gradeModal && <GradeModal report={gradeModal} programDirector={me} onClose={() => setGradeModal(null)} onSaved={handleSaved} />}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
