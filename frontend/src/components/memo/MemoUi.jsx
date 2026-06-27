import { useState, useCallback, useEffect, useRef } from 'react';

// Small UI primitives shared by the consultant-memo pages.

// Toasts with an optional action button (e.g. تراجع/undo).
export function useMemoToasts() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', action = null) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, action }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), action ? 6000 : 3200);
  }, []);

  const dismiss = useCallback(id => setToasts(prev => prev.filter(x => x.id !== id)), []);

  return { toasts, showToast, dismiss };
}

export function MemoToasts({ toasts, dismiss }) {
  return (
    <div className="cmx-toasts" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`cmx-toast cmx-toast-${t.type}`} role="status">
          <span>{t.message}</span>
          {t.action && (
            <button
              className="cmx-toast-action"
              onClick={() => { t.action.onClick(); dismiss(t.id); }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// Focus-trapped modal (delete confirmation, print preview).
export function MemoModal({ title, onClose, children, wide = false, labelledBy }) {
  const boxRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const box = boxRef.current;
    const focusables = () => box.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusables()[0]?.focus();

    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = [...focusables()];
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="cmx-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        ref={boxRef}
        className={'cmx-modal' + (wide ? ' cmx-modal-wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {title}
        {children}
      </div>
    </div>
  );
}

// Auto-growing textarea. The box always grows to fit its full content so
// nothing is clipped. Pass `singleLine` for fields that are conceptually one
// line (e.g. a topic name or an attachment line): they still wrap & grow, but
// Enter is suppressed so no stray newline is stored.
export function AutoTextarea({ value, onChange, rows = 4, singleLine = false, onKeyDown, ...rest }) {
  const ref = useRef(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);
  useEffect(() => { fit(); }, [value, fit]);
  // Re-measure when the container width changes (responsive / sidebar toggles).
  useEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);
  const handleKeyDown = e => {
    if (singleLine && e.key === 'Enter') e.preventDefault();
    onKeyDown?.(e);
  };
  return (
    <textarea
      ref={ref}
      rows={singleLine ? 1 : rows}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );
}
