// Arabic-insensitive normalization for matching/deduping names:
// unifies أ/إ/آ→ا, ة→ه, ى→ي, strips diacritics and collapses whitespace.
function normalizeArabic(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[أإآ]/g, 'ا')   // أ إ آ → ا
    .replace(/ة/g, 'ه')                  // ة → ه
    .replace(/ى/g, 'ي')                  // ى → ي
    .replace(/[ً-ْٰ]/g, '')         // diacritics
    .toLowerCase();
}

module.exports = { normalizeArabic };
