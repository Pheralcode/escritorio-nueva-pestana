/** Helpers de DOM (sin frameworks). */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list' && typeof v !== 'object') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

/**
 * Reemplaza los hijos filtrando nulos.
 *
 * `replaceChildren` convierte en texto lo que no sea un nodo, así que un
 * `cond ? algo : null` acaba pintando literalmente la palabra "null" en la
 * interfaz. `h()` ya filtra sus hijos; esto hace lo mismo para el reemplazo.
 */
export function setChildren(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
}

/** Icono SVG inline por nombre (evita fuentes de iconos externas). */
const ICONS = {
  /* interfaz */
  drag: 'M7 4h2v2H7zm0 5h2v2H7zm0 5h2v2H7zm0 5h2v2H7zm8-15h2v2h-2zm0 5h2v2h-2zm0 5h2v2h-2zm0 5h2v2h-2z',
  close: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z',
  gear: 'M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm8.9-2.5.1-1-.1-1 2-1.6-2-3.4-2.4 1a7.9 7.9 0 0 0-1.7-1L16.4 3h-4l-.4 2.6c-.6.2-1.2.6-1.7 1l-2.4-1-2 3.4L8 10.6l-.1 1 .1 1-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.4 2.6h4l.4-2.6c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  minus: 'M5 11h14v2H5z',
  search: 'M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5zM10 14a4 4 0 1 1 0-8 4 4 0 0 1 0 8z',
  refresh: 'M17.6 6.4A8 8 0 1 0 19.7 14h-2.1A6 6 0 1 1 12 6c1.7 0 3.1.7 4.2 1.8L13 11h7V4z',
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  stop: 'M7 7h10v10H7z',
  minimal: 'M4 6h16v2H4zm0 5h10v2H4zm0 5h16v2H4z',
  grid: 'M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z',
  trash: 'M6 7h12l-1 13H7zM9 4h6l1 2H8z',
  edit: 'M3 17.2V21h3.8L17.8 10 14 6.2zM20.7 7.1a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0L15 5.2 18.8 9z',
  external: 'M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14zM5 5h5v2H7v10h10v-3h2v5H5z',
  image: 'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z',
  download: 'M5 20h14v-2H5zm7-16v9.2l-3.6-3.6L7 11l5 5 5-5-1.4-1.4L12 13.2V4z',
  upload: 'M5 20h14v-2H5zm7-16-5 5 1.4 1.4L11 6.8V16h2V6.8l2.6 2.6L17 8z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  chevron: 'M9.3 6.7 14.6 12l-5.3 5.3 1.4 1.4L17.4 12l-6.7-6.7z',
  chevronLeft: 'M14.7 6.7 9.4 12l5.3 5.3-1.4 1.4L6.6 12l6.7-6.7z',
  moon: 'M12.7 3a9 9 0 1 0 8.3 12.4A7.5 7.5 0 0 1 12.7 3z',
  sun: 'M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-15h0l1 3h-2zm0 17 1 3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.2 5.6 5.6 4.2l2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z',
  desktop: 'M3 4h18v12H3zm7 14h4l1 2H9zM5 6v8h14V6z',
  link: 'M10.6 13.4a1 1 0 0 1 0-1.4l1.4-1.4 1.4 1.4-1.4 1.4a1 1 0 0 1-1.4 0zM7.8 16.2a4 4 0 0 1 0-5.7l2.1-2.1 1.4 1.4-2.1 2.1a2 2 0 0 0 2.8 2.8l2.1-2.1 1.4 1.4-2.1 2.1a4 4 0 0 1-5.7 0zm8.4-8.4a4 4 0 0 1 0 5.7l-2.1 2.1-1.4-1.4 2.1-2.1a2 2 0 0 0-2.8-2.8l-2.1 2.1-1.4-1.4 2.1-2.1a4 4 0 0 1 5.7 0z',
  star: 'M12 17.3 6.2 21l1.6-6.6L2.6 9.9l6.8-.6L12 3l2.6 6.3 6.8.6-5.2 4.5L17.8 21z',

  /* widgets */
  wclock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6V6h-2v7.4l4.7 2.8 1-1.7z',
  wnotes: 'M5 3h9l5 5v13H5zm8 1.5V9h4.5zM7 12h10v2H7zm0 4h10v2H7z',
  wtimer: 'M9 1h6v2H9zm2 6h2v7h-2zM12 4a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm6.5-.9 1.4 1.4-2 2-1.4-1.4z',
  wtasks: 'M4 5h2v2H4zm4 0h12v2H8zM4 11h2v2H4zm4 0h12v2H8zM4 17h2v2H4zm4 0h12v2H8z',
  wcalendar: 'M7 2h2v2h6V2h2v2h3v18H4V4h3zM6 10v10h12V10zm2 2h3v3H8z',
  wworld: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.9a15 15 0 0 0-1.3-3.6A8 8 0 0 1 18.9 8zM12 4.2c.7 1 1.3 2.3 1.7 3.8h-3.4c.4-1.5 1-2.8 1.7-3.8zM4.3 14a8 8 0 0 1 0-4h3.3a17 17 0 0 0 0 4zm.8 2h2.9c.3 1.3.8 2.5 1.3 3.6A8 8 0 0 1 5.1 16zm2.9-8H5.1a8 8 0 0 1 4.2-3.6A15 15 0 0 0 8 8zm4 11.8c-.7-1-1.3-2.3-1.7-3.8h3.4c-.4 1.5-1 2.8-1.7 3.8zm2.1-5.8H9.9a15 15 0 0 1 0-4h4.2a15 15 0 0 1 0 4zm.6 5.6c.5-1.1 1-2.3 1.3-3.6h2.9a8 8 0 0 1-4.2 3.6zm1.7-5.6a17 17 0 0 0 0-4h3.3a8 8 0 0 1 0 4z',
  wcountdown: 'M6 2h12v6l-4 4 4 4v6H6v-6l4-4-4-4zm2 2v3.2l4 4 4-4V4zm0 16h8v-3.2l-4-4-4 4z',
  wcalc: 'M5 2h14v20H5zm2 2v4h10V4zm0 6v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2zm-8 4v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2zm-8 4v2h2v-2zm4 0v2h6v-2z',
  wbattery: 'M4 7h14a2 2 0 0 1 2 2v1h2v4h-2v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v6h14V9z',
  wrss: 'M5 5a14 14 0 0 1 14 14h-3A11 11 0 0 0 5 8zm0 6a8 8 0 0 1 8 8h-3a5 5 0 0 0-5-5zm1.5 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  wquote: 'M7 7h5v5a5 5 0 0 1-5 5v-2a3 3 0 0 0 3-3H7zm8 0h5v5a5 5 0 0 1-5 5v-2a3 3 0 0 0 3-3h-3z',
  wapp: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',

  /* clima (sustituyen a los emojis) */
  cSun: 'M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm-1-15h2v3h-2zm0 17h2v3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.2 5.6 5.6 4.2l2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z',
  cMoon: 'M12.7 3a9 9 0 1 0 8.3 12.4A7.5 7.5 0 0 1 12.7 3z',
  cCloud: 'M6.5 19a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.4A3.8 3.8 0 0 1 17.5 19z',
  cPartly: 'M15 4a5 5 0 0 1 4.9 4 3.8 3.8 0 0 1-1.3 7.4V13a5.5 5.5 0 0 0-7.3-5.2A5 5 0 0 1 15 4zM7.5 20a4.5 4.5 0 0 1-.4-9 5.5 5.5 0 0 1 10.6 1.3A3.8 3.8 0 0 1 17 20z',
  cRain: 'M6.5 16a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.4A3.8 3.8 0 0 1 17.5 16zM7 18l-1 4h2l1-4zm4 0-1 4h2l1-4zm4 0-1 4h2l1-4z',
  cDrizzle: 'M6.5 15a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.4A3.8 3.8 0 0 1 17.5 15zM8 17h1.6l-.8 3H7zm4 0h1.6l-.8 3H11zm4 0h1.6l-.8 3H15z',
  cSnow: 'M6.5 15a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.4A3.8 3.8 0 0 1 17.5 15zM8 17h2v2H8zm4 1h2v2h-2zm4-1h2v2h-2z',
  cStorm: 'M6.5 15a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.4A3.8 3.8 0 0 1 17.5 15zm6.5 2h3l-5 6 1-4H9l5-6z',
  cFog: 'M6.5 13a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.4A3.8 3.8 0 0 1 17.5 13zM4 15h16v2H4zm2 4h12v2H6z',
  cThermo: 'M12 2a3 3 0 0 1 3 3v8.6a5 5 0 1 1-6 0V5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v9.7l-.6.4a3 3 0 1 0 3.2 0l-.6-.4V5a1 1 0 0 0-1-1z',
};

export function icon(name, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name] || ICONS.grid);
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

/** Botón con icono + etiqueta accesible. */
export function iconButton(name, label, onClick, extraClass = '') {
  return h('button', {
    class: `icon-btn ${extraClass}`.trim(),
    type: 'button',
    title: label,
    'aria-label': label,
    onClick,
  }, icon(name));
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function formatRelative(ts) {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `hace ${days} d`;
}

/** Escapa texto para usarlo dentro de un atributo/HTML. */
export function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
