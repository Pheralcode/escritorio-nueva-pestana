/**
 * Procesado del wallpaper antes de guardarlo en storage.local.
 *
 * Una foto de móvil son 4-8 MB; storage.local tiene ~5 MB de cuota en Chrome.
 * Redimensionamos a 1920px de ancho máximo y comprimimos a JPEG/WebP hasta que
 * el dataURL cabe cómodamente.
 *
 * Cadena de respaldo (de mejor a peor, pero todas producen el mismo resultado):
 *   1. Web Worker + OffscreenCanvas  → no bloquea la UI. Chrome/Edge y WebKit reciente.
 *   2. OffscreenCanvas en el hilo principal → si los workers fallan.
 *   3. <canvas> oculto + <img>       → funciona en cualquier motor.
 */

const MAX_W = 1920;
const MAX_H = 1920;
const TARGET_BYTES = 1.6 * 1024 * 1024; // margen amplio frente a la cuota
const QUALITIES = [0.82, 0.7, 0.58, 0.45];

let imgWorker = null;
let workerBroken = false;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (imgWorker) return imgWorker;
  try {
    imgWorker = new Worker(new URL('../workers/image-worker.js', import.meta.url));
    imgWorker.addEventListener('message', (ev) => {
      const entry = pending.get(ev.data?.id);
      if (!entry) return;
      pending.delete(ev.data.id);
      clearTimeout(entry.timer);
      ev.data.ok ? entry.resolve(ev.data) : entry.reject(new Error(ev.data.error));
    });
    imgWorker.addEventListener('error', () => {
      workerBroken = true;
      for (const [, e] of pending) { clearTimeout(e.timer); e.reject(new Error('worker-unavailable')); }
      pending.clear();
      try { imgWorker.terminate(); } catch { /* noop */ }
      imgWorker = null;
    });
  } catch {
    workerBroken = true;
    return null;
  }
  return imgWorker;
}

function pickType() {
  // WebP comprime bastante mejor; Safari/WebKit moderno lo soporta, pero
  // comprobamos antes de fiarnos.
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    if (c.toDataURL('image/webp').startsWith('data:image/webp')) return 'image/webp';
  } catch { /* noop */ }
  return 'image/jpeg';
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error('FileReader falló'));
    fr.readAsDataURL(blob);
  });
}

/* --------------------------- estrategia 1: worker --------------------------- */

async function viaWorker(blob, quality, type) {
  const w = getWorker();
  if (!w) throw new Error('sin-worker');
  const result = await new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('worker-timeout')); }, 12000);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, blob, maxWidth: MAX_W, maxHeight: MAX_H, quality, type });
  });
  return result.blob;
}

/* ------------------ estrategia 2: OffscreenCanvas en la página ------------------ */

async function viaOffscreenMain(blob, quality, type) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
    throw new Error('offscreen-unsupported');
  }
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const hgt = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, hgt);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, hgt);
  bitmap.close?.();
  return canvas.convertToBlob({ type, quality });
}

/* --------------------- estrategia 3: canvas oculto clásico --------------------- */

function viaHiddenCanvas(blob, quality, type) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        if (canvas.toBlob) {
          canvas.toBlob((out) => out ? resolve(out) : reject(new Error('toBlob nulo')), type, quality);
        } else {
          // Último recurso: dataURL directo.
          const dataUrl = canvas.toDataURL(type, quality);
          fetch(dataUrl).then((r) => r.blob()).then(resolve, reject);
        }
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo decodificar la imagen')); };
    img.src = url;
  });
}

