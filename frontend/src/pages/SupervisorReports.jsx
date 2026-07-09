import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar       from '../components/Navbar';
import Toast        from '../components/Toast';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';
import { IconEye, IconCheck, IconClock, IconXCircle } from '../components/icons';

const API_BASE = '';

// Page-chrome translations (titles, labels, headers, buttons, toasts, modal
// section titles, field labels). Dynamic data (names, dates, hospitals) and
// the evaluation form content are intentionally NOT translated here.
const STRINGS = {
  ar: {
    pendingReview: 'بانتظار المراجعة',
    assessed: 'تم التقييم',
    searchPlaceholder: 'ابحث باسم المتدرب أو عنوان التقرير…',
    filterPending: 'بانتظار',
    filterAssessed: 'تم التقييم',
    filterAll: 'الكل',
    colNum: '#',
    colTrainee: 'المتدرب',
    colTitle: 'عنوان التقرير',
    colType: 'النوع',
    colDate: 'التاريخ',
    colFile: 'الملف',
    colStatus: 'الحالة',
    colAction: 'الإجراء',
    noReports: 'لا توجد تقارير',
    idLabel: 'الرقم التعريفي',
    fileView: 'عرض',
    fileNone: 'لا يوجد',
    btnAssess: 'تقييم',
    statusAssessed: 'تم التقييم',
    statusRejected: 'مرفوض',
    statusPending: 'بانتظار المراجعة',
    view: 'عرض',
    // Modal
    assessmentDetails: 'تفاصيل التقييم',
    assessReport: 'تقييم التقرير',
    traineeInformation: 'معلومات المتدرب',
    assessorInformation: 'معلومات المُقيّم',
    asrCriteria: 'معايير تقييم ASR',
    globalRating: 'التقييم العام',
    competent: '✓ كفء',
    notCompetent: '✗ غير كفء',
    letterGrade: 'الدرجة الحرفية (اختياري)',
    assessmentNotes: 'ملاحظات التقييم',
    commentsNotes: 'التعليقات / الملاحظات',
    commentsPlaceholder: 'أدخل أي تعليقات أو ملاحظات…',
    reviewNote: 'ملاحظة المراجعة (تظهر للمتدرب)',
    reviewNotePlaceholder: 'ملاحظة اختيارية للمتدرب…',
    assessmentSubmitted: 'تم إرسال التقييم',
    statusLine: 'الحالة',
    by: 'بواسطة',
    reject: 'رفض',
    approveAssess: 'اعتماد وتقييم',
    saving: 'جارٍ الحفظ…',
    close: 'إغلاق',
    // Field labels
    fName: 'الاسم',
    fStudentId: 'الرقم التعريفي للمتدرب',
    fDateSubmitted: 'تاريخ الإرسال',
    fHospital: 'المستشفى',
    fRotationPeriod: 'فترة التدوير',
    fEmail: 'البريد الإلكتروني',
    fPhone: 'الهاتف',
    // Ratings labels
    ratingNa: 'غير منطبق',
    ratingBelow: 'دون المستوى',
    ratingMeets: 'يحقق المستوى',
    ratingAbove: 'فوق المستوى',
    // Toasts
    loadFailed: 'فشل تحميل التقارير',
    savedIncomplete: 'تم حفظ التقييم، لكن الاستجابة غير مكتملة. يرجى التحديث للتأكد.',
    submitSuccess: 'تم إرسال التقييم بنجاح',
    submitFailed: 'فشل إرسال التقييم.',
  },
  en: {
    pendingReview: 'Pending Review',
    assessed: 'Assessed',
    searchPlaceholder: 'Search by trainee name or report title…',
    filterPending: 'Pending',
    filterAssessed: 'Assessed',
    filterAll: 'All',
    colNum: '#',
    colTrainee: 'Trainee',
    colTitle: 'Report Title',
    colType: 'Type',
    colDate: 'Date',
    colFile: 'File',
    colStatus: 'Status',
    colAction: 'Action',
    noReports: 'No reports found',
    idLabel: 'ID',
    fileView: 'View',
    fileNone: 'None',
    btnAssess: 'Assess',
    statusAssessed: 'Assessed',
    statusRejected: 'Rejected',
    statusPending: 'Pending review',
    view: 'View',
    // Modal
    assessmentDetails: 'Assessment Details',
    assessReport: 'Assess Report',
    traineeInformation: 'Trainee Information',
    assessorInformation: 'Assessor Information',
    asrCriteria: 'ASR Assessment Criteria',
    globalRating: 'Global Rating',
    competent: '✓ Competent',
    notCompetent: '✗ Not-Competent',
    letterGrade: 'Letter Grade (optional)',
    assessmentNotes: 'Assessment Notes',
    commentsNotes: 'Comments / Notes',
    commentsPlaceholder: 'Enter any comments or observations…',
    reviewNote: 'Review Note (shown to trainee)',
    reviewNotePlaceholder: 'Optional note for the trainee…',
    assessmentSubmitted: 'Assessment submitted',
    statusLine: 'Status',
    by: 'By',
    reject: 'Reject',
    approveAssess: 'Approve & Assess',
    saving: 'Saving…',
    close: 'Close',
    // Field labels
    fName: 'Name',
    fStudentId: 'Student ID',
    fDateSubmitted: 'Date Submitted',
    fHospital: 'Hospital',
    fRotationPeriod: 'Rotation Period',
    fEmail: 'Email',
    fPhone: 'Phone',
    // Ratings labels
    ratingNa: 'N/A',
    ratingBelow: 'Below Standard',
    ratingMeets: 'Meets Standard',
    ratingAbove: 'Above Standard',
    // Toasts
    loadFailed: 'Failed to load reports',
    savedIncomplete: 'Assessment saved, but the response was incomplete. Please refresh to verify.',
    submitSuccess: 'Assessment submitted successfully',
    submitFailed: 'Failed to submit assessment.',
  },
};

