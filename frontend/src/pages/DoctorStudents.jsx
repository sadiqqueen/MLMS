import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import Sk  from '../components/Skeleton';

const API_BASE = '';
const STATUS_FILTERS = ['all', 'current', 'upcoming', 'completed'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PhotoCell({ user }) {
  if (user?.photoUrl) return <img src={`${API_BASE}${user.photoUrl}`} alt="" className="cell-photo" />;
  return <div className="cell-initials">{user?.initials || user?.name?.[0] || '?'}</div>;
}

export default function DoctorStudents() {
  const { user: me } = useAuth();
  const [rotations, setRotations] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [filter,    setFilter   ] = useState('all');
  const [search,    setSearch   ] = useState('');
  const [selected,     setSelected    ] = useState(null);
  const [detail,       setDetail      ] = useState(null);
  const [detailLoading,setDetailLoading] = useState(false);

  async function openStudent(rot) {
    setSelected(rot);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/users/${rot.student._id}`);
      setDetail(res.data);
    } catch {
      setDetail(rot.student);
    } finally {
      setDetailLoading(false);
    }
  }
  function closeModal() { setSelected(null); setDetail(null); }

  useEffect(() => {
    if (!me?._id) return;
    api.get(`/api/rotations/doctor/${me._id}`)
      .then(r => setRotations(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [me]);

  const filtered = rotations.filter(rot => {
    const matchFilter = filter === 'all' || rot.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      rot.student?.name?.toLowerCase().includes(q) ||
      rot.hospital?.name?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const counts = {
    current:   rotations.filter(r => r.status === 'current').length,
    upcoming:  rotations.filter(r => r.status === 'upcoming').length,
    completed: rotations.filter(r => r.status === 'completed').length,
  };

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 8 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Sk w={46} h={46} r={10} />
              <Sk w={130} h={14} />
            </div>
          ))}
        </div>
        <div className="admin-card">
          <div className="admin-toolbar">
            <Sk h={36} r={8} style={{ flex: 1, minWidth: 200 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 20px 14px' }}>
            {[...Array(4)].map((_, i) => <Sk key={i} w={80} h={32} r={20} />)}
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {['#', 'Student', 'Hospital', 'Start', 'End', 'Status', 'Grade'].map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={20} h={13} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sk w={36} h={36} r="50%" />
                        <Sk w={110} h={13} />
                      </div>
                    </td>
                    <td><Sk w={110} h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                    <td><Sk w={70}  h={22} r={20} /></td>
                    <td><Sk w={50}  h={13} /></td>
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


        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 8 }}>
          {[
            { label: 'Current',   count: counts.current,   color: '#00B894', bg: '#e8fdf3' },
            { label: 'Upcoming',  count: counts.upcoming,  color: '#f39c12', bg: '#fff8e1' },
            { label: 'Completed', count: counts.completed, color: '#185FA5', bg: '#e6f1fb' },
          ].map(c => (
            <div key={c.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: c.color, flexShrink: 0 }}>
                {c.count}
              </div>
              <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{c.label} Rotations</div>
            </div>
          ))}
        </div>

        <div className="admin-card">

          {/* Search + filter */}
          <div className="admin-toolbar">
            <input
              className="admin-search"
              placeholder="Search by student name or hospital…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, padding: '0 20px 14px', flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                className={`filter-tab${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && <span style={{ marginLeft: 5, fontWeight: 700 }}>({counts[f] ?? 0})</span>}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Hospital</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Weekly Avg</th>
                  <th>Monthly Avg</th>
                  <th>Final Grade</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="admin-empty">No students found</td></tr>
                )}
                {filtered.map((rot, i) => (
                  <tr key={rot._id} style={{ cursor: 'pointer' }} onClick={() => openStudent(rot)}>
                    <td style={{ color: '#aaa' }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PhotoCell user={rot.student} />
                        <div>
                          <strong>{rot.student?.name || '—'}</strong>
                          {rot.student?.studentId && (
                            <div style={{ fontSize: 11, color: '#888' }}>ID: {rot.student.studentId}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{rot.hospital?.name || '—'}</td>
                    <td>{fmtDate(rot.startDate)}</td>
                    <td>{fmtDate(rot.endDate)}</td>
                    <td>
                      <span className={
                        rot.status === 'completed' ? 'badge-completed' :
                        rot.status === 'current'   ? 'badge-active'   : 'badge-pending'
                      }>{rot.status}</span>
                    </td>
                    <td><strong>{rot.weeklyAvg  || '—'}</strong></td>
                    <td><strong>{rot.monthlyAvg || '—'}</strong></td>
                    <td>
                      {rot.finalGrade
                        ? <strong style={{ fontSize: 16, color: '#185FA5' }}>{rot.finalGrade}</strong>
                        : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div className="admin-modal admin-modal-lg" onClick={e => e.stopPropagation()}>

              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {selected.student?.photoUrl
                    ? <img src={`${API_BASE}${selected.student.photoUrl}`} alt={selected.student.name}
                           style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div className="cell-initials" style={{ width: 56, height: 56, fontSize: 20, flexShrink: 0 }}>
                        {selected.student?.initials || selected.student?.name?.[0] || '?'}
                      </div>}
                  <div>
                    <div className="admin-modal-title">{selected.student?.name || '—'}</div>
                    {selected.student?.studentId && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>ID: {selected.student.studentId}</div>
                    )}
                  </div>
                </div>
                <button className="admin-modal-close" onClick={closeModal}>✕</button>
              </div>

              <div className="admin-modal-body">
                {detailLoading || !detail ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {[...Array(6)].map((_, i) => (
                      <div key={i}>
                        <Sk w={80}  h={11} />
                        <Sk w={160} h={14} style={{ marginTop: 6 }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                    {[
                      ['Full Name',     detail.name],
                      ['Username',      detail.username || detail.name],
                      ['Email',         detail.email],
                      ['Phone',         detail.phone],
                      ['Hospital',      detail.hospital?.name || selected.hospital?.name],
                      ['Assigned Doctor', detail.doctor?.name
                        ? `Dr. ${detail.doctor.name.replace(/^Dr\.?\s*/i, '')}${detail.doctor.specialty ? ' · ' + detail.doctor.specialty : ''}`
                        : (me?.name ? `Dr. ${me.name.replace(/^Dr\.?\s*/i, '')}` : '—')],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 14, color: '#111', marginTop: 4, fontWeight: 500 }}>{value || '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-modal-footer">
                <button className="btn-red" onClick={closeModal}>Close</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
