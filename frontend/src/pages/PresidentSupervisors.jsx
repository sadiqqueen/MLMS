import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const API_BASE = '';

function DetailModal({ item, fields, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'20px 24px', borderBottom:'1px solid #E8E9EF' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:'#1B1464', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, flexShrink:0 }}>
            {item.initials || item.name?.slice(0,2)?.toUpperCase() || '?'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17, fontWeight:700, color:'#1B1464' }}>{item.name}</div>
            <div style={{ fontSize:12, color:'#8B8FA8', marginTop:2 }}>{item.email}</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'#F5F6FA', border:'none', fontSize:18, color:'#8B8FA8', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ padding:'20px 24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 20px' }}>
            {fields.map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize:10, color:'#8B8FA8', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:14, color:'#1B1464', fontWeight:500 }}>{value || '—'}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid #E8E9EF', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 20px', borderRadius:8, background:'#FF6B35', color:'#fff', border:'none', fontWeight:500, fontSize:13, cursor:'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function PresidentSupervisors() {
  const [supervisors, setSupervisors] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [search,      setSearch     ] = useState('');
  const [selected,    setSelected   ] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(msg, type='error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message:msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/president/supervisors')
      .then(r => setSupervisors(r.data?.data || r.data || []))
      .catch(() => showToast('Failed to load supervisors'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = supervisors.filter(s => {
    const q = search.toLowerCase();
    return !q
      || s.name?.toLowerCase().includes(q)
      || s.email?.toLowerCase().includes(q)
      || (s.specialtyId?.name || s.specialty || '').toLowerCase().includes(q)
      || (s.department || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(7)].map((_,i) => (
                <tr key={i}>
                  <td><Sk w={20} h={13} /></td>
                  <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                  <td><Sk w={100} h={22} r={20} /></td>
                  <td><Sk w={90}  h={13} /></td>
                  <td><Sk w={80}  h={13} /></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#166534', display:'flex', alignItems:'center', gap:8 }}>
          <span>👁</span> Read-only view — {supervisors.length} supervisor{supervisors.length !== 1 ? 's' : ''} in this hospital
        </div>

        <div className="admin-card">
          <div className="admin-toolbar">
            <input className="admin-search" style={{ flex:1, minWidth:200 }} placeholder="Search by name, email, specialty, or department…" value={search} onChange={e => setSearch(e.target.value)} />
            <span style={{ fontSize:13, color:'#8B8FA8', flexShrink:0 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>#</th><th>Supervisor</th><th>Specialty</th><th>Department</th><th>Phone</th></tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'#8B8FA8' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>👨‍⚕️</div>
                    <div style={{ fontSize:15, fontWeight:600, color:'#4B5563' }}>
                      {supervisors.length === 0 ? 'No supervisors in this hospital' : 'No results match your search'}
                    </div>
                  </td></tr>
                )}
                {filtered.map((s, i) => (
                  <tr key={s._id} style={{ cursor:'pointer' }} onClick={() => setSelected(s)}>
                    <td style={{ color:'#8B8FA8' }}>{i+1}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {s.photoUrl
                          ? <img src={`${API_BASE}${s.photoUrl}`} alt="" className="cell-photo" />
                          : <div className="cell-initials">{s.initials || s.name?.[0] || '?'}</div>
                        }
                        <div><strong>{s.name}</strong><div style={{ fontSize:11, color:'#8B8FA8' }}>{s.email}</div></div>
                      </div>
                    </td>
                    <td><span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>{s.specialtyId?.name || s.specialty || '—'}</span></td>
                    <td style={{ fontSize:13, color:'#4B5563' }}>{s.department || '—'}</td>
                    <td style={{ fontSize:13, color:'#4B5563' }}>{s.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <DetailModal
            item={selected}
            fields={[
              ['Specialty',  selected.specialtyId?.name || selected.specialty],
              ['Department', selected.department],
              ['Phone',      selected.phone],
              ['City',       selected.city],
              ['Hospital',   selected.hospitalId?.name || selected.hospital?.name],
              ['Status',     selected.isActive === false ? 'Inactive' : 'Active'],
            ]}
            onClose={() => setSelected(null)}
          />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
