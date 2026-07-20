// Pagination row (shell_tokens §d). "Showing a–b of total" on the start, Prev /
// Next buttons on the end. Pass an explicit `info` string to override the count.
//
//   <Pagination page={1} pageSize={8} total={1284} onPrev={...} onNext={...} />
export default function Pagination({ page = 1, pageSize = 8, total = 0, onPrev, onNext, info }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const label = info != null ? info : `Showing ${from.toLocaleString('en-US')}–${to.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`;
  const atStart = page <= 1;
  const atEnd = to >= total;

  return (
    <div className="mt-pagination">
      <span className="mt-pagination-info">{label}</span>
      <span className="mt-pagination-spacer" />
      <button type="button" className="mt-page-btn" onClick={onPrev} disabled={atStart}>‹ Prev</button>
      <button type="button" className="mt-page-btn mt-page-btn--next" onClick={onNext} disabled={atEnd}>Next ›</button>
    </div>
  );
}
