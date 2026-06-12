import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const IMG_RE  = /\.(png|jpe?g)(\?|$)/i;
const PDF_RE  = /\.pdf(\?|$)/i;
const DOCX_RE = /\.docx(\?|$)/i;
const MAX_PDF_PAGES = 20;

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
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            resolve(c.toDataURL('image/png'));
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
      const task = pdfjsLib.getDocument({ url: absolute, ...PDFJS_ASSETS });
      try {
        const doc = await task.promise;
        const count = Math.min(doc.numPages, MAX_PDF_PAGES);
        const pages = [];
        for (let i = 1; i <= count; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 2 });  // ~150dpi for A4 — crisp in print
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
        task.destroy().catch(() => {});
      }

    } else if (DOCX_RE.test(probe)) {
      try {
        const mammoth = (await import('mammoth')).default ?? (await import('mammoth'));
        const arrayBuffer = await (await fetch(absolute)).arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        out.push({ name: f.name, kind: 'docx', pages: [], html: result.value, truncated: false });
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
