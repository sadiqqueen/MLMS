// backend/utils/csv.js
// Shared CSV helpers. Extracted verbatim from routes/eventFeedback.js so every
// export in the app produces byte-identical output: an Excel-friendly UTF-8 BOM,
// CRLF row separators, and every cell always double-quoted with "" escaping.

// Format a single value as a CSV cell:
//   null/undefined → '' (empty, unquoted)
//   arrays         → members joined with '; '
//   everything     → String()'d, wrapped in double quotes, inner quotes doubled.
function csvCell(v) {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

// Build a full CSV document from a header array and rows (array of arrays).
// Prepends the literal U+FEFF BOM and joins every line with CRLF. Each cell is
// passed through csvCell, so the output matches the original eventFeedback export
// byte-for-byte.
function buildCsv(header, rows) {
  const lines = [
    header.map(csvCell).join(','),
    ...rows.map(row => row.map(csvCell).join(',')),
  ];
  return '﻿' + lines.join('\r\n');
}

module.exports = { csvCell, buildCsv };
