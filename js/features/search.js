/**
 * Motor de búsqueda compartido.
 *
 * La misma lógica alimenta dos presentaciones:
 *   - la barra grande y centrada de la cabecera (resultados desplegados debajo)
 *   - el overlay de ⌘K / Ctrl+K
 *
 * Busca en accesos, marcadores del navegador (si hay permiso), widgets que se
 * pueden añadir, elementos del dock, ajustes y acciones; y si nada encaja,
 * ofrece abrir la URL escrita o buscar en la web.
 */

import { h, icon, clear, setChildren } from '../core/dom.js';
import { rank } from '../core/fuzzy.js';
import * as store from '../core/store.js';
import { availableWidgets, addWidget } from '../core/dashboard.js';
import { faviconEl, hostOf } from '../core/favicon.js';
import * as sync from './bookmarks-sync.js';

let actionsProvider = () => [];
let token = 0;

export function setActions(fn) { actionsProvider = fn; }

/**
 * Calcula los resultados. `onUpdate` se llama una segunda vez cuando llegan los
 * marcadores del navegador (asíncronos), para no retrasar el primer pintado.
 */
export async function search(query, onUpdate) {
  const mine = ++token;
  const q = query.trim();
  const state = store.getState();
  const out = [];

  for (const { item, score } of rank(state.shortcuts || [], q, (s) => [[s.title, 1], [s.url, 0.6]], 8)) {
    out.push({ kind: 'Acceso', title: item.title, subtitle: hostOf(item.url), url: item.url, icon: item, score });
  }

  for (const { item, score } of rank(state.dock?.items || [], q, (s) => [[s.title, 1], [s.url, 0.6]], 4)) {
    if (out.some((r) => r.url === item.url)) continue;
    out.push({ kind: 'Dock', title: item.title, subtitle: hostOf(item.url), url: item.url, icon: item, score: score * 0.98 });
  }

  for (const { item, score } of rank(availableWidgets(), q, (w) => [[w.name, 1], [w.description || '', 0.5]], 4)) {
    out.push({
      kind: 'Widget', title: `Añadir «${item.name}»`, subtitle: item.description,
      glyph: item.icon, score: score * 0.85, run: () => addWidget(item.type),
    });
  }

  for (const { item, score } of rank(actionsProvider(), q, (a) => [[a.title, 1], [a.keywords || '', 0.7]], 6)) {
    out.push({ kind: item.kind || 'Ajuste', title: item.title, subtitle: item.subtitle, glyph: item.glyph, run: item.run, score: score * 0.9 });
  }

  if (q) {
    if (/^(https?:\/\/|[\w-]+\.[a-z]{2,})(\/|$)/i.test(q)) {
      const url = /^https?:\/\//i.test(q) ? q : `https://${q}`;
      out.push({ kind: 'Ir a', title: url, url, score: 650, glyph: 'external' });
    }
    out.push({
      kind: 'Web', title: `Buscar «${q}»`, glyph: 'search', score: 1,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    });
  }

  out.sort((a, b) => b.score - a.score);
  onUpdate(out);

  if (q.length >= 2 && sync.isSupported()) {
    const found = await sync.searchAll(q);
    if (mine !== token) return out;
    const seen = new Set(out.filter((r) => r.url).map((r) => r.url));
    const extra = rank(found, q, (b) => [[b.title, 1], [b.url, 0.5]], 8)
      .filter(({ item }) => !seen.has(item.url))
      .map(({ item, score }) => ({
        kind: 'Marcador', title: item.title || hostOf(item.url),
        subtitle: hostOf(item.url), url: item.url, icon: item, score: score * 0.95,
      }));
    if (extra.length) {
      const merged = [...out, ...extra].sort((a, b) => b.score - a.score);
      onUpdate(merged);
      return merged;
    }
  }
  return out;
}

export function activate(result, newTab = false) {
  if (!result) return;
  if (result.url) {
    if (newTab) window.open(result.url, '_blank', 'noopener');
    else window.location.href = result.url;
    return;
  }
  result.run?.();
}

/** Pinta la lista de resultados en `listEl`. Devuelve el índice activo. */
export function renderResults(listEl, results, cursor, { onPick, onHover } = {}) {
  clear(listEl);
  if (!results.length) {
    listEl.append(h('li', { class: 'sresult__empty faint' }, 'Sin resultados'));
    return;
  }
  const thirdParty = store.getState().settings.thirdPartyFavicons;
  results.forEach((r, i) => {
    const media = r.icon
      ? faviconEl(r.icon, { thirdParty, size: 26 })
      : h('span', { class: 'sresult__glyph' }, icon(r.glyph || 'chevron', 17));
    listEl.append(h('li', {
      class: `sresult${i === cursor ? ' is-active' : ''}`,
      role: 'option',
      'aria-selected': String(i === cursor),
      onClick: (ev) => onPick?.(r, ev.metaKey || ev.ctrlKey || ev.shiftKey),
      onMousemove: () => onHover?.(i),
    },
      media,
      h('div', { class: 'sresult__text' },
        h('span', { class: 'sresult__title' }, r.title),
        r.subtitle ? h('span', { class: 'sresult__sub faint' }, r.subtitle) : null),
      h('span', { class: 'sresult__kind faint' }, r.kind),
    ));
  });
}

export function paintCursor(listEl, cursor) {
  [...listEl.children].forEach((li, i) => {
    li.classList.toggle('is-active', i === cursor);
    li.setAttribute('aria-selected', String(i === cursor));
  });
}
