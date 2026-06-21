import { useEffect } from 'react';

const API_BASE = '';

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function fmtShort(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

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
  { key:'na',    label:'N/A',            color:'#b2bec3' },
  { key:'below', label:'Below Standard', color:'#FF4757' },
  { key:'meets', label:'Meets Standard', color:'#f39c12' },
  { key:'above', label:'Above Standard', color:'#00B894' },
];

// ── REPORT DETAIL MODAL ────────────────────────────────────────────────────
export default function ReportModal({ report, student, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (!report) return null;

  const criteria    = report.assessmentCriteria || {};
  const isGraded    = report.status === 'graded';
  const hasFullAssess = isGraded && report.globalRating;
  const rota        = report.rotation;
  const rotaStr     = rota ? `${fmtShort(rota.startDate)} – ${fmtShort(rota.endDate)}` : '—';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal report-print-modal">

        <div className="print-header">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="print-logo"><img src="/logo.png" alt="MTMS" className="print-logo-img" /></div>
              <div className="print-subtitle">Clinical Training Assessment Report</div>
            </div>
            <div style={{ textAlign:'right', fontSize:11, color:'var(--text-muted)' }}>
              <div>Printed: {new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</div>
              <div style={{ marginTop:2 }}>Status: <strong>{isGraded ? 'Assessed' : 'Pending'}</strong></div>
            </div>
          </div>
        </div>

        <div className="modal-header no-print">
          <div>
            <div className="modal-title">{report.title}</div>
            <div className="modal-meta">
              <span className={`badge ${report.type === 'final' ? 'badge-red' : report.type === 'monthly' ? 'badge-amber' : 'badge-blue'}`}>{report.type}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{fmtShort(report.date)}</span>
              {report.hospital?.name && <span style={{ fontSize:12, color:'var(--text-muted)' }}>{report.hospital.name}</span>}
              <span className={isGraded ? 'badge badge-green' : 'badge badge-amber'}>
                {isGraded ? 'Assessed' : 'Pending review'}
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-divider no-print" />

        <div className="modal-section">
          <div className="modal-section-title">Report Details</div>
          <div className="assess-grid">
            <div className="assess-info-item">
              <span className="modal-label">Report Title</span>
              <span className="modal-value">{report.title}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Report Type</span>
              <span className="modal-value" style={{ textTransform:'capitalize' }}>{report.type}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Date Submitted</span>
              <span className="modal-value">{fmt(report.date)}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Hospital</span>
              <span className="modal-value">{report.hospital?.name || '—'}</span>
            </div>
            {report.fileUrl && (
              <div className="assess-info-item">
                <span className="modal-label">Attached File</span>
                <a className="modal-link no-print" href={report.fileUrl} target="_blank" rel="noreferrer">View attachment ↗</a>
                <span className="print-only modal-value">{report.fileUrl}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-divider" />

        <div className="modal-section">
          <div className="modal-section-title">Trainee Information</div>
          <div className="assess-grid">
            <div className="assess-info-item">
              <span className="modal-label">Trainee's Name</span>
              <span className="modal-value">{student?.name || '—'}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">IMA Number</span>
              <span className="modal-value">{student?.studentId || '—'}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Rotation Period</span>
              <span className="modal-value">{rotaStr}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Rotation Status</span>
              <span className="modal-value" style={{ textTransform:'capitalize' }}>{rota?.status || '—'}</span>
            </div>
          </div>
        </div>

        <div className="modal-divider" />

        {isGraded ? (
          <>
            <div className="modal-section">
              <div className="modal-section-title">Assessment Result</div>
              <div style={{ display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap', marginBottom:12 }}>
                {report.grade && !['Competent','Not-Competent'].includes(report.grade) && (
                  <div style={{ textAlign:'center' }}>
                    <div className="grade-circle-lg" style={{ margin:'0 auto 4px' }}>{report.grade}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Letter Grade</div>
                  </div>
                )}
                {report.globalRating && (
                  <div style={{ textAlign:'center' }}>
                    <div style={{
                      padding:'10px 22px', borderRadius:10, fontWeight:700, fontSize:15,
                      background:report.globalRating === 'competent' ? 'var(--success-bg)' : 'var(--danger-bg)',
                      color:     report.globalRating === 'competent' ? 'var(--success)' : 'var(--danger)',
                      border:   `2px solid ${report.globalRating === 'competent' ? 'var(--success)' : 'var(--danger)'}`,
                    }}>
                      {report.globalRating === 'competent' ? 'Competent' : 'Not-Competent'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Global Rating</div>
                  </div>
                )}
                <div style={{ flex:1, minWidth:160 }}>
                  <div className="modal-row">
                    <span className="modal-label">Assessed by</span>
                    <span className="modal-value">{report.gradedBy?.name ?? '—'}</span>
                  </div>
                  <div className="modal-row" style={{ marginTop:6 }}>
                    <span className="modal-label">Assessed on</span>
                    <span className="modal-value">{fmt(report.gradedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-divider" />

            {hasFullAssess && (
              <>
                <div className="modal-section">
                  <div className="modal-section-title">ASR — Assessment Criteria</div>
                  <div className="report-asr-grid">
                    <div className="report-asr-header">
                      <div className="report-asr-name">Criteria</div>
                      {RATINGS.map(r => (
                        <div key={r.key} className="report-asr-col" style={{ color:r.color }}>{r.label}</div>
                      ))}
                    </div>
                    {ASR_CRITERIA.map((name, idx) => {
                      const selected = criteria[name];
                      return (
                        <div key={name} className={`report-asr-row${idx % 2 === 1 ? ' alt' : ''}`}>
                          <div className="report-asr-name">{name}</div>
                          {RATINGS.map(r => (
                            <div key={r.key} className="report-asr-col">
                              <div className="report-asr-bubble"
                                style={selected === r.key ? { background:r.color, borderColor:r.color } : {}} />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="modal-divider" />
              </>
            )}

            {report.assessorComments && (
              <>
                <div className="modal-section">
                  <div className="modal-section-title">Assessor's Comments</div>
                  <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, background:'var(--info-bg)', borderRadius:8, padding:'10px 14px', border:'1px solid var(--border-soft)' }}>
                    {report.assessorComments}
                  </div>
                </div>
                <div className="modal-divider" />
              </>
            )}

            <div className="modal-section">
              <div className="modal-section-title">Signatures</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, marginTop:4 }}>
                <div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>ASSESSOR'S SIGNATURE</div>
                  <div style={{ fontSize:15, fontStyle:'italic', color:'var(--link)', borderBottom:'2px solid var(--text)', paddingBottom:8, minHeight:32 }}>
                    {report.assessorSignature || ''}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{report.gradedBy?.name || ''}</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>TRAINEE'S SIGNATURE</div>
                  <div style={{ fontSize:15, fontStyle:'italic', color:'var(--link)', borderBottom:'2px solid var(--text)', paddingBottom:8, minHeight:32 }}>
                    {report.traineeSignature || ''}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{student?.name || ''}</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="modal-section">
            <div className="modal-pending-msg">
              This report has not been assessed yet. You will receive a notification once your doctor reviews it.
            </div>
          </div>
        )}

        {/* ── REPORT DOCUMENT — embedded file (PDF / image) ── */}
        {report.fileUrl && (
          <>
            <div className="modal-divider" />
            <div className="modal-section">
              <div className="modal-section-title">Report Document</div>
              <iframe
                src={`${API_BASE}${report.fileUrl}`}
                title="Report"
                style={{ width:'100%', height:480, border:'1px solid var(--border)', borderRadius:8 }}
              />
              <div className="no-print" style={{ marginTop:8 }}>
                <a className="modal-link" href={`${API_BASE}${report.fileUrl}`} target="_blank" rel="noreferrer">View attachment ↗</a>
              </div>
            </div>
          </>
        )}

        <div className="modal-actions no-print">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={() => window.print()}>🖨 Print as PDF</button>
        </div>

      </div>
    </div>
  );
}
