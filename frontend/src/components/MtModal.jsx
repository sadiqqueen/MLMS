import { useEffect } from 'react';

// Modal shell (shell_tokens §d "Modal", proto_modals §9). 560px card, header with
// title + sub + optional accent meta chip + close, scrollable body, surface-2
// footer. Closes on overlay click and Esc.
//
//   <MtModal open={open} title="Add trainee" sub="Central Secretary"
//     meta="Internal Medicine" onClose={close}
//     footer={<><button className="mt-btn--cancel" onClick={close}>Cancel</button>
//              <button className="mt-btn" onClick={save}>Create trainee</button></>}>
//     …fields…
//   </MtModal>
export default function MtModal({ open, title, sub, meta, onClose, children, footer, labelledBy = 'mt-modal-title' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mt-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="mt-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="mt-modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="mt-modal-title" id={labelledBy}>{title}</div>
            {sub && <div className="mt-modal-sub">{sub}</div>}
          </div>
          <div className="mt-modal-head-spacer" />
          {meta && <span className="mt-modal-meta">{meta}</span>}
          <button type="button" className="mt-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="mt-modal-body">{children}</div>
        {footer && <div className="mt-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
