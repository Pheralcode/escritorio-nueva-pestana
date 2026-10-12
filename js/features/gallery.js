/**
 * Galería de widgets, al estilo de la pantalla de inicio de un iPhone.
 *
 * Se abre como una lámina inferior con una vista previa de cada widget.
 * Arrastras la vista previa fuera de la lámina y la sueltas donde quieras: el
 * widget se crea exactamente en esa posición del escritorio. Un toque simple
 * también lo añade, para quien prefiera no arrastrar.
 */

import { h, icon, iconButton } from '../core/dom.js';
import { allWidgets } from '../core/registry.js';
import { addWidgetAt } from '../core/dashboard.js';
import { SIZES } from '../core/grid.js';

let overlay = null;
let sheet = null;
let drag = null;

export function openGallery() {
  if (!overlay) build();
  overlay.hidden = false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  renderItems();
}

export function closeGallery() {
  if (!overlay) return;
  sheet.classList.remove('is-open');
  document.body.classList.remove('modal-open');
  setTimeout(() => { overlay.hidden = true; }, 260);
}

export function isOpen() { return overlay && !overlay.hidden; }

function build() {
  const grid = h('div', { class: 'gal__grid' });
  sheet = h('div', { class: 'gal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Añadir widget' },
    h('div', { class: 'gal__grip' }),
    h('header', { class: 'gal__head' },
      h('h2', {}, 'Widgets'),
      iconButton('close', 'Cerrar', closeGallery),
    ),
    h('p', { class: 'gal__hint faint' }, 'Arrastra uno a la pantalla, o tócalo para añadirlo.'),
    grid,
  );
  sheet.dataset.grid = '1';
  overlay = h('div', { class: 'overlay overlay--sheet', hidden: true }, sheet);
  overlay.addEventListener('pointerdown', (ev) => {
    if (ev.target === overlay && sheet.classList.contains('is-open')) closeGallery();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && isOpen()) closeGallery(); });
  document.body.append(overlay);
  sheet.addEventListener('pointerdown', onPointerDown);
}

function renderItems() {
  const grid = sheet.querySelector('.gal__grid');
  grid.replaceChildren(...allWidgets().map((def) => {
    const size = def.defaultSize || 'md';
    const dims = SIZES[size] || SIZES.md;
    const card = h('button', {
      class: 'gal__item',
      type: 'button',
      dataset: { type: def.type, size },
      style: { '--pv-cols': dims.cols, '--pv-rows': dims.rows },
    },
      h('span', { class: 'gal__preview' },
        h('span', { class: 'gal__preview-inner' }, icon(def.icon || 'grid', 22)),
      ),
      h('span', { class: 'gal__name' }, def.name),
      h('span', { class: 'gal__desc faint' }, def.description || ''),
    );
    return card;
  }));
}

/* ------------------------- arrastrar hasta la pantalla ------------------------- */

function onPointerDown(ev) {
  const item = ev.target.closest('.gal__item');
  if (!item) return;
  drag = {
    item,
    type: item.dataset.type,
    size: item.dataset.size,
    startX: ev.clientX,
    startY: ev.clientY,
    active: false,
    ghost: null,
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function onMove(ev) {
  if (!drag) return;
  const dx = ev.clientX - drag.startX;
  const dy = ev.clientY - drag.startY;
  if (!drag.active) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    drag.active = true;
    // Fantasma que sigue al dedo, como cuando sacas un widget de la galería en iOS.
    const r = drag.item.getBoundingClientRect();
    drag.ghost = drag.item.cloneNode(true);
    drag.ghost.classList.add('gal__ghost');
    drag.ghost.style.width = `${r.width}px`;
    drag.ghost.style.height = `${r.height}px`;
    drag.offsetX = drag.startX - r.left;
    drag.offsetY = drag.startY - r.top;
    document.body.append(drag.ghost);
    drag.item.classList.add('is-source');
    // La lámina se retrae para dejar la pantalla libre: si no, taparía casi
    // todo el escritorio y no habría dónde soltar.
    sheet.classList.add('is-retracted');
    document.body.classList.add('no-select');
  }
  drag.ghost.style.transform =
    `translate(${ev.clientX - drag.offsetX}px, ${ev.clientY - drag.offsetY}px) scale(1.04)`;

  const overSheet = isOverSheet(ev.clientX, ev.clientY);
  document.querySelector('.grid')?.classList.toggle('is-drop-target', !overSheet);
  drag.ghost.classList.toggle('is-ready', !overSheet);
}

function isOverSheet(x, y) {
  const r = sheet.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function onUp(ev) {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  if (!drag) return;
  const { active, type, size, item, ghost } = drag;
  document.body.classList.remove('no-select');
  document.querySelector('.grid')?.classList.remove('is-drop-target');
  item.classList.remove('is-source');
  sheet.classList.remove('is-retracted');
  ghost?.remove();

  if (!active) {
    // Toque simple: se añade al final.
    drag = null;
    addWidgetAt(null, null, type, size);
    closeGallery();
    return;
  }

  const dropped = !isOverSheet(ev.clientX, ev.clientY);
  drag = null;
  if (dropped) {
    closeGallery();
    // Esperamos a que la lámina se aparte para medir bien las tarjetas de debajo.
    setTimeout(() => addWidgetAt(ev.clientX, ev.clientY, type, size), 280);
  }
}
