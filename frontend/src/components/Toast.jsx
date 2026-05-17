// Toast component — renders floating notifications at the bottom-right.
// Usage in a page:
//   const [toasts, setToasts] = useState([]);
//   function showToast(message, type = 'success') {
//     const id = Date.now();
//     setToasts(prev => [...prev, { id, message, type }]);
//     setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
//   }

export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? '✓ ' : '✕ '}{t.message}
        </div>
      ))}
    </div>
  );
}
