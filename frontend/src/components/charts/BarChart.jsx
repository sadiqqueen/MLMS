// Custom animated bar chart (dashboards.md §2 + RULINGS §A8).
// Bars grow from the baseline (staggered), the max-value bar is accent, the rest
// are brand-primary. Value label above each bar, category label below.
//
//   <BarChart items={[{ l:'Trainees', v:420 }, { l:'PDs', v:96 }]} />
export default function BarChart({ items = [] }) {
  const data = items.map((it) => ({ l: it.l, v: Number(it.v) || 0 }));
  const bmax = Math.max(...data.map((d) => d.v), 1);

  return (
    <div className="mt-bars">
      {data.map((d, i) => {
        const h = Math.max(6, Math.round((d.v / bmax) * 92));
        const isMax = d.v === bmax;
        return (
          <div className="mt-bar-col" key={i}>
            <div className="mt-bar-val" style={{ opacity: 0, animation: `mt-fadeUp .5s ${(0.75 + i * 0.09).toFixed(2)}s forwards` }}>
              {d.v.toLocaleString('en-US')}
            </div>
            <div
              className={`mt-bar${isMax ? ' mt-bar--max' : ''}`}
              style={{ height: `${h}%`, animationDelay: `${(0.15 + i * 0.09).toFixed(2)}s` }}
            />
            <div className="mt-bar-label" title={d.l}>{d.l}</div>
          </div>
        );
      })}
    </div>
  );
}