async function encode(blob, quality, type) {
  const strategies = [viaWorker, viaOffscreenMain, viaHiddenCanvas];
  let lastErr = null;
  for (const fn of strategies) {
    try {
      const out = await fn(blob, quality, type);
      if (out && out.size) return { blob: out, strategy: fn.name };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No se pudo procesar la imagen');
}

/**
 * Procesa el fichero y devuelve { dataUrl, bytes, strategy }.
 * Baja la calidad progresivamente hasta caber en TARGET_BYTES.
 */
export async function processWallpaper(file, onProgress) {
  if (!file || !/^image\//.test(file.type)) throw new Error('El archivo no es una imagen.');
  const type = pickType();
  let last = null;
  for (const q of QUALITIES) {
    onProgress?.(`Optimizando (calidad ${Math.round(q * 100)}%)…`);
    const { blob, strategy } = await encode(file, q, type);
    const dataUrl = await blobToDataUrl(blob);
    last = { dataUrl, bytes: dataUrl.length, strategy, quality: q, type };
    if (dataUrl.length <= TARGET_BYTES) return last;
  }
  return last; // devolvemos la mejor aproximación aunque exceda; el store avisará
}

/**
 * "Proxy de refracción": una copia diminuta del fondo (64 px de ancho, ~2 KB).
 * Estirada con `background-size: cover` el navegador la interpola y queda un
 * campo de color difuso — el mismo efecto que un desenfoque gaussiano, pero sin
 * coste de render y sin máscaras. Es lo que se pinta DENTRO de las cifras del
 * reloj para que el cristal refracte el fondo en vez de solo dejarlo pasar.
 */
export async function makeRefractionProxy(dataUrl, width = 64) {
  if (!dataUrl) return null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = typeof createImageBitmap === 'function' ? await createImageBitmap(blob) : null;

    const w = width;
    const h = Math.max(1, Math.round(width * (bitmap ? bitmap.height / bitmap.width : 0.6)));

    if (bitmap && typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
      return blobToDataUrl(out);
    }

    // Respaldo con canvas clásico (WebKit antiguo).
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = Math.max(1, Math.round(w * (img.naturalHeight / img.naturalWidth)));
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  } catch {
    return null;
  }
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Convierte un archivo de imagen en un icono guardable: lo encaja en `size` px
 * y lo devuelve como dataURL PNG (PNG para conservar la transparencia). No
 * amplía los que ya son más pequeños, así un .ico de 32 px sigue viéndose
 * nítido en vez de borroso.
 */
export async function fileToIcon(file, size = 128) {
  if (!file || !/^image\//.test(file.type)) throw new Error('El archivo no es una imagen.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      el.src = url;
    });
    const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    return { dataUrl: await blobToDataUrl(blob), width: canvas.width };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------------------------ *
 * Color de acento a partir del fondo
 * ------------------------------------------------------------------ */

/**
 * Extrae un color de acento del wallpaper.
 *
 * Método: se dibuja la imagen a 40x40, se agrupan los píxeles en cubos de color
 * (4 bits por canal) y se puntúa cada cubo por población x saturación x cercanía
 * a una luminosidad media. Así gana el color "vivo" que domina la foto, no el
 * gris que suele ser mayoritario. Después se normaliza para que funcione como
 * acento: saturación mínima garantizada y luminosidad ajustada al tema.
 */
export async function extractAccent(dataUrl, { dark = true } = {}) {
  if (!dataUrl) return null;
  const pixels = await samplePixels(dataUrl, 40);
  if (!pixels) return null;

  const buckets = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const { s, l } = rgbToHsl(r, g, b);
    if (l < 0.08 || l > 0.94) continue;          // negros y blancos puros no sirven
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const entry = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, s: 0, l: 0 };
    entry.n++; entry.r += r; entry.g += g; entry.b += b; entry.s += s; entry.l += l;
    buckets.set(key, entry);
  }
  if (!buckets.size) return null;

  let best = null;
  let bestScore = -1;
  for (const e of buckets.values()) {
    const s = e.s / e.n;
    const l = e.l / e.n;
    // Penaliza lo desaturado y lo muy claro/oscuro; premia lo abundante.
    const score = Math.sqrt(e.n) * (0.25 + s * s * 2.2) * (1 - Math.abs(l - 0.5) * 0.9);
    if (score > bestScore) { bestScore = score; best = { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }; }
  }
  if (!best) return null;

  const { h, s, l } = rgbToHsl(best.r, best.g, best.b);
  // Un acento necesita cuerpo: subimos saturación y llevamos la luminosidad a un
  // rango que contraste con el tema activo.
  const outS = Math.min(0.92, Math.max(0.55, s * 1.35));
  const outL = dark ? Math.min(0.68, Math.max(0.55, l)) : Math.min(0.55, Math.max(0.42, l));
  return hslToHex(h, outS, outL);
}

async function samplePixels(dataUrl, size) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
      const bmp = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, size, size);
      bmp.close?.();
      return ctx.getImageData(0, 0, size, size).data;
    }
  } catch { /* seguimos con el canvas clásico */ }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        resolve(ctx.getImageData(0, 0, size, size).data);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Luminancia media del fondo (0 = negro, 1 = blanco), ponderada según la
 * percepción humana del verde. Sirve para decidir si el texto encima debe ser
 * negro o blanco.
 */
export async function averageLuminance(dataUrl, size = 32, band = null) {
  const pixels = await samplePixels(dataUrl, size);
  if (!pixels) return null;
  // `band` acota la zona vertical medida en fracciones (0 = arriba, 1 = abajo).
  const y0 = band ? Math.floor(band[0] * size) : 0;
  const y1 = band ? Math.ceil(band[1] * size) : size;
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (pixels[i + 3] < 128) continue;
      // Luma perceptual (Rec. 709), en sRGB directo: basta para decidir.
      sum += (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
      n++;
    }
  }
  return n ? sum / n : null;
}

/**
 * Luminancia de la franja donde vive el reloj (parte superior central).
 *
 * La media global no sirve para el reloj: un bosque oscuro con el cielo claro
 * arriba da "oscuro" de media, y la fecha en blanco se pierde justo contra ese
 * cielo. Midiendo solo su franja, el reloj decide su color por lo que tiene
 * realmente detrás.
 */
export function heroLuminance(dataUrl) {
  return averageLuminance(dataUrl, 32, [0.02, 0.42]);
}

export function rgbToHsl(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

export function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(v * 255);
  };
  const c = (v) => v.toString(16).padStart(2, '0');
  return `#${c(f(0))}${c(f(8))}${c(f(4))}`;
}
