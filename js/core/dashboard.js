/** Renderiza el grid, monta/desmonta instancias de widget y persiste el layout. */

import { h, icon, iconButton, clear } from './dom.js';
import { createGrid, applySize, nextSize, SIZES, SIZE_ORDER } from './grid.js';
import { getWidget, allWidgets } from './registry.js';
import * as store from './store.js';
import { uid } from './state.js';
import { attachContextMenu } from './menu.js';

const instances = new Map(); // id -> { def, api, card }
let gridRoot = null;
let grid = null;

export function mountDashboard(root, { dropZones = [] } = {}) {
  gridRoot = root;
  grid = createGrid(root, {
    dropZones,
    onReorder(order) {
      store.update((s) => {
        const byId = new Map(s.layout.map((it) => [it.id, it]));
        s.layout = order.map((id) => byId.get(id)).filter(Boolean);
      });
    },
    onResize(id, size) {
      store.update((s) => {
        const item = s.layout.find((it) => it.id === id);
        if (item) item.size = size;
      });
      instances.get(id)?.api?.onResize?.(size);
    },
  });
  render();
}

export function render() {
  const state = store.getState();
  const wanted = new Set(state.layout.map((it) => it.id));

  // Desmontar los que ya no están.
  for (const [id, inst] of [...instances]) {
    if (!wanted.has(id)) {
      try { inst.api.destroy?.(); } catch (e) { console.error(e); }
      inst.card.remove();
      instances.delete(id);
    }
  }

  // Crear los que faltan y reordenar todo según el layout.
  const frag = document.createDocumentFragment();
  for (const item of state.layout) {
    let inst = instances.get(item.id);
    if (!inst) {
      inst = createInstance(item);
      if (!inst) continue;
      instances.set(item.id, inst);
    }
    applySize(inst.card, item.size);
    frag.append(inst.card);
  }
  gridRoot.append(frag); // append de nodos existentes = mover, sin recrear
  updateEmptyState();
}

function updateEmptyState() {
  const empty = gridRoot.parentElement.querySelector('.grid-empty');
  const isEmpty = store.getState().layout.length === 0;
  if (empty) empty.hidden = !isEmpty;
}

function createInstance(item) {
  const def = getWidget(item.type);
  if (!def) {
    console.warn(`[nuevapestana] widget desconocido: ${item.type}`);
    return null;
  }
  const card = h('article', {
    class: `widget widget--${def.type}`,
    dataset: { id: item.id, type: def.type, size: item.size, sizes: (def.sizes || SIZE_ORDER).join(',') },
    tabindex: '0',
    role: 'group',
    'aria-label': def.name,
  });

  const body = h('div', { class: 'widget__body' });

  const ctx = {
    id: item.id,
    get config() { return { ...def.defaultConfig, ...(store.getState().widgets[item.id] || {}) }; },
    setConfig(patch) {
      store.setWidgetConfig(item.id, patch);
      api?.onConfig?.(ctx.config);
    },
    get size() {
      return store.getState().layout.find((l) => l.id === item.id)?.size || def.defaultSize;
    },
    store,
    bus: store.bus,
    card,
  };

  let api = null;
  try {
    api = def.create(ctx) || {};
  } catch (e) {
    console.error(`[nuevapestana] error creando widget ${def.type}:`, e);
    api = { el: h('div', { class: 'widget-error' }, 'Este widget falló al cargar.') };
  }

  body.append(api.el || h('div'));

  if (def.chrome !== 'none') {
    // Clic derecho sobre un widget: sus acciones + las del escritorio. Sin esto,
    // un widget grande sería una zona muerta (el menú del escritorio se suprime
    // sobre las tarjetas y no habría forma de llegar a los ajustes desde ahí).
    attachContextMenu(card, () => {
      const current = card.dataset.size;
      const sizes = (def.sizes || SIZE_ORDER).filter((k) => SIZES[k]);
      return [
        ...sizes.map((key) => ({
          label: `Tamaño: ${SIZES[key].label}`,
          icon: key === current ? 'check' : 'grid',
          run: () => {
            applySize(card, key);
            store.update((st) => {
              const it = st.layout.find((l) => l.id === item.id);
              if (it) it.size = key;
            });
            instances.get(item.id)?.api?.onResize?.(key);
          },
        })),
        'sep',
        (def.settings?.length || def.configurable) && {
          label: `Ajustes de ${def.name}`, icon: 'gear',
          run: () => store.bus.emit('open-widget-settings', { id: item.id, type: def.type }),
        },
        { label: 'Añadir widget', icon: 'plus', run: () => store.bus.emit('open-gallery') },
        { label: 'Ajustes', icon: 'gear', run: () => store.bus.emit('open-settings', 'look') },
        'sep',
        { label: `Quitar ${def.name}`, icon: 'trash', danger: true, run: () => removeWidget(item.id) },
      ].filter(Boolean);
    }, {
      // En campos de texto dejamos el menú nativo (copiar/pegar).
      skip: (target) => !!target.closest('input, textarea, [contenteditable="true"]'),
    });
  }

  if (def.chrome === 'none') {
    // Tarjeta-icono: sin cabecera. La tarjeta entera es el asa de arrastre y los
    // botones flotantes se marcan [data-no-drag] para no iniciar un arrastre.
    card.classList.add('widget--bare');
    card.setAttribute('data-drag-handle', '');
    card.append(floatingActions(def, item, ctx), body, resizeHandle());
  } else {
    card.append(header(def, item, ctx), body, resizeHandle());
  }
  return { def, api, card, ctx };
}

