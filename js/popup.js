/** Popup del icono de la barra: acceso rápido al dashboard y al backup. */
import * as store from './core/store.js';
import { exportToFile } from './features/backup.js';
import { applyTheme, applyAccent } from './core/theme.js';

const NEWTAB = 'newtab.html';

document.getElementById('open').addEventListener('click', () => {
  const ext = globalThis.browser ?? globalThis.chrome;
  const url = ext?.runtime?.getURL ? ext.runtime.getURL(NEWTAB) : NEWTAB;
  if (ext?.tabs?.create) ext.tabs.create({ url });
  else window.open(url, '_blank');
  window.close?.();
});

document.getElementById('export').addEventListener('click', async () => {
  await store.init();
  exportToFile();
});

store.init().then(() => {
  const s = store.getState().settings;
  applyTheme(s.theme);
  applyAccent(s.accent);
});
