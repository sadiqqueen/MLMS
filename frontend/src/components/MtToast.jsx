import { useCallback, useRef, useState } from 'react';

// Toast system for the mt- shell (shell_tokens §d "Toast"). Surface card, 3px
// tone left-border, tinted icon circle, slide-up, auto-dismiss after 3800ms.
// Tones: 'ok' (green check), 'warn' (accent check, e.g. submitted-for-approval),
// 'dng' (red X).
//
//   const { toasts, showToast } = useMtToast();
//   showToast('Saved', 'ok');
//   return <> … <MtToastHost toasts={toasts} /> </>;
let counter = 0;

export function useMtToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const showToast = useCallback((message, tone = 'ok') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, tone }]);
    timers.current[id] = setTimeout(() => dismiss(id), 3800);
    return id;
  }, [dismiss]);

  return { toasts, showToast, dismiss };
}

function ToneIcon({ tone }) {
  const common = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (tone === 'dng') return (<svg {...common} aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>);
  return (<svg {...common} aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>);
}

export function MtToastHost({ toasts = [] }) {
  if (!toasts.length) return null;
  return (
    <div className="mt-toast-container">
      {toasts.map((t) => {
        const cls = t.tone === 'dng' ? 'mt-toast--dng' : t.tone === 'warn' ? 'mt-toast--warn' : 'mt-toast--ok';
        return (
          <div key={t.id} className={`mt-toast ${cls}`} style={{ pointerEvents: 'auto' }} role="status">
            <span className="mt-toast-ic"><ToneIcon tone={t.tone} /></span>
            <span className="mt-toast-msg">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

export default MtToastHost;
