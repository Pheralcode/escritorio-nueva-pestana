/**
 * Service worker MV3 — deliberadamente mínimo.
 *
 * NADA esencial vive aquí: en MV3 el worker se duerme y Orion no garantiza
 * service workers persistentes. El dashboard funciona igual si este archivo
 * nunca llega a ejecutarse. Solo se usa para dos detalles de cortesía.
 *
 * Se escribe en JS clásico (sin `import`) porque el soporte de module service
 * workers no es uniforme entre Chrome y las capas de compatibilidad de WebKit.
 */

/* global chrome, browser */
var api = (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

if (api && api.runtime && api.runtime.onInstalled) {
  api.runtime.onInstalled.addListener(function (details) {
    if (details && details.reason === 'install') {
      try {
        // Marca de primera instalación; el dashboard la usa solo si existe.
        api.storage.local.set({ 'pt.installedAt': Date.now() });
      } catch (e) { /* si el storage falla, no pasa nada */ }
    }
  });
}

// Clic en el icono cuando no hay popup disponible (algunos navegadores).
if (api && api.action && api.action.onClicked) {
  api.action.onClicked.addListener(function () {
    try {
      api.tabs.create({ url: api.runtime.getURL('newtab.html') });
    } catch (e) { /* noop */ }
  });
}
