// Dashboard loading skeleton (dashboards.md §2): 4 stat blocks + 2 chart blocks
// + 1 table block, shimmering with staggered delays. Reuses the app's .skeleton
// class (its @keyframes shimmer already respects reduced motion).
//
//   {loading ? <MtSkeleton /> : <RealDashboard />}
export default function MtSkeleton({ stats = 4, charts = 2, table = true }) {
  return (
    <div>
      <div className="mt-skel-stat-grid">
        {Array.from({ length: stats }).map((_, i) => (
          <div key={i} className="skeleton mt-skel mt-skel-stat" style={{ animationDelay: `${(i * 0.1).toFixed(2)}s` }} />
        ))}
      </div>
      {charts > 0 && (
        <div className="mt-skel-charts">
          {Array.from({ length: charts }).map((_, i) => (
            <div key={i} className="skeleton mt-skel mt-skel-chart" style={{ animationDelay: `${(0.15 + i * 0.1).toFixed(2)}s` }} />
          ))}
        </div>
      )}
      {table && <div className="skeleton mt-skel mt-skel-table" style={{ animationDelay: '.35s' }} />}
    </div>
  );
}
