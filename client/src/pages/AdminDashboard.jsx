import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import Navbar from '../components/Navbar';
import api    from '../api/axios';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const DONUT_COLORS = [
  '#185FA5','#00B894','#0984e3','#e17055','#e84393',
  '#00cec9','#fdcb6e','#a29bfe','#55efc4','#fd79a8'
];

const STAT_CARDS = [
  { key: 'totalHospitals',    label: 'Total Hospitals',    icon: '🏥', cls: 'icon-purple' },
  { key: 'totalDoctors',      label: 'Total Doctors',      icon: '👨‍⚕️', cls: 'icon-green'  },
  { key: 'totalDistributions',label: 'Distributions',      icon: '📋', cls: 'icon-blue'   },
  { key: 'totalEvaluations',  label: 'Total Evaluations',  icon: '📊', cls: 'icon-orange' },
  { key: 'totalSpecialties',  label: 'Specialties',        icon: '🔬', cls: 'icon-pink'   },
  { key: 'pendingEvaluations',label: 'Pending Evaluations',icon: '⏳', cls: 'icon-teal'   },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminDashboard() {
  const [stats,   setStats  ] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dashboard/stats')
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Chart data ─────────────────────────────────────────────────────────
  const donutData = stats ? {
    labels:   (stats.doctorsBySpecialty || []).map(d => d.specialty),
    datasets: [{
      data:            (stats.doctorsBySpecialty || []).map(d => d.count),
      backgroundColor: DONUT_COLORS.slice(0, (stats.doctorsBySpecialty || []).length),
      borderWidth:     2,
      borderColor:     '#fff'
    }]
  } : null;

  const barData = stats ? {
    labels:   (stats.doctorsByHospital || []).map(d => d.hospital),
    datasets: [{
      label:           'Distributions',
      data:            (stats.doctorsByHospital || []).map(d => d.count),
      backgroundColor: '#185FA5',
      borderRadius:    6,
    }]
  } : null;

  const barOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f0f2f5' } },
      x: { grid: { display: false } }
    }
  };

  const donutOptions = {
    responsive:  true,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
  };

  if (loading) {
    return (
      <><Navbar /><main className="admin-main"><div className="loading">Loading dashboard…</div></main></>
    );
  }

  return (
    <>
      <Navbar />

      <main className="admin-main">

        {/* ── PAGE HEADER ── */}
        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">Dashboard</div>
            <div className="admin-page-sub">Overview of the clinical training system</div>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="stat-cards-grid">
          {STAT_CARDS.map(card => (
            <div className="stat-card" key={card.key}>
              <div className={`stat-icon ${card.cls}`}>{card.icon}</div>
              <div className="stat-info">
                <div className="stat-value">{stats?.[card.key] ?? 0}</div>
                <div className="stat-label">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── CHARTS ── */}
        <div className="charts-row">

          <div className="chart-card">
            <div className="chart-card-title">Doctors by Specialty</div>
            <div className="chart-wrap" style={{ maxWidth: 280, margin: '0 auto' }}>
              {donutData && donutData.labels.length > 0
                ? <Doughnut data={donutData} options={donutOptions} />
                : <div className="admin-empty">No specialty data yet</div>
              }
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-card-title">Distributions by Hospital</div>
            <div className="chart-wrap">
              {barData && barData.labels.length > 0
                ? <Bar data={barData} options={barOptions} />
                : <div className="admin-empty">No distribution data yet</div>
              }
            </div>
          </div>

        </div>

        {/* ── RECENT EVALUATIONS ── */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Recent Evaluations</div>
          </div>
          <div className="admin-table-wrap">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Doctor</th>
                  <th>Hospital</th>
                  <th>Specialty</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentEvaluations || []).length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#aaa', padding: 28 }}>No evaluations yet</td></tr>
                )}
                {(stats?.recentEvaluations || []).map(ev => (
                  <tr key={ev._id}>
                    <td>{ev.student?.name ?? '—'}</td>
                    <td>{ev.doctor?.name  ?? '—'}</td>
                    <td>{ev.hospital?.name ?? '—'}</td>
                    <td>{ev.specialty || '—'}</td>
                    <td>{fmtDate(ev.date)}</td>
                    <td>
                      <span className={ev.status === 'completed' ? 'badge-completed' : 'badge-pending'}>
                        {ev.status}
                      </span>
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
