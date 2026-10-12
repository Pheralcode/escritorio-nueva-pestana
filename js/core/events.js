/** Emisor de eventos mínimo (sin dependencias). */
export function createEmitter() {
  const map = new Map();
  return {
    on(event, fn) {
      if (!map.has(event)) map.set(event, new Set());
      map.get(event).add(fn);
      return () => map.get(event)?.delete(fn);
    },
    off(event, fn) { map.get(event)?.delete(fn); },
    emit(event, payload) {
      const set = map.get(event);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(payload); } catch (e) { console.error(`[nuevapestana] listener "${event}":`, e); }
      }
    },
    clear() { map.clear(); },
  };
}
