/**
 * Panel de ajustes (drawer lateral).
 * Secciones: Apariencia · Fondo · Widgets · Integraciones · Datos · Privacidad.
 */

import { h, icon, iconButton, clear } from '../core/dom.js';
import * as store from '../core/store.js';
import { applyTheme, applyAccent, applyGlass, applyClockStyle, CLOCK_FONTS } from '../core/theme.js';
import { refreshAccent, setManualAccent, useAutoAccent } from '../core/accent.js';
import { applyContrast } from '../core/contrast.js';
import { processWallpaper, makeRefractionProxy, averageLuminance, heroLuminance, formatBytes } from '../core/image.js';
import { removeWidget, render as renderDashboard } from '../core/dashboard.js';
import { getWidget } from '../core/registry.js';
import * as backup from './backup.js';
import * as sync from './bookmarks-sync.js';
import { capabilities, storage } from '../core/compat.js';
import { faviconEl } from '../core/favicon.js';
import { setMinimal } from './minimal.js';
import * as dock from './dock.js';
import { starterState, uid } from '../core/state.js';

let panel = null;
let overlay = null;
let bodyEl = null;
let currentTab = 'look';

export function openSettings(tab = 'look') {
  if (!panel) build();
  currentTab = tab;
  overlay.hidden = false;
  document.body.classList.add('modal-open');
  renderBody();
  requestAnimationFrame(() => panel.classList.add('is-open'));
}

export function closeSettings() {
  if (!panel) return;
  panel.classList.remove('is-open');
  document.body.classList.remove('modal-open');
  setTimeout(() => { overlay.hidden = true; }, 240);
}

export function isOpen() { return panel && !overlay.hidden; }

function build() {
  bodyEl = h('div', { class: 'panel__body' });
  const tabs = h('nav', { class: 'panel__tabs' },
    ...[
      ['look', 'Apariencia'],
      ['widgets', 'Widgets'],
      ['dock', 'Dock'],
      ['links', 'Marcadores'],
      ['data', 'Datos'],
    ].map(([key, label]) => h('button', {
      class: 'panel__tab',
      type: 'button',
      dataset: { tab: key },
      onClick: () => { currentTab = key; renderBody(); },
    }, label)),
  );

  panel = h('aside', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ajustes' },
    h('header', { class: 'panel__head' },
      h('h2', {}, 'Ajustes'),
      iconButton('close', 'Cerrar ajustes', closeSettings),
    ),
    tabs,
    bodyEl,
  );

  overlay = h('div', { class: 'overlay overlay--center', hidden: true }, panel);
  overlay.addEventListener('pointerdown', (ev) => {
    // Solo cerramos si el panel ya terminó de entrar: durante la animación está
    // fuera de pantalla y un clic de apertura podría "atravesarlo" y cerrarlo.
    if (ev.target === overlay && panel.classList.contains('is-open')) closeSettings();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && isOpen()) closeSettings(); });
  document.body.append(overlay);
}

function renderBody() {
  [...panel.querySelectorAll('.panel__tab')].forEach((t) => {
    t.classList.toggle('is-active', t.dataset.tab === currentTab);
  });
  clear(bodyEl);
  const section = { look: sectionLook, widgets: sectionWidgets, dock: sectionDock, links: sectionLinks, data: sectionData }[currentTab];
  bodyEl.append(section());
}

/* -------------------------------- Apariencia -------------------------------- */

function toggleRow(label, checked, onChange, hint) {
  const sw = h('button', {
    class: 'switch',
    type: 'button',
    role: 'switch',
    'aria-checked': String(!!checked),
    'aria-label': label,
  });
  sw.addEventListener('click', () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(next));
    onChange(next, sw);
  });
  return h('div', { class: 'field' },
    h('div', { class: 'field--row' }, h('label', {}, label), sw),
    hint ? h('p', { class: 'faint' }, hint) : null,
  );
}

