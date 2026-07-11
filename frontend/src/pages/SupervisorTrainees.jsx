import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar       from '../components/Navbar';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';
import { IconEye, IconPrinter, IconCheck, IconClock, IconXCircle } from '../components/icons';
import { printEvaluation } from '../utils/printEvaluation';

const API_BASE = '';

// Page-chrome translations (Arabic + English). Dynamic data — names, dates,
// hospital/specialty names, and evaluation form content — is NOT translated.
const STRINGS = {
  ar: {
    statTotal:       'إجمالي المتدربين',
    statActive:      'المُسندون',
    statCompleted:   'مُقيّم',
    assigned:        'مُسند',
    current:         'الحالي',
    completed:       'مُقيّم',
    cancelled:       'ملغى',
    upcoming:        'قادم',
    assessed:        'مُقيّم',
    filterAll:       'الكل',
    searchPlaceholder: 'ابحث بالاسم أو الرقم أو التخصص أو المستشفى…',
    emptyNone:       'لا يوجد متدربون معيّنون بعد',
    emptyNoMatch:    'لا يوجد متدربون مطابقون لبحثك',
    emptyHint:       'يتم تعيين المتدربين إليك من قبل السكرتارية.',
    trainee:         'متدرب',
    view:            'عرض',
    print:           'طباعة',
    close:           'إغلاق',
    studentId:       'رقم المتدرب',
    phone:           'الهاتف',
    specialty:       'التخصص',
    hospital:        'المستشفى',
    startDate:       'تاريخ البدء',
    endDate:         'تاريخ الانتهاء',
    duration:        'المدة',
    status:          'الحالة',
    weeks:           'أسابيع',
    reports:         'التقارير',
    evaluations:     'التقييمات',
    courses:         'الشهادات والدورات',
    research:        'الأبحاث والمنشورات',
    noReports:       'لا توجد تقارير بعد',
    noEvaluations:   'لا توجد تقييمات بعد',
    noCourses:       'لا توجد شهادات أو دورات',
    noResearch:      'لا توجد أبحاث',
    approve:         'اعتماد',
    reject:          'رفض',
    approved:        'معتمد',
    rejected:        'مرفوض',
    reviewInQueue:   'راجعه من قائمة "أبحاث بانتظار مراجعتك" بالأعلى',
    researchQueueTitle: 'أبحاث بانتظار مراجعتك',
    approveSign:     'اعتماد وتوقيع',
    signTitle:       'اعتماد وتوقيع البحث',
    signPrompt:      'اكتب اسمك الكامل للتوقيع على الاعتماد',
    signNamePh:      'الاسم الكامل',
    noteOptional:    'ملاحظة (اختياري)',
    rejectReason:    'سبب الرفض (اختياري)',
    submit:          'إرسال',
    cancel:          'إلغاء',
    by:              'بواسطة',
    loading:         'جارٍ التحميل…',
    graded:          'مُقيّم',
    pending:         'قيد المراجعة',
    finalized:       'مُعتمد',
    notFinalized:    'غير مُعتمد',
  },
  en: {
    statTotal:       'Total Assigned',
    statActive:      'Assigned',
    statCompleted:   'Assessed',
    assigned:        'Assigned',
    current:         'Current',
    completed:       'Assessed',
    cancelled:       'Cancelled',
    upcoming:        'Upcoming',
    assessed:        'Assessed',
    filterAll:       'All',
    searchPlaceholder: 'Search by name, ID, specialty or hospital…',
    emptyNone:       'No trainees assigned yet',
    emptyNoMatch:    'No trainees match your search',
    emptyHint:       'Trainees are assigned to you by the secretary.',
    trainee:         'Trainee',
    view:            'View',
    print:           'Print',
    close:           'Close',
    studentId:       'Student ID',
    phone:           'Phone',
    specialty:       'Specialty',
    hospital:        'Hospital',
    startDate:       'Start Date',
    endDate:         'End Date',
    duration:        'Duration',
    status:          'Status',
    weeks:           'weeks',
    reports:         'Reports',
    evaluations:     'Evaluations',
    courses:         'Courses & Certificates',
    research:        'Researches & Publications',
    noReports:       'No reports yet',
    noEvaluations:   'No evaluations yet',
    noCourses:       'No courses or certificates uploaded',
    noResearch:      'No researches submitted',
    approve:         'Approve',
    reject:          'Reject',
    approved:        'Approved',
    rejected:        'Rejected',
    reviewInQueue:   'Review it from "Research awaiting your review" above',
    researchQueueTitle: 'Research awaiting your review',
    approveSign:     'Approve & Sign',
    signTitle:       'Approve & Sign Research',
    signPrompt:      'Type your full name to sign the approval',
    signNamePh:      'Full name',
    noteOptional:    'Note (optional)',
    rejectReason:    'Reason for rejection (optional)',
    submit:          'Submit',
    cancel:          'Cancel',
    by:              'by',
    loading:         'Loading…',
    graded:          'Graded',
    pending:         'Pending',
    finalized:       'Finalized',
    notFinalized:    'Not finalized',
  },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTrainee(dist) {
  return dist.traineeId || dist.student || {};
}

function getTraineeId(dist) {
  return dist.traineeId?._id || dist.student?._id || dist.traineeId || dist.student || dist._id;
}

function getSpecialty(dist) {
  return dist.specialtyId?.name || dist.specialty || '—';
}

function getHospital(dist) {
  return dist.hospitalId?.name || dist.hospital?.name || '—';
}

function weeksBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(1, Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000)));
}

