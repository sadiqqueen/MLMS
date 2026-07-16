// Shared print helper for the consultant-memo pages (builder / all / approved).
//
// window.print() must not run until the hidden .cmx-print-mount is fully
// painted: the letterhead logo + watermark are network images and the annex
// pages are (large) data-URL images. Mobile Chrome prints BLANK pages when the
// dialog opens before those images decode, so we wait for every image and for
// document fonts, then give the layout two frames to paint.
async function imgReady(img) {
  try {
    if (!(img.complete && img.naturalWidth)) {
      await new Promise(res => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });   // print what we have
      });
    }
    if (img.decode) await img.decode();
  } catch {
    /* a broken/undecodable image must not block the whole printout */
  }
}

// Wait for the print mount's images + fonts to be ready and painted.
// Pass the .cmx-print-mount element (or null — we still await fonts/paint).
export async function waitForPrintAssets(root) {
  if (root) {
    await Promise.all(Array.from(root.querySelectorAll('img')).map(imgReady));
  }
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {
    /* ignore font-loading failures */
  }
  // Two frames so the print layout is committed & painted before the blocking
  // print() call snapshots the page.
  await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
}
