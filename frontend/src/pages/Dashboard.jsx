import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';

// Helper: format a date like "Jan 7, 2026"
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Calculate how many weeks until a date
function weeksLeft(endDate) {
  if (!endDate) return null;
  const diff = new Date(endDate) - new Date();
  if (diff < 0) return 0;
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

// Convert letter grade to GPA points
function gradeToGpa(grade) {
  const map = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D': 1.0, 'F': 0 };
  return map[grade] ?? null;
}

// Calculate GPA from an array of reports
function calcGpa(reports) {
  const graded = reports.filter(r => r.grade && r.status === 'graded');
  if (!graded.length) return '—';
  const avg = graded.reduce((sum, r) => sum + (gradeToGpa(r.grade) ?? 0), 0) / graded.length;
  return avg.toFixed(1);
}

export default function Dashboard() {
  const { user } = useAuth();

  // useState for the data we'll fetch from the server
  const [rotation,  setRotation ] = useState(null);   // the current rotation
  const [rotations, setRotations] = useState([]);      // all rotations (for timeline)
  const [reports,   setReports  ] = useState([]);      // all reports
  const [loading,   setLoading  ] = useState(true);

  // useEffect runs AFTER the component renders.
  // We use it to fetch data from the server — you can't do async work outside useEffect in React.
  useEffect(() => {
    if (!user) return;

    // Promise.all runs multiple requests at the same time and waits for ALL of them
    Promise.all([
      api.get(`/api/rotations/current/${user._id}`),
      api.get(`/api/rotations/student/${user._id}`),
      api.get(`/api/reports/student/${user._id}`)
    ]).then(([cur, all, rep]) => {
      setRotation(cur.data);
      setRotations(all.data);
      setReports(rep.data);
    }).finally(() => setLoading(false));

  }, [user]);  // re-run if user changes

  if (loading) return <><Navbar /><div className="main"><div className="loading">Loading…</div></div></>;

  // Filter reports to only those in the current rotation
  const currentReports = reports.filter(r => rotation && r.rotation?._id === rotation._id);
  const weekly  = currentReports.filter(r => r.type === 'weekly');
  const monthly = currentReports.filter(r => r.type === 'monthly' || r.type === 'final');

  const gpa               = calcGpa(reports);
  const hospitalsCompleted = rotations.filter(r => r.status === 'completed').length;
  const wLeft             = rotation ? weeksLeft(rotation.endDate) : null;

  return (
    <>
      <Navbar />
      <main className="main">

        {/* GPA BAR */}
        <div className="gpa-bar">
          <div className="gpa-left">
            <img src="/logo.png" alt="MedLearn LMS" className="gpa-logo" />
            <div className="gpa-name">{user?.name}</div>
            <div className="gpa-sub">Medical resident · Year {user?.year}</div>
          </div>
          <div className="gpa-stats">
            <div className="gpa-item">
              <div className="gpa-label">Overall GPA</div>
              <div className="gpa-score">
                <span className="gpa-num">{gpa}</span>
                <span className="gpa-max">/ 4.0</span>
              </div>
            </div>
            <div className="gpa-item">
              <div className="gpa-label">Hospitals completed</div>
              <div className="gpa-score">
                <span className="gpa-num gpa-num-sm">{hospitalsCompleted}</span>
                <span className="gpa-max">/ {rotations.length}</span>
              </div>
            </div>
            <div className="gpa-item">
              <div className="gpa-label">Reports submitted</div>
              <div className="gpa-score">
                <span className="gpa-num gpa-num-sm">{reports.length}</span>
                <span className="gpa-max">total</span>
              </div>
            </div>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="stats">
          <div className="stat-card">
            <div className="stat-label">Current hospital</div>
            <div className="stat-value">{rotation?.hospital?.name ?? 'No active rotation'}</div>
            <div className="stat-sub">
              {rotation ? `Started ${fmt(rotation.startDate)} · ${wLeft ?? 0} week${wLeft !== 1 ? 's' : ''} left` : '—'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Assigned doctor</div>
            <div className="stat-value">
              {rotation?.doctor ? `Dr. ${rotation.doctor.name.replace(/^Dr\.?\s*/i, '')}` : '—'}
            </div>
            <div className="stat-sub">{rotation?.doctor?.department ?? '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Next report due</div>
            <div className="stat-value">Weekly report</div>
            <div className="stat-sub">
              {wLeft !== null && wLeft <= 2
                ? <span className="badge badge-red">Due in {wLeft} week{wLeft !== 1 ? 's' : ''}</span>
                : <span className="badge badge-amber">Upcoming</span>}
            </div>
          </div>
        </div>

        {/* WEEKLY + MONTHLY REPORT CARDS */}
        <div className="reports-row">
          <div className="card">
            <div className="card-title">Weekly reports <span className="badge badge-blue">This rotation</span></div>
            {weekly.length === 0 && <div className="empty-row">No weekly reports yet</div>}
            {weekly.map(r => (
              <div className="report-row" key={r._id}>
                <div className="report-info">
                  <div className="report-name">{r.title}</div>
                  <div className="report-date">{fmt(r.date)}</div>
                </div>
                <div className="report-right">
                  <span className={r.status === 'graded' ? 'badge badge-green' : 'badge badge-amber'}>
                    {r.status === 'graded' ? 'Graded' : 'Pending'}
                  </span>
                  <div className={`grade-circle${r.grade ? '' : ' grade-empty'}`}>{r.grade ?? '—'}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Monthly reports <span className="badge badge-blue">This rotation</span></div>
            {monthly.length === 0 && <div className="empty-row">No monthly reports yet</div>}
            {monthly.map(r => (
              <div className="report-row" key={r._id}>
                <div className="report-info">
                  <div className="report-name">{r.title}</div>
                  <div className="report-date">{fmt(r.date)}</div>
                </div>
                <div className="report-right">
                  <span className={r.status === 'graded' ? 'badge badge-green' : 'badge badge-amber'}>
                    {r.status === 'graded' ? 'Graded' : 'Pending'}
                  </span>
                  <div className={`grade-circle${r.grade ? '' : ' grade-empty'}`}>{r.grade ?? '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TIMELINE */}
        <div className="card">
          <div className="card-title">Hospital rotation timeline</div>
          <div className="timeline">
            {rotations.map((rot, i) => {
              const isLast    = i === rotations.length - 1;
              const dotClass  = rot.status === 'completed' ? 'tl-dot tl-done'
                              : rot.status === 'current'   ? 'tl-dot tl-current'
                              :                              'tl-dot tl-upcoming';
              return (
                <div className="tl-item" key={rot._id}>
                  <div className="tl-left">
                    <div className={dotClass} />
                    {!isLast && <div className="tl-line" />}
                  </div>
                  <div className="tl-content">
                    <div className={`tl-hospital${rot.status === 'upcoming' ? ' tl-muted' : ''}`}>
                      {rot.hospital?.name ?? 'Hospital — TBA'}
                      {rot.status === 'current' && <span className="badge badge-blue" style={{ marginLeft: 8 }}>Current</span>}
                    </div>
                    {rot.doctor && <div className="tl-doctor">Dr. {rot.doctor.name.replace(/^Dr\.?\s*/i, '')} · {rot.doctor.department}</div>}
                    <div className="tl-dates">{fmt(rot.startDate)} — {fmt(rot.endDate)} · {rot.status.charAt(0).toUpperCase() + rot.status.slice(1)}</div>
                    {rot.status !== 'upcoming' && (
                      <div className="tl-grades">
                        {rot.weeklyAvg  && <span className="badge badge-green">Weekly avg: {rot.weeklyAvg}</span>}
                        {rot.monthlyAvg && <span className="badge badge-green">Monthly avg: {rot.monthlyAvg}</span>}
                        {rot.finalGrade && <span className="badge badge-green">Final: {rot.finalGrade}</span>}
                        {rot.status === 'current' && <span className="badge badge-amber">In progress</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </>
  );
}
