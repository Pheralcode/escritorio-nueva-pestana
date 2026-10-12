/**
 * Sincronización bidireccional entre los accesos del dashboard y los marcadores
 * nativos del navegador.
 *
 * Modelo: una carpeta "Escritorio" en los marcadores. Sus hijos directos son el
 * espejo de `state.shortcuts`. Cada acceso guarda `bookmarkId` para poder
 * emparejar en ambos sentidos.
 *
 * Puntos delicados:
 *  - Bucles de eco: cuando nosotros escribimos en chrome.bookmarks, los
 *    listeners se disparan. Un contador `mutating` los ignora durante nuestras
 *    propias operaciones.
 *  - Orion: si `chrome.bookmarks` o `chrome.permissions` no existen, este módulo
 *    NUNCA se activa y la UI oculta la opción. El resto del dashboard funciona igual.
 */

import { bookmarksApi, permissions } from '../core/compat.js';
import * as store from '../core/store.js';
import { uid } from '../core/state.js';
import { hostOf } from '../core/favicon.js';

const FOLDER_TITLE = 'Escritorio';
const PERM = { permissions: ['bookmarks'] };

let folderId = null;
let unsubs = [];
let mutating = 0;
let active = false;

export function isSupported() {
  return bookmarksApi.supported();
}

export async function hasPermission() {
  if (!bookmarksApi.supported()) return false;
  if (!permissions.supported()) return bookmarksApi.usable(); // Orion podría concederlo de fábrica
  return permissions.contains(PERM);
}

/** Debe llamarse desde un gesto del usuario (click en el interruptor). */
export async function requestPermission() {
  if (!bookmarksApi.supported()) return false;
  if (!permissions.supported()) return bookmarksApi.usable();
  const granted = await permissions.request(PERM);
  if (!granted) return false;
  return bookmarksApi.usable();
}

export async function revokePermission() {
  stop();
  if (permissions.supported()) await permissions.remove(PERM);
}

/* ------------------------------ carpeta espejo ------------------------------ */

function findFolder(nodes) {
  for (const node of nodes || []) {
    if (!node.url && node.title === FOLDER_TITLE) return node;
    const found = findFolder(node.children);
    if (found) return found;
  }
  return null;
}

async function ensureFolder() {
  const tree = await bookmarksApi.getTree();
  const existing = findFolder(tree);
  if (existing) return existing.id;

  // Contenedor donde crearla: preferimos "Otros marcadores".
  const roots = tree?.[0]?.children || [];
  const other = roots.find((n) => n.id === '2') || roots[roots.length - 1] || roots[0];
  mutating++;
  try {
    const created = await bookmarksApi.create({ parentId: other?.id, title: FOLDER_TITLE });
    return created.id;
  } finally {
    setTimeout(() => { mutating = Math.max(0, mutating - 1); }, 0);
  }
}

/* -------------------------------- reconciliar -------------------------------- */

/**
 * Fusión inicial: lo que hay en el dashboard sube al navegador y lo que hay en
 * la carpeta baja al dashboard. Empareja por bookmarkId y, si falta, por URL.
 */
export async function reconcile() {
  if (!folderId) return;
  const children = await bookmarksApi.getChildren(folderId);
  const bookmarks = children.filter((c) => c.url);
  const state = store.getState();
  const shortcuts = [...(state.shortcuts || [])];

  const byId = new Map(bookmarks.map((b) => [b.id, b]));
  const byUrl = new Map(bookmarks.map((b) => [normalize(b.url), b]));
  const claimed = new Set();

  mutating++;
  try {
    // 1. Dashboard -> navegador
    for (const sc of shortcuts) {
      let bm = sc.bookmarkId ? byId.get(sc.bookmarkId) : null;
      if (!bm) bm = byUrl.get(normalize(sc.url));
      if (bm) {
        claimed.add(bm.id);
        sc.bookmarkId = bm.id;
        if (bm.title !== sc.title || normalize(bm.url) !== normalize(sc.url)) {
          await bookmarksApi.update(bm.id, { title: sc.title, url: sc.url });
        }
      } else {
        const created = await bookmarksApi.create({ parentId: folderId, title: sc.title, url: sc.url });
        sc.bookmarkId = created.id;
        claimed.add(created.id);
      }
    }

    // 2. Navegador -> dashboard (lo que no reclamó ningún acceso)
    for (const bm of bookmarks) {
      if (claimed.has(bm.id)) continue;
      shortcuts.push({
        id: uid('sc'),
        title: bm.title || hostOf(bm.url),
        url: bm.url,
        bookmarkId: bm.id,
      });
    }
  } finally {
    setTimeout(() => { mutating = Math.max(0, mutating - 1); }, 120);
  }

  store.update((s) => { s.shortcuts = shortcuts; });
  store.bus.emit('shortcuts-updated');
}

