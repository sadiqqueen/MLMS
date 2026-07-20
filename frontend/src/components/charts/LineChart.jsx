// Custom animated line chart (dashboards.md §2 geometry + RULINGS §A8).
// polyline draw-in 1.5s, tint area fade-in, accent end-dot. viewBox 600×210,
// preserveAspectRatio="none". Colors from tokens (navy line, brand-tint area,
// accent end-dot). Reduced motion is handled by the global kill-switch (the
// draw-in uses `forwards`, so it snaps to the finished line).
//
//   <LineChart values={[62,74,58,...]} labels={['Jul 5','Jul 8',...]} />
const W = 600, H = 210, TOP = 16, PLOT = 164, BASE = 180;

export default function LineChart({ values = [], labels = [], color = 'var(--brand-primary)', areaFill = true, endDot = true }) {
  const vals = values.map((v) => Number(v) || 0);
  const n = vals.length;
  if (n === 0) return <svg className="mt-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 210 }} aria-hidden="true" />;

  const max = Math.max(...vals, 1) * 1.15;
  const x = (i) => (n > 1 ? 6 + (i * 588) / (n - 1) : W / 2);
  const y = (v) => TOP + (1 - v / max) * PLOT;

  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPath = `M ${x(0).toFixed(1)},${y(vals[0]).toFixed(1)} `
    + vals.map((v, i) => `L ${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    + ` L ${x(n - 1).toFixed(1)},${BASE} L ${x(0).toFixed(1)},${BASE} Z`;

  return (
    <>
      <svg className="mt-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 210 }} aria-hidden="true">
        {/* gridlines */}
        {[60, 110, 160].map((gy) => (
          <line key={gy} x1="0" y1={gy} x2={W} y2={gy} stroke="var(--border)" strokeWidth="1" />
        ))}
        <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="var(--border)" strokeWidth="1.5" />

        {areaFill && (
          <path d={areaPath} fill="var(--brand-primary-t)" stroke="none"
            style={{ opacity: 0, animation: 'mt-fadeUp .8s .9s forwards' }} />
        )}

        <polyline
          points={pts} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" pathLength="1"
          style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: 'mt-drawLine 1.5s .25s cubic-bezier(.4,0,.2,1) forwards' }}
        />

        {endDot && n > 0 && (
          <circle cx={x(n - 1)} cy={y(vals[n - 1])} r="4.5" fill="var(--accent)"
            style={{ opacity: 0, animation: 'mt-fadeUp .4s 1.6s forwards' }} />
        )}
      </svg>

      {labels.length > 0 && (
        <div className="mt-chart-labels">
          {labels.map((l, i) => <span key={i} className="mt-chart-label">{l}</span>)}
        </div>
      )}
    </>
  );
}
