import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const API_BASE = '';

const EMPTY = '—';

function label(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || '';
  return '';
}

function firstLabel(...values) {
  return values.map(label).find(Boolean) || EMPTY;
}

function renderValue(value) {
  if (Array.isArray(value)) return value.map(label).filter(Boolean).join(', ') || EMPTY;
  return firstLabel(value);
}

function getSpecialty(t) { return firstLabel(t?.specialtyId, t?.specialty, t?.specialtyName); }
function getHospital(t)  { return firstLabel(t?.hospitalId, t?.hospital, t?.hospitalName); }

function DetailModal({ item, fields, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:460, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'20px 24px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:'#1B1464', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, flexShrink:0 }}>
            {item.initials || item.name?.slice(0,2)?.toUpperCase() || '?'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17, fontWeight:700, color:'var(--brand-secondary)' }}>{item.name}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{item.email}</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'var(--surface-2)', border:'none', fontSize:18, color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ padding:'20px 24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 20px' }}>
            {fields.map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:14, color:'var(--brand-secondary)', fontWeight:500 }}>{renderValue(value)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 20px', borderRadius:8, background:'#FF6B35', color:'#fff', border:'none', fontWeight:500, fontSize:13, cursor:'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function PresidentTrainees() {
  const [trainees, setTrainees] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const [view,     setView    ] = useState('list');
  const [search,   setSearch  ] = useState('');
  const [selected, setSelected] = useState(null);
  const [toasts,   setToasts  ] = useState([]);

  function showToast(msg, type='error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message:msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/president/trainees')
      .then(r => setTrainees(r.data?.data || r.data || []))
      .catch(() => showToast('Failed to load trainees'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = trainees.filter(t => {
    const q = search.toLowerCase();
    return !q
      || t.name?.toLowerCase().includes(q)
      || (t.studentId || '').toLowerCase().includes(q)
      || getSpecialty(t).toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(8)].map((_,i) => (
                <tr key={i}>
                  <td><Sk w={20} h={13} /></td>
                  <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                  <td><Sk w={100} h={22} r={20} /></td>
                  <td><Sk w={110} h={13} /></td>
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
<div className="admin-card">
          <div className="admin-toolbar">
            <input className="admin-search" style={{ flex:1, minWidth:200 }} placeholder="Search by name, ID, or specialty…" value={search} onChange={e => setSearch(e.target.value)} />
            <ViewToggle value={view} onChange={setView} />
            <span style={{ fontSize:13, color:'var(--text-muted)', flexShrink:0 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {view === 'list' && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>#</th><th>Trainee</th><th>Specialty</th><th>Hospital</th><th>Student ID</th></tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>🎓</div>
                    <div style={{ fontSize:15, fontWeight:600, color:'var(--text-2)' }}>
                      {trainees.length === 0 ? 'No trainees found' : 'No results match your search'}
                    </div>
                  </td></tr>
                )}
                {filtered.map((t, i) => (
                  <tr key={t._id} style={{ cursor:'pointer' }} onClick={() => setSelected(t)}>
                    <td style={{ color:'var(--text-muted)' }}>{i+1}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {t.photoUrl
                          ? <img src={`${API_BASE}${t.photoUrl}`} alt="" className="cell-photo" />
                          : <div className="cell-initials">{t.initials || t.name?.[0] || '?'}</div>
                        }
                        <div><strong>{t.name}</strong><div style={{ fontSize:11, color:'var(--text-muted)' }}>{t.email}</div></div>
                      </div>
                    </td>
                    <td><span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'var(--chip-spec-bg)', color:'var(--chip-spec-fg)' }}>{getSpecialty(t)}</span></td>
                    <td style={{ fontSize:13, color:'var(--text-2)' }}>{getHospital(t)}</td>
                    <td style={{ fontSize:13, color:'var(--text-2)' }}>{t.studentId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          {view === 'card' && (
            <div className="management-card-grid">
              {filtered.length === 0 && <div className="admin-empty" style={{ gridColumn:'1/-1' }}>{trainees.length === 0 ? 'No trainees found' : 'No results match your search'}</div>}
              {filtered.map(t => (
                <div className="management-card" key={t._id} onClick={() => setSelected(t)} style={{ cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>{t.photoUrl ? <img src={`${API_BASE}${t.photoUrl}`} alt="" className="cell-photo" /> : <div className="cell-initials">{t.initials || t.name?.[0] || '?'}</div>}<div><div className="management-card-title">{t.name}</div><div className="management-card-sub">{t.email}</div></div></div>
                  <div className="management-card-meta"><span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'var(--chip-spec-bg)', color:'var(--chip-spec-fg)' }}>{getSpecialty(t)}</span></div>
                  <div className="management-card-sub">{getHospital(t)} - {t.studentId || 'No ID'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <DetailModal
            item={selected}
            fields={[
              ['Student ID', selected.studentId],
              ['Phone',      selected.phone],
              ['Specialty',  getSpecialty(selected)],
              ['Hospital',   getHospital(selected)],
              ['Year',       selected.year ? `Year ${selected.year}` : null],
              ['City',       selected.city],
            ]}
            onClose={() => setSelected(null)}
          />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
