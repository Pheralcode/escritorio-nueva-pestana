/**
 * Capa de compatibilidad de APIs de extensión.
 *
 * Objetivo: que el mismo código corra en Chrome/Edge (MV3) y en Orion (WebKit),
 * donde parte de la superficie MV3 no existe o se comporta distinto.
 *
 * Reglas:
 *  - Nunca asumimos que una API existe: todo pasa por `has()`.
 *  - Nunca asumimos promesas: detectamos una vez y cacheamos el estilo de llamada.
 *  - Si algo falta, la función se degrada en silencio (devuelve null / no-op),
 *    nunca lanza y nunca rompe el arranque del dashboard.
 */

export const ext = globalThis.browser ?? globalThis.chrome ?? null;

/** ¿Estamos realmente dentro de una extensión (y no en un file:// de prueba)? */
export const IS_EXTENSION = !!(ext && ext.runtime && ext.runtime.id);

/** Comprueba una ruta tipo "bookmarks.onCreated" sobre el namespace de extensión. */
export function has(path) {
  if (!ext) return false;
  let node = ext;
  for (const part of path.split('.')) {
    if (node == null || typeof node !== 'object' || !(part in node)) return false;
    node = node[part];
  }
  return node != null;
}

/* ------------------------------------------------------------------ *
 * Promesas vs callbacks
 * ------------------------------------------------------------------ */

let promiseStyle = null; // null = sin detectar, true = promesas, false = callbacks

/**
 * Detecta una sola vez si `storage.local.get` devuelve promesa.
 * Se usa una lectura (idempotente) para no arriesgar dobles escrituras.
 */
export async function detectApiStyle() {
  if (promiseStyle !== null) return promiseStyle;
  if (!has('storage.local.get')) { promiseStyle = true; return promiseStyle; }
  try {
    const ret = ext.storage.local.get(null);
    if (ret && typeof ret.then === 'function') {
      await ret;
      promiseStyle = true;
    } else {
      promiseStyle = false;
    }
  } catch {
    promiseStyle = false;
  }
  return promiseStyle;
}

/**
 * Invoca `fn` (método de la API) resolviendo promesa o callback según el estilo
 * detectado. Rechaza con runtime.lastError si aplica.
 */
export function call(thisArg, fn, ...args) {
  return new Promise((resolve, reject) => {
    const done = (value) => {
      const err = ext?.runtime?.lastError;
      if (err) reject(new Error(err.message || String(err)));
      else resolve(value);
    };
    try {
      if (promiseStyle === false) {
        fn.call(thisArg, ...args, done);
        return;
      }
      const ret = fn.call(thisArg, ...args);
      if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
      else if (promiseStyle === null) fn.call(thisArg, ...args, done); // sin detectar aún
      else resolve(ret);
    } catch (e) {
      reject(e);
    }
  });
}

/* ------------------------------------------------------------------ *
 * storage.local (única fuente de verdad; nunca storage.sync)
 * ------------------------------------------------------------------ */

/**
 * Respaldo fuera de una extensión (p. ej. GitHub Pages): IndexedDB, no
 * localStorage. localStorage corta en ~5 MB y un fondo de pantalla ya no cabe;
 * IndexedDB admite cientos de MB.
 * ponytail: sin migración desde localStorage; solo aplica a la versión web.
 */
