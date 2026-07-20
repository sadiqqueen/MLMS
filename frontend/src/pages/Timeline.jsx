import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api    from '../api/axios';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import { NavIcon } from '../components/icons';
import './trainee.css';

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function safeArr(value) {
  return Array.isArray(value) ? value : [];
}

// Normalize distribution (V2) or rotation (V1) to a common shape.
function normalize(item = {}) {
  if (item.traineeId || item.supervisorId || item.specialtyId) {
    return {
      _id:          item._id,
      specialty:    item.specialtyId?.name || item.specialty || 'Specialty Training',
      hospital:     item.hospitalId?.name  || item.hospital?.name || '—',
      supervisor:   item.supervisorId?.name || item.doctor?.name  || '—',
      startDate:    item.startDate,
      endDate:      item.endDate,
      durationWeeks:item.durationWeeks,
      status:       item.status || 'active',
    };
  }
  return {
    _id:          item._id,
    specialty:    item.hospital?.name || 'Clinical Rotation',
    hospital:     item.hospital?.name || '—',
    supervisor:   item.doctor?.name   || '—',
    startDate:    item.startDate,
    endDate:      item.endDate,
    durationWeeks:null,
    status:       item.status || 'upcoming',
  };
}

// % complete of one rotation: completed→100, active→elapsed/total, else 0.
function rotationPct(item) {
  if (item.status === 'completed') return 100;
  if (item.status !== 'active') return 0;
  const s = item.startDate ? new Date(item.startDate).getTime() : NaN;
  const e = item.endDate   ? new Date(item.endDate).getTime()   : NaN;
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 50;
  const p = ((Date.now() - s) / (e - s)) * 100;
  return Math.max(0, Math.min(100, Math.round(p)));
}

// Count own log-book entries per day across the last 14 days.
function logbook14(entries) {
  const days = [];
  const base = new Date(); base.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(base); d.setDate(base.getDate() - i);
    days.push(d);
  }
  const values = days.map(d => {
    const next = new Date(d); next.setDate(d.getDate() + 1);
    return entries.filter(en => {
      const t = new Date(en.date || en.createdAt).getTime();
      return t >= d.getTime() && t < next.getTime();
    }).length;
  });
  const lbl = i => days[i].toLocaleDateString('en-US', { month:'short', day:'numeric' });
  return { values, labels: [lbl(0), lbl(3), lbl(6), lbl(10), lbl(13)] };
}

function StatusPill({ status }) {
  const map = {
    active:    { cls: 'mt-pill--active',   label: 'Active' },
    completed: { cls: 'mt-pill--capacity', label: 'Completed' },
    upcoming:  { cls: 'mt-pill--warn',     label: 'Upcoming' },
  };
  const s = map[status] || map.upcoming;
  return <span className={`mt-pill ${s.cls}`}>{s.label}</span>;
}

function RotationCard({ item }) {
  return (
    <div className="tr-rot-card" style={{ opacity: item.status === 'upcoming' ? 0.72 : 1 }}>
      <div className="tr-rot-head">
        <div className="tr-rot-name">{item.specialty}</div>
        <StatusPill status={item.status} />
      </div>
      <div className="tr-rot-line"><NavIcon name="building" size={14} /><strong style={{ color:'var(--text)' }}>{item.hospital}</strong></div>
      {item.supervisor && item.supervisor !== '—' && (
        <div className="tr-rot-line"><NavIcon name="users" size={14} />Dr. {item.supervisor.replace(/^Dr\.?\s*/i, '')}</div>
      )}
      <div className="tr-rot-line" style={{ fontSize:12 }}>
        <NavIcon name="clock" size={14} />
        {fmt(item.startDate)} — {fmt(item.endDate)}{item.durationWeeks ? ` · ${item.durationWeeks} weeks` : ''}
      </div>
    </div>
  );
}

