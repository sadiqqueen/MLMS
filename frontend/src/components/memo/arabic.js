// Arabic-insensitive normalization for the council search — must mirror
// backend/utils/arabic.js so client matching agrees with server dedupe:
// unifies أ/إ/آ→ا, ة→ه, ى→ي, strips diacritics, collapses whitespace.
export function normalizeArabic(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْٰ]/g, '')
    .toLowerCase();
}

// Search-only variant: also unfolds the assimilated definite article at
// word starts (لِ+ال → لل), so typing "الجراحه" matches "للجراحة".
// Applied to BOTH sides of the comparison, so matching stays consistent.
export function searchNormalizeArabic(s) {
  return normalizeArabic(s).replace(/(^|\s)لل/g, '$1لال');
}
