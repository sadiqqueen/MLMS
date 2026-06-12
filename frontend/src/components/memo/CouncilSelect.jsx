import { useState, useMemo, useRef, useEffect } from 'react';
import { searchNormalizeArabic } from './arabic';

const OTHER = 'أخرى';

const IconCaret = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// Searchable combobox for المجلس العلمي. Typing filters the options live
// with Arabic normalization (أ/إ/آ≈ا, ة≈ه, ى≈ي); أخرى is always pinned
// last and always available. Fully keyboard accessible.
export default function CouncilSelect({ id, options, value, onSelect, required = false }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(null);  // null = not searching (input shows the selection)
  const [hi, setHi]       = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const others = options.filter(o => o.name === OTHER);
    let base = options.filter(o => o.name !== OTHER);
    if (query && query.trim()) {
      const nq = searchNormalizeArabic(query);
      base = base.filter(o => searchNormalizeArabic(o.name).includes(nq));
    }
    return [...base, ...others];
  }, [options, query]);

  // close on outside click; drop any unfinished search text
  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(null);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // keep the highlighted option scrolled into view
  useEffect(() => {
    listRef.current?.children[hi]?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  function select(option) {
    onSelect(option);
    setOpen(false);
    setQuery(null);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHi(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && filtered[hi]) {
        e.preventDefault();
        select(filtered[hi]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(null);
    }
  }

  return (
    <div className="cmx-combo" ref={wrapRef}>
      <input
        id={id}
        type="text"
        className="cmx-input-lg cmx-combo-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[hi] ? `${id}-opt-${hi}` : undefined}
        autoComplete="off"
        required={required}
        value={query !== null ? query : (value || '')}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHi(0); }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <span className="cmx-combo-caret"><IconCaret /></span>
      {open && (
        <ul className="cmx-combo-list" role="listbox" id={`${id}-list`} ref={listRef} dir="rtl" lang="ar">
          {filtered.map((o, i) => (
            <li
              key={o._id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={o.name === value}
              className={
                'cmx-combo-opt'
                + (i === hi ? ' active' : '')
                + (o.name === OTHER ? ' cmx-combo-other' : '')
              }
              onMouseDown={e => { e.preventDefault(); select(o); }}
              onMouseEnter={() => setHi(i)}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
