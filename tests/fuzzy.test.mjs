import { score, rank } from '../js/core/fuzzy.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('✗ ' + msg); } };

ok(score('GitHub', 'github') === 1000, 'exacta (case-insensitive)');
ok(score('GitHub', 'git') > score('Digital', 'git'), 'prefijo gana a contiene');
ok(score('Digital', 'git') > 0, 'contiene puntúa');
ok(score('Wikipedia', 'wkp') > 0, 'subsecuencia');
ok(score('Wikipedia', 'xyz') === 0, 'sin coincidencia = 0');
ok(score('Ajustes de tema', 'tema') > 0, 'palabra interior');
ok(score('open-meteo', 'meteo') > 0, 'tras guion');
ok(score('cualquier cosa', '') === 1, 'consulta vacía devuelve todo');
ok(score('', 'a') === 0, 'texto vacío');

const items = [
  { t: 'GitHub' }, { t: 'Gitlab' }, { t: 'Wikipedia' }, { t: 'Ajustes: tema oscuro' },
];
const r = rank(items, 'git', (i) => [[i.t, 1]]);
ok(r.length === 2, 'rank filtra los que no coinciden');
ok(r[0].item.t === 'GitHub' || r[0].item.t === 'Gitlab', 'rank ordena por puntuación');

const weighted = rank(items, 'tema', (i) => [[i.t, 1]]);
ok(weighted[0].item.t === 'Ajustes: tema oscuro', 'encuentra por palabra interior');

console.log(`\n${pass} pruebas OK, ${fail} fallos`);
process.exit(fail ? 1 : 0);
