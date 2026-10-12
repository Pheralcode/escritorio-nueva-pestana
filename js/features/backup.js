/**
 * Exportar / importar toda la configuración como JSON.
 *
 * El fichero incluye el wallpaper (dataURL), así que restaurar en otro
 * dispositivo deja el dashboard exactamente igual. Todo local: se descarga
 * con un <a download> y se lee con <input type="file">. Nada sale a la red.
 */

import * as store from '../core/store.js';
import { SCHEMA_VERSION, withDefaults, migrate } from '../core/state.js';

export function buildBackup() {
  return {
    app: 'newtab-desktop',
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state: store.getState(),
    wallpaper: store.getWallpaper(),
  };
}

export function exportToFile() {
  const data = buildBackup();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `escritorio-backup-${stamp}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return json.length;
}

/** Valida la forma del backup antes de tocar nada. */
export function validateBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('El archivo no contiene un objeto JSON.');
  if (data.app && data.app !== 'newtab-desktop') throw new Error(`El backup es de otra app (${data.app}).`);
  const state = data.state || data; // toleramos un state “pelado”
  if (!state || typeof state !== 'object') throw new Error('Falta el bloque de estado.');
  if (!Array.isArray(state.layout)) throw new Error('El estado no tiene un layout válido.');
  if (typeof state.settings !== 'object' || state.settings == null) throw new Error('El estado no tiene ajustes.');
  const wp = data.wallpaper;
  if (wp != null && (typeof wp !== 'string' || !wp.startsWith('data:image/'))) {
    throw new Error('El wallpaper del backup no es una imagen válida.');
  }
  return { state, wallpaper: wp ?? null };
}

export async function importFromText(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('El archivo no es JSON válido.'); }

  const { state, wallpaper } = validateBackup(parsed);
  const clean = withDefaults(migrate(state));

  store.update(() => clean, { immediate: true });
  await store.setWallpaper(wallpaper);
  await store.flush(true);
  return clean;
}

export function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => resolve(input.files?.[0] || null));
    // Safari/WebKit exige que el input esté en el DOM para abrir el diálogo.
    input.style.display = 'none';
    document.body.append(input);
    input.click();
    setTimeout(() => input.remove(), 60000);
  });
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error || new Error('No se pudo leer el archivo.'));
    fr.readAsText(file);
  });
}
