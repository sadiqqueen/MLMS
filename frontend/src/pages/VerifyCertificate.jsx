import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
}

export default function VerifyCertificate() {
  const { code }     = useParams();
  const [result,     setResult    ] = useState(null);
  const [loading,    setLoading   ] = useState(false);
  const [manualCode, setManualCode] = useState(code || '');

  async function verify(verifyCode) {
    if (!verifyCode.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.get(`/api/certificates/verify/${verifyCode.trim()}`);
      setResult(res.data?.data || res.data);
    } catch {
      setResult({ valid:false, message:'Verification failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (code) verify(code);
  }, [code]);

  return (
    <div style={{
      minHeight:'100vh', background:'#F5F6FA',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:24,
      fontFamily:'Inter,-apple-system,BlinkMacSystemFont,sans-serif'
    }}>
      <img src="/logo.png" alt="MTMS" style={{ height:72, marginBottom:24 }} />

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
          <div style={{ border:'2px solid #059669', borderRadius:12, padding:24, background:'#F0FDF4' }}>
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
                ['Trainee Name', result.trainee   || '—'],
                ['Student ID',   result.studentId || '—'],
                ['Specialty',    result.specialty || '—'],
                ['Hospital',     result.hospital  || '—'],
                ['Issue Date',   fmt(result.issuedAt)],
                ['Issued By',    result.issuedBy  || '—'],
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
              Verify Code: {manualCode || code}
            </div>
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

      <div style={{ fontSize:12, color:'#8B8FA8', marginTop:20, textAlign:'center', maxWidth:400 }}>
        This verification service confirms the authenticity of certificates issued by the Medical Training Management System (MTMS).
      </div>
    </div>
  );
}