const ASR_CRITERIA = [
  'History Taking',
  'Physical Examination',
  'Clinical Reasoning',
  'Diagnosis & Management',
  'Communication with Patient',
  'Communication with Team',
  'Professionalism & Ethics',
  'Time Management',
];

const RATINGS = [
  { key: 'na',    tKey: 'ratingNa',    color: '#b2bec3', bg: '#f0f2f3' },
  { key: 'below', tKey: 'ratingBelow', color: '#FF4757', bg: '#fef0f0' },
  { key: 'meets', tKey: 'ratingMeets', color: '#f39c12', bg: '#fff8e1' },
  { key: 'above', tKey: 'ratingAbove', color: '#00B894', bg: '#e8fdf3' },
];

const LETTER_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function GradeBubbles({ selected, onChange, disabled }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
      {LETTER_GRADES.map(g => {
        const active = selected === g;
        return (
          <button
            key={g} type="button"
            onClick={() => !disabled && onChange(active ? '' : g)}
            disabled={disabled}
            style={{
              width:40, height:40, borderRadius:'50%',
              border: active ? '2px solid var(--link)' : '1.5px solid var(--border)',
              background: active ? 'var(--link)' : 'var(--surface)',
              color: active ? '#fff' : 'var(--text-2)',
              fontSize:12, fontWeight:700,
              cursor: disabled ? 'default' : 'pointer',
              transition:'background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease', flexShrink:0,
              opacity: disabled && !active ? 0.5 : 1,
            }}
          >{g}</button>
        );
      })}
    </div>
  );
}

