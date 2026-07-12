/**
 * CertificatePrint.jsx
 * Formal printable certificate page for AMETI.
 *
 * Route: /dio/certificates/:id/print  (also accessible from DioTraineeDetail)
 * Backend endpoint: GET /api/certificates/:id/print
 *   Returns formatCertificateForPrint() which includes:
 *   traineeFullName, traineeId, specialty, hospital, programDates,
 *   issueDate, issuedByName, type, verifyCode, verificationUrl, code
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
}

function textValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || value.fullName || fallback;
  return fallback;
}

export default function CertificatePrint() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [cert,     setCert   ] = useState(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError  ] = useState('');

  useEffect(() => {
    api.get(`/api/certificates/${id}/print`)
      .then(r => setCert(r.data?.data || r.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load certificate'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--app-bg)' }}>
      <div style={{ fontSize:15, color:'var(--text-2)' }}>Loading certificate…</div>
    </div>
  );

  if (error || !cert) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16 }}>
      <div style={{ color:'var(--danger)', fontSize:15 }}>{error || 'Certificate not found'}</div>
      <button onClick={() => navigate(-1)} style={{ padding:'8px 20px', borderRadius:8, background:'#1B1464', color:'#fff', border:'none', cursor:'pointer' }}>Go Back</button>
    </div>
  );

  const trainee     = cert.trainee       || {};
  const hospital    = cert.hospital      || {};
  const startDate   = cert.programDates?.startDate || cert.rotationDates?.startDate;
  const endDate     = cert.programDates?.endDate   || cert.rotationDates?.endDate;
  const verifyUrl   = cert.verificationUrl || `${window.location.origin}/verify/${cert.verifyCode || cert.code}`;
  const certType    = cert.type || 'Completion';
  const isRevoked   = cert.status === 'revoked';
  const specialtyName = textValue(cert.specialty, '');
  const hospitalName = textValue(cert.hospital || cert.trainingSite, '');

  return (
    <div className="cert-print-root">

      {/* Screen-only action bar */}
      <div className="cert-actions no-print">
        <button onClick={() => navigate(-1)}
          style={{ padding:'9px 20px', borderRadius:8, background:'#fff', color:'#374151', border:'1px solid #D1D5DB', fontWeight:500, fontSize:14, cursor:'pointer' }}>
          ← Back
        </button>
        {!isRevoked && (
          <button onClick={() => window.print()}
            style={{ padding:'9px 24px', borderRadius:8, background:'#1B1464', color:'#fff', border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>
            🖨 Print Certificate
          </button>
        )}
        {isRevoked && (
          <div style={{ background:'#FEE2E2', color:'#991B1B', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:600 }}>
            ⚠ This certificate has been revoked and cannot be printed.
          </div>
        )}
      </div>

      {/* Certificate document */}
      <div className="cert-page certificate-print-area" id="cert-print-area">

        {/* Watermark for revoked */}
        {isRevoked && (
          <div style={{
            position:'absolute', top:'50%', left:'50%',
            transform:'translate(-50%,-50%) rotate(-35deg)',
            fontSize:72, fontWeight:900, color:'rgba(220,38,38,.12)',
            whiteSpace:'nowrap', userSelect:'none', zIndex:0, pointerEvents:'none'
          }}>
            REVOKED
          </div>
        )}

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8mm', position:'relative', zIndex:1 }}>
          <img src="/ameti-logo.jpeg" alt="AMETI" style={{ height:64, width:'auto', display:'block', mixBlendMode:'multiply' }}
            onError={e => { e.target.style.display='none'; }} />
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>AMETI — Academy of Medical Education and Training in Iraq</div>
            <div style={{ fontSize:11, color:'#6B7280' }}>Qimam Foundation for Health & Educational Services</div>
          </div>
        </div>

        {/* Top border rule */}
        <div style={{ borderTop:'3px solid #0C2D5E', marginBottom:'6mm' }}></div>
        <div style={{ borderTop:'1px solid #FF6B35', marginBottom:'8mm' }}></div>

        {/* Title block */}
        <div style={{ textAlign:'center', marginBottom:'8mm', position:'relative', zIndex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.18em', color:'#6B7280', textTransform:'uppercase', marginBottom:'3mm' }}>
            Certificate of {certType}
          </div>
          <div style={{ fontSize:28, fontWeight:900, color:'#0C2D5E', letterSpacing:'-0.01em', lineHeight:1.15 }}>
            شهادة {certType === 'Completion' ? 'إتمام التدريب' : 'التدريب الطبي'}
          </div>
        </div>

        {/* Issued to */}
        <div style={{ textAlign:'center', marginBottom:'7mm', position:'relative', zIndex:1 }}>
          <div style={{ fontSize:12, color:'#6B7280', fontWeight:500, marginBottom:'2mm' }}>This is to certify that</div>
          <div style={{ fontSize:32, fontWeight:900, color:'#0C2D5E', fontFamily:'Georgia, serif', marginBottom:'1mm', lineHeight:1.2 }}>
            {cert.traineeFullName || trainee.fullName || trainee.name || '—'}
          </div>
          {(cert.traineeId || trainee.studentId) && (
            <div style={{ fontSize:12, color:'#6B7280' }}>
              Student ID: <strong style={{ color:'#374151' }}>{cert.traineeId || trainee.studentId}</strong>
            </div>
          )}
        </div>

        {/* Body text */}
        <div style={{ textAlign:'center', fontSize:13, color:'#374151', lineHeight:1.8, marginBottom:'7mm', maxWidth:'140mm', margin:'0 auto 7mm', position:'relative', zIndex:1 }}>
          has successfully completed the required clinical training program
          {specialtyName ? (
            <> in <strong style={{ color:'#0C2D5E' }}>{specialtyName}</strong></>
          ) : null}
          {hospitalName ? (
            <> at <strong style={{ color:'#0C2D5E' }}>{hospitalName}</strong></>
          ) : null}
          {(startDate || endDate) ? (
            <>, from <strong>{fmtDate(startDate)}</strong> to <strong>{fmtDate(endDate)}</strong></>
          ) : null}
          .
        </div>

        {/* Info grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'4mm 8mm', background:'#F8FAFD', border:'1px solid #E5E7EB', borderRadius:8, padding:'6mm', marginBottom:'8mm', position:'relative', zIndex:1 }}>
          {[
            ['Specialty / Program', specialtyName || '—'],
            ['Training Site', hospitalName || '—'],
            ['Issue Date', fmtDate(cert.issueDate)],
            ['Training From', fmtDate(startDate)],
            ['Training To', fmtDate(endDate)],
            ['Issued By', cert.issuedByName || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize:9, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1mm' }}>
                {label}
              </div>
              <div style={{ fontSize:12, fontWeight:600, color:'#1F2937' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Signature area */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'6mm', position:'relative', zIndex:1 }}>

          {/* Seal placeholder */}
          <div style={{ width:60, height:60, borderRadius:'50%', border:'3px solid #0C2D5E', display:'flex', alignItems:'center', justifyContent:'center', opacity:0.25, flexShrink:0 }}>
            <div style={{ textAlign:'center', fontSize:8, fontWeight:700, color:'#0C2D5E', lineHeight:1.2 }}>OFFICIAL<br/>SEAL</div>
          </div>

          {/* Centre: cert ID */}
          <div style={{ textAlign:'center', flex:1, padding:'0 8mm' }}>
            <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:'1mm' }}>Certificate ID</div>
            <div style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, color:'#374151', wordBreak:'break-all' }}>
              {cert.verifyCode || cert.code || cert._id}
            </div>
          </div>

          {/* Right: signature line */}
          <div style={{ textAlign:'center', minWidth:120, flexShrink:0 }}>
            <div style={{ borderBottom:'2px solid #0C2D5E', width:120, marginBottom:'2mm' }}></div>
            <div style={{ fontSize:10, fontWeight:700, color:'#374151' }}>{cert.issuedByName || 'DIO'}</div>
            <div style={{ fontSize:9, color:'#6B7280' }}>Director of Internship and Orientation</div>
          </div>
        </div>

        {/* Bottom rule */}
        <div style={{ borderTop:'1px solid #FF6B35', marginBottom:'3mm' }}></div>
        <div style={{ borderTop:'3px solid #0C2D5E', marginBottom:'4mm' }}></div>

        {/* Verification footer */}
        <div style={{ textAlign:'center', fontSize:10, color:'#6B7280', position:'relative', zIndex:1 }}>
          <div style={{ marginBottom:'1mm' }}>
            This certificate can be verified online at:
          </div>
          <div style={{ fontFamily:'monospace', fontWeight:600, color:'#0C2D5E', wordBreak:'break-all' }}>
            {verifyUrl}
          </div>
          <div style={{ marginTop:'1mm', fontSize:9, color:'#9CA3AF' }}>
            AMETI · Academy of Medical Education and Training in Iraq · {new Date().getFullYear()}
          </div>
        </div>

      </div>

    </div>
  );
}
