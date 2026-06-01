// Toast component — renders floating notifications at the bottom-right.
// Usage in a page:
//   const [toasts, setToasts] = useState([]);
//   function showToast(message, type = 'success') {
//     const id = Date.now();
//     setToasts(prev => [...prev, { id, message, type }]);
//     setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
//   }

// Supports two calling conventions:
//   <Toast toasts={toasts} />              — passes whole array (preferred)
//   <Toast message="msg" type="success" /> — per-item render (legacy/spread usage)
export default function Toast({ toasts, message, type = 'success' }) {
  const items = Array.isArray(toasts)
    ? toasts
    : (message ? [{ id: 0, message, type }] : []);
  if (!items.length) return null;
  return (
    <div className="toast-container">
      {items.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? '✓ ' : '✕ '}{t.message}
        </div>
      ))}
    </div>
  );
}