function normalize(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/$/, '')}${u.search}`.toLowerCase();
  } catch { return String(url || '').toLowerCase(); }
}

/* --------------------------------- listeners --------------------------------- */

function attachListeners() {
  const onCreated = async (id, node) => {
    if (mutating || !active || node.parentId !== folderId || !node.url) return;
    store.update((s) => {
      if (s.shortcuts.some((x) => x.bookmarkId === id)) return;
      s.shortcuts = [...s.shortcuts, {
        id: uid('sc'),
        title: node.title || hostOf(node.url),
        url: node.url,
        bookmarkId: id,
      }];
    });
    store.bus.emit('shortcuts-updated');
  };

  const onRemoved = (id, info) => {
    if (mutating || !active) return;
    if (info?.parentId && info.parentId !== folderId && id !== folderId) return;
    if (id === folderId) { // borraron la carpeta entera: desactivamos
      store.bus.emit('toast', { message: 'La carpeta «Escritorio» ya no existe: sync desactivado.', kind: 'error' });
      store.setSetting('bookmarksSync', false);
      stop();
      return;
    }
    store.update((s) => { s.shortcuts = s.shortcuts.filter((x) => x.bookmarkId !== id); });
    store.bus.emit('shortcuts-updated');
  };

  const onChanged = (id, changes) => {
    if (mutating || !active) return;
    store.update((s) => {
      const sc = s.shortcuts.find((x) => x.bookmarkId === id);
      if (!sc) return;
      if (changes.title != null) sc.title = changes.title;
      if (changes.url != null) sc.url = changes.url;
    });
    store.bus.emit('shortcuts-updated');
  };

  const onMoved = async (id, info) => {
    if (mutating || !active) return;
    if (info.newParentId === folderId) {
      // Entró en nuestra carpeta: lo tratamos como creación.
      try {
        const [node] = await bookmarksApi.getChildren(folderId).then(
          (kids) => kids.filter((k) => k.id === id));
        if (node?.url) onCreated(id, { ...node, parentId: folderId });
      } catch { /* noop */ }
    } else if (info.oldParentId === folderId) {
      onRemoved(id, { parentId: folderId });
    }
  };

  unsubs = [
    bookmarksApi.on('onCreated', onCreated),
    bookmarksApi.on('onRemoved', onRemoved),
    bookmarksApi.on('onChanged', onChanged),
    bookmarksApi.on('onMoved', onMoved),
  ];
}

/* ------------------------- cambios hechos en el dashboard ------------------------- */

async function onShortcutsChanged({ reason, item }) {
  if (!active || !folderId) return;
  mutating++;
  try {
    if (reason === 'add') {
      const created = await bookmarksApi.create({ parentId: folderId, title: item.title, url: item.url });
      store.update((s) => {
        const sc = s.shortcuts.find((x) => x.id === item.id);
        if (sc) sc.bookmarkId = created.id;
      }, { silent: true });
    } else if (reason === 'remove' && item.bookmarkId) {
      await bookmarksApi.remove(item.bookmarkId).catch(() => {});
    } else if (reason === 'update' && item.bookmarkId) {
      await bookmarksApi.update(item.bookmarkId, { title: item.title, url: item.url }).catch(() => {});
    }
  } catch (e) {
    console.warn('[nuevapestana] sync marcadores:', e);
  } finally {
    setTimeout(() => { mutating = Math.max(0, mutating - 1); }, 120);
  }
}

let offShortcuts = null;

/* ---------------------------------- ciclo ---------------------------------- */

export async function start() {
  if (active) return true;
  if (!(await hasPermission())) return false;
  try {
    folderId = await ensureFolder();
    active = true;
    attachListeners();
    offShortcuts = store.bus.on('shortcuts-changed', onShortcutsChanged);
    await reconcile();
    return true;
  } catch (e) {
    console.warn('[nuevapestana] no se pudo iniciar el sync de marcadores:', e);
    active = false;
    return false;
  }
}

export function stop() {
  active = false;
  folderId = null;
  unsubs.forEach((fn) => fn?.());
  unsubs = [];
  offShortcuts?.();
  offShortcuts = null;
}

export function isActive() { return active; }

/** Búsqueda en TODOS los marcadores del navegador (para el Spotlight). */
export async function searchAll(query) {
  if (!active && !(await hasPermission())) return [];
  try {
    const results = await bookmarksApi.search(query);
    return (results || []).filter((r) => r.url).slice(0, 30);
  } catch { return []; }
}
