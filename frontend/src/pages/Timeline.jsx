import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api    from '../api/axios';
import Navbar from '../components/Navbar';
import Sk     from '../components/Skeleton';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

// Normalize distribution (V2) or rotation (V1) to common shape
function normalize(item) {
  // V2 distribution
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
  // V1 rotation
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

function SpecialtyCard({ item }) {
  const muted  = item.status === 'upcoming';
  const statusColor = item.status==='active'    ? '#059669'
                    : item.status==='completed' ? '#1B1464'
                    : '#D97706';
  const statusBg    = item.status==='active'    ? '#D1FAE5'
                    : item.status==='completed' ? '#EEEDFE'
                    : '#FEF3C7';

  return (
    <div style={{
      background:'#fff',
      border:'1px solid #E8E9EF',
      borderRadius:12,
      padding:'18px 20px',
      opacity:muted ? 0.7 : 1,
      boxShadow:'0 1px 3px rgba(0,0,0,.06)',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ fontSize:16, fontWeight:700, color:'#1B1464' }}>
          ⭐ {item.specialty}
        </div>
        <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:statusBg, color:statusColor }}>
          {item.status}
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <div style={{ fontSize:13, color:'#4B5563' }}>
          🏥 <strong>{item.hospital}</strong>
        </div>
        {item.supervisor && item.supervisor !== '—' && (
          <div style={{ fontSize:13, color:'#4B5563' }}>
            👨‍⚕️ Dr. {item.supervisor.replace(/^Dr\.?\s*/i, '')}
          </div>
        )}
        <div style={{ fontSize:12, color:'#8B8FA8' }}>
          📅 {fmt(item.startDate)} — {fmt(item.endDate)}
          {item.durationWeeks ? ` · ${item.durationWeeks} weeks` : ''}
        </div>
      </div>
    </div>
  );
}

export default function Timeline() {
  const { user }    = useAuth();
  const [items,    setItems  ] = useState([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Try V2 endpoint first
    api.get('/api/trainee/timeline')
      .then(r => {
        const list = r.data?.data || r.data || [];
        if (Array.isArray(list) && list.length > 0) {
          setItems(list.map(normalize));
          return;
        }
        // Fall back to V1
        return api.get(`/api/rotations/student/${user._id}`)
          .then(r2 => setItems((r2.data || []).map(normalize)));
      })
      .catch(() =>
        api.get(`/api/rotations/student/${user._id}`)
          .then(r => setItems((r.data || []).map(normalize)))
          .catch(console.error)
      )
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return (
    <>
      <Navbar />
      <main className="main">
        <div className="card progress-card">
          <div className="progress-header">
            <Sk w={160} h={14} /><Sk w={120} h={14} />
          </div>
          <Sk h={8} r={99} style={{ marginTop:8 }} />
          <Sk w={70} h={12} style={{ marginTop:6 }} />
        </div>
        <div className="timeline-alt">
          {[0,1,2].map(i => {
            const isLeft = i % 2 === 0;
            const card = (
              <div style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:'18px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                  <Sk w={160} h={16} /><Sk w={65} h={20} r={20} />
                </div>
                <Sk w={130} h={13} style={{ marginBottom:6 }} />
                <Sk w={110} h={13} style={{ marginBottom:6 }} />
                <Sk w={140} h={12} />
              </div>
            );
            return (
              <div key={i} className="tl-alt-item">
                <div className={`tl-alt-card${isLeft ? '' : ' tl-invisible'}`}>{isLeft && card}</div>
                <div className="tl-alt-spine">
                  <Sk w={14} h={14} r="50%" />
                  <div className="tl-spine-line" />
                </div>
                <div className={`tl-alt-card${!isLeft ? '' : ' tl-invisible'}`}>{!isLeft && card}</div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );

  const completed = items.filter(r => r.status === 'completed').length;
  const total     = items.length;
  const pct       = total ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <Navbar />
      <main className="main">

        <div className="card progress-card">
          <div className="progress-header">
            <span className="progress-label">Specialty Education Progress</span>
            <span className="progress-count">{completed} of {total} completed</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width:`${pct}%`, transition:'width 0.8s ease' }} />
          </div>
          <div className="progress-pct">{pct}% complete</div>
        </div>

        {items.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'#8B8FA8' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#4B5563', marginBottom:6 }}>No rotations assigned yet</div>
            <div style={{ fontSize:13 }}>Your secretary will assign you to specialties. Check back soon.</div>
          </div>
        )}

        <div className="timeline-alt">
          {items.map((item, i) => {
            const isLeft   = i % 2 === 0;
            const dotClass = item.status==='completed' ? 'tl-dot tl-done'
                           : item.status==='active'    ? 'tl-dot tl-current'
                           :                             'tl-dot tl-upcoming';
            const card = <SpecialtyCard item={item} />;
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

      </main>
    </>
  );
}
