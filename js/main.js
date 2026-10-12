/** Punto de entrada del escritorio. */

import { h, $ } from './core/dom.js';
import * as store from './core/store.js';
import { applyTheme, applyGlass, applyClockStyle } from './core/theme.js';
import { applyCachedAccent, refreshAccent } from './core/accent.js';
import { applyContrast } from './core/contrast.js';
import { loadWidgets } from './core/registry.js';
import { mountDashboard, addWidget, addAppAt, getInstance } from './core/dashboard.js';
import { mountMinimal, toggleMinimal, setMinimal } from './features/minimal.js';
import { mountHero, focusSearch } from './features/hero.js';
import { openSettings, applyWallpaper, applyAll } from './features/settings.js';
import * as spotlight from './features/spotlight.js';
import * as sync from './features/bookmarks-sync.js';
import { mountDock, dockElement, insertAt as dockInsertAt } from './features/dock.js';
import { openMenu, closeMenu } from './core/menu.js';
import { openGallery } from './features/gallery.js';
import { IS_EXTENSION } from './core/compat.js';

async function boot() {
  await store.init();

  const s = store.getState().settings;
  applyTheme(s.theme);
  applyCachedAccent();          // instantáneo; luego se recalcula desde el fondo
  applyGlass(s.glass);
  applyClockStyle(s.clock);
  applyWallpaper();
  applyContrast();
  document.documentElement.classList.toggle('is-minimal', !!s.minimal);

  mountHero($('.app'));
  mountMinimal($('.app'));

  await loadWidgets();
  mountDock(document.body);
  mountDashboard($('.grid'), {
    dropZones: [{
      el: dockElement,
      // Solo los iconos de app pueden vivir en el dock.
      accepts: (card) => card.dataset.type === 'app',
      onDrop: (card, ev) => {
        const cfg = store.getState().widgets[card.dataset.id] || {};
        if (!cfg.url) return;
        store.bus.emit('remove-widget', { id: card.dataset.id });
        dockInsertAt(ev?.clientX ?? window.innerWidth / 2, { title: cfg.title, url: cfg.url });
        toast({ message: `«${cfg.title || cfg.url}» está en el dock.`, kind: 'ok' });
      },
    }],
  });

  installToasts();
  installSearch();
  installDesktopMenu();
  installShortcuts();

  // Del dock al escritorio y viceversa.
  store.bus.on('drop-app-at', ({ x, y, title, url }) => {
    addAppAt(x, y, { title, url });
    toast({ message: `«${title || url}» está en la pantalla.`, kind: 'ok' });
  });
  store.bus.on('add-app-widget', ({ title, url }) => {
    const id = addWidget('app', 'xs');
    if (!id) return;
    store.setWidgetConfig(id, { title, url });
    getInstance(id)?.api?.onConfig?.({ title, url });
    toast({ message: `«${title || url}» está en la pantalla.`, kind: 'ok' });
  });

  // El acento y el contraste salen del fondo. Si el fondo se guardó antes de que
  // existieran estas medidas, se calculan una vez y quedan cacheadas.
  backfillWallpaperMetrics().then(() => refreshAccent({ silent: true }));

  if (s.bookmarksSync) {
    const started = await sync.start();
    if (!started) {
      store.setSetting('bookmarksSync', false);
      console.info('[nuevapestana] sincronización de marcadores no disponible; se desactiva.');
    }
  }

  store.bus.on('external-change', () => { applyAll(); });
  store.bus.on('wallpaper', () => applyWallpaper());
  store.bus.on('storage-error', (e) => {
    toast({
      message: /quota/i.test(String(e?.message))
        ? 'Almacenamiento lleno: prueba con un fondo más ligero.'
        : 'No se pudo guardar en el almacenamiento.',
      kind: 'error',
    });
  });

  store.bus.on('open-settings', (tab) => openSettings(tab || 'look'));
  store.bus.on('open-gallery', () => openGallery());
  store.bus.on('open-widget-settings', ({ id }) => {
    const inst = getInstance(id);
    if (inst?.api?.openSettings) inst.api.openSettings();
    else openSettings('widgets');
  });

  showFirstRunHint();
  document.body.classList.add('is-ready');
  if (!IS_EXTENSION) {
    console.info('[nuevapestana] fuera de una extensión: se usa localStorage como respaldo.');
  }
}

