import { QUOTES, quoteOfTheDay } from '../data/quotes.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗ ' + m); } };

ok(QUOTES.length >= 20, 'hay al menos 20 frases');
ok(QUOTES.every(q => q.text && q.author), 'todas tienen texto y autor');

const d1 = new Date(2026, 7, 22);
const d1b = new Date(2026, 7, 22, 23, 59);
const d2 = new Date(2026, 7, 23);
ok(quoteOfTheDay(d1).text === quoteOfTheDay(d1b).text, 'misma frase todo el día');
ok(quoteOfTheDay(d1).text !== quoteOfTheDay(d2).text, 'cambia al día siguiente');

// cobertura: en N días consecutivos se recorren todas las frases sin repetir
const seen = new Set();
for (let i = 0; i < QUOTES.length; i++) {
  seen.add(quoteOfTheDay(new Date(2026, 0, 1 + i)).text);
}
ok(seen.size === QUOTES.length, 'recorre todas las frases sin repetir en un ciclo');

// fechas antiguas (índice negativo si no se normaliza)
ok(!!quoteOfTheDay(new Date(1969, 0, 1)), 'no rompe con fechas anteriores a 1970');

console.log(`\n${pass} pruebas OK, ${fail} fallos`);
process.exit(fail ? 1 : 0);
