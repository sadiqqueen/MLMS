// Custom 3-line "Registry growth" chart (dashboards.md §5.1 + RULINGS §A8).
// Three cumulative series (brand / accent / success), staggered draw-in
// (0.25 + i*0.2s), shared axis max, NO area fill, NO end-dots. Header legend
// chips are rendered by the caller or via the `series[].name` + last value.
//
//   <GrowthChart
//     series={[{ name:'Programs', values:[...], color:'var(--brand-primary)' }, ...]}
//     labels={['Aug','Oct',...]} />
const W = 600, H = 210, TOP = 16, PLOT = 164, BASE = 180;

export default function GrowthChart({ series = [], labels = [] }) {
  const clean = series.map((s) => ({ ...s, values: (s.values || []).map((v) => Number(v) || 0) }));
  const all = clean.flatMap((s) => s.values);
  if (all.length === 0) return <svg className="mt-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 210 }} aria-hidden="true" />;

  const max = Math.max(...all, 1) * 1.12;

  return (
    <>
      {/* legend chips */}
      {clean.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end', marginBlockEnd: 8 }}>
          {clean.map((s) => (
            <span key={s.name} className="mt-chart-legend-row" style={{ flex: 'none' }}>
              <span className="mt-chart-legend-sw" style={{ background: s.color }} />
              <span style={{ color: 'var(--text-2)' }}>{s.name} · </span>
              <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {(s.values[s.values.length - 1] || 0).toLocaleString('en-US')}
              </b>
            </span>
          ))}
        </div>
      )}

      <svg className="mt-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 210 }} aria-hidden="true">
        {[60, 110, 160].map((gy) => (
          <line key={gy} x1="0" y1={gy} x2={W} y2={gy} stroke="var(--border)" strokeWidth="1" />
        ))}
        <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="var(--border)" strokeWidth="1.5" />

        {clean.map((s, si) => {
          const nn = s.values.length;
          const x = (i) => (nn > 1 ? 6 + (i * 588) / (nn - 1) : W / 2);
          const y = (v) => TOP + (1 - v / max) * PLOT;
          const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
          return (
            <polyline
              key={s.name || si} points={pts} fill="none" stroke={s.color || 'var(--brand-primary)'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1"
              style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: `mt-drawLine 1.5s ${(0.25 + si * 0.2).toFixed(2)}s cubic-bezier(.4,0,.2,1) forwards` }}
            />
          );
        })}
      </svg>

      {labels.length > 0 && (
        <div className="mt-chart-labels">
          {labels.map((l, i) => <span key={i} className="mt-chart-label">{l}</span>)}
        </div>
      )}
    </>
  );
}
