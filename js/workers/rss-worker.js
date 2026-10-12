/**
 * Worker de RSS/Atom.
 *
 * Por qué un worker: parsear XML de varios cientos de KB con expresiones
 * regulares bloquea el hilo principal y se nota como un tirón en la nueva
 * pestaña. Aquí corre fuera del hilo de UI.
 *
 * Por qué no DOMParser: no existe en Workers. Implementamos un extractor
 * tolerante que cubre RSS 2.0, RDF y Atom, que es lo que sirven los feeds reales.
 *
 * El fetch NO se hace aquí: en MV3 la red desde el worker sigue sujeta a CORS y
 * necesitamos el permiso de host concedido desde la página. El hilo principal
 * descarga el texto y el worker solo parsea.
 */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', hellip: '…', mdash: '—', ndash: '–',
  laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
};

function decodeEntities(str) {
  return String(str).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
    if (code[0] === '#') {
      const num = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(num) && num > 0 ? String.fromCodePoint(num) : m;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, code) ? ENTITIES[code] : m;
  });
}

function stripCdata(str) {
  return String(str).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripTags(str) {
  return String(str)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '');
}

/**
 * `mode`:
 *   'text'    -> solo decodifica entidades (títulos: "Hola &lt;mundo&gt;" debe
 *                seguir leyéndose como "Hola <mundo>", que es su texto literal).
 *   'markup'  -> quita etiquetas reales y luego decodifica (títulos con <b>).
 *   'escaped' -> decodifica primero y quita después: es el caso de <description>,
 *                donde los feeds meten HTML escapado (&lt;p&gt;Hola&lt;/p&gt;).
 *                Sin este orden, las etiquetas acababan visibles como texto.
 */
function clean(str, mode = 'text') {
  let out = stripCdata(str || '');
  if (mode === 'markup') {
    out = decodeEntities(stripTags(out));
  } else if (mode === 'escaped') {
    out = stripTags(decodeEntities(out));
  } else {
    out = decodeEntities(out);
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Primer valor de <tag> ... </tag> (ignora namespaces del estilo dc:date). */
function tagValue(block, names) {
  for (const name of [].concat(names)) {
    const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${name}>`, 'i');
    const m = block.match(re);
    if (m) return m[1];
  }
  return '';
}

function attrValue(tagStr, attr) {
  const m = tagStr.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3] ?? '') : '';
}

/** Enlace: RSS usa <link>url</link>; Atom usa <link href="..." rel="alternate"/>. */
function extractLink(block) {
  const selfClosing = [...block.matchAll(/<(?:[a-zA-Z0-9]+:)?link\b([^>]*)\/?>/gi)];
  let fallback = '';
  for (const m of selfClosing) {
    const attrs = m[1] || '';
    const href = attrValue(attrs, 'href');
    if (!href) continue;
    const rel = (attrValue(attrs, 'rel') || 'alternate').toLowerCase();
    if (rel === 'alternate') return decodeEntities(href);
    if (!fallback) fallback = decodeEntities(href);
  }
  const inner = clean(tagValue(block, 'link'));
  if (inner) return inner;
  if (fallback) return fallback;
  const guid = clean(tagValue(block, 'guid'));
  return /^https?:\/\//i.test(guid) ? guid : '';
}

function parseDate(str) {
  if (!str) return 0;
  const t = Date.parse(str.trim());
  return Number.isFinite(t) ? t : 0;
}

export function parseFeed(xml, { limit = 40 } = {}) {
  const text = String(xml || '');
  const channelHead = text.split(/<(?:item|entry)\b/i)[0] || '';
  const feedTitle = clean(tagValue(channelHead, 'title'), 'markup');

  const blocks = [...text.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const items = [];
  for (const m of blocks) {
    const block = m[2];
    const title = clean(tagValue(block, 'title'), 'markup') || '(sin título)';
    const link = extractLink(block);
    const dateRaw = clean(tagValue(block, ['pubDate', 'published', 'updated', 'date']));
    const summaryRaw = tagValue(block, ['description', 'summary', 'encoded', 'content']);
    const summary = clean(summaryRaw, 'escaped').slice(0, 240);
    const author = clean(tagValue(block, ['creator', 'author'])).replace(/<[^>]*>/g, '').slice(0, 60);
    items.push({ title, link, date: parseDate(dateRaw), summary, author });
    if (items.length >= limit) break;
  }
  items.sort((a, b) => b.date - a.date);
  return { title: feedTitle, items };
}

/* --------- interfaz del worker (solo si corremos dentro de uno) --------- */

if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined') {
  self.addEventListener('message', (ev) => {
    const { id, xml, limit } = ev.data || {};
    try {
      const result = parseFeed(xml, { limit });
      self.postMessage({ id, ok: true, ...result });
    } catch (e) {
      self.postMessage({ id, ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
}