function sectionLook() {
  const s = store.getState().settings;
  const wrap = h('div', { class: 'panel__section' });

  // Tema
  const themeBtns = h('div', { class: 'segmented' },
    ...[['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Sistema']].map(([value, label]) =>
      h('button', {
        class: `segmented__btn${s.theme === value ? ' is-active' : ''}`,
        type: 'button',
        onClick: async (ev) => {
          store.setSetting('theme', value);
          applyTheme(value);
          [...ev.target.parentElement.children].forEach((b) => b.classList.remove('is-active'));
          ev.target.classList.add('is-active');
          applyContrast();
          await refreshAccent();      // el acento se reajusta al tema nuevo
          renderBody();
        },
      }, label)),
  );
  wrap.append(h('div', { class: 'field' }, h('label', {}, 'Tema'), themeBtns));

  // Acento: automático del fondo, con opción de fijarlo a mano
  const picker = h('input', {
    class: 'accent-picker', type: 'color', value: s.accent, 'aria-label': 'Elegir color de acento',
  });
  const hex = h('code', { class: 'accent-hex' }, s.accent);
  const manualRow = h('div', { class: 'accent-manual', hidden: s.accentAuto !== false },
    picker,
    h('button', { class: 'btn btn--ghost', type: 'button', onClick: async () => {
      await useAutoAccent();
      renderBody();
    } }, 'Volver al automático'),
  );
  picker.addEventListener('input', () => {
    setManualAccent(picker.value);
    hex.textContent = picker.value;
  });

  const autoSwitch = toggleRow('Color de acento automático', s.accentAuto !== false, async (on) => {
    if (on) { await useAutoAccent(); renderBody(); }
    else {
      setManualAccent(store.getState().settings.accent);
      manualRow.hidden = false;
    }
  }, 'Se toma del fondo que elijas y se ajusta al tema. Desactívalo para elegirlo tú.');

  wrap.append(
    h('div', { class: 'field' },
      h('div', { class: 'field--row' },
        h('label', {}, 'Acento actual'),
        h('span', { class: 'accent-chip' }, h('span', { class: 'accent-dot' }), hex),
      ),
    ),
    autoSwitch,
    manualRow,
  );

  // Reloj
  wrap.append(h('hr', { class: 'sep' }), h('h3', { class: 'panel__h3' }, 'Reloj'));
  wrap.append(toggleRow('Mostrar segundos', s.clock.seconds, (on) => {
    store.update((st) => { st.settings.clock.seconds = on; });
    store.bus.emit('clock-config');
  }));
  wrap.append(toggleRow('Formato 24 horas', s.clock.hour24, (on) => {
    store.update((st) => { st.settings.clock.hour24 = on; });
    store.bus.emit('clock-config');
  }));

  // Tipografía: familia, grosor y cuánto cristal
  const fontSelect = h('select', { class: 'input' },
    ...Object.entries(CLOCK_FONTS).map(([key, def]) =>
      h('option', { value: key, selected: s.clock.font === key }, def.label)),
  );
  fontSelect.addEventListener('change', () => {
    store.update((st) => { st.settings.clock.font = fontSelect.value; });
    applyClockStyle(store.getState().settings.clock);
    clockPreview.style.fontFamily = CLOCK_FONTS[fontSelect.value].stack;
  });

  const clockPreview = h('div', { class: 'clock-preview' }, '10:24');
  const syncPreview = () => {
    const c = store.getState().settings.clock;
    clockPreview.style.fontFamily = CLOCK_FONTS[c.font]?.stack || '';
    clockPreview.style.fontWeight = String(c.weight);
    clockPreview.style.setProperty('--clock-solid', String(1 - c.transparency));
  };

  const clockRange = (key, label, min, max, step, suffix = '', transform = (v) => v) => {
    const value = h('span', { class: 'range__value faint' }, `${transform(s.clock[key])}${suffix}`);
    const input = h('input', {
      class: 'range', type: 'range', min: String(min), max: String(max), step: String(step),
      value: String(s.clock[key]),
    });
    input.addEventListener('input', () => {
      const n = Number(input.value);
      store.update((st) => { st.settings.clock[key] = n; });
      value.textContent = `${transform(n)}${suffix}`;
      applyClockStyle(store.getState().settings.clock);
      syncPreview();
    });
    return h('div', { class: 'field' },
      h('div', { class: 'field--row' }, h('label', {}, label), value), input);
  };

  wrap.append(
    h('div', { class: 'field' }, h('label', {}, 'Tipografía'), fontSelect),
    clockRange('weight', 'Grosor', 100, 700, 50),
    clockRange('transparency', 'Cristal de la fuente', 0, 0.9, 0.05, ' %', (v) => Math.round(v * 100)),
    clockPreview,
  );
  syncPreview();

  // Modo minimalista
  wrap.append(toggleRow('Modo minimalista', s.minimal, (on) => {
    setMinimal(on);
  }, 'Oculta los widgets: solo reloj, meta del día y frase.'));

  wrap.append(h('hr', { class: 'sep' }), h('h3', { class: 'panel__h3' }, 'Vidrio de los widgets'));

  const glass = () => store.getState().settings.glass;
  const glassRange = (key, label, min, max, step, suffix = '') => {
    const value = h('span', { class: 'range__value faint' }, `${glass()[key]}${suffix}`);
    const input = h('input', {
      class: 'range', type: 'range', min: String(min), max: String(max), step: String(step),
      value: String(glass()[key]),
    });
    input.addEventListener('input', () => {
      const n = Number(input.value);
      store.update((st) => { st.settings.glass[key] = n; });
      value.textContent = `${n}${suffix}`;
      applyGlass(glass());
      applyContrast();
    });
    return h('div', { class: 'field' },
      h('div', { class: 'field--row' }, h('label', {}, label), value), input);
  };

  wrap.append(
    glassRange('opacity', 'Opacidad', 0, 1, 0.02),
    glassRange('blur', 'Desenfoque', 0, 50, 1, ' px'),
    glassRange('saturation', 'Saturación', 100, 260, 5, ' %'),
    h('p', { class: 'faint' }, 'Con la opacidad baja y el desenfoque alto se consigue el efecto '
      + 'de cristal líquido: el fondo se ve a través de la tarjeta.'),
  );

  wrap.append(h('hr', { class: 'sep' }));

  /* ------------------------------- wallpaper ------------------------------- */
  wrap.append(h('h3', { class: 'panel__h3' }, 'Fondo'));

  const status = h('p', { class: 'faint' }, '');
  const preview = h('div', { class: 'wp-preview' });
  const paintPreview = () => {
    const wp = store.getWallpaper();
    preview.style.backgroundImage = wp ? `url("${wp}")` : 'none';
    preview.classList.toggle('is-empty', !wp);
    preview.textContent = wp ? '' : 'Sin imagen';
  };
  paintPreview();

  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', id: 'pt-wp-file' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    status.textContent = 'Procesando imagen…';
    try {
      const result = await processWallpaper(file, (msg) => { status.textContent = msg; });
      await store.setWallpaper(result.dataUrl);
      applyWallpaper();
      paintPreview();
      status.textContent = 'Extrayendo color de acento…';
      const proxy = await makeRefractionProxy(result.dataUrl);
      store.setSetting('wallpaperProxy', proxy);
      store.setSetting('wallpaperLum', await averageLuminance(result.dataUrl));
      store.setSetting('wallpaperLumHero', await heroLuminance(result.dataUrl));
      applyWallpaper();
      applyContrast();
      await refreshAccent();
      renderBody();
      const used = await storage.bytesInUse();
      status.textContent = `Listo · ${formatBytes(result.bytes)} (${result.strategy})`
        + (used > 0 ? ` · storage: ${formatBytes(used)}` : '');
    } catch (e) {
      status.textContent = '';
      store.bus.emit('toast', { message: `No se pudo procesar: ${e.message}`, kind: 'error' });
    } finally {
      fileInput.value = '';
    }
  });

  const uploadBtn = h('button', { class: 'btn btn--primary', type: 'button', onClick: () => fileInput.click() },
    icon('image', 16), 'Subir foto');
  const clearBtn = h('button', {
    class: 'btn btn--ghost', type: 'button',
    onClick: async () => {
      await store.setWallpaper(null);
      store.setSetting('wallpaperProxy', null);
      store.setSetting('wallpaperLum', null);
      store.setSetting('wallpaperLumHero', null);
      applyWallpaper();
      applyContrast();
      paintPreview();
      status.textContent = '';
      await refreshAccent();
      renderBody();
    },
  }, 'Quitar');

  wrap.append(preview, h('div', { class: 'row' }, uploadBtn, clearBtn, fileInput), status);

  const dim = h('input', { class: 'range', type: 'range', min: '0', max: '0.85', step: '0.05', value: String(s.wallpaper.dim) });
  dim.addEventListener('input', () => {
    store.update((st) => { st.settings.wallpaper.dim = Number(dim.value); });
    applyWallpaper();
    applyContrast();
  });
  const blur = h('input', { class: 'range', type: 'range', min: '0', max: '24', step: '1', value: String(s.wallpaper.blur) });
  blur.addEventListener('input', () => {
    store.update((st) => { st.settings.wallpaper.blur = Number(blur.value); });
    applyWallpaper();
  });
  wrap.append(
    h('div', { class: 'field' }, h('label', {}, 'Oscurecer fondo'), dim),
    h('div', { class: 'field' }, h('label', {}, 'Desenfoque del fondo'), blur),
  );

  return wrap;
}

