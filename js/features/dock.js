/**
 * Dock estilo macOS.
 *
 *  - Magnificación: al pasar el cursor, el icono bajo el puntero crece y los
 *    vecinos algo menos, con caída gaussiana. Se calcula sobre el eje X del
 *    puntero, igual que el Dock real (no por :hover, que da saltos).
 *  - Reordenar: arrastre horizontal con Pointer Events; los vecinos se apartan.
 *  - Mover al escritorio: sacar el icono del dock y soltarlo sobre la pantalla;
 *    aparece como icono de app en el punto donde se suelta. Y al revés: un icono
 *    de app arrastrado sobre el dock se convierte en elemento del dock.
 *    (Para quitarlo del todo, clic derecho → Quitar del dock.)
 *
 * Los elementos del dock viven en `state.dock.items`, independientes de los
 * accesos del widget de marcadores (que se conserva tal cual).
 */

import { h, icon, setChildren } from '../core/dom.js';
import { faviconEl, hostOf, openIconDialog } from '../core/favicon.js';
import { attachContextMenu, openMenu } from '../core/menu.js';
import * as store from '../core/store.js';
import { uid } from '../core/state.js';

const MAG_RANGE = 110;   // px de influencia a cada lado del cursor
const OUT_MARGIN = 26;   // px fuera del dock para considerar que sale al escritorio

let root = null;
let listEl = null;
let drag = null;

/** El contenedor visible del dock (zona de destino para el grid). */
export function dockElement() { return root?.querySelector('.dock__glass') || null; }

export function mountDock(container) {
  listEl = h('div', { class: 'dock__list' });
  root = h('nav', { class: 'dock', 'aria-label': 'Dock' },
    h('div', { class: 'dock__glass' }, listEl),
  );
  container.append(root);

  root.addEventListener('pointermove', onMagnify);
  root.addEventListener('pointerleave', resetMagnify);
  listEl.addEventListener('pointerdown', onPointerDown);

  store.bus.on('dock-add', (item) => addItem(item));
  store.bus.on('dock-changed', render);

  render();
  return { render, setEnabled };
}

export function setEnabled(on) {
  document.documentElement.classList.toggle('has-dock', !!on);
  if (root) root.hidden = !on;
}

/* --------------------------------- render --------------------------------- */

export function render() {
  const state = store.getState();
  const dock = state.dock || { enabled: true, items: [] };
  setEnabled(dock.enabled);
  if (!root) return;

  root.style.setProperty('--dock-size', `${dock.size || 52}px`);
  root.classList.toggle('no-magnify', dock.magnify === false);

  const thirdParty = state.settings.thirdPartyFavicons;
  const tiles = (dock.items || []).map((item) => {
    const tile = h('a', {
      class: 'dock__item',
      href: item.url,
      // Sin `title`: ya mostramos nuestra propia etiqueta y el tooltip nativo
      // salía encima, duplicando el nombre.
      'aria-label': item.title || hostOf(item.url),
      dataset: { id: item.id },
      draggable: 'false',
    },
      faviconEl(item, { thirdParty, size: 48 }),
      h('span', { class: 'dock__tip' }, item.title || hostOf(item.url)),
    );
    tile.addEventListener('click', (ev) => {
      if (tile.dataset.dragged === '1') { ev.preventDefault(); delete tile.dataset.dragged; }
    });
    attachContextMenu(tile, () => [
      { label: 'Abrir', icon: 'external', run: () => { window.location.href = item.url; } },
      { label: 'Poner en la pantalla', icon: 'grid', run: () => {
        store.bus.emit('add-app-widget', { title: item.title, url: item.url });
      } },
      { label: 'Cambiar icono…', icon: 'image', run: () => openIconDialog(item.url, () => {
        render();
        store.bus.emit('shortcuts-updated');
      }) },
      'sep',
      { label: 'Quitar del dock', icon: 'trash', danger: true, run: () => removeItem(item.id) },
    ]);
    return tile;
  });

  const addBtn = h('button', {
    class: 'dock__item dock__item--add',
    type: 'button',
    'aria-label': 'Añadir al dock',
    onClick: (ev) => openPicker(ev.currentTarget),
  }, h('span', { class: 'dock__plus' }, icon('plus', 22)), h('span', { class: 'dock__tip' }, 'Añadir'));

  setChildren(listEl, ...tiles, tiles.length ? h('span', { class: 'dock__sep' }) : null, addBtn);
}


