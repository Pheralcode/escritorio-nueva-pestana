/**
 * Favicons nítidos, sin sacrificar privacidad.
 *
 * El problema de `/favicon.ico` es que casi siempre son 16 o 32 px: ampliado a
 * 48 px en el dock se ve borroso. Antes de pintar nada probamos, por orden de
 * calidad, los iconos grandes que los sitios ya publican para iOS y Android:
 *
 *   1. /apple-touch-icon.png            (180x180 en la mayoría de sitios)
 *   2. /apple-touch-icon-precomposed.png
 *   3. /favicon.svg                     (vectorial: nítido a cualquier tamaño)
 *   4. servicio de terceros con tamaño   (solo si el usuario lo activa)
 *   5. /favicon.ico                     (último recurso)
 *
 * Se acepta el primero que cargue Y tenga resolución suficiente para el tamaño
 * en pantalla; si ninguno la alcanza, se usa el más grande de los que cargaron.
 * El resultado se cachea por dominio para no repetir el sondeo en cada pestaña.
 *
 * Todo son peticiones al propio dominio que el usuario marcó: nada de terceros
 * salvo que lo active en Ajustes.
 */

import { h, icon } from './dom.js';
import { fileToIcon } from './image.js';
import * as store from './store.js';

const CACHE_MS = 30 * 24 * 60 * 60 * 1000;   // un mes
const probes = new Map();                     // host -> Promise, evita sondeos repetidos

/** Fija a mano el icono de un dominio (menú contextual -> "Cambiar icono"). */
export function setCustomIcon(url, iconUrl, width = 512) {
  const host = hostOf(url);
  store.update((s) => {
    const cache = { ...(s.faviconCache || {}) };
    if (iconUrl) cache[host] = { url: iconUrl, width, custom: true, at: Date.now() };
    else delete cache[host];
    s.faviconCache = cache;
  });
}

/**
 * Diálogo único para cambiar el icono de un dominio: subir un archivo (lo
 * normal) o pegar una URL. Lo usan el dock, los iconos de app y los accesos.
 */
export function openIconDialog(targetUrl, onDone) {
  const file = h('input', { type: 'file', accept: 'image/*', class: 'sr-only' });
  const urlInput = h('input', { class: 'input', type: 'url', placeholder: 'https://…/icono.png' });
  const status = h('p', { class: 'faint' }, 'PNG, JPG, SVG o WebP. Se guarda para todo el dominio.');
  const close = () => dialog.remove();

  const save = (iconUrl, width) => {
    setCustomIcon(targetUrl, iconUrl, width);
    close();
    onDone?.();
  };

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    status.textContent = 'Procesando imagen…';
    try {
      const { dataUrl, width } = await fileToIcon(f);
      save(dataUrl, width);
    } catch (e) {
      status.textContent = e.message;
    }
  });

  const dialog = h('div', { class: 'overlay' },
    h('form', { class: 'minidialog' },
      h('h3', {}, 'Cambiar icono'),
      h('button', {
        class: 'btn btn--primary btn--block', type: 'button',
        onClick: () => file.click(),
      }, icon('upload', 16), 'Subir imagen'),
      file,
      status,
      h('div', { class: 'field' }, h('label', {}, 'O pegar una URL'), urlInput),
      h('div', { class: 'row-end' },
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => save(null) }, 'Quitar icono'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: close }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit' }, 'Guardar URL'),
      ),
    ),
  );
  dialog.querySelector('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    save(urlInput.value.trim() || null);
  });
  dialog.addEventListener('pointerdown', (ev) => { if (ev.target === dialog) close(); });
  document.body.append(dialog);
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return String(url || '').replace(/^https?:\/\//, '').split('/')[0]; }
}