/** Calcula luminancia y proxy de refracción si faltan (fondos antiguos). */
async function backfillWallpaperMetrics() {
  const wp = store.getWallpaper();
  if (!wp) return;
  const s = store.getState().settings;
  if (typeof s.wallpaperLum === 'number' && typeof s.wallpaperLumHero === 'number' && s.wallpaperProxy) return;
  try {
    const { averageLuminance, heroLuminance, makeRefractionProxy } = await import('./core/image.js');
    if (typeof s.wallpaperLum !== 'number') {
      store.setSetting('wallpaperLum', await averageLuminance(wp), { silent: true });
    }
    if (typeof s.wallpaperLumHero !== 'number') {
      store.setSetting('wallpaperLumHero', await heroLuminance(wp), { silent: true });
    }
    if (!s.wallpaperProxy) {
      store.setSetting('wallpaperProxy', await makeRefractionProxy(wp), { silent: true });
    }
    applyWallpaper();
    applyContrast();
  } catch (e) {
    console.warn('[nuevapestana] no se pudieron medir los colores del fondo:', e);
  }
}

/**
 * Al no haber barra de herramientas, la primera vez avisamos de dónde está todo.
 * Se muestra una sola vez y se recuerda en el estado.
 */
function showFirstRunHint() {
  if (store.getState().settings.hintSeen) return;
  setTimeout(() => {
    toast({ message: 'Clic derecho en el fondo para widgets, ajustes y modo minimalista.', ms: 7000 });
    store.setSetting('hintSeen', true);
  }, 900);
}

/* ---------------------- menú del escritorio (clic derecho) ---------------------- */

/**
 * Toda la configuración vive aquí: no hay barra de herramientas. Clic derecho
 * (o pulsación larga en táctil) sobre el fondo vacío. Los widgets, accesos y
 * elementos del dock tienen su propio menú y no llegan hasta aquí.
 */
function installDesktopMenu() {
  const isBackground = (target) => !target.closest(
    '.widget, .dock, .hero__searchwrap, .panel, .overlay, .ctxmenu, .minimal__goal',
  );

  document.addEventListener('contextmenu', (ev) => {
    if (!isBackground(ev.target)) return;
    ev.preventDefault();
    openMenu({ x: ev.clientX, y: ev.clientY }, desktopItems(ev));
  });

  // Pulsación larga en táctil, donde no hay clic derecho.
  let timer = null;
  document.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch' || !isBackground(ev.target)) return;
    timer = setTimeout(() => openMenu({ x: ev.clientX, y: ev.clientY }, desktopItems(ev)), 520);
  });
  for (const type of ['pointerup', 'pointermove', 'pointercancel']) {
    document.addEventListener(type, () => clearTimeout(timer));
  }
}

function desktopItems() {
  const minimal = store.getState().settings.minimal;
  return [
    { label: 'Añadir widget', icon: 'plus', run: () => openGallery() },
    { label: 'Añadir favorito', icon: 'star', run: () => promptFavorite() },
    'sep',
    {
      label: minimal ? 'Salir del modo minimalista' : 'Modo minimalista',
      icon: 'minimal',
      run: () => setMinimal(!minimal),
    },
    { label: 'Buscar', icon: 'search', run: () => focusSearch('') },
    'sep',
    { label: 'Ajustes', icon: 'gear', run: () => openSettings('look') },
  ];
}

/** Diálogo mínimo para crear un favorito (icono de app en la pantalla). */
function promptFavorite() {
  const url = h('input', { class: 'input', type: 'url', placeholder: 'https://ejemplo.com' });
  const title = h('input', { class: 'input', type: 'text', placeholder: 'Nombre (opcional)' });
  const dialog = h('div', { class: 'overlay' },
    h('form', { class: 'minidialog' },
      h('h3', {}, 'Añadir favorito'),
      h('div', { class: 'field' }, h('label', {}, 'Dirección'), url),
      h('div', { class: 'field' }, h('label', {}, 'Nombre'), title),
      h('div', { class: 'row-end' },
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => dialog.remove() }, 'Cancelar'),
        h('button', { class: 'btn btn--primary', type: 'submit' }, 'Añadir'),
      ),
    ),
  );
  dialog.querySelector('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    let value = url.value.trim();
    if (!value) return;
    if (!/^[a-z]+:\/\//i.test(value)) value = `https://${value}`;
    try { new URL(value); } catch { url.focus(); return; }
    store.bus.emit('add-app-widget', { title: title.value.trim(), url: value });
    dialog.remove();
  });
  dialog.addEventListener('pointerdown', (ev) => { if (ev.target === dialog) dialog.remove(); });
  document.body.append(dialog);
  setTimeout(() => url.focus(), 30);
}

