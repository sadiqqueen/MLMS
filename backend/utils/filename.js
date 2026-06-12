// Helpers for handling user-supplied upload filenames.

// busboy (used by multer) decodes the multipart `filename` parameter as
// latin1 by default, so a UTF-8 name like Arabic arrives mojibake'd.
// Recover the real name - but only when the string actually looks
// misdecoded, so an already-correct name is never double-decoded.
function decodeOriginalName(file) {
  const raw = (file && file.originalname) || '';
  if (!raw) return raw;

  // Already contains real Unicode (code points above U+00FF, e.g. Arabic):
  // busboy gave us proper UTF-8; leave it alone.
  if ([...raw].some(c => c.codePointAt(0) > 0xff)) return raw;

  // Pure ASCII: nothing to recover.
  if (!/[-ÿ]/.test(raw)) return raw;

  // Mojibake candidate: every char fits in one byte. Re-read those bytes
  // as UTF-8; if that yields invalid sequences (U+FFFD), the name really
  // was latin1 text (e.g. "café.pdf") - keep the original.
  const decoded = Buffer.from(raw, 'latin1').toString('utf8');
  if (decoded.includes('�')) return raw;
  return decoded;
}

// RFC 6266/5987 Content-Disposition that survives non-ASCII names in every
// browser: ASCII-safe `filename` fallback + percent-encoded `filename*`.
function contentDisposition(originalName) {
  const ascii = originalName.replace(/[^\x20-\x7e]/g, '_').replace(/[\\"]/g, '_') || 'attachment';
  const encoded = encodeURIComponent(originalName)
    // encodeURIComponent leaves these unescaped, but RFC 5987 attr-char
    // does not allow them
    .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

module.exports = { decodeOriginalName, contentDisposition };
