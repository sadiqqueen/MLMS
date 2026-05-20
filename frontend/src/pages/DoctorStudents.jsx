import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../api/axios';

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

  if (loading) return <><Navbar /><main className="admin-main"><div className="loading">Loading…</div></main></>;

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
                  <tr key={rot._id}>
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

      </main>
    </>
  );
}