/** Acciones flotantes para las tarjetas sin cabecera. */
function floatingActions(def, item, ctx) {
  const actions = h('div', { class: 'widget__float', 'data-no-drag': '' },
    (def.settings?.length || def.configurable) && iconButton('gear', 'Ajustes', (ev) => {
      ev.stopPropagation();
      store.bus.emit('open-widget-settings', { id: item.id, type: def.type });
    }),
    iconButton('close', 'Quitar', (ev) => {
      ev.stopPropagation();
      removeWidget(item.id);
    }, 'icon-btn--danger'),
  );
  return actions;
}

function header(def, item, ctx) {
  const title = h('span', { class: 'widget__title' }, def.name);
  const grip = h('button', {
    class: 'widget__grip',
    type: 'button',
    'data-drag-handle': '',
    title: 'Arrastrar para reordenar',
    'aria-label': `Mover ${def.name}`,
  }, icon('drag', 16));

  const actions = h('div', { class: 'widget__actions' },
    iconButton('grid', `Tamaño (${SIZES[item.size]?.label || ''})`, (ev) => {
      ev.stopPropagation();
      const card = ctx.card;
      const size = nextSize(card.dataset.size, def.sizes);
      applySize(card, size);
      store.update((s) => {
        const it = s.layout.find((l) => l.id === item.id);
        if (it) it.size = size;
      });
      instances.get(item.id)?.api?.onResize?.(size);
    }),
    (def.settings?.length || def.configurable) && iconButton('gear', 'Ajustes del widget', (ev) => {
      ev.stopPropagation();
      store.bus.emit('open-widget-settings', { id: item.id, type: def.type });
    }),
    iconButton('close', 'Quitar widget', (ev) => {
      ev.stopPropagation();
      removeWidget(item.id);
    }, 'icon-btn--danger'),
  );

  return h('header', { class: 'widget__header' }, grip, title, actions);
}

function resizeHandle() {
  return h('div', {
    class: 'widget__resize',
    'data-resize-handle': '',
    title: 'Arrastrar para redimensionar',
    'aria-hidden': 'true',
  });
}

export function addWidget(type, size) {
  const def = getWidget(type);
  if (!def) return null;
  const id = uid(type);
  store.update((s) => {
    s.layout.push({ id, type, size: size || def.defaultSize });
    s.widgets[id] = { ...def.defaultConfig };
  });
  render();
  const card = instances.get(id)?.card;
  card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  card?.classList.add('just-dropped');
  setTimeout(() => card?.classList.remove('just-dropped'), 400);
  return id;
}

export function removeWidget(id) {
  const inst = instances.get(id);
  if (inst) {
    inst.card.classList.add('is-removing');
  }
  setTimeout(() => {
    store.update((s) => {
      s.layout = s.layout.filter((it) => it.id !== id);
      delete s.widgets[id];
    });
    render();
  }, 140);
}

store.bus.on('remove-widget', ({ id }) => removeWidget(id));

/**
 * Crea un widget y lo coloca en el punto (x, y) de la pantalla: busca la tarjeta
 * más cercana al puntero y se inserta antes o después según el lado. Con (null,
 * null) se añade al final. Lo usan la galería y el arrastre desde el dock.
 */
export function addWidgetAt(x, y, type, size, config = null) {
  const id = addWidget(type, size);
  if (!id) return null;
  if (config) {
    store.setWidgetConfig(id, config);
    getInstance(id)?.api?.onConfig?.({ ...getWidget(type)?.defaultConfig, ...config });
  }
  if (x == null || y == null) return id;
  placeNear(id, x, y);
  return id;
}

/** Icono de app en una posición concreta (atajo de addWidgetAt). */
export function addAppAt(x, y, { title, url }) {
  return addWidgetAt(x, y, 'app', 'xs', { title, url });
}

function placeNear(id, x, y) {
  const cards = [...gridRoot.querySelectorAll('.widget')].filter((c) => c.dataset.id !== id);
  let target = null;
  let after = false;
  let bestDist = Infinity;
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestDist) { bestDist = d; target = card; after = x > cx; }
  }
  if (target) {
    const index = store.getState().layout.findIndex((l) => l.id === target.dataset.id);
    store.update((st) => {
      const moving = st.layout.find((l) => l.id === id);
      st.layout = st.layout.filter((l) => l.id !== id);
      st.layout.splice(Math.max(0, index + (after ? 1 : 0)), 0, moving);
    });
    render();
  }
  const card = instances.get(id)?.card;
  card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  card?.classList.add('just-dropped');
  setTimeout(() => card?.classList.remove('just-dropped'), 400);
}

export function getInstance(id) { return instances.get(id) || null; }
export function availableWidgets() { return allWidgets(); }

/** Re-render completo (tras importar un backup o un cambio externo). */
export function reset() {
  for (const [, inst] of instances) {
    try { inst.api.destroy?.(); } catch { /* noop */ }
    inst.card.remove();
  }
  instances.clear();
  clear(gridRoot);
  render();
}
