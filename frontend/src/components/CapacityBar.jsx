// Program capacity bar (n / 100) — RULINGS §H41 unified thresholds.
// >75% amber (accent), 100% red (at capacity), else brand-primary. The fill
// width animates .9s; reduced motion neutralizes it globally.
//
//   <CapacityBar used={96} max={100} />
export default function CapacityBar({ used = 0, max = 100, label = 'Program capacity', showHead = true }) {
  const u = Number(used) || 0;
  const m = Number(max) || 100;
  const pct = Math.min(100, m > 0 ? (u / m) * 100 : 0);
  const level = u >= m ? 'full' : (u / m) * 100 > 75 ? 'warn' : 'low';
  const fillClass = level === 'full' ? 'mt-capacity-fill--full' : level === 'warn' ? 'mt-capacity-fill--warn' : '';

  return (
    <div>
      {showHead && (
        <div className="mt-capacity-head">
          <span className="mt-capacity-label">{label}</span>
          <span className="mt-capacity-count"><b>{u}</b> / {m} programs used</span>
        </div>
      )}
      <div className="mt-capacity-track">
        <div className={`mt-capacity-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
