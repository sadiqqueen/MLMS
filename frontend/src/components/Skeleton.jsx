export default function Skeleton({ w = '100%', h = 16, r = 4, style }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
  );
}
