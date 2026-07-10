import { useState, useEffect } from 'react';
import Navbar  from '../components/Navbar';
import Toast   from '../components/Toast';
import api     from '../api/axios';
import Sk      from '../components/Skeleton';

const API_BASE = '';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function weeksBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(1, Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000)));
}

function getStatusStyle(status) {
  if (status === 'current' || status === 'active') return { color: '#059669', bg: '#D1FAE5' };
  if (status === 'completed') return { color: '#1B1464', bg: '#EEEDFE' };
  if (status === 'cancelled') return { color: '#991B1B', bg: '#FEE2E2' };
  return { color: '#D97706', bg: '#FEF3C7' };
}

function getSpecialtyName(trainee) {
  return trainee.specialtyId?.name || trainee.specialty || '—';
}

function getHospitalName(trainee) {
  return trainee.hospitalId?.name || trainee.hospital?.name || '—';
}

function TraineeModal({ trainee, distributions, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const myDists = distributions.filter(d => {
    const tid = d.traineeId?._id || d.traineeId || d.student?._id || d.student;
    return tid?.toString() === trainee._id?.toString();
  });

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
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,.2)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 24px', borderBottom: '1px solid #E8E9EF',
          position: 'sticky', top: 0, background: '#fff', zIndex: 10
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: '#1B1464',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 700, flexShrink: 0
          }}>
            {trainee.initials || trainee.name?.slice(0,2)?.toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1B1464' }}>{trainee.name}</div>
            <div style={{ fontSize: 12, color: '#8B8FA8', marginTop: 2 }}>{trainee.email}</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 20 }}>
            {[
              ['Student ID', trainee.studentId || '—'],
              ['Phone',      trainee.phone     || '—'],
              ['Specialty',  getSpecialtyName(trainee)],
              ['Hospital',   getHospitalName(trainee)],
              ['Year',       trainee.year ? `Year ${trainee.year}` : '—'],
              ['City',       trainee.city || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{
                  fontSize: 10, color: '#8B8FA8', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3
                }}>{label}</div>
                <div style={{ fontSize: 14, color: '#1B1464', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{
            fontSize: 12, fontWeight: 700, color: '#8B8FA8',
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10
          }}>
            Rotation History
          </div>

          {myDists.length === 0 ? (
            <div style={{ fontSize: 13, color: '#8B8FA8', padding: '12px 0' }}>
              No rotations assigned yet
            </div>
          ) : myDists.map(d => {
            const specName = d.specialtyId?.name || d.specialty || '—';
            const supName  = d.supervisorId?.name || d.doctor?.name || '—';
            const status   = d.status || 'upcoming';
            const style    = getStatusStyle(status);
            const duration = d.durationWeeks || weeksBetween(d.startDate, d.endDate);

            return (
              <div key={d._id} style={{
                background: '#F8F9FA', borderRadius: 10,
                padding: '12px 14px', marginBottom: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1B1464' }}>{specName}</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 20, background: style.bg, color: style.color
                  }}>{status}</span>
                </div>
                <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 4 }}>
                  Supervisor: <strong>{supName}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#8B8FA8' }}>
                  {fmtDate(d.startDate)} → {fmtDate(d.endDate)}
                  {duration ? ` · ${duration} weeks` : ''}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          padding: '14px 24px', borderTop: '1px solid #E8E9EF',
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

export default function ProgramDirectorTrainees() {
  const [trainees,      setTrainees     ] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [search,        setSearch       ] = useState('');
  const [specFilter,    setSpecFilter   ] = useState('All');
  const [selected,      setSelected     ] = useState(null);
  const [toasts,        setToasts       ] = useState([]);

  function showToast(msg, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/program-director/trainees')
      .then(r => {
        const data = r.data?.data || r.data || {};
        setTrainees(data.trainees || (Array.isArray(data) ? data : []));
        setDistributions(data.distributions || []);
      })
      .catch(() => showToast('Failed to load trainees'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = trainees.filter(t => {
    const specName = getSpecialtyName(t);
    const matchSpec = specFilter === 'All' || specName === specFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || t.name?.toLowerCase().includes(q)
      || (t.studentId || '').toLowerCase().includes(q)
      || specName.toLowerCase().includes(q);
    return matchSpec && matchSearch;
  });

  const specCounts = {};
  trainees.forEach(t => {
    const s = getSpecialtyName(t);
    specCounts[s] = (specCounts[s] || 0) + 1;
  });
  const specialtyOptions = ['All', ...Object.keys(specCounts).filter(Boolean).sort()];

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} /><Sk w={100} h={14} />
            </div>
          ))}
        </div>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(8)].map((_,i) => (
                  <tr key={i}>
                    <td><Sk w={20} h={13} /></td>
                    <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={100} h={13} /></td>
                    <td><Sk w={110} h={22} r={20} /></td>
                    <td><Sk w={90}  h={13} /></td>
                    <td><Sk w={70}  h={22} r={20} /></td>
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

        {/* Stat cards — total + one per specialty (clickable filter) */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
          <div style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:42, height:42, borderRadius:10, background:'#DBEAFE',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, fontWeight:700, color:'#2563EB', flexShrink:0
            }}>
              {trainees.length}
            </div>
            <div style={{ fontSize:12, color:'#4B5563', fontWeight:500 }}>Total Trainees</div>
          </div>
          {specialtyOptions.filter(s => s !== 'All').map(s => (
            <div
              key={s}
              style={{
                background:'#fff', border:'1px solid #E8E9EF', borderRadius:12,
                padding:'14px 16px', display:'flex', alignItems:'center', gap:12,
                cursor:'pointer',
                boxShadow: specFilter === s ? '0 0 0 2px #1B1464' : 'none',
                transition:'box-shadow .15s ease'
              }}
              onClick={() => setSpecFilter(specFilter === s ? 'All' : s)}
            >
              <div style={{
                width:42, height:42, borderRadius:10,
                background: specFilter === s ? '#1B1464' : '#EEEDFE',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:20, fontWeight:700,
                color: specFilter === s ? '#fff' : '#1B1464',
                flexShrink:0, transition:'background-color .15s ease, color .15s ease'
              }}>
                {specCounts[s] || 0}
              </div>
              <div style={{ fontSize:11, color:'#4B5563', fontWeight:500, lineHeight:1.3 }}>{s}</div>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="admin-card">
          <div className="admin-toolbar" style={{ flexWrap:'wrap', gap:10 }}>
            <input
              className="admin-search"
              style={{ flex:1, minWidth:200, height:36 }}
              placeholder="Search by name, ID, or specialty…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {specialtyOptions.map(s => (
                <button
                  key={s}
                  className={`filter-tab${specFilter === s ? ' active' : ''}`}
                  onClick={() => setSpecFilter(s)}
                >
                  {s === 'All' ? `All (${trainees.length})` : s.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trainee</th>
                  <th>Specialty</th>
                  <th>Hospital</th>
                  <th>Student ID</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign:'center', padding:40, color:'#8B8FA8' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>🎓</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563', marginBottom:4 }}>No trainees found</div>
                      <div style={{ fontSize:13 }}>
                        {trainees.length === 0
                          ? 'No trainees are assigned to your specialty yet.'
                          : 'Try a different filter or search term.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((t, i) => {
                  const spec   = getSpecialtyName(t);
                  const myDist = distributions.find(d => {
                    const tid = d.traineeId?._id || d.traineeId || d.student?._id || d.student;
                    return tid?.toString() === t._id?.toString();
                  });
                  const status      = myDist?.status || 'upcoming';
                  const statusStyle = getStatusStyle(status);

                  return (
                    <tr key={t._id} style={{ cursor:'pointer' }} onClick={() => setSelected(t)}>
                      <td style={{ color:'#8B8FA8' }}>{i + 1}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {t.photoUrl
                            ? <img src={`${API_BASE}${t.photoUrl}`} alt="" className="cell-photo" />
                            : <div className="cell-initials">{t.initials || t.name?.[0] || '?'}</div>
                          }
                          <div>
                            <strong>{t.name}</strong>
                            <div style={{ fontSize:11, color:'#8B8FA8' }}>{t.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize:11, fontWeight:600, padding:'3px 9px',
                          borderRadius:20, background:'#EEEDFE', color:'#3C3489'
                        }}>{spec}</span>
                      </td>
                      <td style={{ fontSize:13, color:'#4B5563' }}>{getHospitalName(t)}</td>
                      <td style={{ fontSize:13, color:'#4B5563' }}>{t.studentId || '—'}</td>
                      <td>
                        <span style={{
                          fontSize:11, fontWeight:600, padding:'3px 9px',
                          borderRadius:20, background:statusStyle.bg, color:statusStyle.color
                        }}>{status}</span>
                      </td>
                      <td>
                        <button
                          className="btn-action edit"
                          onClick={e => { e.stopPropagation(); setSelected(t); }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <TraineeModal
            trainee={selected}
            distributions={distributions}
            onClose={() => setSelected(null)}
          />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
