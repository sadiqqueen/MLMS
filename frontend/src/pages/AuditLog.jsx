import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

const ACTION_COLORS = {
  create_user:          { bg:'#D1FAE5', color:'#065F46' },
  update_user:          { bg:'#DBEAFE', color:'#1E40AF' },
  deactivate_user:      { bg:'#FEE2E2', color:'#991B1B' },
  create_trainee:       { bg:'#D1FAE5', color:'#065F46' },
  update_trainee:       { bg:'#DBEAFE', color:'#1E40AF' },
  create_supervisor:    { bg:'#D1FAE5', color:'#065F46' },
  create_distribution:  { bg:'#EDE9FE', color:'#5B21B6' },
  finalize_evaluation:  { bg:'#FEF3C7', color:'#92400E' },
  grade_final_report:   { bg:'#FCE7F3', color:'#9D174D' },
  issue_certificate:    { bg:'#D1FAE5', color:'#065F46' },
  revoke_certificate:   { bg:'#FEE2E2', color:'#991B1B' },
  create_hospital:      { bg:'#DBEAFE', color:'#1E40AF' },
  create_specialty:     { bg:'#EDE9FE', color:'#5B21B6' },
  upload_pdf_template:  { bg:'#FEF3C7', color:'#92400E' },
};

const ROLE_BADGE = {
  super_admin:      { bg:'#1B1464', color:'#fff'     },
  secretary:        { bg:'#FEF3C7', color:'#92400E'  },
  dio:              { bg:'#FCE7F3', color:'#9D174D'  },
  supervisor:       { bg:'#D1FAE5', color:'#065F46'  },
  program_director: { bg:'#EDE9FE', color:'#5B21B6'  },
  trainee:          { bg:'#DBEAFE', color:'#1E40AF'  },
  president:        { bg:'#E0F2FE', color:'#075985'  },
};

export default function AuditLog() {
  const [logs,    setLogs    ] = useState([]);
  const [loading, setLoading ] = useState(true);
  const [total,   setTotal   ] = useState(0);
  const [page,    setPage    ] = useState(1);
  const [search,  setSearch  ] = useState('');
  const [toasts,  setToasts  ] = useState([]);
  const LIMIT = 30;

  function showToast(msg, type='error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message:msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    setLoading(true);
    api.get(`/api/admin/audit-log?page=${page}&limit=${LIMIT}`)
      .then(r => {
        setLogs(r.data?.data || r.data || []);
        setTotal(r.data?.total || 0);
      })
      .catch(() => showToast('Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return !q
      || l.action?.toLowerCase().includes(q)
      || l.userId?.name?.toLowerCase().includes(q)
      || l.userId?.email?.toLowerCase().includes(q)
      || l.targetModel?.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <Navbar />
      <main className="admin-main">

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#1B1464' }}>Audit Log</div>
          <div style={{ fontSize:13, color:'#8B8FA8', marginTop:2 }}>
            Every create, update, and delete action across the system · {total} total entries
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-toolbar">
            <input
              className="admin-search"
              style={{ flex:1, minWidth:200 }}
              placeholder="Search by action, user, or model…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ fontSize:13, color:'#8B8FA8', flexShrink:0 }}>
              Page {page} of {totalPages || 1}
            </span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Time</th><th>User</th><th>Action</th><th>Collection</th><th>IP</th></tr>
              </thead>
              <tbody>
                {loading && [...Array(10)].map((_,i) => (
                  <tr key={i}>
                    <td><Sk w={120} h={13} /></td>
                    <td><Sk w={130} h={13} /></td>
                    <td><Sk w={140} h={22} r={20} /></td>
                    <td><Sk w={90}  h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign:'center', padding:40, color:'#8B8FA8' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563' }}>No audit entries found</div>
                    </td>
                  </tr>
                )}
                {!loading && filtered.map(log => {
                  const actionStyle = ACTION_COLORS[log.action] || { bg:'#F3F4F6', color:'#6B7280' };
                  const roleStyle   = ROLE_BADGE[log.userId?.role] || { bg:'#F3F4F6', color:'#6B7280' };
                  return (
                    <tr key={log._id}>
                      <td style={{ fontSize:12, color:'#8B8FA8', whiteSpace:'nowrap' }}>
                        {fmt(log.createdAt)}
                      </td>
                      <td>
                        <div>
                          <strong style={{ fontSize:13 }}>{log.userId?.name || 'Unknown'}</strong>
                          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
                            <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:20, background:roleStyle.bg, color:roleStyle.color }}>
                              {log.userId?.role || '—'}
                            </span>
                            <span style={{ fontSize:11, color:'#8B8FA8' }}>{log.userId?.email || ''}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:actionStyle.bg, color:actionStyle.color, whiteSpace:'nowrap' }}>
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize:13, color:'#4B5563' }}>{log.targetModel || '—'}</td>
                      <td style={{ fontSize:12, color:'#8B8FA8', fontFamily:'monospace' }}>{log.ip || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <span>Showing {(page-1)*LIMIT+1}–{Math.min(page*LIMIT, total)} of {total}</span>
              <div className="pagination-btns">
                <button className="pg-btn" disabled={page===1} onClick={() => setPage(1)}>«</button>
                <button className="pg-btn" disabled={page===1} onClick={() => setPage(p => p-1)}>‹</button>
                {Array.from({ length:Math.min(totalPages, 5) }, (_,i) => {
                  const n = Math.max(1, Math.min(page-2, totalPages-4)) + i;
                  return n <= totalPages ? (
                    <button key={n} className={`pg-btn${n===page ? ' active-pg' : ''}`} onClick={() => setPage(n)}>{n}</button>
                  ) : null;
                })}
                <button className="pg-btn" disabled={page===totalPages} onClick={() => setPage(p => p+1)}>›</button>
                <button className="pg-btn" disabled={page===totalPages} onClick={() => setPage(totalPages)}>»</button>
              </div>
            </div>
          )}
        </div>

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
