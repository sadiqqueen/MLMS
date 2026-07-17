import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import DOMPurify from 'dompurify';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const IMG_RE  = /\.(png|jpe?g)(\?|$)/i;
const PNG_RE  = /\.png(\?|$)/i;
const PDF_RE  = /\.pdf(\?|$)/i;
const DOCX_RE = /\.docx(\?|$)/i;
const MAX_PDF_PAGES = 20;
const MAX_IMG_WIDTH = 2000;   // downscale bigger photos so mobile holds less
const MAX_PDF_WIDTH = 1600;   // cap rendered PDF page width for the same reason

// pdf.js needs these for real-world PDFs (CID/Arabic fonts, JPX images…);
// copied from pdfjs-dist into frontend/public/pdfjs/.
const PDFJS_ASSETS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
};

// Convert uploaded attachment files into printable previews:
//   images → inlined as data URLs (so printing never races the network)
//   PDFs   → every page rendered to an image (pdf.js)
//   .docx  → converted to HTML (mammoth)
//   other  → name-only note in the printout
// Returns [{ name, kind: 'image'|'pdf'|'docx'|'other', pages: [src…], html, truncated }]
export async function buildAttachmentPreviews(files) {
  const out = [];
  for (const f of files || []) {
    if (!f?.url) continue;
    const probe = f.url + ' ' + (f.name || '');
    const absolute = new URL(f.url, window.location.origin).href;

    if (IMG_RE.test(probe)) {
      const isPng = PNG_RE.test(probe);
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            // Downscale oversized photos; keep aspect ratio.
            let w = img.naturalWidth, h = img.naturalHeight;
            if (w > MAX_IMG_WIDTH) { h = Math.round(h * MAX_IMG_WIDTH / w); w = MAX_IMG_WIDTH; }
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            // Only true PNG sources stay PNG; JPEGs re-encode as JPEG (far smaller).
            resolve(isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9));
          };
          img.onerror = reject;
          img.src = absolute;
        });
        out.push({ name: f.name, kind: 'image', pages: [dataUrl], truncated: false });
      } catch (err) {
        console.error('attachment preview failed for', f.url, err);
        out.push({ name: f.name, kind: 'other', pages: [], truncated: false });
      }

    } else if (PDF_RE.test(probe)) {
      // getDocument() can throw synchronously on older Safari (missing
      // Promise.withResolvers / module workers) — keep it inside the try so a
      // pdf.js failure degrades to the name-only fallback instead of aborting
      // the whole build.
      let task;
      try {
        task = pdfjsLib.getDocument({ url: absolute, ...PDFJS_ASSETS });
        const doc = await task.promise;
        const count = Math.min(doc.numPages, MAX_PDF_PAGES);
        const pages = [];
        for (let i = 1; i <= count; i++) {
          const page = await doc.getPage(i);
          // Cap width at MAX_PDF_WIDTH; A4 at scale 1 is ~595px so normal pages
          // still render at scale 2 (~150dpi, crisp), only very wide pages clamp.
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(2, MAX_PDF_WIDTH / base.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          pages.push(canvas.toDataURL('image/jpeg', 0.9));
        }
        out.push({ name: f.name, kind: 'pdf', pages, truncated: doc.numPages > count });
      } catch (err) {
        console.error('attachment preview failed for', f.url, err);
        out.push({ name: f.name, kind: 'other', pages: [], truncated: false });
      } finally {
        task?.destroy().catch(() => {});   // task may be unset if getDocument threw
      }

    } else if (DOCX_RE.test(probe)) {
      try {
        const mammoth = (await import('mammoth')).default ?? (await import('mammoth'));
        const arrayBuffer = await (await fetch(absolute)).arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        // Sanitize once here (not in render) — MemoPrint injects this via
        // dangerouslySetInnerHTML.
        out.push({ name: f.name, kind: 'docx', pages: [], html: DOMPurify.sanitize(result.value), truncated: false });
      } catch (err) {
        console.error('attachment preview failed for', f.url, err);
        out.push({ name: f.name, kind: 'other', pages: [], truncated: false });
      }

    } else {
      out.push({ name: f.name, kind: 'other', pages: [], truncated: false });
    }
  }
  return out;
}
