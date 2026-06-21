import { useEffect, useRef } from 'react';
import { IconTrash } from './icons';

// Converts a date into a human-friendly "X minutes/hours/days ago" string
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Props this component receives from Navbar:
// - notifications: the array of notification objects
// - onOpen(n):     call when user clicks a notification (marks read + navigates to its page)
// - onReadAll():   call when user clicks "Mark all as read"
// - onDelete(id):  call to delete a (read) notification
// - onClose():     call when user clicks outside (closes the panel)
export default function NotificationPanel({ notifications, onOpen, onReadAll, onDelete, onClose }) {
  const panelRef = useRef(null);
  // useRef gives us a reference to the actual DOM element so we can detect clicks outside it

  // "Outside click to close" — a very common UI pattern
  useEffect(() => {
    function handleClick(e) {
      // If the click target is NOT inside our panel, close it
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    // Add the listener when the panel opens
    document.addEventListener('mousedown', handleClick);
    // Remove it when the panel unmounts (closes) — always clean up event listeners!
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="notif-panel" ref={panelRef}>
      <div className="notif-header">
        <span className="notif-title">Notifications</span>
        <button className="notif-mark-all" onClick={onReadAll}>Mark all as read</button>
      </div>

      <div className="notif-list">
        {notifications.length === 0 && (
          <div className="notif-empty">No notifications</div>
        )}
        {notifications.map(n => (
          <div
            key={n._id}
            className={`notif-item${n.read ? '' : ' notif-unread'}`}
            role="button"
            onClick={() => onOpen(n)}
          >
            <div className="notif-dot-wrap">
              {!n.read && <span className="notif-dot" />}
            </div>
            <div className="notif-body">
              <div className="notif-msg">{n.message}</div>
              <div className="notif-time">{timeAgo(n.createdAt)}</div>
            </div>
            {n.read && (
              <button
                className="notif-del"
                title="Delete notification"
                aria-label="Delete notification"
                onClick={e => { e.stopPropagation(); onDelete(n._id); }}
              >
                <IconTrash size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