/** Aplica wallpaper + ajustes a las variables CSS. */
export function applyWallpaper() {
  const root = document.documentElement;
  const settings = store.getState().settings;
  const s = settings.wallpaper;
  const wp = store.getWallpaper();
  if (wp && s.enabled) {
    root.style.setProperty('--wallpaper', `url("${wp}")`);
    // El proxy sirve para refractar el fondo dentro de las cifras del reloj.
    if (settings.wallpaperProxy) {
      root.style.setProperty('--wallpaper-proxy', `url("${settings.wallpaperProxy}")`);
      root.classList.add('has-refraction');
    } else {
      root.style.removeProperty('--wallpaper-proxy');
      root.classList.remove('has-refraction');
    }
    root.classList.add('has-wallpaper');
  } else {
    root.style.removeProperty('--wallpaper');
    root.style.removeProperty('--wallpaper-proxy');
    root.classList.remove('has-wallpaper', 'has-refraction');
  }
  root.style.setProperty('--wallpaper-dim', String(s.dim));
  root.style.setProperty('--wallpaper-blur', `${s.blur}px`);
}

/* --------------------------------- Widgets --------------------------------- */

function sectionWidgets() {
  const wrap = h('div', { class: 'panel__section' });
  const state = store.getState();

  wrap.append(h('button', {
    class: 'btn btn--primary btn--block', type: 'button',
    onClick: () => { closeSettings(); setTimeout(() => store.bus.emit('open-gallery'), 200); },
  }, icon('plus', 16), 'Abrir galería de widgets'));
  wrap.append(h('p', { class: 'faint' }, 'Arrastra un widget desde la galería hasta el sitio exacto de la pantalla.'));

  wrap.append(h('hr', { class: 'sep' }), h('h3', { class: 'panel__h3' }, 'En el dashboard'));
  const list = h('ul', { class: 'wlist' });
  if (!state.layout.length) list.append(h('li', { class: 'faint' }, 'No hay widgets. Añade alguno arriba.'));
  for (const item of state.layout) {
    const def = getWidget(item.type);
    if (!def) continue;
    list.append(h('li', { class: 'wlist__item' },
      h('span', { class: 'gallery__glyph' }, icon(def.icon || 'grid', 20)),
      h('span', {}, def.name),
      h('span', { class: 'faint' }, item.size.toUpperCase()),
      iconButton('trash', `Quitar ${def.name}`, () => { removeWidget(item.id); setTimeout(renderBody, 180); }, 'icon-btn--danger'),
    ));
  }
  wrap.append(list);

  // Ajustes por widget (esquema declarativo de cada módulo)
  const configurables = state.layout
    .map((item) => ({ item, def: getWidget(item.type) }))
    .filter(({ def }) => def?.settings?.length);
  if (configurables.length) {
    wrap.append(h('hr', { class: 'sep' }), h('h3', { class: 'panel__h3' }, 'Opciones'));
    for (const { item, def } of configurables) {
      wrap.append(h('details', { class: 'accordion' },
        h('summary', {}, `${def.icon || ''} ${def.name}`),
        ...def.settings.map((f) => renderField(item.id, def, f)),
      ));
    }
  }
  return wrap;
}

