import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const SPECIALTY_NAMES = [
  'Internal Medicine',
  'Surgery',
  'Pediatrics',
  'Obstetrics & Gynecology',
  'Emergency Medicine',
];

const PDF_TYPES = [
  { key:'weekly',  label:'Weekly Report',  uploadPath:'upload-weekly'  },
  { key:'monthly', label:'Monthly Report', uploadPath:'upload-monthly' },
  { key:'final',   label:'Final Report',   uploadPath:'upload-final'   },
];

export default function AdminSpecialties() {
  const [specialties, setSpecialties] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [uploading,   setUploading  ] = useState({});  // { specialtyId_type: true }
  const [creating,    setCreating   ] = useState(false);
  const [newName,     setNewName    ] = useState('');
  const [toasts,      setToasts     ] = useState([]);
  const fileRefs = useRef({});

  function showToast(msg, type='success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message:msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }

  useEffect(() => {
    api.get('/api/specialties')
      .then(r => setSpecialties(r.data?.data || r.data || []))
      .catch(() => showToast('Failed to load specialties', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function createSpecialty() {
    if (!newName) return;
    setCreating(true);
    try {
      const res = await api.post('/api/specialties', { name: newName });
      const created = res.data?.data || res.data;
      setSpecialties(prev => [...prev, created]);
      setNewName('');
      showToast(`${newName} specialty created`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create specialty', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function uploadPdf(specialtyId, type, uploadPath, file) {
    const key = `${specialtyId}_${type}`;
    if (!file) return;
    if (!file.type.includes('pdf')) { showToast('Only PDF files are allowed', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('File must be under 10MB', 'error'); return; }

    setUploading(p => ({ ...p, [key]: true }));
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const res = await api.post(`/api/specialties/${specialtyId}/${uploadPath}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const updated = res.data?.data || res.data;
      setSpecialties(prev => prev.map(s => s._id === specialtyId ? { ...s, ...updated } : s));
      showToast(`${type.charAt(0).toUpperCase()+type.slice(1)} PDF uploaded successfully`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploading(p => ({ ...p, [key]: false }));
    }
  }

  function triggerUpload(specialtyId, type) {
    const key = `${specialtyId}_${type}`;
    if (!fileRefs.current[key]) return;
    fileRefs.current[key].click();
  }

  const existingNames = specialties.map(s => s.name);
  const remaining     = SPECIALTY_NAMES.filter(n => !existingNames.includes(n));

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:24 }}>
              <Sk w={200} h={18} style={{ marginBottom:16 }} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                {[0,1,2].map(j => <Sk key={j} h={80} r={8} />)}
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
      <main className="admin-main">

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#1B1464' }}>Specialties</div>
            <div style={{ fontSize:13, color:'#8B8FA8', marginTop:2 }}>
              Manage specialties and upload PDF report templates for each
            </div>
          </div>
        </div>

        {/* Create new specialty — only shows remaining ones */}
        {remaining.length > 0 && (
          <div style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:20, marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#1B1464', marginBottom:12 }}>
              Add Specialty
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <select
                className="admin-search"
                style={{ flex:1, minWidth:200 }}
                value={newName}
                onChange={e => setNewName(e.target.value)}
              >
                <option value="">— Select specialty to add —</option>
                {remaining.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button
                className="btn-purple"
                onClick={createSpecialty}
                disabled={!newName || creating}
                style={{ opacity: !newName || creating ? 0.6 : 1 }}
              >
                {creating ? 'Creating…' : '+ Add Specialty'}
              </button>
            </div>
          </div>
        )}

        {specialties.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'#8B8FA8' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔬</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#4B5563', marginBottom:6 }}>No specialties yet</div>
            <div style={{ fontSize:13 }}>Add the 5 specialties above to get started.</div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {specialties.map(specialty => (
            <div key={specialty._id} style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:24, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:17, fontWeight:700, color:'#1B1464' }}>
                    🔬 {specialty.name}
                  </div>
                  <div style={{ fontSize:12, color:'#8B8FA8', marginTop:3 }}>
                    {specialty.secretaryId?.name ? `Secretary: ${specialty.secretaryId.name}` : 'No secretary assigned'}
                    {specialty.hospitalId?.name ? ` · ${specialty.hospitalId.name}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
                  background: specialty.isActive !== false ? '#D1FAE5' : '#FEE2E2',
                  color:      specialty.isActive !== false ? '#065F46' : '#991B1B'
                }}>
                  {specialty.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
                {PDF_TYPES.map(({ key, label, uploadPath }) => {
                  const pdfField  = `${key}ReportPdf`;
                  const hasPdf    = !!specialty[pdfField];
                  const uploadKey = `${specialty._id}_${key}`;
                  const isLoading = !!uploading[uploadKey];

                  return (
                    <div key={key} style={{
                      border:'1px solid #E8E9EF', borderRadius:10, padding:'16px 14px',
                      background:'#F8F9FA', display:'flex', flexDirection:'column', gap:10
                    }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1B1464' }}>{label}</div>

                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                        {hasPdf ? (
                          <>
                            <span style={{ color:'#059669' }}>✓</span>
                            <a
                              href={specialty[pdfField]}
                              target="_blank" rel="noreferrer"
                              style={{ color:'#185FA5', fontWeight:500 }}
                            >
                              Template uploaded ↗
                            </a>
                          </>
                        ) : (
                          <>
                            <span style={{ color:'#D1D5DB' }}>○</span>
                            <span style={{ color:'#8B8FA8' }}>No template yet</span>
                          </>
                        )}
                      </div>

                      <button
                        style={{
                          padding:'7px 14px', borderRadius:7,
                          background: hasPdf ? '#EEEDFE' : '#FF6B35',
                          color: hasPdf ? '#1B1464' : '#fff',
                          border:'none', fontWeight:600, fontSize:12,
                          cursor: isLoading ? 'default' : 'pointer',
                          opacity: isLoading ? 0.7 : 1,
                          transition:'all .15s'
                        }}
                        onClick={() => triggerUpload(specialty._id, key)}
                        disabled={isLoading}
                      >
                        {isLoading ? '⏳ Uploading…' : hasPdf ? '↺ Replace PDF' : '⬆ Upload PDF'}
                      </button>

                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        style={{ display:'none' }}
                        ref={el => { fileRefs.current[uploadKey] = el; }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) uploadPdf(specialty._id, key, uploadPath, file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
      </main>
    </>
  );
}