export default function Timeline() {
  const { user }    = useAuth();
  const [items,   setItems  ] = useState([]);
  const [logs,    setLogs   ] = useState([]);
  const [certs,   setCerts  ] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    const timeline = api.get('/api/trainee/timeline')
      .then(r => {
        const list = safeArr(r.data?.data || r.data);
        if (list.length > 0) return list;
        return api.get(`/api/rotations/student/${user._id}`).then(r2 => safeArr(r2.data?.data || r2.data));
      })
      .catch(() =>
        api.get(`/api/rotations/student/${user._id}`)
          .then(r => safeArr(r.data?.data || r.data))
          .catch(() => [])
      );

    // Best-effort self-owned data for the dashboard stats/charts.
    const logbook = api.get('/api/logbook/mine').then(r => safeArr(r.data?.data || r.data)).catch(() => []);
    const courses = api.get('/api/trainee-courses/mine').then(r => safeArr(r.data?.data || r.data)).catch(() => []);

    Promise.all([timeline, logbook, courses]).then(([tl, lb, cc]) => {
      if (!alive) return;
      setItems(tl.map(normalize));
      setLogs(lb);
      setCerts(cc.filter(c => c.kind !== 'course').length);
    }).finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [user]);

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content">
        <MtSkeleton stats={4} charts={2} table={false} />
      </main>
    </>
  );

  const completed  = items.filter(r => r.status === 'completed').length;
  const total      = items.length;
  const pendingLb  = logs.filter(l => l.status === 'pending').length;

  const stats = [
    { label:'Rotations completed', value:completed, icon:'clock', delta: total ? `of ${total}` : undefined, tone:'warn' },
    { label:'Logbook entries',     value:logs.length, icon:'book' },
    { label:'Certificates earned', value:certs, icon:'award' },
    { label:'Pending sign-offs',   value:pendingLb, icon:'check', delta: pendingLb ? 'awaiting PD review' : undefined, tone:'warn' },
  ];

  const line = logbook14(logs);
  const hasLine = line.values.some(v => v > 0);

  const bars = items
    .map(it => ({ l: it.specialty, v: rotationPct(it) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);

  return (
    <>
      <Navbar />
      <main className="mt-content">

        {/* Stat cards */}
        <div className="mt-stat-grid">
          {stats.map((s, i) => (
            <RevealOnScroll key={s.label} delay={i * 0.055}>
              <StatCard label={s.label} value={s.value} icon={s.icon} delta={s.delta} tone={s.tone || 'ok'} />
            </RevealOnScroll>
          ))}
        </div>

        {/* Charts */}
        <div className="tr-charts">
          <RevealOnScroll chart className="mt-card mt-card--chart" delay={0}>
            <div className="mt-card-head">
              <div style={{ minWidth:0 }}>
                <div className="mt-card-title">Logbook entries</div>
                <div className="mt-card-sub">Last 14 days</div>
              </div>
              <div className="mt-divider" />
            </div>
            {hasLine
              ? <LineChart values={line.values} labels={line.labels} />
              : <div className="tr-chart-empty">No log book activity in the last 14 days.</div>}
          </RevealOnScroll>

          <RevealOnScroll chart className="mt-card mt-card--chart" delay={0.08}>
            <div className="mt-card-head">
              <div style={{ minWidth:0 }}>
                <div className="mt-card-title">Rotation progress</div>
                <div className="mt-card-sub">% complete by module</div>
              </div>
              <div className="mt-divider" />
            </div>
            {bars.length
              ? <BarChart items={bars} />
              : <div className="tr-chart-empty">No rotations assigned yet.</div>}
          </RevealOnScroll>
        </div>

        {/* Training timeline (alternating spine) */}
        <RevealOnScroll className="mt-card-head" style={{ marginBlockStart:24 }}>
          <div style={{ minWidth:0 }}>
            <div className="mt-card-title">Training timeline</div>
            <div className="mt-card-sub">{completed} of {total} rotations completed</div>
          </div>
          <div className="mt-divider" />
        </RevealOnScroll>

        {items.length === 0 ? (
          <div className="mt-empty">
            <span className="mt-empty-icon"><NavIcon name="clock" size={24} /></span>
            <div className="mt-empty-title">No rotations assigned yet</div>
            <div className="mt-empty-sub">Your secretary will assign you to specialties. Check back soon.</div>
          </div>
        ) : (
          <div className="timeline-alt">
            {items.map((item, i) => {
              const isLeft   = i % 2 === 0;
              const dotClass = item.status==='completed' ? 'tl-dot tl-done'
                             : item.status==='active'    ? 'tl-dot tl-current'
                             :                             'tl-dot tl-upcoming';
              const card = <RotationCard item={item} />;
              return (
                <div className="tl-alt-item" key={item._id}>
                  <div className={`tl-alt-card${isLeft  ? '' : ' tl-invisible'}`}>{isLeft  && card}</div>
                  <div className="tl-alt-spine">
                    <div className={dotClass} />
                    {i < items.length - 1 && <div className="tl-spine-line" />}
                  </div>
                  <div className={`tl-alt-card${!isLeft ? '' : ' tl-invisible'}`}>{!isLeft && card}</div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </>
  );
}