/* --------------------------------- toasts --------------------------------- */

let toastRoot = null;

export function toast({ message, kind = '', ms = 3200 }) {
  if (!toastRoot) {
    toastRoot = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(toastRoot);
  }
  const el = h('div', { class: `toast${kind ? ` toast--${kind}` : ''}` }, message);
  toastRoot.append(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 240);
  }, ms);
}

function installToasts() {
  store.bus.on('toast', toast);
}

/* -------------------------------- búsqueda -------------------------------- */

function installSearch() {
  spotlight.installShortcuts();
  spotlight.setActions(() => {
    const st = store.getState().settings;
    return [
      { title: 'Abrir ajustes', keywords: 'configuración preferencias', glyph: 'gear', run: () => openSettings('look') },
      { title: 'Cambiar a tema claro', keywords: 'tema light claro', glyph: 'sun', run: async () => { store.setSetting('theme', 'light'); applyTheme('light'); applyContrast(); await refreshAccent(); } },
      { title: 'Cambiar a tema oscuro', keywords: 'tema dark oscuro noche', glyph: 'moon', run: async () => { store.setSetting('theme', 'dark'); applyTheme('dark'); applyContrast(); await refreshAccent(); } },
      { title: 'Seguir el tema del sistema', keywords: 'tema sistema auto', glyph: 'desktop', run: async () => { store.setSetting('theme', 'system'); applyTheme('system'); applyContrast(); await refreshAccent(); } },
      { title: st.minimal ? 'Salir del modo minimalista' : 'Activar modo minimalista', keywords: 'minimal zen foco', glyph: 'minimal', run: () => setMinimal(!st.minimal) },
      { title: 'Cambiar fondo', keywords: 'wallpaper foto imagen fondo acento color', glyph: 'image', run: () => openSettings('look') },
      { title: 'Ajustar el vidrio de los widgets', keywords: 'opacidad transparencia cristal desenfoque blur', glyph: 'grid', run: () => openSettings('look') },
      { title: 'Configurar el dock', keywords: 'dock barra inferior iconos', glyph: 'wapp', run: () => openSettings('dock') },
      { title: 'Añadir un widget', keywords: 'widget galería añadir nuevo', glyph: 'plus', run: () => openGallery() },
      { title: 'Añadir un favorito', keywords: 'icono app acceso enlace marcador', glyph: 'star', run: () => promptFavorite() },
      { title: 'Exportar configuración', keywords: 'backup json copia seguridad', glyph: 'download', run: () => openSettings('data') },
      { title: 'Importar configuración', keywords: 'restaurar json backup', glyph: 'upload', run: () => openSettings('data') },
      { title: 'Marcadores y sincronización', keywords: 'bookmarks sync permisos', glyph: 'link', run: () => openSettings('links') },
    ];
  });
}

/* -------------------------- atajos globales de teclado -------------------------- */

function installShortcuts() {
  window.addEventListener('keydown', (ev) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.isContentEditable;
    if (typing || spotlight.isOpen()) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

    if (ev.key === 'm') { closeMenu(); toggleMinimal(); }
    else if (ev.key === ',') { ev.preventDefault(); openSettings('look'); }
  });
}

boot().catch((e) => {
  console.error('[nuevapestana] fallo al arrancar:', e);
  showFirstRunHint();
  document.body.classList.add('is-ready');
  const app = document.querySelector('.app');
  app?.append(h('div', { class: 'boot-error' },
    h('h2', {}, 'No se pudo iniciar'),
    h('p', { class: 'faint' }, String(e?.message || e)),
    h('button', { class: 'btn', onClick: () => location.reload() }, 'Recargar'),
  ));
});
