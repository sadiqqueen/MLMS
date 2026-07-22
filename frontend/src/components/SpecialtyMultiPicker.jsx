// Repeatable specialty picker for a central secretary's scope — one line per
// specialty (a searchable select + a remove button); once the current line is
// filled, "+ Add another specialty" adds the next. Any mix of specialties and
// sub-specialties, one or more (required, ≥1). Shared by the analyzer
// (AnalyzerStaffForms) and developer (Users) CS-create/edit forms.
//   options  : [{ value, label }]
//   value    : array of selected specialty ids
//   onChange : (nextIds) => void
import { useState } from 'react';
import SearchableSelect from './SearchableSelect';

export default function SpecialtyMultiPicker({
  options = [], value = [], onChange, error,
  label = 'Specialties & sub-specialties',
  hint = 'select one or more',
  addLabel = 'Add another specialty',
  placeholder = 'Select a specialty or sub-specialty…',
  required = true,
}) {
  // Local working rows: the committed ids from `value`, plus any empty pending
  // row. Seeded once; thereafter this array drives what renders. `value` only
  // ever changes through our own onChange, so local + parent stay in sync.
  const [rows, setRows] = useState(() => (value.length ? value.map(String) : ['']));

  const commit = (next) => { setRows(next); onChange(next.filter(Boolean)); };
  const setRow = (i, id) => commit(rows.map((r, idx) => (idx === i ? id : r)));
  const removeRow = (i) => {
    const next = rows.filter((_, idx) => idx !== i);
    commit(next.length ? next : ['']);   // always leave one (empty) row visible
  };
  const addRow = () => setRows([...rows, '']);

  const chosen = new Set(rows.filter(Boolean).map(String));
  const hasEmptyRow = rows.some((r) => !r);
  const noneLeft = options.length > 0 && options.every((o) => chosen.has(String(o.value)));

  const removeBtn = {
    flex: 'none', width: 34, height: 36, border: '1px solid var(--border)', borderRadius: 8,
    background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const addBtnDisabled = hasEmptyRow || noneLeft;
  const addBtn = {
    width: '100%', height: 36, borderRadius: 8, border: '1.5px dashed var(--brand-primary)',
    background: 'var(--brand-primary-t)', color: 'var(--brand-primary)', fontSize: 12.5, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    cursor: addBtnDisabled ? 'not-allowed' : 'pointer', opacity: addBtnDisabled ? 0.5 : 1,
  };

  return (
    <div className="mt-field mt-field-full">
      <label className="mt-label">
        {label} {required && <span className="mt-label-req">*</span>}
        {hint && <span style={{ fontWeight: 400, color: 'var(--text-2)' }}> {hint}</span>}
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row, i) => {
          // This row may keep its own value; otherwise offer only un-chosen ones.
          const rowOpts = options.filter((o) => String(o.value) === String(row) || !chosen.has(String(o.value)));
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect value={row} onChange={(id) => setRow(i, id)} options={rowOpts}
                  placeholder={placeholder} error={!!error && !row} hideClear />
              </div>
              <button type="button" style={removeBtn} onClick={() => removeRow(i)} aria-label="Remove specialty">✕</button>
            </div>
          );
        })}

        <button type="button" style={addBtn} onClick={addRow} disabled={addBtnDisabled}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> {addLabel}
        </button>
      </div>
    </div>
  );
}
