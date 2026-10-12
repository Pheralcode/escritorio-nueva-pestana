/** Estado por defecto + migraciones de esquema. */

export const SCHEMA_VERSION = 1;

/** Claves de chrome.storage.local (separadas para no reescribir el wallpaper en cada tecla). */
export const KEYS = {
  state: 'pt.state',
  wallpaper: 'pt.wallpaper',
  cache: 'pt.cache',
};

export function uid(prefix = 'w') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    settings: {
      theme: 'system',            // 'light' | 'dark' | 'system'
      accent: '#6d5efc',
      accentAuto: true,           // false = el usuario lo eligió a mano
      minimal: false,
      goal: '',
      goalDate: '',
      firstPaintCache: true,      // espejo en localStorage solo para el primer pintado
      thirdPartyFavicons: true,   // respaldo de iconos cuando el sitio no publica uno grande
      bookmarksSync: false,
      wallpaper: { enabled: true, dim: 0.35, blur: 0 },
      wallpaperProxy: null,       // copia diminuta del fondo para la refracción
      wallpaperLum: null,         // luminancia media del fondo (contraste del texto)
      wallpaperLumHero: null,     // luminancia de la franja donde va el reloj
      glass: { opacity: 0.62, blur: 18, saturation: 180 },
      hintSeen: false,          // pista de "clic derecho" mostrada una sola vez
      clock: { seconds: false, hour24: true, font: 'system', weight: 250, transparency: 0 },
    },
    /** Dock inferior estilo macOS (independiente de los accesos del widget). */
    dock: { enabled: true, magnify: true, size: 52, items: [] },
    /** Orden de render del grid. */
    layout: [],
    /** Config/datos por instancia de widget: { [id]: {...} } */
    widgets: {},
    /** Accesos directos del dashboard (espejo opcional de chrome.bookmarks). */
    shortcuts: [],
    /** Iconos de alta resolución ya resueltos: { host: { url, at } } */
    faviconCache: {},
  };
}

export function starterState() {
  const s = defaultState();
  const mk = (type, size, config = {}) => {
    const id = uid(type);
    s.layout.push({ id, type, size });
    s.widgets[id] = config;
    return id;
  };
  mk('weather', 'sm');
  mk('notes', 'md');
  mk('timer', 'sm');
  mk('bookmarks', 'lg');
  s.shortcuts = [
    { id: uid('sc'), title: 'GitHub', url: 'https://github.com' },
    { id: uid('sc'), title: 'Wikipedia', url: 'https://es.wikipedia.org' },
    { id: uid('sc'), title: 'Open-Meteo', url: 'https://open-meteo.com' },
  ];
  s.dock.items = [
    { id: uid('dk'), title: 'GitHub', url: 'https://github.com' },
    { id: uid('dk'), title: 'Wikipedia', url: 'https://es.wikipedia.org' },
  ];
  return s;
}

/** Fusión profunda y tolerante: rellena huecos sin pisar lo que el usuario ya tiene. */
export function withDefaults(loaded) {
  const base = defaultState();
  if (!loaded || typeof loaded !== 'object') return starterState();
  const out = {
    ...base,
    ...loaded,
    settings: { ...base.settings, ...(loaded.settings || {}) },
    widgets: { ...(loaded.widgets || {}) },
    layout: Array.isArray(loaded.layout) ? loaded.layout : base.layout,
    shortcuts: Array.isArray(loaded.shortcuts) ? loaded.shortcuts : base.shortcuts,
  };
  out.settings.wallpaper = { ...base.settings.wallpaper, ...((loaded.settings || {}).wallpaper || {}) };
  out.settings.glass = { ...base.settings.glass, ...((loaded.settings || {}).glass || {}) };
  out.settings.clock = { ...base.settings.clock, ...((loaded.settings || {}).clock || {}) };
  out.faviconCache = (loaded.faviconCache && typeof loaded.faviconCache === 'object') ? loaded.faviconCache : {};
  out.dock = { ...base.dock, ...(loaded.dock || {}) };
  out.dock.items = Array.isArray(out.dock.items)
    ? out.dock.items.filter((i) => i && typeof i.url === 'string')
    : [];
  // Saneado del layout: descarta entradas corruptas y garantiza un size válido.
  const valid = new Set(['xs', 'sm', 'md', 'lg']);
  out.layout = out.layout
    .filter((it) => it && typeof it.id === 'string' && typeof it.type === 'string')
    .map((it) => ({ id: it.id, type: it.type, size: valid.has(it.size) ? it.size : 'md' }));
  return out;
}

/** Tipos de widget retirados: se limpian del layout al cargar. */
const RETIRED = new Set(['clock']);

/** Punto único para migraciones entre versiones de esquema. */
export function migrate(loaded) {
  if (!loaded) return null;
  const s = loaded;
  // El reloj dejó de ser un widget: ahora es la cabecera fija de la página.
  if (Array.isArray(s.layout)) {
    const dropped = s.layout.filter((it) => RETIRED.has(it?.type));
    if (dropped.length) {
      s.layout = s.layout.filter((it) => !RETIRED.has(it?.type));
      for (const it of dropped) delete s.widgets?.[it.id];
    }
  }
  s.version = SCHEMA_VERSION;
  return s;
}