function getStatusStyle(status) {
  if (status === 'current' || status === 'active') return { color: 'var(--success-fg)', bg: 'var(--success-bg)' };
  if (status === 'completed') return { color: 'var(--brand-secondary)', bg: 'var(--surface-2)' };
  if (status === 'cancelled') return { color: 'var(--danger-fg)', bg: 'var(--danger-bg)' };
  return { color: 'var(--warning-fg)', bg: 'var(--warning-bg)' };
}

function Avatar({ user, size = 56 }) {
  if (user?.photoUrl) {
    return (
      <img
        src={`${API_BASE}${user.photoUrl}`}
        alt={user.name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '3px solid var(--border)'
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--brand-secondary)', color: '#fff',
      fontWeight: 700, fontSize: size * 0.32,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, border: '3px solid var(--border)'
    }}>
      {user?.initials || user?.name?.slice(0, 2)?.toUpperCase() || '?'}
    </div>
  );
}

function TraineeModal({ dist, onClose, t }) {
  const trainee   = getTrainee(dist);
  const traineeId = getTraineeId(dist);
  const [reports,    setReports]    = useState([]);
  const [evals,      setEvals]      = useState([]);
  const [courses,    setCourses]    = useState([]);
  const [research,   setResearch]   = useState([]);
  const [detLoading, setDetLoading] = useState(true);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!traineeId) { setDetLoading(false); return; }
    let alive = true;
    setDetLoading(true);
    Promise.all([
      api.get(`/api/reports/student/${traineeId}`).then(r => r.data).catch(() => []),
      api.get(`/api/evaluations/student/${traineeId}`).then(r => r.data).catch(() => []),
      api.get(`/api/trainee-courses/trainee/${traineeId}`).then(r => r.data).catch(() => []),
      api.get(`/api/research/trainee/${traineeId}`).then(r => r.data).catch(() => []),
    ])
      .then(([rep, ev, crs, rsh]) => {
        if (!alive) return;
        setReports(Array.isArray(rep) ? rep : (rep?.data || []));
        setEvals(Array.isArray(ev) ? ev : (ev?.data || []));
        setCourses(Array.isArray(crs) ? crs : (crs?.data || []));
        setResearch(Array.isArray(rsh) ? rsh : (rsh?.data || []));
      })
      .finally(() => { if (alive) setDetLoading(false); });
    return () => { alive = false; };
  }, [traineeId]);


  const sectionTitle = {
    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
  };
  const detailRow = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 0', borderBottom: '1px solid var(--border-soft)',
  };

  const reportIcon = r => (r.status === 'graded' || r.status === 'approved')
    ? <span className="status-ic status-ic-green" title={t('graded')}><IconCheck size={15} /></span>
    : <span className="status-ic status-ic-amber" title={t('pending')}><IconClock size={15} /></span>;

  const evalIcon = ev => ev.isFinalized
    ? <span className="status-ic status-ic-green" title={t('finalized')}><IconCheck size={15} /></span>
    : <span className="status-ic status-ic-amber" title={t('notFinalized')}><IconClock size={15} /></span>;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--overlay)',
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn 0.22s ease-out'
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px var(--shadow)',
        animation: 'modalIn 0.22s ease-out'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '20px 24px', borderBottom: '1px solid var(--border)'
        }}>
          <Avatar user={trainee} size={52} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{trainee.name || '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{trainee.email || ''}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-2)',
              border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '14px 20px', marginBottom: 20
          }}>
            {[
              [t('studentId'), trainee.studentId || '—'],
              [t('phone'),     trainee.phone     || '—'],
              [t('specialty'), getSpecialty(dist)],
              [t('hospital'),  getHospital(dist)],
              [t('startDate'), fmtDate(dist.startDate)],
              [t('endDate'),   fmtDate(dist.endDate)],
              [t('duration'),  (dist.durationWeeks || weeksBetween(dist.startDate, dist.endDate)) ? `${dist.durationWeeks || weeksBetween(dist.startDate, dist.endDate)} ${t('weeks')}` : '—'],
              [t('status'),    dist.status || 'upcoming'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3
                }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Reports */}
          <div style={{ marginBottom: 20 }}>
            <div style={sectionTitle}>{t('reports')}</div>
            {detLoading ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('loading')}</div>
            ) : reports.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('noReports')}</div>
            ) : (
              reports.map(r => (
                <div key={r._id} style={detailRow}>
                  {reportIcon(r)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
                      {r.type || ''}{r.type && r.date ? ' · ' : ''}{fmtDate(r.date)}
                    </div>
                  </div>
                  {r.fileUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <a
                        href={`${API_BASE}${r.fileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        title={t('view')}
                        aria-label={t('view')}
                        style={{
                          width: 28, height: 28, borderRadius: 7, background: 'var(--surface-2)',
                          color: 'var(--text-2)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', textDecoration: 'none'
                        }}
                      >
                        <IconEye size={15} />
                      </a>
                      <button
                        type="button"
                        title={t('print')}
                        aria-label={t('print')}
                        onClick={() => window.open(`${API_BASE}${r.fileUrl}`, '_blank')}
                        style={{
                          width: 28, height: 28, borderRadius: 7, background: 'var(--surface-2)',
                          color: 'var(--text-2)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <IconPrinter size={15} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ flexShrink: 0, fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Evaluations */}
          <div>
            <div style={sectionTitle}>{t('evaluations')}</div>
            {detLoading ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('loading')}</div>
            ) : evals.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('noEvaluations')}</div>
            ) : (
              evals.map(ev => (
                <div key={ev._id} style={detailRow}>
                  {evalIcon(ev)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.evaluationType || ev.type || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {fmtDate(ev.date)}
                      {ev.doctor?.name ? ` · ${ev.doctor.name}` : ''}
                      {(ev.grade || ev.totalScore != null) ? ` · ${ev.grade || ev.totalScore}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    title={t('view')}
                    aria-label={t('view')}
                    onClick={() => printEvaluation(ev, { traineeName: trainee.name })}
                    style={{
                      width: 28, height: 28, borderRadius: 7, background: 'var(--surface-2)',
                      color: 'var(--text-2)', border: '1px solid var(--border)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <IconEye size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Courses & Certificates (uploaded by trainee) */}
          <div style={{ marginTop: 20 }}>
            <div style={sectionTitle}>{t('courses')}</div>
            {detLoading ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('loading')}</div>
            ) : courses.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('noCourses')}</div>
            ) : (
              courses.map(c => (
                <div key={c._id} style={detailRow}>
                  <span className="status-ic status-ic-green" title={c.kind === 'course' ? 'Course' : 'Certificate'}><IconCheck size={15} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {c.kind === 'course' ? 'Course' : 'Certificate'}
                      {c.issuer ? ` · ${c.issuer}` : ''}
                      {c.completedDate ? ` · ${fmtDate(c.completedDate)}` : ''}
                    </div>
                  </div>
                  {c.fileUrl ? (
                    <a href={`${API_BASE}${c.fileUrl}`} target="_blank" rel="noreferrer"
                      title={t('view')} aria-label={t('view')}
                      style={{
                        width: 28, height: 28, borderRadius: 7, background: 'var(--surface-2)',
                        color: 'var(--text-2)', border: '1px solid var(--border)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none'
                      }}>
                      <IconEye size={15} />
                    </a>
                  ) : (
                    <span style={{ flexShrink: 0, fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Researches & Publications (approve pending; view publications) */}
          <div style={{ marginTop: 20 }}>
            <div style={sectionTitle}>{t('research')}</div>
            {detLoading ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('loading')}</div>
            ) : research.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('noResearch')}</div>
            ) : (
              research.map(r => {
                const st = r.status === 'approved'
                  ? { bg: 'var(--success-bg)', color: 'var(--success-fg)', label: t('approved') }
                  : r.status === 'rejected'
                    ? { bg: 'var(--danger-bg)', color: 'var(--danger-fg)', label: t('rejected') }
                    : { bg: 'var(--warning-bg)', color: 'var(--warning-fg)', label: t('pending') };
                return (
                  <div key={r._id} style={{ padding: '9px 0', borderBottom: '1px solid var(--border-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: 120 }}>{r.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                      {r.status === 'approved' && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                          {r.visibility === 'public' ? '· Public' : '· Private'}
                        </span>
                      )}
                      {r.fileUrl && (
                        <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer"
                          title={t('view')} aria-label={t('view')}
                          style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                          <IconEye size={14} />
                        </a>
                      )}
                    </div>
                    {(r.journal || r.authors) && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {[r.authors, r.journal].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {r.signedByName && (
                      <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>✍ Signed by {r.signedByName}</div>
                    )}
                    {r.status === 'pending' && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                        {t('reviewInQueue')}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 8, background: 'var(--accent)',
              color: '#fff', border: 'none', fontWeight: 500, fontSize: 13,
              cursor: 'pointer'
            }}
          >{t('close')}</button>
        </div>
      </div>
    </div>
  );
}

// Approve & Sign modal — the research supervisor types their full name to sign.
function SignModal({ item, t, onClose, onSigned }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function submit() {
    if (!name.trim()) { setError(t('signPrompt')); return; }
    setSaving(true); setError('');
    try {
      await api.patch(`/api/research/${item._id}/approve`, { signatureName: name.trim(), note: note.trim() });
      onSigned(item._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 2600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px var(--shadow)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
          {t('signTitle')}
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{item.title}</div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{t('signPrompt')}</label>
            <input value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder={t('signNamePh')}
              style={{ width: '100%', boxSizing: 'border-box', height: 42, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }} />
            {/* live cursive preview so the typed name reads as a signature */}
            {name.trim() && (
              <div style={{ marginTop: 8, fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: 22, color: 'var(--brand-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                /s/ {name.trim()}
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{t('noteOptional')}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 70, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          {error && <div style={{ color: 'var(--danger-fg)', fontSize: 13 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
            <button className="btn-purple" onClick={submit} disabled={saving}>{saving ? '…' : t('approveSign')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupervisorTrainees() {
  const { user: me }   = useAuth();
  const { lang }       = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [dists,    setDists   ] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const [search,   setSearch  ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [queue,    setQueue   ] = useState([]);
  const [signItem, setSignItem] = useState(null);

  useEffect(() => {
    api.get('/api/research/queue')
      .then(r => setQueue(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {});
  }, []);

  async function rejectResearch(id) {
    const note = window.prompt(t('rejectReason')) ?? '';
    try {
      await api.patch(`/api/research/${id}/reject`, { note });
      setQueue(prev => prev.filter(x => x._id !== id));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    api.get('/api/supervisor/trainees')
      .then(r => {
        const list = r.data?.data || r.data || [];
        setDists(Array.isArray(list) ? list : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusOf = d => d.status || 'active';
  const filtered = dists.filter(d => {
    const tr = getTrainee(d);
    const q = search.toLowerCase();
    const matchesSearch = !q
      || tr.name?.toLowerCase().includes(q)
      || tr.studentId?.toLowerCase().includes(q)
      || getSpecialty(d).toLowerCase().includes(q)
      || getHospital(d).toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    const s = statusOf(d);
    if (statusFilter === 'assigned') return s === 'active';
    if (statusFilter === 'current')  return s === 'current';
    if (statusFilter === 'upcoming') return s === 'upcoming';
    if (statusFilter === 'assessed') return s === 'completed';
    return true;
  });

  const active    = dists.filter(d => {
    const s = d.status || 'active';
    return s === 'active' || s === 'current';
  }).length;
  const completed = dists.filter(d => d.status === 'completed').length;

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} />
              <Sk w={120} h={14} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}><Sk h={40} r={8} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
          {[...Array(6)].map((_,i) => (
            <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:22, textAlign:'center' }}>
              <Sk w={56} h={56} r="50%" style={{ margin:'0 auto 12px' }} />
              <Sk w={140} h={15} style={{ margin:'0 auto 8px' }} />
              <Sk w={100} h={12} style={{ margin:'0 auto 6px' }} />
              <Sk w={80}  h={22} r={20} style={{ margin:'0 auto 14px' }} />
              <div style={{ display:'flex', gap:7, justifyContent:'center' }}>
                <Sk w={80} h={32} r={8} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
          {[
            { label: t('statTotal'),     count: dists.length,  color:'var(--info-fg)',           bg:'var(--info-bg)' },
            { label: t('statActive'),    count: active,         color:'var(--success-fg)',        bg:'var(--success-bg)' },
            { label: t('statCompleted'), count: completed,      color:'var(--brand-secondary)',   bg:'var(--surface-2)' },
          ].map(c => (
            <div key={c.label} style={{
              background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:14
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:c.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, fontWeight:700, color:c.color, flexShrink:0
              }}>
                {c.count}
              </div>
              <div style={{ fontSize:13, color:'var(--text-2)', fontWeight:500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Research awaiting the supervisor's signature/approval */}
        {queue.length > 0 && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--brand-secondary)', marginBottom:12 }}>
              {t('researchQueueTitle')} <span className="badge badge-blue" style={{ marginInlineStart:6 }}>{queue.length}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {queue.map(r => (
                <div key={r._id} style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', border:'1px solid var(--border-soft)', borderRadius:10, padding:'10px 12px', background:'var(--surface-2)' }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{r.title}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                      {t('by')} {r.trainee?.name || '—'}{[r.authors, r.journal].filter(Boolean).length ? ` · ${[r.authors, r.journal].filter(Boolean).join(' · ')}` : ''}
                    </div>
                  </div>
                  {r.fileUrl && (
                    <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer" title={t('view')} aria-label={t('view')}
                      style={{ width:30, height:30, borderRadius:7, background:'var(--surface)', color:'var(--text-2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
                      <IconEye size={15} />
                    </a>
                  )}
                  <button type="button" onClick={() => setSignItem(r)}
                    style={{ padding:'6px 12px', fontSize:12, fontWeight:700, borderRadius:7, border:'none', cursor:'pointer', background:'var(--success-fg)', color:'#fff' }}>
                    {t('approveSign')}
                  </button>
                  <button type="button" onClick={() => rejectResearch(r._id)}
                    style={{ padding:'6px 12px', fontSize:12, fontWeight:700, borderRadius:7, cursor:'pointer', background:'var(--surface)', color:'var(--danger-fg)', border:'1px solid var(--border)' }}>
                    {t('reject')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <input
            className="admin-search"
            style={{ width:'100%', height:40, maxWidth:'100%' }}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs" style={{ marginBottom:20 }}>
          {[
            { key:'all',      label:t('filterAll') },
            { key:'assigned', label:t('assigned') },
            { key:'current',  label:t('current') },
            { key:'upcoming', label:t('upcoming') },
            { key:'assessed', label:t('assessed') },
          ].map(f => (
            <button
              key={f.key}
              className={`filter-tab${statusFilter === f.key ? ' active' : ''}`}
              onClick={() => setStatusFilter(f.key)}
            >{f.label}</button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'var(--text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>
              {dists.length === 0 ? t('emptyNone') : t('emptyNoMatch')}
            </div>
            <div style={{ fontSize:13 }}>{t('emptyHint')}</div>
          </div>
        )}

        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',
          gap:16
        }}>
          {filtered.map(dist => {
            const trainee     = getTrainee(dist);
            const status      = dist.status || 'upcoming';
            const statusStyle = getStatusStyle(status);
            const duration    = dist.durationWeeks || weeksBetween(dist.startDate, dist.endDate);

            return (
              <div
                key={dist._id}
                style={{
                  background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
                  padding:'22px 18px', textAlign:'center',
                  boxShadow:'0 1px 3px var(--shadow)',
                  transition:'transform .2s, box-shadow .2s',
                  cursor:'default'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px var(--shadow)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '0 1px 3px var(--shadow)';
                }}
              >
                <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
                  <Avatar user={trainee} size={56} />
                </div>

                <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
                  {trainee.name || '—'}
                </div>

                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>
                  {t('trainee')} {trainee.studentId ? `· ${trainee.studentId}` : ''}
                </div>

                <div style={{ marginBottom:6 }}>
                  <span style={{
                    display:'inline-block', fontSize:11, padding:'3px 10px',
                    borderRadius:20, background:'var(--surface-2)', color:'var(--brand-secondary)', fontWeight:600
                  }}>
                    {getSpecialty(dist)}
                  </span>
                </div>

                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
                  {fmtDate(dist.startDate)} – {fmtDate(dist.endDate)}
                  {duration ? ` · ${duration}w` : ''}
                </div>

                <div style={{ marginBottom:14 }}>
                  <span style={{
                    fontSize:11, fontWeight:600, padding:'2px 9px',
                    borderRadius:20, background:statusStyle.bg, color:statusStyle.color
                  }}>
                    {status === 'active'      ? t('assigned')
                      : status === 'current'   ? t('current')
                      : status === 'completed' ? t('assessed')
                      : t(status)}
                  </span>
                </div>

                <div style={{ display:'flex', gap:7, justifyContent:'center' }}>
                  <button
                    title={t('view')}
                    aria-label={t('view')}
                    style={{
                      width:34, height:34, borderRadius:8, background:'var(--accent)',
                      color:'#fff', border:'none', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      boxShadow:'0 2px 6px var(--shadow)'
                    }}
                    onClick={() => setSelected(dist)}
                  >
                    <IconEye size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <TraineeModal dist={selected} onClose={() => setSelected(null)} t={t} />
        )}

        {signItem && (
          <SignModal
            item={signItem}
            t={t}
            onClose={() => setSignItem(null)}
            onSigned={id => { setQueue(prev => prev.filter(x => x._id !== id)); setSignItem(null); }}
          />
        )}

        <style>{`
          @keyframes modalIn {
            from { opacity:0; transform:translateY(-14px) scale(.98); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
        `}</style>

      </main>
    </>
  );
}