function renderField(widgetId, def, field) {
  const cfg = { ...def.defaultConfig, ...(store.getState().widgets[widgetId] || {}) };
  const set = (value) => {
    store.setWidgetConfig(widgetId, { [field.key]: value });
    const inst = window.__nuevapestana?.getInstance?.(widgetId);
    inst?.api?.onConfig?.({ ...def.defaultConfig, ...(store.getState().widgets[widgetId] || {}) });
  };

  if (field.type === 'checkbox') {
    return toggleRow(field.label, cfg[field.key], set);
  }
  if (field.type === 'select') {
    const sel = h('select', { class: 'input' },
      ...field.options.map((o) => h('option', { value: o.value, selected: cfg[field.key] === o.value }, o.label)));
    sel.addEventListener('change', () => set(sel.value));
    return h('div', { class: 'field' }, h('label', {}, field.label), sel);
  }
  const input = h('input', {
    class: 'input',
    type: field.type === 'number' ? 'number' : 'text',
    value: cfg[field.key] ?? '',
    placeholder: field.placeholder || '',
    min: field.min, max: field.max,
  });
  input.addEventListener('change', () => {
    set(field.type === 'number' ? Number(input.value) : input.value.trim());
  });
  return h('div', { class: 'field' }, h('label', {}, field.label), input);
}