export function initialsOf(title, url) {
  const src = (title || hostOf(url) || '?').trim();
  const parts = src.split(/[\s.\-_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/** Hash estable -> matiz, para que cada dominio tenga siempre el mismo color. */
export function hueOf(str) {
  let hLocal = 0;
  for (let i = 0; i < str.length; i++) hLocal = (hLocal * 31 + str.charCodeAt(i)) % 360;
  return hLocal;
}

/** Candidatos ordenados de mejor a peor calidad. */
export function candidates(url, { thirdParty = false } = {}) {
  let origin;
  let host;
  try {
    const u = new URL(url);
    origin = u.origin;
    host = u.hostname;
  } catch { return []; }

  const list = [
    { url: `${origin}/apple-touch-icon.png` },
    { url: `${origin}/apple-touch-icon-precomposed.png` },
    { url: `${origin}/favicon.svg`, vector: true },
    { url: `${origin}/favicon-192x192.png` },
  ];
  if (thirdParty) {
    // DuckDuckGo en vez de Google: el endpoint de Google devuelve error para
    // varios dominios y DDG suele servir el PNG grande del sitio.
    list.push({ url: `https://icons.duckduckgo.com/ip3/${host}.ico` });
  }
  list.push({ url: `${origin}/favicon.ico` });
  return list;
}

/** Carga una imagen y devuelve su tamaño real, o null si falla. */
function probe(src) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    img.onload = () => finish({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    img.onerror = () => finish(null);
    // Algunos servidores dejan la petición colgada: no bloqueamos el icono por eso.
    setTimeout(() => finish(null), 6000);
    img.src = src;
  });
}

/**
 * Busca el mejor icono disponible para `url`. `want` es el ancho en píxeles
 * físicos que necesitamos (tamaño en pantalla x densidad).
 */
export async function resolveBest(url, { thirdParty = false, want = 96 } = {}) {
  let best = null;
  for (const cand of candidates(url, { thirdParty })) {
    const res = await probe(cand.url);
    if (!res) continue;
    if (res.width < 4 && !cand.vector) continue;        // píxeles 1x1 de relleno
    if (cand.vector) return { url: cand.url, width: 0, vector: true };
    if (res.width >= want) return { url: cand.url, width: res.width, vector: false };
    if (!best || res.width > best.width) best = { url: cand.url, width: res.width, vector: false };
  }
  return best;
}

/* --------------------------- caché por dominio --------------------------- */

function readCache(host) {
  const cache = store.getState().faviconCache || {};
  const entry = cache[host];
  if (!entry) return null;
  if (!entry.custom && Date.now() - entry.at > CACHE_MS) return null;
  return entry;
}

function writeCache(host, found) {
  store.update((s) => {
    const cache = { ...(s.faviconCache || {}) };
    cache[host] = { url: found.url, width: found.width, vector: !!found.vector, at: Date.now() };
    // Cota de tamaño: nos quedamos con las 200 entradas más recientes.
    const keys = Object.keys(cache);
    if (keys.length > 200) {
      keys.sort((a, b) => cache[a].at - cache[b].at).slice(0, keys.length - 200)
        .forEach((k) => delete cache[k]);
    }
    s.faviconCache = cache;
  }, { silent: true });
}

/**
 * Devuelve un elemento con el favicon. Se pinta al instante con la tesela de
 * iniciales y la imagen entra en cuanto se resuelve, sin bloquear el render.
 */
export function faviconEl(item, { thirdParty = false, size = 32 } = {}) {
  const host = hostOf(item.url);
  const wrap = h('span', {
    class: 'favicon',
    style: {
      width: `${size}px`,
      height: `${size}px`,
      '--fav-hue': String(hueOf(host || item.title || '')),
    },
  });
  wrap.append(h('span', { class: 'favicon__tile' }, initialsOf(item.title, item.url)));

  const img = h('img', { class: 'favicon__img', alt: '', decoding: 'async' });
  wrap.append(img);

  /**
   * Un icono pequeño ampliado se ve borroso. Si lo mejor que hay son 16 px, lo
   * pintamos a su tamaño real y centrado —nítido, aunque pequeño— en vez de
   * estirarlo. Es lo que hacen los lanzadores del sistema.
   */
  const show = (src, found) => {
    if (found && !found.vector && found.width > 0 && found.width < size * dpr) {
      const natural = Math.max(16, Math.round(found.width / dpr));
      img.style.width = `${Math.min(size, natural)}px`;
      img.style.height = 'auto';
      img.style.margin = 'auto';
      img.style.padding = '0';
      wrap.classList.add('is-small');
    }
    img.src = src;
    img.addEventListener('load', () => wrap.classList.add('has-img'), { once: true });
  };

  const dpr = Math.min(3, window.devicePixelRatio || 1);

  // 1. icono fijado a mano en el elemento
  if (item.favicon) { show(item.favicon); return wrap; }

  // 2. caché de un sondeo anterior
  const cached = readCache(host);
  if (cached) { show(cached.url, cached); return wrap; }

  // 3. sondeo (compartido entre todos los elementos del mismo dominio)
  const want = Math.round(size * dpr);
  const key = `${host}|${want}|${thirdParty}`;
  if (!probes.has(key)) probes.set(key, resolveBest(item.url, { thirdParty, want }));
  probes.get(key).then((found) => {
    if (!found) return;
    writeCache(host, found);
    show(found.url, found);
  });
  return wrap;
}
