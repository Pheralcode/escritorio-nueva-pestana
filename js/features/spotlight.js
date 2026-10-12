/**
 * Overlay de búsqueda (⌘K / Ctrl+K).
 *
 * La barra grande de la cabecera y este overlay comparten motor (search.js);
 * aquí solo vive la carcasa modal y su navegación por teclado.
 */

import { h, icon } from '../core/dom.js';
import * as engine from './search.js';
import { focusSearch } from './hero.js';

let overlay = null;
let input = null;
let listEl = null;
let results = [];
let cursor = 0;

export const setActions = engine.setActions;

export function isOpen() { return !!overlay && !overlay.hidden; }

export function open(prefill = '') {
  if (!overlay) build();
  overlay.hidden = false;
  document.body.classList.add('modal-open');
  input.value = prefill;
  input.focus();
  input.select();
  update();
}

export function close() {
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove('modal-open');
  results = [];
  cursor = 0;
}

function build() {
  input = h('input', {
    class: 'spotlight__input',
    type: 'text',
    placeholder: 'Buscar accesos, marcadores, widgets y ajustes…',
    'aria-label': 'Buscar',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  listEl = h('ul', { class: 'sresults', role: 'listbox' });

  const panel = h('div', { class: 'spotlight', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Buscador' },
    h('div', { class: 'spotlight__bar' }, icon('search', 18), input),
    listEl,
    h('div', { class: 'spotlight__hint faint' },
      h('span', {}, '↑↓ navegar'), h('span', {}, '⏎ abrir'),
      h('span', {}, '⇧⏎ nueva pestaña'), h('span', {}, 'esc cerrar')),
  );

  overlay = h('div', { class: 'overlay', hidden: true }, panel);
  overlay.addEventListener('pointerdown', (ev) => { if (ev.target === overlay) close(); });
  input.addEventListener('input', update);
  input.addEventListener('keydown', onKeyDown);
  document.body.append(overlay);
}

function update() {
  engine.search(input.value, (list) => {
    results = list;
    cursor = 0;
    engine.renderResults(listEl, results, cursor, {
      onPick: (r, newTab) => { close(); engine.activate(r, newTab); },
      onHover: (i) => { cursor = i; engine.paintCursor(listEl, cursor); },
    });
  });
}

function onKeyDown(ev) {
  if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
  if (ev.key === 'ArrowDown' || (ev.key === 'n' && ev.ctrlKey)) { ev.preventDefault(); move(1); return; }
  if (ev.key === 'ArrowUp' || (ev.key === 'p' && ev.ctrlKey)) { ev.preventDefault(); move(-1); return; }
  if (ev.key === 'Enter') {
    ev.preventDefault();
    const target = results[cursor];
    close();
    engine.activate(target, ev.shiftKey);
  }
}

function move(delta) {
  if (!results.length) return;
  cursor = (cursor + delta + results.length) % results.length;
  engine.paintCursor(listEl, cursor);
  listEl.children[cursor]?.scrollIntoView({ block: 'nearest' });
}

/**
 * Atajos globales. ⌘K enfoca la barra grande de la cabecera si está visible
 * (es la que el usuario tiene delante); si no —modo minimalista—, abre el overlay.
 */
export function installShortcuts() {
  window.addEventListener('keydown', (ev) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.isContentEditable;
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (isOpen()) { close(); return; }
      if (document.querySelector('.hero') && !document.documentElement.classList.contains('is-minimal')) {
        focusSearch('');
      } else {
        open();
      }
      return;
    }
    if (ev.key === '/' && !typing && !isOpen()) {
      ev.preventDefault();
      if (document.querySelector('.hero') && !document.documentElement.classList.contains('is-minimal')) focusSearch('');
      else open();
    }
  });
}
