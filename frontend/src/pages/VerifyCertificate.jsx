import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { usePrefs } from '../context/PrefsContext';

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
}

function textValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.fullName || value.title || fallback;
  return fallback;
}

export default function VerifyCertificate() {
  const { code }     = useParams();
  const { theme }    = usePrefs();
  const logoSrc      = theme === 'dark' ? '/logo-light.png' : '/logo.png';
  const [result,     setResult    ] = useState(null);
  const [loading,    setLoading   ] = useState(false);
  const [manualCode, setManualCode] = useState(code || '');
  const verifiedCode = result?.verifyCode || manualCode || code || '—';

  async function verify(verifyCode) {
    if (!verifyCode.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.get(`/api/certificates/verify/${verifyCode.trim()}`);
      setResult(res.data?.data || res.data);
    } catch (err) {
      const errData = err?.response?.data;
      setResult({ valid: false, message: errData?.message || 'Verification failed. Please try again.', revokedAt: errData?.revokedAt });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (code) verify(code);
  }, [code]);

  return (
    <div style={{
      minHeight:'100vh', background:'var(--app-bg)',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:24,
      fontFamily:'Inter,-apple-system,BlinkMacSystemFont,sans-serif'
    }}>
      <img src={logoSrc} alt="MTMS" style={{ height:72, marginBottom:24 }} />

      <div style={{
        background:'#fff', borderRadius:16, border:'1px solid #E8E9EF',
        padding:'32px 36px', width:'100%', maxWidth:480,
        boxShadow:'0 4px 20px rgba(0,0,0,.08)'
      }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#1B1464', marginBottom:6 }}>
            Certificate Verification
          </div>
          <div style={{ fontSize:13, color:'#8B8FA8' }}>
            Enter a verification code to check if a certificate is valid
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          <input
            style={{
              flex:1, height:42, border:'1.5px solid #E8E9EF', borderRadius:8,
              padding:'0 14px', fontSize:13, color:'#1B1464', outline:'none',
              fontFamily:'monospace', letterSpacing:'0.05em'
            }}
            placeholder="Enter verify code…"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && verify(manualCode)}
            onFocus={e => e.target.style.borderColor = '#1B1464'}
            onBlur={e => e.target.style.borderColor = '#E8E9EF'}
          />
          <button
            style={{
              padding:'0 20px', height:42, borderRadius:8, background:'#FF6B35',
              color:'#fff', border:'none', fontWeight:600, fontSize:13,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
            onClick={() => verify(manualCode)}
            disabled={loading}
          >
            {loading ? '⏳' : 'Verify'}
          </button>
        </div>

        {loading && (
          <div style={{ textAlign:'center', padding:20, color:'#8B8FA8', fontSize:14 }}>
            Checking certificate…
          </div>
        )}

        {!loading && result?.valid && (
          <div className="certificate-print-area" style={{ border:'2px solid #059669', borderRadius:12, padding:24, background:'#F0FDF4', position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:18, borderBottom:'1px solid #BBF7D0', paddingBottom:14 }}>
              <img src="/logo.png" alt="MTMS" style={{ height:44, width:'auto' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:15, fontWeight:800, color:'#0C2D5E' }}>Certificate of Training</div>
                <div style={{ fontSize:11, color:'#047857' }}>Medical Training Management System</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <div style={{
                width:44, height:44, borderRadius:'50%', background:'#059669',
                color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, flexShrink:0
              }}>✓</div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#065F46' }}>Certificate is Valid</div>
                <div style={{ fontSize:12, color:'#047857', marginTop:2 }}>This certificate has been verified successfully</div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 20px' }}>
              {[
                ['Trainee Name', textValue(result.holder || result.trainee)],
                ['Student ID',   textValue(result.studentId)],
                ['Specialty',    textValue(result.specialty)],
                ['Hospital',     textValue(result.hospital)],
                ['Issue Date',   fmt(result.issueDate || result.issuedAt)],
                ['Issued By',    textValue(result.issuedBy)],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:14, color:'#1B1464', fontWeight:500 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop:18, padding:'10px 14px', background:'#D1FAE5',
              borderRadius:8, fontSize:12, color:'#065F46', fontFamily:'monospace',
              wordBreak:'break-all'
            }}>
              Verify Code: {verifiedCode}
            </div>

            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:18, marginTop:22 }}>
              <div style={{ width:62, height:62, borderRadius:'50%', border:'3px solid #0C2D5E', opacity:.28, display:'flex', alignItems:'center', justifyContent:'center', color:'#0C2D5E', fontSize:8, fontWeight:800, textAlign:'center', lineHeight:1.2 }}>
                OFFICIAL<br />SEAL
              </div>
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ borderBottom:'2px solid #0C2D5E', width:140, margin:'0 auto 6px' }}></div>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151' }}>{textValue(result.issuedBy, 'Authorized Officer')}</div>
                <div style={{ fontSize:10, color:'#6B7280' }}>Authorized Signature</div>
              </div>
            </div>

            <button
              type="button"
              className="no-print"
              onClick={() => window.print()}
              style={{ marginTop:18, width:'100%', height:42, borderRadius:8, background:'#1B1464', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer' }}
            >
              Print Certificate
            </button>
          </div>
        )}

        {!loading && result && !result.valid && (
          <div style={{ border:'2px solid #DC2626', borderRadius:12, padding:24, background:'#FEF2F2', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✗</div>
            <div style={{ fontSize:16, fontWeight:700, color:'#991B1B', marginBottom:6 }}>Certificate Not Valid</div>
            <div style={{ fontSize:13, color:'#B91C1C' }}>
              {result.message || 'This certificate could not be verified. It may be invalid or revoked.'}
            </div>
            {result.revokedAt && (
              <div style={{ fontSize:12, color:'#DC2626', marginTop:8 }}>
                Revoked on: {fmt(result.revokedAt)}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:20, textAlign:'center', maxWidth:400 }}>
        This verification service confirms the authenticity of certificates issued by the Medical Training Management System (MTMS).
      </div>
    </div>
  );
}
