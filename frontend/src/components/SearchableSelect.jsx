/**
 * SearchableSelect.jsx
 * A reusable searchable dropdown that replaces <select> in forms.
 *
 * Props:
 *   value       - currently selected ID (string)
 *   onChange    - callback(id) called with the selected option's value
 *   options     - [{ value: string, label: string }]
 *   placeholder - string shown when nothing is selected
 *   disabled    - bool
 *   error       - bool, adds red border (matches admin-field .invalid)
 */
import { useState, useRef, useEffect } from 'react';

export default function SearchableSelect({
  value        = '',
  onChange,
  options      = [],
  placeholder  = 'Search or select...',
  disabled     = false,
  error        = false,
  hideClear    = false,
}) {
  const [open,  setOpen ] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  const selected = options.find(o => o.value === value);

  /* close on outside click */
  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  /* close on Escape */
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  function handleFocus() {
    if (!disabled) { setOpen(true); setQuery(''); }
  }

  function handleInputChange(e) {
    setQuery(e.target.value);
    if (!open) setOpen(true);
  }

  function handleSelect(option) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
  }

  /* input shows: query while open, label while closed, '' if nothing selected */
  const inputDisplayValue = open ? query : (selected?.label ?? '');

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        className={`admin-search${error ? ' invalid' : ''}`}
        style={{ width: '100%', boxSizing: 'border-box', paddingRight: 30 }}
        value={inputDisplayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-haspopup="listbox"
        aria-expanded={open}
      />

      {/* chevron */}
      <span style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 10,
        transition: 'transform 0.15s ease-in-out',
        display: 'inline-block',
        ...(open ? { transform: 'translateY(-50%) rotate(180deg)' } : {}),
      }}>v</span>

      {/* clear button - only when something is selected and not disabled */}
      {value && !disabled && !open && !hideClear && (
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); onChange(''); }}
          style={{
            position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: 14, lineHeight: 1, padding: '0 2px',
          }}
          aria-label="Clear selection"
        >x</button>
      )}

      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0,
            zIndex: 600,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            maxHeight: 220,
            overflowY: 'auto',
            margin: 0, padding: 0, listStyle: 'none',
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              No results found
            </li>
          ) : filtered.map(option => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(option); }}
                  style={{
                    width: '100%', textAlign: 'left', background: isSelected ? 'var(--info-bg)' : 'none',
                    border: 'none', borderBottom: '1px solid var(--border-soft)',
                    padding: '10px 14px', cursor: 'pointer',
                    fontSize: 13, color: isSelected ? 'var(--info-fg)' : 'var(--text)',
                    fontWeight: isSelected ? 600 : 400, display: 'block',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'none'; }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
