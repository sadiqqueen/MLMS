import useCountUp from '../../hooks/useCountUp';

// Custom animated donut (dashboards.md §2 + RULINGS §A8).
// Segment fade-in, count-up center total, legend rows with value + percent.
// Donut palette per prototype: [brand, accent, brand-d, accent-hover, success, text-2]
// (segments 2 & 4 are the accent-highlighted ones).
//
//   <DonutChart items={[{ l:'Sudan', v:12 }, ...]} cap="centers" />
const PALETTE = [
  'var(--brand-primary)', 'var(--accent)', 'var(--brand-primary-d)',
  'var(--accent-hover)', 'var(--success)', 'var(--text-2)',
];

export default function DonutChart({ items = [], cap = '', colors = PALETTE }) {
  const data = items.map((it) => ({ l: it.l, v: Number(it.v) || 0 }));
  const total = data.reduce((s, d) => s + d.v, 0);
  const shownTotal = useCountUp(total);

  let acc = 0;
  const segs = data.map((d, i) => {
    const pct = total ? (d.v / total) * 100 : 0;
    const len = Math.max(pct - 1.6, 0.4);
    const seg = {
      color: colors[i % colors.length],
      dasharray: `${len.toFixed(2)} ${(100 - len).toFixed(2)}`,
      dashoffset: (-(acc + 0.8)).toFixed(2),
      delay: (0.2 + i * 0.13).toFixed(2),
    };
    acc += pct;
    return seg;
  });

  return (
    <div className="mt-donut-wrap">
      <div className="mt-donut">
        <svg viewBox="0 0 180 180" width="150" height="150" aria-hidden="true">
          <circle cx="90" cy="90" r="70" fill="none" stroke="var(--surface-2)" strokeWidth="21" />
          <g transform="rotate(-90 90 90)">
            {segs.map((s, i) => (
              <circle
                key={i} cx="90" cy="90" r="70" fill="none" stroke={s.color} strokeWidth="21"
                pathLength="100" strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset}
                strokeLinecap="butt"
                style={{ opacity: 0, animation: `fadeIn .55s ${s.delay}s forwards` }}
              />
            ))}
          </g>
        </svg>
        <div className="mt-donut-center">
          <div className="mt-donut-total">{shownTotal.toLocaleString('en-US')}</div>
          {cap && <div className="mt-donut-cap">{cap}</div>}
        </div>
      </div>

      <div className="mt-chart-legend" style={{ flex: 1, minWidth: 0 }}>
        {data.map((d, i) => (
          <div className="mt-chart-legend-row" key={i}>
            <span className="mt-chart-legend-sw" style={{ background: colors[i % colors.length] }} />
            <span className="mt-chart-legend-label" title={d.l}>{d.l}</span>
            <span className="mt-chart-legend-val">{d.v.toLocaleString('en-US')}</span>
            <span className="mt-chart-legend-pct">{total ? Math.round((d.v / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
