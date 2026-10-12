import { parseFeed } from '../js/workers/rss-worker.js';

let pass = 0, fail = 0;
const eq = (actual, expected, msg) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; } else { fail++; console.log(`✗ ${msg}\n   esperado: ${JSON.stringify(expected)}\n   obtenido: ${JSON.stringify(actual)}`); }
};
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log(`✗ ${msg}`); } };

/* --- RSS 2.0 con CDATA, HTML en la descripción y entidades --- */
const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Blog de Pruebas</title>
  <link>https://ejemplo.com</link>
  <item>
    <title><![CDATA[Caf&eacute; &amp; c&oacute;digo]]></title>
    <link>https://ejemplo.com/post-1</link>
    <pubDate>Wed, 20 Aug 2025 10:00:00 GMT</pubDate>
    <description><![CDATA[<p>Un <b>resumen</b> con <script>alert(1)</script> HTML.</p>]]></description>
    <dc:creator>Ana</dc:creator>
  </item>
  <item>
    <title>Entrada m&#225;s nueva</title>
    <guid isPermaLink="true">https://ejemplo.com/post-2</guid>
    <pubDate>Thu, 21 Aug 2025 08:30:00 GMT</pubDate>
    <description>Texto plano</description>
  </item>
</channel></rss>`;

const a = parseFeed(rss);
eq(a.title, 'Blog de Pruebas', 'título del canal');
eq(a.items.length, 2, 'número de items');
eq(a.items[0].title, 'Entrada más nueva', 'orden por fecha descendente + entidad numérica');
eq(a.items[0].link, 'https://ejemplo.com/post-2', 'link desde guid permalink');
eq(a.items[1].title, 'Café & código', 'CDATA + entidades nombradas');
eq(a.items[1].author, 'Ana', 'autor vía dc:creator');
ok(!a.items[1].summary.includes('<'), 'HTML eliminado del resumen');
ok(!a.items[1].summary.includes('alert'), 'script eliminado del resumen');
eq(a.items[1].summary, 'Un resumen con HTML.', 'resumen limpio');

/* --- Atom con link href y rel --- */
const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Noticias Atom</title>
  <entry>
    <title type="html">Hola &lt;mundo&gt;</title>
    <link rel="edit" href="https://ejemplo.org/edit/1"/>
    <link rel="alternate" type="text/html" href="https://ejemplo.org/1"/>
    <updated>2025-08-22T12:00:00Z</updated>
    <summary>Resumen atom</summary>
    <author><name>Beto</name></author>
  </entry>
</feed>`;

const b = parseFeed(atom);
eq(b.title, 'Noticias Atom', 'título Atom');
eq(b.items[0].title, 'Hola <mundo>', 'entidades escapadas en título Atom');
eq(b.items[0].link, 'https://ejemplo.org/1', 'prefiere rel=alternate sobre rel=edit');
eq(b.items[0].summary, 'Resumen atom', 'summary Atom');
ok(b.items[0].date > 0, 'fecha Atom parseada');

/* --- HTML escapado con entidades en la descripción (caso muy común) --- */
const escaped = `<rss><channel><title>E</title>
  <item>
    <title>T&#237;tulo con &lt;etiqueta&gt; literal</title>
    <link>https://e.com/1</link>
    <description>&lt;p&gt;P&#225;rrafo &lt;b&gt;en negrita&lt;/b&gt; y &amp;amp; final&lt;/p&gt;</description>
  </item>
  <item>
    <title>Con &lt;b&gt;markup&lt;/b&gt; real</title>
    <link>https://e.com/2</link>
    <description><![CDATA[<div>CDATA <span>anidado</span></div>]]></description>
  </item>
</channel></rss>`;
const e = parseFeed(escaped);
eq(e.items[0].summary, 'Párrafo en negrita y &amp; final', 'entidades escapadas: se decodifica y LUEGO se quitan las etiquetas');
ok(!e.items[0].summary.includes('<'), 'ninguna etiqueta visible en el resumen');
eq(e.items[0].title, 'Título con <etiqueta> literal', 'el título conserva el texto literal entre <>');
eq(e.items[1].summary, 'CDATA anidado', 'CDATA con etiquetas reales');

/* --- Robustez: basura, feed vacío, límite --- */
eq(parseFeed('no es xml').items.length, 0, 'entrada no-XML no revienta');
eq(parseFeed('').items.length, 0, 'cadena vacía');
eq(parseFeed(null).items.length, 0, 'null');
const many = `<rss><channel><title>T</title>${Array.from({length: 60}, (_, i) =>
  `<item><title>P${i}</title><link>https://x.com/${i}</link><pubDate>Wed, 0${(i%9)+1} Jan 2025 10:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`;
eq(parseFeed(many, { limit: 10 }).items.length, 10, 'respeta el límite');

console.log(`\n${pass} pruebas OK, ${fail} fallos`);
process.exit(fail ? 1 : 0);
