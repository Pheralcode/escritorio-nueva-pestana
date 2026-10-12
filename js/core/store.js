/**
 * Store: única fuente de verdad en memoria, persistida en chrome.storage.local.
 *
 *  - Escrituras con debounce (250 ms) para no castigar el storage al teclear.
 *  - El wallpaper vive en su propia clave: no se reescribe con cada cambio de estado.
 *  - Espejo opcional en localStorage SOLO para el primer pintado (tema/acento/wallpaper).
 *    No es fuente de verdad: se reconstruye desde chrome.storage.local en cada arranque.
 */

import { storage, detectApiStyle } from './compat.js';
import { createEmitter } from './events.js';
import { KEYS, defaultState, starterState, withDefaults, migrate } from './state.js';

const WRITE_DEBOUNCE = 250;
const FP_KEY = 'pt.firstPaint';

export const bus = createEmitter();

let state = defaultState();
let wallpaper = null;         // dataURL o null
let writeTimer = null;
let pendingWallpaper = false;
let suppressExternal = false; // evita re-entrar al aplicar nuestros propios cambios

export function getState() { return state; }
export function getWallpaper() { return wallpaper; }

export async function init() {
  await detectApiStyle();
  const data = await storage.get([KEYS.state, KEYS.wallpaper]);
  const raw = data?.[KEYS.state];
  state = raw ? withDefaults(migrate(raw)) : starterState();
  wallpaper = typeof data?.[KEYS.wallpaper] === 'string' ? data[KEYS.wallpaper] : null;
  if (!raw) await flush(true); // primera vez: persistimos el estado inicial

  // Cambios hechos en otra pestaña abierta.
  storage.onChanged((changes) => {
    if (suppressExternal) return;
    if (changes[KEYS.state]) {
      state = withDefaults(changes[KEYS.state].newValue);
      bus.emit('external-change', state);
    }
    if (changes[KEYS.wallpaper]) {
      wallpaper = changes[KEYS.wallpaper].newValue ?? null;
      bus.emit('wallpaper', wallpaper);
    }
  });

  syncFirstPaintCache();
  return state;
}

/**
 * Aplica un cambio. `mutator` recibe el estado (mutable) y opcionalmente devuelve
 * uno nuevo. Emite 'change' y persiste con debounce.
 */
export function update(mutator, { silent = false, immediate = false } = {}) {
  const next = mutator(state);
  if (next && typeof next === 'object') state = next;
  if (!silent) bus.emit('change', state);
  syncFirstPaintCache();
  schedule(immediate);
  return state;
}

export function setSetting(key, value, opts) {
  return update((s) => { s.settings[key] = value; }, opts);
}

export function setWidgetConfig(id, patch, opts) {
  return update((s) => {
    s.widgets[id] = { ...(s.widgets[id] || {}), ...patch };
  }, opts);
}

export async function setWallpaper(dataUrl) {
  wallpaper = dataUrl || null;
  pendingWallpaper = true;
  bus.emit('wallpaper', wallpaper);
  syncFirstPaintCache();
  await flush(true);
}

function schedule(immediate) {
  if (writeTimer) clearTimeout(writeTimer);
  if (immediate) { flush(); return; }
  writeTimer = setTimeout(() => flush(), WRITE_DEBOUNCE);
}

export async function flush(force = false) {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  const payload = { [KEYS.state]: state };
  if (pendingWallpaper || force) {
    payload[KEYS.wallpaper] = wallpaper;
    pendingWallpaper = false;
  }
  suppressExternal = true;
  try {
    await storage.set(payload);
  } catch (e) {
    bus.emit('storage-error', e);
  } finally {
    // Damos un tick para que el evento onChanged propio no se confunda con externo.
    setTimeout(() => { suppressExternal = false; }, 50);
  }
}

/** Persistimos antes de que la pestaña se cierre. */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { if (writeTimer) flush(); });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && writeTimer) flush();
  });
}

/* ---------- espejo de primer pintado (no es fuente de verdad) ---------- */

function syncFirstPaintCache() {
  try {
    if (!state.settings.firstPaintCache) { localStorage.removeItem(FP_KEY); return; }
    localStorage.setItem(FP_KEY, JSON.stringify({
      theme: state.settings.theme,
      accent: state.settings.accent,
      minimal: state.settings.minimal,
      glass: state.settings.glass,
      dock: !!state.dock?.enabled,
      contrast: document.documentElement.classList.contains('wp-light') ? 'light'
        : document.documentElement.classList.contains('wp-dark') ? 'dark' : null,
      heroContrast: document.documentElement.classList.contains('hero-light') ? 'light'
        : document.documentElement.classList.contains('hero-dark') ? 'dark' : null,
      wp: state.settings.wallpaper.enabled ? wallpaper : null,
      dim: state.settings.wallpaper.dim,
      blur: state.settings.wallpaper.blur,
    }));
  } catch { /* quota o modo privado: no pasa nada, se pinta 1 frame más tarde */ }
}

/* ---------- caché efímera (clima, RSS) ---------- */

export async function readCache(key) {
  const data = await storage.get(KEYS.cache);
  return data?.[KEYS.cache]?.[key] ?? null;
}

export async function writeCache(key, value) {
  const data = await storage.get(KEYS.cache);
  const cache = data?.[KEYS.cache] || {};
  cache[key] = value;
  await storage.set({ [KEYS.cache]: cache });
}
