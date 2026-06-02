import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import api from '../api/axios';
import Sk from '../components/Skeleton';

const API_BASE = '';

function getSpecialty(t) {
  return t?.specialtyId?.name || t?.specialty || '-';
}

export default function DioTrainees() {
  const navigate = useNavigate();
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState('All');
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/dio/trainees')
      .then(r => {
        const data = r.data?.data || r.data || [];
        setTrainees(Array.isArray(data) ? data : []);
      })
      .catch(() => showToast('Failed to load trainees'))
      .finally(() => setLoading(false));
  }, []);

  const specCounts = {};
  trainees.forEach(t => {
    const specialty = getSpecialty(t);
    specCounts[specialty] = (specCounts[specialty] || 0) + 1;
  });
  const specialtyOptions = ['All', ...Object.keys(specCounts).filter(Boolean).sort()];

  const filtered = trainees.filter(t => {
    const specialty = getSpecialty(t);
    const q = search.toLowerCase();
    const matchSpec = specFilter === 'All' || specialty === specFilter;
    const matchSearch = !q
      || t.name?.toLowerCase().includes(q)
      || (t.studentId || '').toLowerCase().includes(q)
      || specialty.toLowerCase().includes(q);
    return matchSpec && matchSearch;
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={20} h={13} /></td>
                    <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={100} h={22} r={20} /></td>
                    <td><Sk w={110} h={13} /></td>
                    <td><Sk w={80} h={13} /></td>
                    <td><Sk w={55} h={28} r={8} /></td>
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
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {specialtyOptions.map(s => (
            <button
              key={s}
              className={`filter-tab${specFilter === s ? ' active' : ''}`}
              onClick={() => setSpecFilter(s)}
            >
              {s === 'All' ? `All (${trainees.length})` : `${s.split(' ')[0]} (${specCounts[s] || 0})`}
            </button>
          ))}
        </div>

        <div className="admin-card">
          <div className="admin-toolbar">
            <input
              className="admin-search"
              style={{ flex:1, minWidth:200 }}
              placeholder="Search by name, ID, or specialty..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ fontSize:13, color:'#8B8FA8', flexShrink:0 }}>
              {filtered.length} trainee{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Trainee</th><th>Specialty</th><th>Hospital</th><th>Student ID</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign:'center', padding:40, color:'#8B8FA8' }}>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563', marginBottom:4 }}>
                        {trainees.length === 0 ? 'No trainees found' : 'No trainees match your search'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((t, i) => (
                  <tr key={t._id} style={{ cursor:'pointer' }} onClick={() => navigate(`/dio/trainees/${t._id}`)}>
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
                      <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>
                        {getSpecialty(t)}
                      </span>
                    </td>
                    <td style={{ fontSize:13, color:'#4B5563' }}>{t.hospitalId?.name || t.hospital?.name || '-'}</td>
                    <td style={{ fontSize:13, color:'#4B5563' }}>{t.studentId || '-'}</td>
                    <td>
                      <button className="btn-action edit" onClick={e => { e.stopPropagation(); navigate(`/dio/trainees/${t._id}`); }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
