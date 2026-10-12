/**
 * Puntuación difusa para el Spotlight.
 *
 * Reglas (de mayor a menor puntuación):
 *   - coincidencia exacta            → 1000
 *   - empieza por la consulta        → 900 - longitud
 *   - contiene la consulta           → 700 - posición
 *   - coincidencia por subsecuencia  → 300 + bonus por letras consecutivas
 *                                      y por caer al inicio de palabra
 * Devuelve 0 si no hay coincidencia.
 */

export function score(text, query) {
  if (!query) return 1;
  const t = String(text || '').toLowerCase();
  const q = String(query).toLowerCase().trim();
  if (!t || !q) return 0;

  if (t === q) return 1000;
  if (t.startsWith(q)) return 900 - Math.min(100, t.length);
  const idx = t.indexOf(q);
  if (idx >= 0) return 700 - Math.min(200, idx * 4) - Math.min(50, t.length / 4);

  // Subsecuencia
  let ti = 0;
  let hits = 0;
  let streak = 0;
  let bonus = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    const found = t.indexOf(ch, ti);
    if (found === -1) return 0;
    if (found === ti && ti > 0) { streak++; bonus += 8 + streak * 2; } else { streak = 0; }
    if (found === 0 || /[\s\-_./]/.test(t[found - 1] || '')) bonus += 12; // inicio de palabra
    hits++;
    ti = found + 1;
  }
  return hits === q.length ? 300 + bonus - Math.min(80, t.length / 3) : 0;
}

/** Mejor puntuación entre varios campos, con pesos. */
export function scoreFields(fields, query) {
  let best = 0;
  for (const [text, weight = 1] of fields) {
    const s = score(text, query) * weight;
    if (s > best) best = s;
  }
  return best;
}

export function rank(items, query, getFields, limit = 12) {
  if (!query) return items.slice(0, limit).map((item) => ({ item, score: 1 }));
  const out = [];
  for (const item of items) {
    const s = scoreFields(getFields(item), query);
    if (s > 0) out.push({ item, score: s });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