/* ---------------------------------- Dock ---------------------------------- */

function sectionDock() {
  const wrap = h('div', { class: 'panel__section' });
  const d = store.getState().dock;

  wrap.append(toggleRow('Mostrar el dock', d.enabled, (on) => {
    store.update((s) => { s.dock.enabled = on; });
    dock.render();
  }, 'Barra inferior con tus accesos favoritos.'));

  wrap.append(toggleRow('Magnificación', d.magnify, (on) => {
    store.update((s) => { s.dock.magnify = on; });
    dock.render();
  }, 'Los iconos crecen al pasar el cursor, como en macOS.'));

  const sizeValue = h('span', { class: 'range__value faint' }, `${d.size} px`);
  const size = h('input', { class: 'range', type: 'range', min: '36', max: '76', step: '2', value: String(d.size) });
  size.addEventListener('input', () => {
    store.update((s) => { s.dock.size = Number(size.value); });
    sizeValue.textContent = `${size.value} px`;
    dock.render();
  });
  wrap.append(h('div', { class: 'field' },
    h('div', { class: 'field--row' }, h('label', {}, 'Tamaño de los iconos'), sizeValue), size));

  wrap.append(h('hr', { class: 'sep' }), h('h3', { class: 'panel__h3' }, 'En el dock'));
  const list = h('ul', { class: 'wlist' });
  if (!d.items.length) list.append(h('li', { class: 'faint' }, 'El dock está vacío.'));
  for (const item of d.items) {
    list.append(h('li', { class: 'wlist__item' },
      faviconEl(item, { thirdParty: store.getState().settings.thirdPartyFavicons, size: 22 }),
      h('span', {}, item.title),
      h('span', { class: 'faint' }, ''),
      iconButton('trash', `Quitar ${item.title}`, () => { dock.removeItem(item.id); renderBody(); }, 'icon-btn--danger'),
    ));
  }
  wrap.append(list);

  wrap.append(h('hr', { class: 'sep' }), h('h3', { class: 'panel__h3' }, 'Añadir desde tus accesos'));
  const inDock = new Set(d.items.map((i) => i.url));
  const candidates = (store.getState().shortcuts || []).filter((s) => !inDock.has(s.url));
  const gallery = h('div', { class: 'gallery' });
  if (!candidates.length) gallery.append(h('p', { class: 'faint' }, 'Todos tus accesos ya están en el dock.'));
  for (const sc of candidates) {
    gallery.append(h('button', {
      class: 'gallery__item', type: 'button',
      onClick: () => { dock.addItem(sc); renderBody(); },
    },
      faviconEl(sc, { thirdParty: store.getState().settings.thirdPartyFavicons, size: 24 }),
      h('span', { class: 'gallery__name' }, sc.title),
    ));
  }
  wrap.append(gallery);

  wrap.append(h('p', { class: 'faint' }, 'Truco: arrastra un icono del dock para reordenarlo, '
    + 'o tira de él hacia arriba y suéltalo para quitarlo.'));
  return wrap;
}

