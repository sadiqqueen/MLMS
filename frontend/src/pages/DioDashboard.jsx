import { useState, useEffect } from 'react';
import Navbar        from '../components/Navbar';
import StatCard      from '../components/StatCard';
import LineChart     from '../components/charts/LineChart';
import BarChart      from '../components/charts/BarChart';
import DonutChart    from '../components/charts/DonutChart';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton    from '../components/MtSkeleton';
import api           from '../api/axios';
import './dio.css';

// ODIO operations dashboard — mt- restyle (dashboards.md §4.7 layout, real data
// from GET /api/dio/stats). Endpoint + fields are unchanged from the legacy page;
// only the presentation moves to the shared StatCard + animated SVG charts.
const STAT_CARDS = [
  { key: 'hospitals',        label: 'Hospitals',         icon: 'building' },
  { key: 'trainees',         label: 'Trainees',          icon: 'grad'     },
  { key: 'supervisors',      label: 'Supervisors',       icon: 'users'    },
  { key: 'programDirectors', label: 'Program Directors', icon: 'brief'    },
  { key: 'secretaries',      label: 'Secretaries',       icon: 'users'    },
  { key: 'certificates',     label: 'Certificates',      icon: 'award'    },
  { key: 'activeRotations',  label: 'Active Rotations',  icon: 'clock'    },
];

function ChartCard({ title, sub, delay, children }) {
  return (
    <RevealOnScroll as="section" chart delay={delay} className="mt-card mt-card--chart">
      <div className="mt-card-head">
        <div style={{ minWidth: 0 }}>
          <div className="mt-card-title">{title}</div>
          {sub && <div className="mt-card-sub">{sub}</div>}
        </div>
        <div className="mt-divider" />
      </div>
      {children}
    </RevealOnScroll>
  );
}

export default function DioDashboard() {
  const [stats,   setStats  ] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dio/stats')
      .then(r => setStats(r.data?.data || r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const traineeItems = (stats?.traineesBySpecialty      || []).map(d => ({ l: d.specialty, v: d.count }));
  const distItems    = (stats?.distributionsBySpecialty || []).map(d => ({ l: d.specialty, v: d.count }));
  const supItems     = (stats?.supervisorsBySpecialty   || []).map(d => ({ l: d.specialty, v: d.count }));
  const certValues   = (stats?.certsOverTime || []).map(d => d.count);
  const certLabels   = (stats?.certsOverTime || []).map(d => d.month);

  return (
    <>
      <Navbar />
      <main className="mt-content">
        {loading ? (
          <MtSkeleton stats={7} charts={2} table={false} />
        ) : (
          <>
            <div className="mt-stat-grid">
              {STAT_CARDS.map((card, i) => (
                <RevealOnScroll key={card.key} delay={i * 0.055}>
                  <StatCard label={card.label} value={stats?.[card.key] ?? 0} icon={card.icon} />
                </RevealOnScroll>
              ))}
            </div>

            <div className="dio-charts">
              <ChartCard title="Trainees by Specialty" sub="Current cohort" delay={0}>
                {traineeItems.length > 0
                  ? <DonutChart items={traineeItems} cap="trainees" />
                  : <div className="dio-chart-empty">No trainee data yet</div>}
              </ChartCard>

              <ChartCard title="Rotations by Specialty" sub="Active distributions" delay={0.08}>
                {distItems.length > 0
                  ? <BarChart items={distItems} />
                  : <div className="dio-chart-empty">No rotation data yet</div>}
              </ChartCard>

              <ChartCard title="Supervisors by Specialty" sub="Assigned trainers" delay={0.1}>
                {supItems.length > 0
                  ? <BarChart items={supItems} />
                  : <div className="dio-chart-empty">No supervisor data yet</div>}
              </ChartCard>

              <ChartCard title="Certificates Issued Over Time" sub="Recent months" delay={0.12}>
                {certValues.length > 0
                  ? <LineChart values={certValues} labels={certLabels} />
                  : <div className="dio-chart-empty">No certificate data yet</div>}
              </ChartCard>
            </div>
          </>
        )}
      </main>
    </>
  );
}
