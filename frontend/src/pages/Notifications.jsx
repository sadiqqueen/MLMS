import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Sk from '../components/Skeleton';
import { IconTrash } from '../components/icons';

function fmt(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function safeArr(v) { return Array.isArray(v) ? v : []; }

// A notification counts as "from the Program Director" when it is tagged with the
// program_director category, or (for legacy notifications with no category) when
// its wording names the Program Director.
function isFromPd(n) {
  return n.category === 'program_director' || /program director/i.test(n.message || '');
}

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!user) return;
    api.get(`/api/notifications/${user._id}`)
      .then(r => setItems(safeArr(r.data).filter(isFromPd)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [user]);

  async function markRead(n) {
    if (n.read) return;
    setItems(prev => prev.map(x => x._id === n._id ? { ...x, read: true } : x));
    try { await api.put(`/api/notifications/${n._id}/read`); } catch { /* ignore */ }
  }

  async function markAllRead() {
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    try { await api.put(`/api/notifications/read-all/${user._id}`); } catch { /* ignore */ }
  }

  async function handleDelete(id) {
    setItems(prev => prev.filter(x => x._id !== id));
    try { await api.delete(`/api/notifications/${id}`); } catch { /* ignore */ }
  }

  const unread = items.filter(n => !n.read).length;

  return (
    <>
      <Navbar />
      <main className="main">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div className="card-title">Program Director Notifications</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Updates from your Program Directors — e.g. when a report is graded or published.
              </div>
            </div>
            {unread > 0 && (
              <button className="btn-purple" onClick={markAllRead}>Mark all as read</button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => <Sk key={i} h={58} r={10} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>🔔</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No notifications yet</div>
              <div style={{ fontSize: 13 }}>Notifications from your Program Directors will appear here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(n => (
                <div key={n._id}
                  role="button"
                  onClick={() => markRead(n)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
                    background: n.read ? 'var(--surface-2)' : 'var(--info-bg)',
                    borderLeft: `4px solid ${n.read ? 'var(--border)' : 'var(--accent)'}`,
                    cursor: 'pointer',
                  }}>
                  <div style={{ width: 10, flexShrink: 0 }}>
                    {!n.read && <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: n.read ? 500 : 700 }}>{n.message}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{fmt(n.createdAt)}</div>
                  </div>
                  <button type="button" title="Delete" aria-label="Delete"
                    onClick={e => { e.stopPropagation(); handleDelete(n._id); }}
                    style={{
                      width: 32, height: 32, borderRadius: 8, background: 'var(--surface)',
                      border: '1px solid var(--border)', color: 'var(--danger-fg)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                    <IconTrash size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