/* ------------------------------- Marcadores ------------------------------- */

function sectionLinks() {
  const wrap = h('div', { class: 'panel__section' });
  const s = store.getState().settings;

  wrap.append(h('h3', { class: 'panel__h3' }, 'Sincronizar con el navegador'));

  if (!sync.isSupported()) {
    wrap.append(h('div', { class: 'notice' },
      h('p', {}, 'Aquí no se puede leer tu barra de marcadores (solo lo permite una extensión).'),
      h('p', { class: 'faint' }, 'Exporta tus marcadores desde el navegador (archivo HTML) e impórtalos: '
        + 'se añaden como accesos, hasta 48.'),
      h('button', { class: 'btn', type: 'button', onClick: async () => {
        const file = await backup.pickFile('.html,text/html');
        if (!file) return;
        const have = new Set(store.getState().shortcuts.map((x) => x.url));
        const found = backup.parseBookmarksHtml(await backup.readFile(file))
          .filter((b) => !have.has(b.url)).slice(0, 48);
        store.update((st) => { st.shortcuts = [...st.shortcuts, ...found.map((b) => ({ id: uid('sc'), ...b }))]; });
        store.bus.emit('shortcuts-updated');
        store.bus.emit('toast', { message: `${found.length} marcadores importados.`, kind: 'ok' });
      } }, icon('upload', 16), 'Importar marcadores (HTML)'),
    ));
  } else {
    const row = toggleRow('Sincronizar accesos con marcadores', s.bookmarksSync, async (on, sw) => {
      if (on) {
        const granted = await sync.requestPermission(); // dentro del gesto de click
        if (!granted) {
          sw.setAttribute('aria-checked', 'false');
          store.bus.emit('toast', { message: 'Permiso de marcadores no concedido.', kind: 'error' });
          return;
        }
        const started = await sync.start();
        store.setSetting('bookmarksSync', started);
        sw.setAttribute('aria-checked', String(started));
        if (started) store.bus.emit('toast', { message: 'Sincronización activada (carpeta «Escritorio»).', kind: 'ok' });
      } else {
        sync.stop();
        store.setSetting('bookmarksSync', false);
        await sync.revokePermission();
        store.bus.emit('toast', { message: 'Sincronización desactivada y permiso retirado.' });
      }
    }, 'Crea una carpeta «Escritorio» en tus marcadores. Los cambios van en ambos sentidos. '
     + 'El permiso se pide solo ahora, no al instalar.');
    wrap.append(row);
  }

  wrap.append(h('hr', { class: 'sep' }));
  wrap.append(toggleRow('Mejorar iconos de baja resolución', s.thirdPartyFavicons, (on) => {
    store.setSetting('thirdPartyFavicons', on);
    store.update((st) => { st.faviconCache = {}; });   // hay que volver a sondear
    store.bus.emit('shortcuts-updated');
    store.bus.emit('dock-changed');
  }, 'Primero se buscan siempre los iconos grandes del propio sitio. Solo cuando un sitio '
   + 'no publica ninguno (YouTube, por ejemplo) se consulta el servicio de iconos de '
   + 'DuckDuckGo, al que se le envía únicamente el dominio.'));

  return wrap;
}