const openDb = () => new Promise((res, rej) => {
  const r = indexedDB.open('nueva-pestana', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

const idbTx = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('kv', mode);
    const out = {};
    fn(t.objectStore('kv'), out);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
};

const memoryStore = {
  get: (keys) => idbTx('readonly', (s, out) => {
    const read = (list) => list.forEach((k) => {
      s.get(k).onsuccess = (e) => { if (e.target.result !== undefined) out[k] = e.target.result; };
    });
    if (keys == null) s.getAllKeys().onsuccess = (e) => read(e.target.result);
    else read([].concat(keys));
  }),
  set: (obj) => idbTx('readwrite', (s) => Object.entries(obj).forEach(([k, v]) => s.put(v, k))).then(() => {}),
  remove: (keys) => idbTx('readwrite', (s) => [].concat(keys).forEach((k) => s.delete(k))).then(() => {}),
};

export const storage = {
  available: () => has('storage.local.get'),

  async get(keys) {
    if (!has('storage.local.get')) return memoryStore.get(keys);
    try {
      return (await call(ext.storage.local, ext.storage.local.get, keys)) || {};
    } catch (e) {
      console.warn('[nuevapestana] storage.get falló, uso fallback local:', e);
      return memoryStore.get(keys);
    }
  },

  async set(obj) {
    if (!has('storage.local.set')) return memoryStore.set(obj);
    try {
      await call(ext.storage.local, ext.storage.local.set, obj);
    } catch (e) {
      console.warn('[nuevapestana] storage.set falló:', e);
      throw e;
    }
  },

  async remove(keys) {
    if (!has('storage.local.remove')) return memoryStore.remove(keys);
    try {
      await call(ext.storage.local, ext.storage.local.remove, keys);
    } catch (e) {
      console.warn('[nuevapestana] storage.remove falló:', e);
    }
  },

  /** Bytes usados; -1 si el navegador no lo expone (Orion no siempre lo hace). */
  async bytesInUse() {
    if (!has('storage.local.getBytesInUse')) return -1;
    try {
      const n = await call(ext.storage.local, ext.storage.local.getBytesInUse, null);
      return typeof n === 'number' ? n : -1;
    } catch { return -1; }
  },

  /** Suscribe cambios entre pestañas. Devuelve función para desuscribir. */
  onChanged(handler) {
    if (!has('storage.onChanged.addListener')) return () => {};
    const wrapped = (changes, area) => { if (area === 'local') handler(changes); };
    ext.storage.onChanged.addListener(wrapped);
    return () => { try { ext.storage.onChanged.removeListener(wrapped); } catch { /* noop */ } };
  },
};

/* ------------------------------------------------------------------ *
 * permissions (opcional: Orion puede no implementarlo)
 * ------------------------------------------------------------------ */

export const permissions = {
  supported: () => has('permissions.request') && has('permissions.contains'),

  async contains(perm) {
    if (!has('permissions.contains')) return false;
    try { return !!(await call(ext.permissions, ext.permissions.contains, perm)); }
    catch { return false; }
  },

  /** Debe llamarse dentro de un gesto de usuario. Devuelve false si no se puede. */
  async request(perm) {
    if (!has('permissions.request')) return false;
    try { return !!(await call(ext.permissions, ext.permissions.request, perm)); }
    catch (e) { console.warn('[nuevapestana] permissions.request falló:', e); return false; }
  },

  async remove(perm) {
    if (!has('permissions.remove')) return false;
    try { return !!(await call(ext.permissions, ext.permissions.remove, perm)); }
    catch { return false; }
  },
};

/* ------------------------------------------------------------------ *
 * bookmarks (opcional)
 * ------------------------------------------------------------------ */

export const bookmarksApi = {
  /** ¿Existe el objeto? (aunque falte el permiso concedido) */
  supported: () => has('bookmarks.getTree') && has('bookmarks.create'),

  /** ¿Existe Y podemos usarlo ahora mismo? */
  async usable() {
    if (!bookmarksApi.supported()) return false;
    try { await call(ext.bookmarks, ext.bookmarks.getTree); return true; }
    catch { return false; }
  },

  getTree: () => call(ext.bookmarks, ext.bookmarks.getTree),
  getChildren: (id) => call(ext.bookmarks, ext.bookmarks.getChildren, id),
  search: (q) => call(ext.bookmarks, ext.bookmarks.search, q),
  create: (b) => call(ext.bookmarks, ext.bookmarks.create, b),
  update: (id, changes) => call(ext.bookmarks, ext.bookmarks.update, id, changes),
  remove: (id) => call(ext.bookmarks, ext.bookmarks.remove, id),
  removeTree: (id) => call(ext.bookmarks, ext.bookmarks.removeTree, id),

  on(event, handler) {
    if (!has(`bookmarks.${event}.addListener`)) return () => {};
    ext.bookmarks[event].addListener(handler);
    return () => { try { ext.bookmarks[event].removeListener(handler); } catch { /* noop */ } };
  },
};

/* ------------------------------------------------------------------ *
 * Utilidades varias
 * ------------------------------------------------------------------ */

export function runtimeUrl(path) {
  if (has('runtime.getURL')) { try { return ext.runtime.getURL(path); } catch { /* noop */ } }
  return path;
}

/** Informe de capacidades, útil para el panel de diagnóstico del README. */
export function capabilities() {
  return {
    isExtension: IS_EXTENSION,
    storageLocal: has('storage.local.get'),
    storageOnChanged: has('storage.onChanged.addListener'),
    permissions: permissions.supported(),
    bookmarks: bookmarksApi.supported(),
    offscreen: has('offscreen.createDocument'),
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    workers: typeof Worker !== 'undefined',
    createImageBitmap: typeof createImageBitmap === 'function',
    promiseStyle,
  };
}
