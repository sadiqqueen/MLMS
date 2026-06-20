// Shared icon library — single source of truth for every inline SVG icon
// used across the app. Each icon is a small stroke glyph on a 24×24 grid
// that uses `currentColor` so it inherits the button/text color.
//
// Signature: Icon({ size = 18, className, ...props }) → <svg …>{inner}</svg>
//
// Synonyms render the SAME glyph and are exported as aliases at the bottom:
//   IconDelete  = IconTrash    (trash can)
//   IconEdit    = IconPencil   (pencil-in-box)
//   IconPrint   = IconPrinter  (printer)
//   IconChevron = IconCaret    (down chevron)
//   IconPassword= IconLock     (closed padlock)
// IconRestore (refresh arrow) and IconUserCheck (person + check) are kept
// separate — different glyphs and different actions (restore vs reactivate).

// Common stroke props shared by all line icons.
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ size = 18, className, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...stroke}
      {...props}
    >
      {children}
    </svg>
  );
}

/* ── Edit / pencil ──────────────────────────────────────────────── */
export function IconPencil({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}

/* ── Delete / trash ─────────────────────────────────────────────── */
export function IconTrash({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

/* ── Change password / closed padlock ───────────────────────────── */
export function IconLock({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

/* ── Unlock / open padlock ──────────────────────────────────────── */
export function IconUnlock({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </Svg>
  );
}

/* ── Ban / deactivate (circle + slash) ──────────────────────────── */
export function IconBan({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </Svg>
  );
}

/* ── Reactivate / person + check ────────────────────────────────── */
export function IconUserCheck({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </Svg>
  );
}

/* ── Print / printer ────────────────────────────────────────────── */
export function IconPrinter({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </Svg>
  );
}

/* ── Add / plus ─────────────────────────────────────────────────── */
export function IconPlus({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

/* ── Attachment / paperclip ─────────────────────────────────────── */
export function IconPaperclip({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </Svg>
  );
}

/* ── Back / left arrow (flippable for RTL via className) ─────────── */
export function IconBack({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </Svg>
  );
}

/* ── Restore / refresh arrow ────────────────────────────────────── */
export function IconRestore({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </Svg>
  );
}

/* ── Archive box ────────────────────────────────────────────────── */
export function IconArchive({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </Svg>
  );
}

/* ── Check / done ───────────────────────────────────────────────── */
export function IconCheck({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

/* ── Clock / in-progress ────────────────────────────────────────── */
export function IconClock({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

/* ── Power / deactivate-reactivate toggle ───────────────────────── */
export function IconPower({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </Svg>
  );
}

/* ── Save / floppy ──────────────────────────────────────────────── */
export function IconSave({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </Svg>
  );
}

/* ── Eye / preview-view ─────────────────────────────────────────── */
export function IconEye({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

/* ── X-circle / cancel ──────────────────────────────────────────── */
export function IconXCircle({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </Svg>
  );
}

/* ── Copy / duplicate ───────────────────────────────────────────── */
export function IconCopy({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

/* ── Caret / chevron (down) ─────────────────────────────────────── */
export function IconCaret({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

/* ── Moon / dark theme ──────────────────────────────────────────── */
export function IconMoon({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  );
}

/* ── Sun / light theme ──────────────────────────────────────────── */
export function IconSun({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </Svg>
  );
}

/* ── Folder / all memos ─────────────────────────────────────────── */
export function IconFolder({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

/* ── Board / initiatives ────────────────────────────────────────── */
export function IconBoard({ size = 18, className, ...props }) {
  return (
    <Svg size={size} className={className} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </Svg>
  );
}

/* ── Synonym aliases (same glyph, existing import names preserved) ─ */
export const IconEdit = IconPencil;
export const IconDelete = IconTrash;
export const IconPrint = IconPrinter;
export const IconChevron = IconCaret;
export const IconPassword = IconLock;
