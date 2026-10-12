/**
 * Registro de widgets.
 *
 * Cada widget es un módulo independiente que exporta por defecto un objeto:
 *
 *   export default {
 *     type: 'clock',
 *     name: 'Reloj',
 *     description: '...',
 *     sizes: ['sm','md','lg'],      // tamaños permitidos
 *     defaultSize: 'md',
 *     defaultConfig: { ... },
 *     settings: [ {key,label,type,...} ],   // esquema del formulario (opcional)
 *     create(ctx) -> { el, destroy?(), onResize?(size), onConfig?(config) }
 *   }
 *
 * `ctx` = { id, config, setConfig(patch), size, store, bus, requestRender() }
 *
 * Para añadir un widget nuevo: crear js/widgets/mi-widget.js y registrarlo en
 * la lista `MODULES` de abajo. Nada más.
 */

const MODULES = [
  () => import('../widgets/weather.js'),
  () => import('../widgets/notes.js'),
  () => import('../widgets/timer.js'),
  () => import('../widgets/bookmarks.js'),
  () => import('../widgets/rss.js'),
  () => import('../widgets/tasks.js'),
  () => import('../widgets/calendar.js'),
  () => import('../widgets/worldclock.js'),
  () => import('../widgets/countdown.js'),
  () => import('../widgets/calculator.js'),
  () => import('../widgets/habits.js'),
  () => import('../widgets/app.js'),
];

const registry = new Map();
let loaded = false;

export async function loadWidgets() {
  if (loaded) return registry;
  const mods = await Promise.all(MODULES.map((load) => load().catch((e) => {
    console.error('[nuevapestana] no se pudo cargar un widget:', e);
    return null;
  })));
  for (const mod of mods) {
    const def = mod?.default;
    if (!def || !def.type || typeof def.create !== 'function') continue;
    registry.set(def.type, {
      sizes: ['sm', 'md', 'lg'],
      defaultSize: 'md',
      defaultConfig: {},
      settings: [],
      ...def,
    });
  }
  loaded = true;
  return registry;
}

export function getWidget(type) { return registry.get(type) || null; }
export function allWidgets() { return [...registry.values()]; }
