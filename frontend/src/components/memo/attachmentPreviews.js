import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const IMG_RE = /\.(png|jpe?g)(\?|$)/i;
const PDF_RE = /\.pdf(\?|$)/i;
const MAX_PDF_PAGES = 20;

// Convert uploaded attachment files into printable previews:
//   images  → shown as-is
//   PDFs    → every page rendered to an image (via pdf.js)
//   other   → no preview (name still appears in the printed attachments list)
// Returns [{ name, kind: 'image'|'pdf'|'other', pages: [src…], truncated }]
export async function buildAttachmentPreviews(files) {
  const out = [];
  for (const f of files || []) {
    if (!f?.url) continue;
    const probe = f.url + ' ' + (f.name || '');
    if (IMG_RE.test(probe)) {
      // inline as a data URL so the print annex never races the network
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
          img.src = new URL(f.url, window.location.origin).href;
        });
        out.push({ name: f.name, kind: 'image', pages: [dataUrl], truncated: false });
      } catch (err) {
        console.error('attachment preview failed for', f.url, err);
        out.push({ name: f.name, kind: 'other', pages: [], truncated: false });
      }
    } else if (PDF_RE.test(probe)) {
      // pdf.js v6 requires a params object with an absolute URL
      const absolute = new URL(f.url, window.location.origin).href;
      const task = pdfjsLib.getDocument({ url: absolute });
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
        // fall back to name-only in the printed list
        console.error('attachment preview failed for', f.url, err);
        out.push({ name: f.name, kind: 'other', pages: [], truncated: false });
      } finally {
        task.destroy().catch(() => {});
      }
    } else {
      out.push({ name: f.name, kind: 'other', pages: [], truncated: false });
    }
  }
  return out;
}
