import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import Navbar       from '../components/Navbar';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';

const API_BASE = '';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTrainee(dist) {
  return dist.traineeId || dist.student || {};
}

function getSpecialty(dist) {
  return dist.specialtyId?.name || dist.specialty || '—';
}

function getHospital(dist) {
  return dist.hospitalId?.name || dist.hospital?.name || '—';
}

function Avatar({ user, size = 56 }) {
  if (user?.photoUrl) {
    return (
      <img
        src={`${API_BASE}${user.photoUrl}`}
        alt={user.name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '3px solid #E8E9EF'
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#1B1464', color: '#fff',
      fontWeight: 700, fontSize: size * 0.32,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, border: '3px solid #E8E9EF'
    }}>
      {user?.initials || user?.name?.slice(0, 2)?.toUpperCase() || '?'}
    </div>
  );
}

function TraineeModal({ dist, onClose }) {
  const trainee = getTrainee(dist);
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        animation: 'modalIn 0.22s ease'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '20px 24px', borderBottom: '1px solid #E8E9EF'
        }}>
          <Avatar user={trainee} size={52} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1B1464' }}>{trainee.name || '—'}</div>
            <div style={{ fontSize: 13, color: '#8B8FA8', marginTop: 2 }}>{trainee.email || ''}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%', background: '#F5F6FA',
              border: 'none', fontSize: 18, color: '#8B8FA8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '14px 20px', marginBottom: 20
          }}>
            {[
              ['Student ID',  trainee.studentId || '—'],
              ['Phone',       trainee.phone     || '—'],
              ['Specialty',   getSpecialty(dist)],
              ['Hospital',    getHospital(dist)],
              ['Start Date',  fmtDate(dist.startDate)],
              ['End Date',    fmtDate(dist.endDate)],
              ['Duration',    dist.durationWeeks ? `${dist.durationWeeks} weeks` : '—'],
              ['Status',      dist.status || 'active'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{
                  fontSize: 11, color: '#8B8FA8', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3
                }}>{label}</div>
                <div style={{ fontSize: 14, color: '#1B1464', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          padding: '14px 24px', borderTop: '1px solid #E8E9EF',
          display: 'flex', justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 8, background: '#FF6B35',
              color: '#fff', border: 'none', fontWeight: 500, fontSize: 13,
              cursor: 'pointer'
            }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}

export default function SupervisorTrainees() {
  const { user: me }   = useAuth();
  const [dists,    setDists   ] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const [search,   setSearch  ] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/api/supervisor/trainees')
      .then(r => {
        const list = r.data?.data || r.data || [];
        setDists(Array.isArray(list) ? list : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = dists.filter(d => {
    const t = getTrainee(d);
    const q = search.toLowerCase();
    return !q
      || t.name?.toLowerCase().includes(q)
      || t.studentId?.toLowerCase().includes(q)
      || getSpecialty(d).toLowerCase().includes(q)
      || getHospital(d).toLowerCase().includes(q);
  });

  const active    = dists.filter(d => (d.status || 'active') === 'active').length;
  const completed = dists.filter(d => d.status === 'completed').length;

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} />
              <Sk w={120} h={14} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}><Sk h={40} r={8} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
          {[...Array(6)].map((_,i) => (
            <div key={i} style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:22, textAlign:'center' }}>
              <Sk w={56} h={56} r="50%" style={{ margin:'0 auto 12px' }} />
              <Sk w={140} h={15} style={{ margin:'0 auto 8px' }} />
              <Sk w={100} h={12} style={{ margin:'0 auto 6px' }} />
              <Sk w={80}  h={22} r={20} style={{ margin:'0 auto 14px' }} />
              <div style={{ display:'flex', gap:7, justifyContent:'center' }}>
                <Sk w={80} h={32} r={8} />
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

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
          {[
            { label:'Total Assigned', count: dists.length,  color:'#185FA5', bg:'#E6F1FB' },
            { label:'Active',         count: active,         color:'#00B894', bg:'#E8FDF3' },
            { label:'Completed',      count: completed,      color:'#1B1464', bg:'#EEEDFE' },
          ].map(c => (
            <div key={c.label} style={{
              background:'#fff', border:'1px solid #E8E9EF', borderRadius:12,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:14
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:c.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, fontWeight:700, color:c.color, flexShrink:0
              }}>
                {c.count}
              </div>
              <div style={{ fontSize:13, color:'#4B5563', fontWeight:500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:20 }}>
          <input
            className="admin-search"
            style={{ width:'100%', height:40, maxWidth:'100%' }}
            placeholder="Search by name, ID, specialty or hospital…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'#8B8FA8' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#4B5563', marginBottom:6 }}>
              {dists.length === 0 ? 'No trainees assigned yet' : 'No trainees match your search'}
            </div>
            <div style={{ fontSize:13 }}>Trainees are assigned to you by the secretary.</div>
          </div>
        )}

        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',
          gap:16
        }}>
          {filtered.map(dist => {
            const trainee     = getTrainee(dist);
            const statusColor = (dist.status || 'active') === 'active' ? '#00B894'
                              : dist.status === 'completed'             ? '#1B1464'
                              :                                           '#D97706';
            const statusBg    = (dist.status || 'active') === 'active' ? '#E8FDF3'
                              : dist.status === 'completed'             ? '#EEEDFE'
                              :                                           '#FEF3C7';

            return (
              <div
                key={dist._id}
                style={{
                  background:'#fff', border:'1px solid #E8E9EF', borderRadius:12,
                  padding:'22px 18px', textAlign:'center',
                  boxShadow:'0 1px 3px rgba(0,0,0,.06)',
                  transition:'transform .2s, box-shadow .2s',
                  cursor:'default'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)';
                }}
              >
                <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
                  <Avatar user={trainee} size={56} />
                </div>

                <div style={{ fontSize:15, fontWeight:700, color:'#1B1464', marginBottom:4 }}>
                  {trainee.name || '—'}
                </div>

                <div style={{ fontSize:12, color:'#8B8FA8', marginBottom:8 }}>
                  Trainee {trainee.studentId ? `· ${trainee.studentId}` : ''}
                </div>

                <div style={{ marginBottom:6 }}>
                  <span style={{
                    display:'inline-block', fontSize:11, padding:'3px 10px',
                    borderRadius:20, background:'#EEEDFE', color:'#3C3489', fontWeight:600
                  }}>
                    {getSpecialty(dist)}
                  </span>
                </div>

                <div style={{ fontSize:11, color:'#8B8FA8', marginBottom:6 }}>
                  {fmtDate(dist.startDate)} – {fmtDate(dist.endDate)}
                  {dist.durationWeeks ? ` · ${dist.durationWeeks}w` : ''}
                </div>

                <div style={{ marginBottom:14 }}>
                  <span style={{
                    fontSize:11, fontWeight:600, padding:'2px 9px',
                    borderRadius:20, background:statusBg, color:statusColor
                  }}>
                    {dist.status || 'active'}
                  </span>
                </div>

                <div style={{ display:'flex', gap:7, justifyContent:'center' }}>
                  <button
                    style={{
                      padding:'7px 16px', borderRadius:8, background:'#FF6B35',
                      color:'#fff', border:'none', fontWeight:500, fontSize:12,
                      cursor:'pointer', boxShadow:'0 2px 6px rgba(255,107,53,.3)'
                    }}
                    onClick={() => setSelected(dist)}
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <TraineeModal dist={selected} onClose={() => setSelected(null)} />
        )}

        <style>{`
          @keyframes modalIn {
            from { opacity:0; transform:translateY(-14px) scale(.98); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
        `}</style>

      </main>
    </>
  );
}
