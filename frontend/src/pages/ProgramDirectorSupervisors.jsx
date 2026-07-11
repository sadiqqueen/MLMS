import { useState, useEffect } from 'react';
import Navbar  from '../components/Navbar';
import Toast   from '../components/Toast';
import api     from '../api/axios';
import Sk      from '../components/Skeleton';

const API_BASE = '';

function textValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || fallback;
  return fallback;
}

function SupervisorModal({ supervisor, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
        zIndex: 2000, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 20
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,.2)'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 24px', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#1B1464', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, flexShrink: 0
          }}>
            {supervisor.initials || supervisor.name?.slice(0,2)?.toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--brand-secondary)' }}>{supervisor.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{supervisor.email}</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 20 }}>
            {[
              ['Specialty',        textValue(supervisor.specialtyId || supervisor.specialty)],
              ['Department',       supervisor.department || '—'],
              ['Phone',            supervisor.phone     || '—'],
              ['City',             supervisor.city      || '—'],
              ['Hospital',         supervisor.hospitalId?.name || supervisor.hospital?.name || '—'],
              ['Assigned Trainees',supervisor.traineeCount ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{
                  fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3
                }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--brand-secondary)', fontWeight: 500 }}>{String(value)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 8, background: '#FF6B35',
              color: '#fff', border: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer'
            }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ProgramDirectorSupervisors() {
  const [supervisors, setSupervisors] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [search,      setSearch     ] = useState('');
  const [selected,    setSelected   ] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(msg, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/program-director/supervisors')
      .then(r => {
        const list = r.data?.data || r.data || [];
        setSupervisors(Array.isArray(list) ? list : []);
      })
      .catch(() => showToast('Failed to load supervisors'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = supervisors.filter(s => {
    const q = search.toLowerCase();
    return !q
      || s.name?.toLowerCase().includes(q)
      || s.email?.toLowerCase().includes(q)
      || textValue(s.specialtyId || s.specialty, '').toLowerCase().includes(q)
      || (s.department || '').toLowerCase().includes(q);
  });

  const totalTrainees = supervisors.reduce((sum, sv) => sum + (sv.traineeCount || 0), 0);
  const avgTrainees   = supervisors.length
    ? (totalTrainees / supervisors.length).toFixed(1)
    : 0;

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} /><Sk w={110} h={14} />
            </div>
          ))}
        </div>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(6)].map((_,i) => (
                  <tr key={i}>
                    <td><Sk w={20} h={13} /></td>
                    <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={110} h={22} r={20} /></td>
                    <td><Sk w={90}  h={13} /></td>
                    <td><Sk w={60}  h={13} /></td>
                    <td><Sk w={40}  h={13} /></td>
                    <td><Sk w={55}  h={28} r={8} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Total Supervisors',      count: supervisors.length, color:'var(--info-fg)', bg:'var(--info-bg)' },
            { label:'Total Assigned Trainees',count: totalTrainees,       color:'var(--success-fg)', bg:'var(--success-bg)' },
            { label:'Avg Trainees / Supervisor', count: avgTrainees,      color:'var(--warning-fg)', bg:'var(--warning-bg)' },
          ].map(c => (
            <div key={c.label} style={{
              background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:14
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:c.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:20, fontWeight:700, color:c.color, flexShrink:0
              }}>{c.count}</div>
              <div style={{ fontSize:13, color:'var(--text-2)', fontWeight:500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="admin-card">
          <div className="admin-toolbar">
            <input
              className="admin-search"
              style={{ flex:1, minWidth:200, height:36 }}
              placeholder="Search by name, email, specialty, or department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Supervisor</th>
                  <th>Specialty</th>
                  <th>Department</th>
                  <th>Phone</th>
                  <th>Trainees</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>👨‍⚕️</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'var(--text-2)', marginBottom:4 }}>No supervisors found</div>
                      <div style={{ fontSize:13 }}>
                        {supervisors.length === 0
                          ? 'No supervisors are assigned to your specialty yet.'
                          : 'Try a different search term.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => (
                  <tr key={s._id} style={{ cursor:'pointer' }} onClick={() => setSelected(s)}>
                    <td style={{ color:'var(--text-muted)' }}>{i + 1}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {s.photoUrl
                          ? <img src={`${API_BASE}${s.photoUrl}`} alt="" className="cell-photo" />
                          : <div className="cell-initials">{s.initials || s.name?.[0] || '?'}</div>
                        }
                        <div>
                          <strong>{s.name}</strong>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize:11, fontWeight:600, padding:'3px 9px',
                        borderRadius:20, background:'var(--chip-spec-bg)', color:'var(--chip-spec-fg)'
                      }}>
                        {textValue(s.specialtyId || s.specialty)}
                      </span>
                    </td>
                    <td style={{ fontSize:13, color:'var(--text-2)' }}>{s.department || '—'}</td>
                    <td style={{ fontSize:13, color:'var(--text-2)' }}>{s.phone || '—'}</td>
                    <td>
                      <div style={{
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        width:32, height:32, borderRadius:'50%',
                        background: (s.traineeCount || 0) > 0 ? '#1B1464' : 'var(--surface-2)',
                        color: (s.traineeCount || 0) > 0 ? '#fff' : 'var(--text-muted)',
                        fontSize:13, fontWeight:700
                      }}>
                        {s.traineeCount || 0}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn-action edit"
                        onClick={e => { e.stopPropagation(); setSelected(s); }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <SupervisorModal supervisor={selected} onClose={() => setSelected(null)} />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
