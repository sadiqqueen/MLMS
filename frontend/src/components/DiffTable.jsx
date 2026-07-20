// Before → after diff table (lists_views §6, proto_modals edit-with-approval).
// Struck-through muted "before" → brand-bold "after". Used by the analyzer
// Pending-Changes inbox and any edit-with-approval preview.
//
//   <DiffTable rows={[{ field:'Phone', before:'0912…', after:'0999…' }]} />
export default function DiffTable({ rows = [], labels = { field: 'Field', before: 'Before', after: 'After' } }) {
  return (
    <div className="mt-diff">
      <table>
        <thead>
          <tr>
            <th className="mt-diff-field">{labels.field}</th>
            <th>{labels.before}</th>
            <th>{labels.after}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="mt-diff-field">{r.field}</td>
              <td className="mt-diff-before">{r.before ?? '—'}</td>
              <td className="mt-diff-after">{r.after ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
