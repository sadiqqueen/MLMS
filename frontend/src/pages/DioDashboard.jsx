import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title,
  PointElement, LineElement
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import Navbar from '../components/Navbar';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title,
  PointElement, LineElement
);

const SPECIALTY_COLORS = [
  '#1B1464','#FF6B35','#059669','#DB2777','#D97706'
];

const STAT_CARDS = [
  { key:'hospitals',        label:'Hospitals',         icon:'🏥', bg:'#EDE9FE', color:'#7C3AED' },
  { key:'trainees',         label:'Trainees',          icon:'🎓', bg:'#D1FAE5', color:'#059669' },
  { key:'supervisors',      label:'Supervisors',       icon:'👨‍⚕️', bg:'#DBEAFE', color:'#2563EB' },
  { key:'programDirectors', label:'Program Directors', icon:'⭐', bg:'#FEF3C7', color:'#D97706' },
  { key:'secretaries',      label:'Secretaries',       icon:'📋', bg:'#FCE7F3', color:'#DB2777' },
  { key:'certificates',     label:'Certificates',      icon:'🏆', bg:'#D1FAE5', color:'#059669' },
  { key:'activeRotations',  label:'Active Rotations',  icon:'📅', bg:'#FEE2E2', color:'#DC2626' },
];

export default function DioDashboard() {
  const [stats,   setStats  ] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dio/stats')
      .then(r => setStats(r.data?.data || r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const donutData = stats ? {
    labels:   (stats.traineesBySpecialty || []).map(d => d.specialty),
    datasets: [{
      data:            (stats.traineesBySpecialty || []).map(d => d.count),
      backgroundColor: SPECIALTY_COLORS.slice(0, (stats.traineesBySpecialty || []).length),
      borderWidth:     2,
      borderColor:     '#fff'
    }]
  } : null;

  const distBarData = stats ? {
    labels:   (stats.distributionsBySpecialty || []).map(d => d.specialty),
    datasets: [{
      label:           'Rotations',
      data:            (stats.distributionsBySpecialty || []).map(d => d.count),
      backgroundColor: '#1B1464',
      borderRadius:    6,
    }]
  } : null;

  const supBarData = stats ? {
    labels:   (stats.supervisorsBySpecialty || []).map(d => d.specialty),
    datasets: [{
      label:           'Supervisors',
      data:            (stats.supervisorsBySpecialty || []).map(d => d.count),
      backgroundColor: SPECIALTY_COLORS.slice(0, (stats.supervisorsBySpecialty || []).length),
      borderRadius:    6,
    }]
  } : null;

  const lineData = stats ? {
    labels:   (stats.certsOverTime || []).map(d => d.month),
    datasets: [{
      label:           'Certificates Issued',
      data:            (stats.certsOverTime || []).map(d => d.count),
      borderColor:     '#FF6B35',
      backgroundColor: 'rgba(255,107,53,0.08)',
      tension:         0.35,
      pointBackgroundColor: '#FF6B35',
      pointRadius:     5,
      fill:            true
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

  const hBarOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f0f2f5' } },
      y: { grid: { display: false } }
    }
  };

  const donutOptions = {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
  };

  const lineOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f0f2f5' } },
      x: { grid: { display: false } }
    }
  };

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="stat-cards-grid" style={{ marginBottom: 24 }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} className="stat-card">
              <Sk w={46} h={46} r={10} />
              <div className="stat-info" style={{ flex: 1 }}>
                <Sk w="55%" h={24} style={{ marginBottom: 8 }} />
                <Sk w="75%" h={11} />
              </div>
            </div>
          ))}
        </div>
        <div className="charts-row">
          {[0,1].map(i => (
            <div key={i} className="chart-card">
              <Sk w="40%" h={16} style={{ marginBottom: 16 }} />
              <Sk h={200} r={8} />
            </div>
          ))}
        </div>
        <div className="charts-row">
          {[0,1].map(i => (
            <div key={i} className="chart-card">
              <Sk w="50%" h={16} style={{ marginBottom: 16 }} />
              <Sk h={200} r={8} />
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

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1B1464' }}>DIO Dashboard</div>
          <div style={{ fontSize: 13, color: '#8B8FA8', marginTop: 3 }}>
            Hospital-wide overview · {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </div>
        </div>

        <div className="stat-cards-grid" style={{ marginBottom: 24 }}>
          {STAT_CARDS.map(card => (
            <div className="stat-card" key={card.key}>
              <div className="stat-icon" style={{ background: card.bg, color: card.color, fontSize: 22 }}>
                {card.icon}
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats?.[card.key] ?? 0}</div>
                <div className="stat-label">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="charts-row">
          <div className="chart-card">
            <div className="chart-card-title">Trainees by Specialty</div>
            <div className="chart-wrap" style={{ maxWidth: 300, margin: '0 auto' }}>
              {donutData && donutData.labels.length > 0
                ? <Doughnut data={donutData} options={donutOptions} />
                : <div className="admin-empty" style={{ padding: 40 }}>No trainee data yet</div>
              }
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-card-title">Rotations by Specialty</div>
            <div className="chart-wrap">
              {distBarData && distBarData.labels.length > 0
                ? <Bar data={distBarData} options={barOptions} />
                : <div className="admin-empty" style={{ padding: 40 }}>No rotation data yet</div>
              }
            </div>
          </div>
        </div>

        <div className="charts-row">
          <div className="chart-card">
            <div className="chart-card-title">Supervisors by Specialty</div>
            <div className="chart-wrap">
              {supBarData && supBarData.labels.length > 0
                ? <Bar data={supBarData} options={hBarOptions} />
                : <div className="admin-empty" style={{ padding: 40 }}>No supervisor data yet</div>
              }
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-card-title">Certificates Issued Over Time</div>
            <div className="chart-wrap">
              {lineData && lineData.labels.length > 0
                ? <Line data={lineData} options={lineOptions} />
                : <div className="admin-empty" style={{ padding: 40 }}>No certificate data yet</div>
              }
            </div>
          </div>
        </div>

      </main>
    </>
  );
}
