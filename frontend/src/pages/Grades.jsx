import { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Sk from '../components/Skeleton';

// You must register Chart.js components before using them
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function gradeToGpa(grade) {
  const map = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D': 1.0, 'F': 0 };
  return map[grade] ?? null;
}

function calcAvg(reps) {
  const g = reps.filter(r => r.grade);
  if (!g.length) return null;
  return g.reduce((s, r) => s + (gradeToGpa(r.grade) ?? 0), 0) / g.length;
}

export default function Grades() {
  const { user } = useAuth();
  const [reports,   setReports  ] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [collapsed, setCollapsed] = useState({});  // tracks which hospital sections are folded

  useEffect(() => {
    if (!user) return;
    api.get(`/api/reports/student/${user._id}`)
      .then(res => setReports(res.data))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return (
    <>
      <Navbar />
      <main className="main">
        <div className="stats">
          {[0, 1, 2].map(i => (
            <div className="stat-card" key={i}>
              <Sk w={90} h={12} />
              <Sk w={120} h={28} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div className="card">
          <Sk w={180} h={16} style={{ marginBottom: 14 }} />
          <Sk h={220} r={8} />
        </div>
        {[0, 1].map(i => (
          <div className="card" key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Sk w={180} h={16} />
              <Sk w={20} h={14} />
            </div>
            {[0, 1, 2].map(j => (
              <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f0f0f0' }}>
                <Sk w={140} h={13} />
                <Sk w={50} h={20} r={20} />
                <Sk w={80} h={13} />
                <Sk w={60} h={20} r={20} />
                <Sk w={30} h={30} r="50%" />
                <Sk w={80} h={13} />
              </div>
            ))}
          </div>
        ))}
      </main>
    </>
  );

  const graded = reports.filter(r => r.status === 'graded' && r.grade);

  // Group reports by hospital name
  const byHospital = {};
  reports.forEach(r => {
    const key = r.hospital?.name ?? 'Unknown';
    if (!byHospital[key]) byHospital[key] = [];
    byHospital[key].push(r);
  });

  // Find the hospital with the highest average GPA
  let best = null, bestAvg = -1;
  for (const [name, reps] of Object.entries(byHospital)) {
    const avg = calcAvg(reps);
    if (avg !== null && avg > bestAvg) { bestAvg = avg; best = name; }
  }

  const overallAvg = calcAvg(graded);
  const gpaDisplay = overallAvg !== null ? overallAvg.toFixed(1) : '—';

  // Build the chart data — graded reports sorted by date
  const sorted = [...graded].sort((a, b) => new Date(a.date) - new Date(b.date));
  const chartData = {
    labels: sorted.map(r => fmt(r.date)),
    datasets: [{
      label: 'GPA Points',
      data: sorted.map(r => gradeToGpa(r.grade)),
      borderColor: '#185FA5',
      backgroundColor: 'rgba(24,95,165,0.08)',
      tension: 0.35,
      pointBackgroundColor: '#185FA5',
      pointRadius: 5,
      fill: true
    }]
  };
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 0, max: 4.0, ticks: { stepSize: 0.5 }, grid: { color: '#f0f0f0' } },
      x: { grid: { display: false } }
    }
  };

  return (
    <>
      <Navbar />
      <main className="main">

        <div className="stats">
          <div className="stat-card">
            <div className="stat-label">Overall GPA</div>
            <div className="gpa-score" style={{ marginTop: 6 }}>
              <span className="gpa-num">{gpaDisplay}</span>
              <span className="gpa-max">/ 4.0</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Best hospital</div>
            <div className="stat-value" style={{ marginTop: 6 }}>{best ?? '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Graded reports</div>
            <div className="gpa-score" style={{ marginTop: 6 }}>
              <span className="gpa-num gpa-num-sm">{graded.length}</span>
              <span className="gpa-max">/ {reports.length}</span>
            </div>
          </div>
        </div>

        {graded.length > 1 && (
          <div className="card">
            <div className="card-title">Grade progress over time</div>
            <div style={{ height: 220 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

        {Object.entries(byHospital).map(([name, reps]) => {
          const avg   = calcAvg(reps);
          const isOpen = !collapsed[name];
          return (
            <div className="card" key={name}>
              <button className="hospital-header" onClick={() => setCollapsed(c => ({ ...c, [name]: !c[name] }))}>
                <div>
                  <span className="hospital-name">{name}</span>
                  {avg !== null && <span className="badge badge-blue" style={{ marginLeft: 10 }}>Avg GPA: {avg.toFixed(1)}</span>}
                </div>
                <span className="collapse-icon">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <table className="grade-table">
                  <thead>
                    <tr><th>Report</th><th>Type</th><th>Date</th><th>Status</th><th>Grade</th><th>Graded by</th></tr>
                  </thead>
                  <tbody>
                    {reps.map(r => (
                      <tr key={r._id}>
                        <td>{r.title}</td>
                        <td><span className="badge badge-blue">{r.type}</span></td>
                        <td>{fmt(r.date)}</td>
                        <td><span className={r.status === 'graded' ? 'badge badge-green' : 'badge badge-amber'}>{r.status === 'graded' ? 'Graded' : 'Pending'}</span></td>
                        <td><div className={`grade-circle${r.grade ? '' : ' grade-empty'}`} style={{ margin: '0 auto' }}>{r.grade ?? '—'}</div></td>
                        <td>{r.gradedBy?.name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </main>
    </>
  );
}
