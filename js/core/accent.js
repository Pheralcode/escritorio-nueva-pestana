/**
 * Color de acento automático.
 *
 * Ya no se elige a mano: se extrae del fondo. Se recalcula cuando cambia el
 * wallpaper y cuando cambia el tema (un acento que funciona sobre oscuro suele
 * quedar lavado sobre claro, así que la luminosidad se ajusta al tema activo).
 * El valor calculado se guarda en `settings.accent` como caché, para que el
 * primer pintado no tenga que volver a analizar la imagen.
 */

import { extractAccent } from './image.js';
import { applyAccent, resolvedTheme } from './theme.js';
import * as store from './store.js';

const FALLBACK_DARK = '#6d7dfc';
const FALLBACK_LIGHT = '#4b57d8';

let running = null;

export async function refreshAccent({ silent = false } = {}) {
  if (running) return running;
  running = (async () => {
    // Si el usuario fijó un color a mano, mandan sus preferencias.
    if (store.getState().settings.accentAuto === false) {
      applyAccent(store.getState().settings.accent);
      return store.getState().settings.accent;
    }
    const dark = resolvedTheme() === 'dark';
    const wallpaper = store.getWallpaper();
    let hex = null;
    if (wallpaper && store.getState().settings.wallpaper.enabled) {
      try { hex = await extractAccent(wallpaper, { dark }); }
      catch (e) { console.warn('[nuevapestana] no se pudo leer el color del fondo:', e); }
    }
    if (!hex) hex = dark ? FALLBACK_DARK : FALLBACK_LIGHT;
    applyAccent(hex);
    store.setSetting('accent', hex, { silent });
    return hex;
  })();
  try { return await running; } finally { running = null; }
}

/** Fija un acento manual y desactiva el automático. */
export function setManualAccent(hex) {
  store.update((s) => {
    s.settings.accentAuto = false;
    s.settings.accent = hex;
  });
  applyAccent(hex);
}

/** Vuelve al acento automático y lo recalcula desde el fondo. */
export async function useAutoAccent() {
  store.setSetting('accentAuto', true);
  return refreshAccent();
}

/** Aplica el acento cacheado sin analizar nada (arranque instantáneo). */
export function applyCachedAccent() {
  applyAccent(store.getState().settings.accent || FALLBACK_DARK);
}
