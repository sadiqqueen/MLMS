/**
 * PresidentHospitals.jsx
 * Read-only hospital overview for the President role.
 * Endpoint: GET /api/president/hospitals
 * Response includes: name, city, supervisorsCount, traineesCount, programDirector, supervisors
 */
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const EMPTY = '—';

function safeArr(value) {
  return Array.isArray(value) ? value : [];
}

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

function getSpecialty(user) {
  return firstLabel(user?.specialtyId, user?.specialty, user?.specialtyName);
}

function getProgramDirector(hospital) {
  return firstLabel(hospital?.programDirector, hospital?.programDirectorName);
}

function HospitalModal({ hospital, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'20px 24px', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--surface)', zIndex:10 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:'#1B1464', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
            🏥
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17, fontWeight:700, color:'var(--brand-secondary)' }}>{hospital.name}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{hospital.city || hospital.governorate || '—'}</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'var(--surface-2)', border:'none', fontSize:18, color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>
          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            {[
              { label:'Trainees',   value: hospital.traineesCount  ?? 0, bg:'var(--info-bg)', color:'var(--info-fg)' },
              { label:'Supervisors',value: hospital.supervisorsCount ?? 0, bg:'var(--success-bg)', color:'var(--success-fg)' },
              { label:'Status',     value: hospital.isActive !== false ? 'Active' : 'Inactive', bg: hospital.isActive !== false ? 'var(--success-bg)':'var(--danger-bg)', color: hospital.isActive !== false ? 'var(--success-fg)':'var(--danger-fg)' },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11, color:s.color, fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Info grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 20px' }}>
            {[
              ['City',            hospital.city],
              ['Governorate',     hospital.governorate],
              ['Address',         hospital.address],
              ['Phone',           hospital.phone],
              ['Email',           hospital.email],
              ['Program Director',getProgramDirector(hospital)],
            ].map(([label, value]) => renderValue(value) !== EMPTY ? (
              <div key={label}>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:13, color:'var(--brand-secondary)', fontWeight:500 }}>{renderValue(value)}</div>
              </div>
            ) : null)}
          </div>

          {/* Supervisors list */}
          {Array.isArray(hospital.supervisors) && hospital.supervisors.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                Supervisors ({hospital.supervisors.length})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {hospital.supervisors.map(s => (
                  <div key={s._id} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-2)', background:'var(--surface-2)', borderRadius:8, padding:'8px 12px' }}>
                    <span style={{ fontWeight:600 }}>{firstLabel(s.name)}</span>
                    <span style={{ color:'var(--text-muted)' }}>{getSpecialty(s)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 20px', borderRadius:8, background:'#FF6B35', color:'#fff', border:'none', fontWeight:500, fontSize:13, cursor:'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function PresidentHospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [view,      setView     ] = useState('list');
  const [search,    setSearch   ] = useState('');
  const [selected,  setSelected ] = useState(null);
  const [toasts,    setToasts   ] = useState([]);

  function showToast(msg, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/president/hospitals')
      .then(r => setHospitals(safeArr(r.data?.data || r.data)))
      .catch(() => showToast('Failed to load hospitals'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = safeArr(hospitals).filter(h => {
    const q = search.trim().toLowerCase();
    return !q
      || h.name?.toLowerCase().includes(q)
      || h.city?.toLowerCase().includes(q)
      || h.governorate?.toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(6)].map((_,i) => (
                <tr key={i}>
                  <td><Sk w={20} h={13} /></td>
                  <td><Sk w={150} h={13} /></td>
                  <td><Sk w={90}  h={13} /></td>
                  <td><Sk w={40}  h={22} r={20} /></td>
                  <td><Sk w={40}  h={22} r={20} /></td>
                  <td><Sk w={22}  h={22} r={20} /></td>
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
            <input className="admin-search" style={{ flex:1, minWidth:200 }}
              placeholder="Search by hospital name, city, or governorate…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <ViewToggle value={view} onChange={setView} />
            <span style={{ fontSize:13, color:'var(--text-muted)', flexShrink:0 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {view === 'list' && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Hospital</th>
                  <th>Location</th>
                  <th>Trainees</th>
                  <th>Supervisors</th>
                  <th>Program Director</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>🏥</div>
                    <div style={{ fontSize:15, fontWeight:600, color:'var(--text-2)' }}>
                      {hospitals.length === 0 ? 'No hospitals found' : 'No results match your search'}
                    </div>
                  </td></tr>
                )}
                {filtered.map((h, i) => {
                  const active = h.isActive !== false;
                  return (
                    <tr key={h._id} style={{ cursor:'pointer' }} onClick={() => setSelected(h)}>
                      <td style={{ color:'var(--text-muted)' }}>{i+1}</td>
                      <td>
                        <div style={{ fontWeight:700, color:'var(--brand-secondary)' }}>{h.name}</div>
                        {h.address && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{h.address}</div>}
                      </td>
                      <td style={{ fontSize:13, color:'var(--text-2)' }}>
                        {[h.city, h.governorate].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td>
                        <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'var(--info-bg)', color:'var(--info-fg)' }}>
                          {h.traineesCount ?? 0}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'var(--success-bg)', color:'var(--success-fg)' }}>
                          {h.supervisorsCount ?? 0}
                        </span>
                      </td>
                      <td style={{ fontSize:13, color:'var(--text-2)' }}>{getProgramDirector(h)}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20,
                          background: active ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color:      active ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
          {view === 'card' && (
            <div className="management-card-grid">
              {filtered.length === 0 && (
                <div className="admin-empty" style={{ gridColumn:'1/-1' }}>
                  {hospitals.length === 0 ? 'No hospitals found' : 'No results match your search'}
                </div>
              )}
              {filtered.map(h => {
                const active = h.isActive !== false;
                return (
                  <div className="management-card" key={h._id} onClick={() => setSelected(h)} style={{ cursor:'pointer' }}>
                    <div>
                      <div className="management-card-title">{h.name}</div>
                      <div className="management-card-sub">{[h.city, h.governorate].filter(Boolean).join(', ') || EMPTY}</div>
                    </div>
                    <div className="management-card-meta">
                      <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'var(--info-bg)', color:'var(--info-fg)' }}>
                        {h.traineesCount ?? 0} trainees
                      </span>
                      <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'var(--success-bg)', color:'var(--success-fg)' }}>
                        {h.supervisorsCount ?? 0} supervisors
                      </span>
                      <span className={active ? 'badge-active' : 'badge-inactive'}>{active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="management-card-sub">PD: {getProgramDirector(h)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selected && <HospitalModal hospital={selected} onClose={() => setSelected(null)} />}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
