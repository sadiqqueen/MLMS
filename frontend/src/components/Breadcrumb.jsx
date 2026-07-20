// Breadcrumb (shell_tokens §d, clerk Countries drill-down lists_views §5).
// Clickable ancestors are navy links; the current level is plain text. An
// optional `right` node (add button / at-capacity chip) sits at the end.
//
//   <Breadcrumb
//     items={[{ label:'Countries', onClick: goHome }, { label:'Sudan', onClick: backToCentres }, { label:'Khartoum TH' }]}
//     right={<button className="mt-btn mt-btn--small">+ Add program</button>} />
export default function Breadcrumb({ items = [], right }) {
  return (
    <nav className="mt-breadcrumb" aria-label="Breadcrumb">
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        const clickable = !isLast && (it.onClick || it.to);
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span className="mt-breadcrumb-sep" aria-hidden="true">›</span>}
            {clickable ? (
              <button type="button" className="mt-breadcrumb-item mt-breadcrumb-link" onClick={it.onClick}>
                {it.label}
              </button>
            ) : (
              <span className="mt-breadcrumb-item" aria-current={isLast ? 'page' : undefined}>{it.label}</span>
            )}
          </span>
        );
      })}
      {right && <><span className="mt-breadcrumb-spacer" />{right}</>}
    </nav>
  );
}