function AssessmentModal({ report, supervisor, onClose, onSaved }) {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const isGraded = report.status === 'graded' || report.status === 'approved';

  const [criteria,     setCriteria    ] = useState(report.assessmentCriteria || {});
  const [globalRating, setGlobalRating] = useState(report.globalRating       || '');
  const [letterGrade,  setLetterGrade ] = useState(
    report.grade && !['Competent','Not-Competent','approved','rejected'].includes(report.grade)
      ? report.grade : ''
  );
  const [comments,   setComments  ] = useState(report.assessorComments || '');
  const [reviewNote, setReviewNote] = useState(report.reviewNote       || '');
  const [saving,     setSaving    ] = useState(false);
  const [error,      setError     ] = useState('');

  function toggleCriteria(name, key) {
    if (isGraded) return;
    setCriteria(p => ({ ...p, [name]: p[name] === key ? '' : key }));
  }

  async function handleSubmit(status) {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/api/supervisor/reports/${report._id}`, {
        status,
        reviewNote: reviewNote || comments,
        globalRating: globalRating || undefined,
        assessmentCriteria: criteria,
        assessorComments: comments,
        grade: letterGrade || undefined,
      });
      onSaved(res.data?.data || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || t('submitFailed'));
      setSaving(false);
    }
  }

  const rota    = report.distribution || report.rotation;
  const rotaStr = rota ? `${fmtDate(rota.startDate)} – ${fmtDate(rota.endDate)}` : '—';

  return (
    <div
      style={{
        position:'fixed', inset:0, background:'var(--overlay)',
        zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center',
        padding:20, overflowY:'auto'
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div dir={dir} style={{
        background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:680,
        boxShadow:'0 20px 60px var(--shadow)', maxHeight:'90vh', overflowY:'auto'
      }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          padding:'20px 24px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--surface)', zIndex:10
        }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'var(--text)' }}>
              {isGraded ? t('assessmentDetails') : t('assessReport')}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
              <span style={{
                fontSize:11, padding:'2px 9px', borderRadius:20, fontWeight:600,
                background: report.type==='monthly' ? 'var(--warning-bg)' : 'var(--info-bg)',
                color:      report.type==='monthly' ? 'var(--warning-fg)' : 'var(--info-fg)'
              }}>{report.type}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{report.title}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width:30, height:30, borderRadius:'50%', background:'var(--surface-2)',
              border:'none', fontSize:18, color:'var(--text-muted)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
            }}
          >✕</button>
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* Trainee Info */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              {t('traineeInformation')}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px' }}>
              {[
                [t('fName'),          report.student?.name || '—'],
                [t('fStudentId'),     report.student?.studentId || '—'],
                [t('fDateSubmitted'), fmtDate(report.date)],
                [t('fHospital'),      report.hospital?.name || '—'],
                [t('fRotationPeriod'), rotaStr],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, color:'var(--text)', fontWeight:500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Assessor Info */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              {t('assessorInformation')}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px' }}>
              {[
                [t('fName'),     supervisor?.name    || '—'],
                [t('fEmail'),    supervisor?.email   || '—'],
                [t('fPhone'),    supervisor?.phone   || '—'],
                [t('fHospital'), report.hospital?.name || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, color:'var(--text)', fontWeight:500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ASR Criteria */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
              {t('asrCriteria')}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:6, marginBottom:6 }}>
              <div />
              {RATINGS.map(r => (
                <div key={r.key} style={{ fontSize:10, fontWeight:600, color:r.color, textAlign:'center' }}>
                  {t(r.tKey)}
                </div>
              ))}
            </div>
            {ASR_CRITERIA.map((name, idx) => (
              <div
                key={name}
                style={{
                  display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
                  gap:6, marginBottom:4, padding:'8px 0',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border-soft)'
                }}
              >
                <div style={{ fontSize:13, color:'var(--text)', alignSelf:'center' }}>{name}</div>
                {RATINGS.map(r => {
                  const sel = criteria[name] === r.key;
                  return (
                    <div key={r.key} style={{ display:'flex', justifyContent:'center' }}>
                      <button
                        type="button"
                        disabled={isGraded}
                        onClick={() => toggleCriteria(name, r.key)}
                        style={{
                          width:28, height:28, borderRadius:'50%',
                          border: sel ? `2px solid ${r.color}` : '1.5px solid var(--border)',
                          background: sel ? r.color : 'var(--surface)',
                          cursor: isGraded ? 'default' : 'pointer',
                          transition:'background-color 0.12s ease, border-color 0.12s ease',
                          opacity: isGraded && !sel ? 0.5 : 1,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Global Rating */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              {t('globalRating')}
            </div>
            <div style={{ display:'flex', gap:12 }}>
              {['competent','not-competent'].map(val => {
                const active = globalRating === val;
                const color  = val === 'competent' ? 'var(--success)' : 'var(--danger)';
                return (
                  <button
                    key={val} type="button" disabled={isGraded}
                    onClick={() => !isGraded && setGlobalRating(active ? '' : val)}
                    style={{
                      flex:1, padding:'12px 0', borderRadius:10,
                      border: active ? `2px solid ${color}` : '1.5px solid var(--border)',
                      background: active ? (val==='competent' ? 'var(--success-bg)' : 'var(--danger-bg)') : 'var(--surface)',
                      color: active ? color : 'var(--text-2)',
                      fontWeight:700, fontSize:14,
                      cursor: isGraded ? 'default' : 'pointer',
                      transition:'background-color .15s ease, border-color .15s ease, color .15s ease'
                    }}
                  >
                    {val === 'competent' ? t('competent') : t('notCompetent')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Letter Grade */}
          {!isGraded && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:8 }}>
                {t('letterGrade')}
              </div>
              <GradeBubbles
                selected={letterGrade}
                onChange={setLetterGrade}
                disabled={isGraded}
              />
            </div>
          )}

          {/* Comments */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>
              {isGraded ? t('assessmentNotes') : t('commentsNotes')}
            </div>
            <textarea
              disabled={isGraded}
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder={t('commentsPlaceholder')}
              style={{
                width:'100%', minHeight:90, padding:'10px 12px',
                border:'1.5px solid var(--border)', borderRadius:8, fontSize:13,
                color:'var(--text)', resize:'vertical', fontFamily:'inherit',
                background: isGraded ? 'var(--surface-2)' : 'var(--surface)'
              }}
            />
          </div>

          {/* Review Note */}
          {!isGraded && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>
                {t('reviewNote')}
              </div>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder={t('reviewNotePlaceholder')}
                style={{
                  width:'100%', minHeight:70, padding:'10px 12px',
                  border:'1.5px solid var(--border)', borderRadius:8, fontSize:13,
                  color:'var(--text)', resize:'vertical', fontFamily:'inherit',
                  background:'var(--surface)'
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              background:'var(--danger-bg)', borderRadius:8, padding:'10px 14px',
              fontSize:13, color:'var(--danger-fg)', marginBottom:16
            }}>
              {error}
            </div>
          )}

          {isGraded && (
            <div style={{
              background:'var(--success-bg)', border:'1px solid var(--success)',
              borderRadius:10, padding:'14px 16px', marginBottom:16,
              display:'flex', alignItems:'center', gap:10
            }}>
              <div style={{ fontSize:20, color:'var(--success)' }}>✓</div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--success-fg)' }}>
                  {t('assessmentSubmitted')}
                </div>
                <div style={{ fontSize:12, color:'var(--success-fg)', marginTop:2 }}>
                  {t('statusLine')}: {report.status} · {t('by')} {report.gradedBy?.name || report.reviewedBy?.name || '—'}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isGraded && (
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
              <button
                type="button"
                onClick={() => handleSubmit('rejected')}
                disabled={saving}
                style={{
                  padding:'9px 20px', borderRadius:8, background:'var(--danger)',
                  color:'#fff', border:'none', fontWeight:500, fontSize:13,
                  cursor:'pointer', opacity: saving ? 0.7 : 1
                }}
              >
                {t('reject')}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('graded')}
                disabled={saving}
                style={{
                  padding:'9px 20px', borderRadius:8, background:'var(--accent)',
                  color:'#fff', border:'none', fontWeight:500, fontSize:13,
                  cursor:'pointer', boxShadow:'0 2px 8px rgba(255,107,53,.35)',
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? t('saving') : t('approveAssess')}
              </button>
            </div>
          )}

          {isGraded && (
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding:'9px 20px', borderRadius:8, background:'var(--accent)',
                  color:'#fff', border:'none', fontWeight:500, fontSize:13, cursor:'pointer'
                }}
              >{t('close')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupervisorReports() {
  const { user: me }     = useAuth();
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [reports,     setReports    ] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [search,      setSearch     ] = useState('');
  const [filter,      setFilter     ] = useState('all');
  const [assessModal, setAssessModal] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/supervisor/reports')
      .then(r => {
        const list = r.data?.data || r.data || [];
        // Block final reports — supervisor only handles weekly/monthly
        const filtered = (Array.isArray(list) ? list : []).filter(rep => rep.type !== 'final');
        setReports(filtered);
      })
      .catch(() => showToast(t('loadFailed'), 'error'))
      .finally(() => setLoading(false));
  }, []);

  function handleAssessmentSaved(updated) {
    if (!updated?._id) {
      showToast(t('savedIncomplete'), 'error');
      return;
    }
    setReports(prev => prev.map(r => r._id === updated._id ? updated : r));
    showToast(t('submitSuccess'));
  }

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const gradedCount  = reports.filter(r => r.status === 'graded' || r.status === 'approved').length;

  const displayed = reports.filter(r => {
    const matchFilter =
      filter === 'all'     ? true :
      filter === 'pending' ? r.status === 'pending' :
      ['graded','approved'].includes(r.status);
    const q = search.toLowerCase();
    const matchSearch = !q
      || r.student?.name?.toLowerCase().includes(q)
      || r.title?.toLowerCase().includes(q)
      || r.type?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
          {[0,1].map(i => (
            <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} />
              <Sk w={120} h={14} />
            </div>
          ))}
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
            <Sk h={36} r={8} />
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              {[...Array(8)].map((_,i) => (
                <tr key={i} style={{ borderBottom:'1px solid var(--border-soft)' }}>
                  <td style={{ padding:'13px 16px' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={120} h={13} /></div></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={140} h={13} /></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={60} h={22} r={20} /></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={80} h={13} /></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={80} h={22} r={20} /></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={80} h={32} r={8} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>

        {/* Stat Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
          {[
            { label:t('pendingReview'), count:pendingCount, color:'var(--warning)', bg:'var(--warning-bg)' },
            { label:t('assessed'),      count:gradedCount,  color:'var(--success)', bg:'var(--success-bg)' },
          ].map(c => (
            <div key={c.label} style={{
              background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:14
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:c.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, fontWeight:700, color:c.color, flexShrink:0
              }}>{c.count}</div>
              <div style={{ fontSize:13, color:'var(--text-2)', fontWeight:500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>

          {/* Toolbar */}
          <div style={{
            padding:'14px 20px', borderBottom:'1px solid var(--border)',
            display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'
          }}>
            <input
              className="admin-search"
              style={{ flex:1, minWidth:200, height:36 }}
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ display:'flex', gap:6 }}>
              {[
                ['pending', `${t('filterPending')} (${pendingCount})`],
                ['graded',  `${t('filterAssessed')} (${gradedCount})`],
                ['all',     `${t('filterAll')} (${reports.length})`],
              ].map(([val, label]) => (
                <button
                  key={val}
                  className={`filter-tab${filter === val ? ' active' : ''}`}
                  onClick={() => setFilter(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('colNum')}</th>
                  <th>{t('colTrainee')}</th>
                  <th>{t('colTitle')}</th>
                  <th>{t('colType')}</th>
                  <th>{t('colDate')}</th>
                  <th>{t('colFile')}</th>
                  <th>{t('colStatus')}</th>
                  <th>{t('colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>
                      {t('noReports')}
                    </td>
                  </tr>
                )}
                {displayed.map((r, i) => (
                  <tr key={r._id} style={{ background: r.status==='pending' ? 'var(--surface-2)' : 'var(--surface)' }}>
                    <td style={{ color:'var(--text-muted)' }}>{i + 1}</td>

                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {r.student?.photoUrl
                          ? <img src={`${API_BASE}${r.student.photoUrl}`} alt="" className="cell-photo" />
                          : <div className="cell-initials">{r.student?.initials || r.student?.name?.[0] || '?'}</div>
                        }
                        <div>
                          <strong>{r.student?.name || '—'}</strong>
                          {r.student?.studentId && (
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{t('idLabel')}: {r.student.studentId}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ maxWidth:180 }}>
                      <div style={{ fontWeight:500, color:'var(--text)', fontSize:13 }}>{r.title}</div>
                    </td>

                    <td>
                      <span className={r.type==='monthly' ? 'badge badge-amber' : 'badge badge-blue'}>
                        {r.type}
                      </span>
                    </td>

                    <td style={{ whiteSpace:'nowrap' }}>{fmtDate(r.date)}</td>

                    <td>
                      {r.fileUrl
                        ? <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer"
                             className="btn-action view" title={t('fileView')} aria-label={t('fileView')}
                             style={{ display:'inline-flex' }}>
                            <IconEye size={16} />
                          </a>
                        : <span style={{ color:'var(--text-muted)', fontSize:12 }}>{t('fileNone')}</span>
                      }
                    </td>

                    <td>
                      {(r.status==='graded' || r.status==='approved') ? (
                        <span className="status-ic status-ic-green" title={t('statusAssessed')}><IconCheck size={15} /></span>
                      ) : r.status === 'rejected' ? (
                        <span className="status-ic status-ic-red" title={t('statusRejected')}><IconXCircle size={15} /></span>
                      ) : (
                        <span className="status-ic status-ic-amber" title={t('statusPending')}><IconClock size={15} /></span>
                      )}
                    </td>

                    <td>
                      {r.status === 'pending' ? (
                        <button
                          className="btn-primary"
                          style={{ fontSize:12, padding:'6px 14px' }}
                          onClick={() => setAssessModal(r)}
                        >
                          {t('btnAssess')}
                        </button>
                      ) : (
                        <button
                          className="btn-action view"
                          title={t('view')}
                          aria-label={t('view')}
                          onClick={() => setAssessModal(r)}
                        >
                          <IconEye size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {assessModal && (
          <AssessmentModal
            report={assessModal}
            supervisor={me}
            onClose={() => setAssessModal(null)}
            onSaved={handleAssessmentSaved}
          />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