/* ------------------------------ magnificación ------------------------------ */

function onMagnify(ev) {
  const dock = store.getState().dock;
  if (dock?.magnify === false || drag) return;
  const items = [...listEl.querySelectorAll('.dock__item')];
  for (const it of items) {
    const r = it.getBoundingClientRect();
    const dx = Math.abs(ev.clientX - (r.left + r.width / 2));
    // Caída gaussiana: 1 justo debajo del cursor, ~0 más allá del rango.
    const factor = Math.exp(-(dx * dx) / (2 * (MAG_RANGE / 2.2) ** 2));
    it.style.setProperty('--mag', factor.toFixed(3));
  }
}

function resetMagnify() {
  for (const it of listEl.querySelectorAll('.dock__item')) it.style.setProperty('--mag', '0');
}

/* -------------------------------- arrastre -------------------------------- */

function onPointerDown(ev) {
  if (ev.button != null && ev.button !== 0) return;
  const tile = ev.target.closest('.dock__item:not(.dock__item--add)');
  if (!tile) return;
  drag = {
    tile,
    id: tile.dataset.id,
    pointerId: ev.pointerId,
    startX: ev.clientX,
    startY: ev.clientY,
    active: false,
  };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function onDragMove(ev) {
  if (!drag) return;
  const dx = ev.clientX - drag.startX;
  const dy = ev.clientY - drag.startY;
  if (!drag.active) {
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    drag.active = true;
    drag.tile.classList.add('is-dragging');
    resetMagnify();
    document.body.classList.add('no-select');
  }

  const pullOut = isOutside(ev.clientX, ev.clientY);
  drag.tile.classList.toggle('is-pulled', pullOut);
  drag.tile.style.transform = `translate(${dx}px, ${dy}px) scale(${pullOut ? 0.92 : 1.1})`;
  document.querySelector('.grid')?.classList.toggle('is-drop-target', pullOut);

  if (pullOut) return;

  // Reordenado: buscamos el vecino cuyo centro cruzamos.
  const others = [...listEl.querySelectorAll('.dock__item:not(.is-dragging):not(.dock__item--add)')];
  for (const other of others) {
    const r = other.getBoundingClientRect();
    const center = r.left + r.width / 2;
    if (ev.clientX > center && other.compareDocumentPosition(drag.tile) & Node.DOCUMENT_POSITION_PRECEDING) {
      other.after(drag.tile);
      drag.startX = ev.clientX;
      drag.tile.style.transform = '';
      break;
    }
    if (ev.clientX < center && other.compareDocumentPosition(drag.tile) & Node.DOCUMENT_POSITION_FOLLOWING) {
      other.before(drag.tile);
      drag.startX = ev.clientX;
      drag.tile.style.transform = '';
      break;
    }
  }
}

/** ¿El puntero está fuera del dock (es decir, sobre el escritorio)? */
function isOutside(x, y) {
  const glass = dockElement();
  if (!glass) return false;
  const r = glass.getBoundingClientRect();
  return x < r.left - OUT_MARGIN || x > r.right + OUT_MARGIN
      || y < r.top - OUT_MARGIN || y > r.bottom + OUT_MARGIN;
}

function endDrag(ev) {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  if (!drag) return;
  const { tile, active, id } = drag;
  const pulledOut = active && ev && isOutside(ev.clientX, ev.clientY);
  document.body.classList.remove('no-select');
  document.querySelector('.grid')?.classList.remove('is-drop-target');
  tile.style.transform = '';
  tile.classList.remove('is-dragging', 'is-pulled');

  if (active) {
    tile.dataset.dragged = '1'; // evita que el arrastre acabe navegando
    setTimeout(() => { delete tile.dataset.dragged; }, 300);
  }

  if (pulledOut) {
    const item = store.getState().dock.items.find((i) => i.id === id);
    drag = null;
    if (item) {
      store.update((s) => { s.dock.items = s.dock.items.filter((i) => i.id !== id); });
      render();
      // El escritorio decide dónde encaja según el punto donde se soltó.
      store.bus.emit('drop-app-at', { x: ev.clientX, y: ev.clientY, title: item.title, url: item.url });
    }
    return;
  }
  if (active) persistOrder();
  drag = null;
}

/**
 * Alta desde el grid: un icono de app soltado sobre el dock. Se inserta en la
 * posición horizontal donde se soltó, no al final.
 */
export function insertAt(clientX, { title, url }) {
  const id = addItem({ title, url });
  if (!id) return null;
  const tiles = [...listEl.querySelectorAll('.dock__item:not(.dock__item--add)')];
  let index = tiles.length - 1;
  for (let i = 0; i < tiles.length; i++) {
    const r = tiles[i].getBoundingClientRect();
    if (clientX < r.left + r.width / 2) { index = i; break; }
  }
  store.update((s) => {
    const moving = s.dock.items.find((i) => i.id === id);
    s.dock.items = s.dock.items.filter((i) => i.id !== id);
    s.dock.items.splice(Math.min(index, s.dock.items.length), 0, moving);
  });
  render();
  const tile = listEl.querySelector(`[data-id="${id}"]`);
  tile?.classList.add('just-added');
  setTimeout(() => tile?.classList.remove('just-added'), 500);
  return id;
}

function persistOrder() {
  const order = [...listEl.querySelectorAll('.dock__item:not(.dock__item--add)')].map((t) => t.dataset.id);
  store.update((s) => {
    const byId = new Map(s.dock.items.map((i) => [i.id, i]));
    s.dock.items = order.map((id) => byId.get(id)).filter(Boolean);
  });
}

/* ------------------------------ altas y bajas ------------------------------ */

export function addItem({ title, url }) {
  if (!url) return null;
  let clean = String(url).trim();
  if (!/^[a-z]+:\/\//i.test(clean)) clean = `https://${clean}`;
  try { new URL(clean); } catch { return null; }

  const existing = store.getState().dock.items.find((i) => i.url === clean);
  if (existing) {
    store.bus.emit('toast', { message: 'Ya está en el dock.' });
    return existing.id;
  }
  const item = { id: uid('dk'), title: title || hostOf(clean), url: clean };
  store.update((s) => { s.dock.items = [...s.dock.items, item]; });
  render();
  const tile = listEl.querySelector(`[data-id="${item.id}"]`);
  tile?.classList.add('just-added');
  setTimeout(() => tile?.classList.remove('just-added'), 500);
  return item.id;
}

export function removeItem(id) {
  const tile = listEl?.querySelector(`[data-id="${id}"]`);
  if (tile) {
    tile.classList.add('is-removing');
    setTimeout(() => {
      store.update((s) => { s.dock.items = s.dock.items.filter((i) => i.id !== id); });
      render();
    }, 180);
  } else {
    store.update((s) => { s.dock.items = s.dock.items.filter((i) => i.id !== id); });
    render();
  }
}

/* --------------------------- selector de elementos --------------------------- */

function openPicker(anchor) {
  const state = store.getState();
  const inDock = new Set(state.dock.items.map((i) => i.url));
  const candidates = (state.shortcuts || []).filter((s) => !inDock.has(s.url));

  const r = anchor.getBoundingClientRect();
  const items = candidates.slice(0, 8).map((s) => ({
    label: s.title || hostOf(s.url),
    icon: 'plus',
    run: () => addItem(s),
  }));
  if (items.length) items.push('sep');
  items.push({ label: 'Añadir una URL…', icon: 'edit', run: promptUrl });
  openMenu({ x: r.left, y: r.top - 8 }, items);
}

function promptUrl() {
  const url = h('input', { class: 'input', type: 'url', placeholder: 'https://ejemplo.com' });
  const title = h('input', { class: 'input', type: 'text', placeholder: 'Nombre (opcional)' });
  const dialog = h('div', { class: 'overlay' },
    h('form', { class: 'minidialog' },
      h('h3', {}, 'Añadir al dock'),
      h('div', { class: 'field' }, h('label', {}, 'URL'), url),
      h('div', { class: 'field' }, h('label', {}, 'Nombre'), title),
      h('div', { class: 'row-end' },
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => dialog.remove() }, 'Cancelar'),
        h('button', { class: 'btn btn--primary', type: 'submit' }, 'Añadir'),
      ),
    ),
  );
  dialog.querySelector('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (addItem({ url: url.value, title: title.value.trim() })) dialog.remove();
  });
  dialog.addEventListener('pointerdown', (ev) => { if (ev.target === dialog) dialog.remove(); });
  document.body.append(dialog);
  setTimeout(() => url.focus(), 30);
}
