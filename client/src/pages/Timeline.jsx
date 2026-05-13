import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Timeline() {
  const { user } = useAuth();
  const [rotations, setRotations] = useState([]);
  const [reports,   setReports  ] = useState([]);
  const [loading,   setLoading  ] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get(`/api/rotations/student/${user._id}`),
      api.get(`/api/reports/student/${user._id}`)
    ]).then(([rot, rep]) => {
      setRotations(rot.data);
      setReports(rep.data);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <><Navbar /><div className="main"><div className="loading">Loading…</div></div></>;

  const completed = rotations.filter(r => r.status === 'completed').length;
  const total     = rotations.length;
  const pct       = total ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <Navbar />
      <main className="main">
        <div className="page-header"><h1 className="page-title">Rotation Timeline</h1></div>

        {/* ANIMATED PROGRESS BAR */}
        <div className="card progress-card">
          <div className="progress-header">
            <span className="progress-label">Rotation progress</span>
            <span className="progress-count">{completed} of {total} completed</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%`, transition: 'width 0.8s ease' }} />
          </div>
          <div className="progress-pct">{pct}% complete</div>
        </div>

        {/* ALTERNATING LEFT/RIGHT TIMELINE */}
        <div className="timeline-alt">
          {rotations.map((rot, i) => {
            const isLeft     = i % 2 === 0;  // even index = left card
            const rotReports = reports.filter(r => r.rotation?._id === rot._id || r.rotation === rot._id);
            const weekly     = rotReports.filter(r => r.type === 'weekly');
            const dotClass   = rot.status === 'completed' ? 'tl-dot tl-done'
                             : rot.status === 'current'   ? 'tl-dot tl-current'
                             :                              'tl-dot tl-upcoming';
            const card = (
              <RotationCard rot={rot} weekly={weekly} />
            );
            return (
              <div className="tl-alt-item" key={rot._id}>
                <div className={`tl-alt-card${isLeft  ? '' : ' tl-invisible'}`}>{isLeft  && card}</div>
                <div className="tl-alt-spine">
                  <div className={dotClass} />
                  {i < rotations.length - 1 && <div className="tl-spine-line" />}
                </div>
                <div className={`tl-alt-card${!isLeft ? '' : ' tl-invisible'}`}>{!isLeft && card}</div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}

function RotationCard({ rot, weekly }) {
  function fmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const muted = rot.status === 'upcoming';
  return (
    <div className={`tl-rot-card${muted ? ' tl-rot-muted' : ''}`}>
      <div className="tl-rot-header">
        <span className="tl-rot-name">{rot.hospital?.name ?? 'Hospital — TBA'}</span>
        {rot.status === 'current'   && <span className="badge badge-blue">Current</span>}
        {rot.status === 'completed' && <span className="badge badge-green">Completed</span>}
        {muted && <span className="badge" style={{ background: '#f0f0f0', color: '#888' }}>Upcoming</span>}
      </div>
      {rot.doctor && <div className="tl-rot-doctor">Dr. {rot.doctor.name.replace(/^Dr\.?\s*/i, '')} · {rot.doctor.department}</div>}
      <div className="tl-rot-dates">{fmt(rot.startDate)} — {fmt(rot.endDate)}</div>
      {!muted && weekly.length > 0 && (
        <div className="tl-breakdown">
          <div className="tl-breakdown-title">Weekly reports</div>
          {weekly.map(r => (
            <div className="tl-breakdown-row" key={r._id}>
              <span className="tl-rname">{r.title}</span>
              <div className={`grade-circle grade-circle-sm${r.grade ? '' : ' grade-empty'}`}>{r.grade ?? '—'}</div>
            </div>
          ))}
        </div>
      )}
      {!muted && (
        <div className="tl-grades">
          {rot.weeklyAvg  && <span className="badge badge-green">Weekly avg: {rot.weeklyAvg}</span>}
          {rot.monthlyAvg && <span className="badge badge-green">Monthly avg: {rot.monthlyAvg}</span>}
          {rot.finalGrade && <span className="badge badge-green">Final: {rot.finalGrade}</span>}
          {rot.status === 'current' && <span className="badge badge-amber">In progress</span>}
        </div>
      )}
    </div>
  );
}
