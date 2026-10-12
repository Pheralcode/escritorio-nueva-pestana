/**
 * Worker de imagen: redimensiona y comprime el wallpaper fuera del hilo de UI
 * usando OffscreenCanvas.
 *
 * Nota sobre chrome.offscreen: NO lo usamos. Esa API sirve para dar un DOM a un
 * service worker MV3, no la necesitamos (procesamos desde la propia página) y
 * además Orion no la implementa. Un Worker + OffscreenCanvas consigue lo mismo
 * y funciona en Chrome, Edge y WebKit moderno.
 */

self.addEventListener('message', async (ev) => {
  const { id, blob, maxWidth, maxHeight, quality, type } = ev.data || {};
  try {
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
      throw new Error('offscreen-unsupported');
    }
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const hgt = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(w, hgt);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, hgt);
    bitmap.close?.();

    const out = await canvas.convertToBlob({ type, quality });
    self.postMessage({ id, ok: true, blob: out, width: w, height: hgt });
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e && e.message ? e.message : e) });
  }
});