/* ---------------------------------- Datos ---------------------------------- */

function sectionData() {
  const wrap = h('div', { class: 'panel__section' });
  const s = store.getState().settings;

  wrap.append(h('h3', { class: 'panel__h3' }, 'Copia de seguridad'));
  wrap.append(h('p', { class: 'faint' }, 'Incluye ajustes, layout, widgets, accesos y el fondo.'));

  wrap.append(h('div', { class: 'row' },
    h('button', { class: 'btn btn--primary', type: 'button', onClick: () => {
      const bytes = backup.exportToFile();
      store.bus.emit('toast', { message: `Exportado (${formatBytes(bytes)})`, kind: 'ok' });
    } }, icon('download', 16), 'Exportar JSON'),
    h('button', { class: 'btn', type: 'button', onClick: async () => {
      const file = await backup.pickFile();
      if (!file) return;
      try {
        const text = await backup.readFile(file);
        await backup.importFromText(text);
        applyAll();
        store.bus.emit('toast', { message: 'Configuración importada.', kind: 'ok' });
        renderBody();
      } catch (e) {
        store.bus.emit('toast', { message: `Importación fallida: ${e.message}`, kind: 'error' });
      }
    } }, icon('upload', 16), 'Importar JSON'),
  ));

  wrap.append(h('hr', { class: 'sep' }), h('h3', { class: 'panel__h3' }, 'Privacidad'));
  wrap.append(h('div', { class: 'notice notice--ok' },
    h('p', {}, 'Sin cuentas, sin analítica, sin servidor propio.'),
    h('p', { class: 'faint' }, 'Las únicas conexiones salen si tú las pides: clima (Open-Meteo), '
      + 'el feed RSS que añadas y los favicons de tus propios accesos.'),
  ));

  wrap.append(toggleRow('Caché de primer pintado', s.firstPaintCache, (on) => {
    store.setSetting('firstPaintCache', on);
    if (!on) { try { localStorage.removeItem('pt.firstPaint'); } catch { /* noop */ } }
  }, 'Copia el tema y el fondo en localStorage para evitar el parpadeo al abrir la pestaña. '
   + 'La fuente de verdad sigue siendo chrome.storage.local.'));

  // Diagnóstico: útil para comparar Chrome vs Orion.
  const caps = capabilities();
  const rows = Object.entries(caps).map(([k, v]) =>
    h('li', {}, h('span', {}, k), h('span', { class: v ? 'ok' : 'faint' }, v === null ? '—' : String(v))));
  wrap.append(h('hr', { class: 'sep' }),
    h('details', { class: 'accordion' },
      h('summary', {}, 'Diagnóstico de compatibilidad'),
      h('ul', { class: 'caps' }, ...rows),
      h('p', { class: 'faint' }, 'Úsalo para ver qué APIs expone este navegador.'),
    ));

  wrap.append(h('hr', { class: 'sep' }));
  wrap.append(h('button', {
    class: 'btn btn--danger btn--block', type: 'button',
    onClick: async () => {
      if (!confirm('¿Restablecer todo? Se borrarán ajustes, widgets, accesos y el fondo de este dispositivo.')) return;
      store.update(() => starterState(), { immediate: true });
      await store.setWallpaper(null);
      applyAll();
      renderDashboard();
      renderBody();
      store.bus.emit('toast', { message: 'Configuración restablecida.' });
    },
  }, icon('trash', 16), 'Restablecer todo'));

  return wrap;
}

/** Reaplica todo el aspecto tras importar/restablecer. */
export function applyAll() {
  const s = store.getState().settings;
  applyTheme(s.theme);
  applyAccent(s.accent);
  applyGlass(s.glass);
  applyClockStyle(s.clock);
  applyWallpaper();
  applyContrast();
  document.documentElement.classList.toggle('is-minimal', !!s.minimal);
  renderDashboard();
  dock.render();
}
