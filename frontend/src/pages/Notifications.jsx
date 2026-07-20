import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Sk from '../components/Skeleton';
import { IconTrash, NavIcon } from '../components/icons';
import './trainee.css';

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
      <main className="mt-content">
        <div className="mt-card">
          <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div className="mt-card-title">Program Director notifications</div>
              <div className="mt-card-sub">Updates from your Program Directors — e.g. when a report is graded or published.</div>
            </div>
            <div className="mt-card-head-spacer" style={{ flex: 1 }} />
            {unread > 0 && <button className="mt-btn mt-btn--small" onClick={markAllRead}>Mark all as read</button>}
          </div>

          {loading ? (
            <div className="tr-rows">{[0, 1, 2].map(i => <Sk key={i} h={58} r={10} />)}</div>
          ) : items.length === 0 ? (
            <div className="mt-empty">
              <span className="mt-empty-icon"><NavIcon name="bell" size={24} /></span>
              <div className="mt-empty-title">No notifications yet</div>
              <div className="mt-empty-sub">Notifications from your Program Directors will appear here.</div>
            </div>
          ) : (
            <div className="tr-rows" style={{ gap: 8 }}>
              {items.map(n => (
                <div key={n._id} role="button" onClick={() => markRead(n)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
                    background: n.read ? 'var(--surface-2)' : 'var(--brand-primary-t)',
                    borderInlineStart: `4px solid ${n.read ? 'var(--border)' : 'var(--accent)'}`,
                    cursor: 'pointer',
                  }}>
                  <div style={{ width: 10, flexShrink: 0 }}>
                    {!n.read && <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: n.read ? 500 : 700 }}>{n.message}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginBlockStart: 3 }}>{fmt(n.createdAt)}</div>
                  </div>
                  <button type="button" className="mt-icon-action mt-icon-action--danger" title="Delete" aria-label="Delete"
                    onClick={e => { e.stopPropagation(); handleDelete(n._id); }}
                    style={{ width: 32, height: 32, border: '1px solid var(--border)', background: 'var(--surface)' }}>
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
