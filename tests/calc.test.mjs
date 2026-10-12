import { evaluate, formatResult, tokenize } from '../js/widgets/calculator.js';
import { daysUntil, describeRemaining } from '../js/widgets/countdown.js';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('✗ '+m); } };
const eq=(a,b,m)=>ok(a===b, `${m} (esperado ${b}, obtenido ${a})`);

/* --- calculadora --- */
eq(evaluate('2+3'), 5, 'suma');
eq(evaluate('2+3*4'), 14, 'precedencia');
eq(evaluate('(2+3)*4'), 20, 'paréntesis');
eq(evaluate('10/4'), 2.5, 'división');
eq(evaluate('10/0'), null, 'división por cero devuelve null');
eq(evaluate('-5+8'), 3, 'menos unario al principio');
eq(evaluate('3*-2'), -6, 'menos unario tras operador');
eq(evaluate('-3*-2'), 6, 'dos unarios');
eq(evaluate('10--3'), 13, 'resta de un negativo');
eq(evaluate('2+-3*4'), -10, 'unario respeta la precedencia de *');
eq(evaluate('(-2+5)*2'), 6, 'unario dentro de paréntesis');
eq(evaluate('-(2+3)'), -5, 'unario aplicado a un paréntesis');
eq(evaluate('50%'), 0.5, 'porcentaje');
eq(evaluate('200*10%'), 20, 'porcentaje combinado');
eq(evaluate('1,5+1'), 2.5, 'coma decimal');
eq(evaluate('6×7'), 42, 'signo ×');
eq(evaluate('84÷2'), 42, 'signo ÷');
eq(evaluate(''), null, 'vacío');
eq(evaluate('2+'), null, 'expresión incompleta');
eq(evaluate('(2+3'), null, 'paréntesis sin cerrar');
eq(evaluate('2+3)'), null, 'paréntesis sobrante');
eq(evaluate('abc'), null, 'texto no numérico');
eq(tokenize('2$3'), null, 'carácter inválido');
eq(formatResult(0.1+0.2), '0.3', 'redondeo de coma flotante');
eq(formatResult(1/3), '0.3333333333', 'decimales acotados');

/* --- cuenta atrás --- */
const hoy = new Date(2026,7,22);
eq(daysUntil(new Date(2026,7,25), hoy), 3, 'faltan 3 días');
eq(daysUntil(new Date(2026,7,22), hoy), 0, 'hoy = 0');
eq(daysUntil(new Date(2026,7,20), hoy), -2, 'pasado = negativo');
eq(describeRemaining(new Date(2026,7,22), hoy).value, 'Hoy', 'etiqueta de hoy');
eq(describeRemaining(new Date(2026,7,23), hoy).unit, 'día', 'singular a un día');
eq(describeRemaining(new Date(2026,7,29), hoy).unit, 'días', 'plural');
ok(describeRemaining(new Date(2026,7,1), hoy).past === true, 'marca las fechas pasadas');
// cambio de mes y año
eq(daysUntil(new Date(2027,0,1), new Date(2026,11,31)), 1, 'cruza el año');

console.log(`\n${pass} pruebas OK, ${fail} fallos`);
process.exit(fail?1:0);
