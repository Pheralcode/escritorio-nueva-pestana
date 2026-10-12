/**
 * Cabecera fija: reloj centrado al estilo de la pantalla de bloqueo de iOS y,
 * debajo, la barra de búsqueda grande.
 *
 * El reloj ya no es un widget: siempre está, siempre centrado, sin configuración.
 * La barra de búsqueda usa el mismo motor que ⌘K, pero despliega los resultados
 * justo debajo en vez de abrir un overlay.
 */

import { h, icon } from '../core/dom.js';
import * as store from '../core/store.js';
import { formatTime, formatDate, scheduleTick } from '../core/time.js';
import * as engine from './search.js';

let results = [];
let cursor = 0;
let input = null;
let panel = null;
let listEl = null;

let bar = null;
let heroEl = null;
let stopTick = null;
let timeEl = null;
let dateEl = null;

export function mountHero(container) {
  timeEl = h('div', { class: 'hero__time' });
  dateEl = h('div', { class: 'hero__date' });

  input = h('input', {
    class: 'hero__input',
    type: 'text',
    placeholder: '',
    'aria-label': 'Buscar',
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'go',
  });

  listEl = h('ul', { class: 'sresults', role: 'listbox' });
  panel = h('div', { class: 'hero__panel', hidden: true }, listEl);

  const isMac = navigator.platform.toLowerCase().includes('mac');
  bar = h('div', { class: 'hero__search', onClick: () => input.focus() },
    h('span', { class: 'hero__search-icon' }, icon('search', 18)),
    input,
    h('span', { class: 'hero__kbd' }, isMac ? '\u2318K' : 'Ctrl K'),
    h('button', {
      class: 'hero__clear', type: 'button', 'aria-label': 'Limpiar',
      onClick: (ev) => { ev.stopPropagation(); input.value = ''; update(); input.focus(); },
    }, icon('close', 14)),
  );

  heroEl = h('header', { class: 'hero' },
    h('div', { class: 'hero__clock' }, dateEl, timeEl),
    h('div', { class: 'hero__searchwrap' }, bar, panel),
  );
  container.prepend(heroEl);

  input.addEventListener('input', update);
  input.addEventListener('focus', expand);
  input.addEventListener('blur', () => {
    // Si no hay texto, la barra vuelve a su tamaño pequeño.
    setTimeout(() => { if (!input.value.trim() && !panel.matches(':hover')) collapse(); }, 120);
  });
  input.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', (ev) => {
    if (!heroEl.contains(ev.target)) { close(); collapse(); }
  });

  stopTick = startClock();
  store.bus.on('clock-config', () => { stopTick?.(); stopTick = startClock(); });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') paintClock();
  });

  return { el: heroEl, focus: () => input.focus(), destroy: () => stopTick?.() };
}

function clockCfg() {
  return store.getState().settings.clock || { seconds: false, hour24: true };
}

function paintClock() {
  const cfg = clockCfg();
  const now = new Date();
  const base = formatTime(now, { hour24: cfg.hour24, seconds: false });
  if (cfg.seconds) {
    const ss = String(now.getSeconds()).padStart(2, '0');
    timeEl.replaceChildren(document.createTextNode(base),
      h('span', { class: 'hero__seconds' }, ss));
  } else {
    timeEl.textContent = base;
  }
  dateEl.textContent = formatDate(now);
}

function startClock() {
  return scheduleTick(paintClock, { seconds: clockCfg().seconds });
}

/* ------------------------- expansión de la barra ------------------------- */

function expand() { bar?.classList.add('is-open'); }

function collapse() {
  if (!bar) return;
  bar.classList.remove('is-open');
  bar.classList.remove('has-text');
}

/** Enfoca la barra grande (lo usa el atajo de teclado). */
export function focusSearch(prefill) {
  if (!input) return;
  if (prefill != null) input.value = prefill;
  expand();
  input.focus();
  input.select();
  if (input.value.trim()) update();
}

function update() {
  const q = input.value;
  bar?.classList.toggle('has-text', !!q);
  if (q) expand();
  if (!q.trim()) { close(); return; }
  engine.search(q, (list) => {
    results = list;
    cursor = 0;
    open();
    engine.renderResults(listEl, results, cursor, {
      onPick: (r, newTab) => { engine.activate(r, newTab); close(); },
      onHover: (i) => { cursor = i; engine.paintCursor(listEl, cursor); },
    });
  });
}

function open() {
  panel.hidden = false;
  document.documentElement.classList.add('searching');
}

function close() {
  if (!panel) return;
  panel.hidden = true;
  document.documentElement.classList.remove('searching');
}

function onKeyDown(ev) {
  if (ev.key === 'Escape') {
    if (panel.hidden) { input.value = ''; collapse(); input.blur(); }
    else close();
    return;
  }
  if (ev.key === 'ArrowDown') { ev.preventDefault(); move(1); return; }
  if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); return; }
  if (ev.key === 'Enter') {
    ev.preventDefault();
    const target = results[cursor];
    if (target) { engine.activate(target, ev.shiftKey); close(); }
  }
}

function move(delta) {
  if (!results.length) return;
  cursor = (cursor + delta + results.length) % results.length;
  engine.paintCursor(listEl, cursor);
  listEl.children[cursor]?.scrollIntoView({ block: 'nearest' });
}
