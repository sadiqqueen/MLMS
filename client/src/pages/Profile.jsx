import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function gradeToGpa(grade) {
  const map = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D': 1.0, 'F': 0 };
  return map[grade] ?? null;
}

export default function Profile() {
  const { user } = useAuth();
  const [profile,  setProfile ] = useState(null);
  const [rotation, setRotation] = useState(null);
  const [reports,  setReports ] = useState([]);
  const [loading,  setLoading ] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get('/api/auth/me'),
      api.get(`/api/rotations/current/${user._id}`),
      api.get(`/api/reports/student/${user._id}`)
    ]).then(([p, rot, rep]) => {
      setProfile(p.data);
      setRotation(rot.data);
      setReports(rep.data);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <><Navbar /><div className="main"><div className="loading">Loading…</div></div></>;

  const graded = reports.filter(r => r.grade);
  const gpa    = graded.length
    ? (graded.reduce((s, r) => s + (gradeToGpa(r.grade) ?? 0), 0) / graded.length).toFixed(1)
    : '—';

  const p = profile || user;

  return (
    <>
      <Navbar />
      <main className="main">
        <div className="page-header"><h1 className="page-title">Profile</h1></div>

        <div className="card profile-header-card">
          <div className="profile-avatar-lg">{p?.initials}</div>
          <div className="profile-info">
            <div className="profile-name">{p?.name}</div>
            <div className="profile-role">
              {p?.role?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              {p?.year && ` · Year ${p.year}`}
            </div>
            <div className="profile-email">{p?.email}</div>
          </div>
        </div>

        <div className="two-col">
          <div className="card">
            <div className="card-title">Personal information</div>
            <div className="info-grid">
              {[
                ['Full name',      p?.name],
                ['Email',          p?.email],
                ['Phone',          p?.phone],
                ['Student ID',     p?.studentId],
                ['Enrolled since', fmt(p?.enrolledSince)],
                ['Year',           p?.year ? `Year ${p.year}` : '—']
              ].map(([label, value]) => (
                <div className="info-row" key={label}>
                  <span className="info-label">{label}</span>
                  <span className="info-value">{value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Academic summary</div>
            <div className="info-grid">
              {[
                ['Overall GPA',       <span className="gpa-highlight">{gpa} / 4.0</span>],
                ['Reports submitted', reports.length],
                ['Graded reports',    graded.length],
                ['Pending reports',   reports.filter(r => r.status === 'pending').length]
              ].map(([label, value]) => (
                <div className="info-row" key={label}>
                  <span className="info-label">{label}</span>
                  <span className="info-value">{value}</span>
                </div>
              ))}
            </div>

            {rotation && (
              <>
                <div className="card-title" style={{ marginTop: '1.25rem' }}>Current rotation</div>
                <div className="info-grid">
                  {[
                    ['Hospital',   rotation.hospital?.name],
                    ['Doctor',     rotation.doctor ? `Dr. ${rotation.doctor.name.replace(/^Dr\.?\s*/i, '')}` : '—'],
                    ['Department', rotation.doctor?.department],
                    ['Period',     `${fmt(rotation.startDate)} — ${fmt(rotation.endDate)}`]
                  ].map(([label, value]) => (
                    <div className="info-row" key={label}>
                      <span className="info-label">{label}</span>
                      <span className="info-value">{value ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
