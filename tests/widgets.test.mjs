import { monthGrid, mondayIndex } from '../js/widgets/calendar.js';
import { timeIn, offsetLabel, isDaytime } from '../js/widgets/worldclock.js';
import { isoDay, weekDays, streak } from '../js/widgets/habits.js';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('✗ '+m); } };
const eq=(a,b,m)=>ok(JSON.stringify(a)===JSON.stringify(b), `${m} (obtenido ${JSON.stringify(a)})`);

/* --- calendario --- */
// 1 de agosto de 2026 cae en sábado -> índice 5 con semana empezando en lunes
eq(mondayIndex(new Date(2026,7,1)), 5, 'sábado = índice 5 con semana en lunes');
eq(mondayIndex(new Date(2026,7,2)), 6, 'domingo = índice 6');
eq(mondayIndex(new Date(2026,7,3)), 0, 'lunes = índice 0');

const ago = monthGrid(2026, 7);           // agosto 2026: 31 días, empieza sábado
eq(ago.length % 7, 0, 'la cuadrícula siempre completa semanas');
eq(ago.slice(0,5), [null,null,null,null,null], '5 huecos antes del día 1');
eq(ago[5], 1, 'el día 1 cae en la sexta casilla');
eq(ago.filter(d=>d!==null).length, 31, 'agosto tiene 31 días');

const feb = monthGrid(2024, 1);           // bisiesto
eq(feb.filter(d=>d!==null).length, 29, 'febrero de 2024 tiene 29 días');
const feb25 = monthGrid(2025, 1);
eq(feb25.filter(d=>d!==null).length, 28, 'febrero de 2025 tiene 28 días');

// un mes que empieza en lunes no lleva huecos delante
const jun = monthGrid(2026, 5);           // 1 de junio de 2026 es lunes
eq(jun[0], 1, 'sin huecos si el mes empieza en lunes');

/* --- reloj mundial --- */
const d = new Date('2026-08-22T12:00:00Z');
ok(/^\d{2}:\d{2}$/.test(timeIn('Europe/Madrid', d)), 'formato hh:mm');
ok(timeIn('Europe/Madrid', d) !== timeIn('America/New_York', d), 'husos distintos dan horas distintas');
eq(timeIn('zona/inventada', d), '--:--', 'zona inválida no revienta');
ok(typeof offsetLabel('Asia/Tokyo', d) === 'string', 'la diferencia es texto');
ok(offsetLabel('zona/inventada', d) === '', 'diferencia vacía si la zona no vale');
ok(isDaytime('Europe/Madrid', new Date('2026-08-22T12:00:00Z')) === true, 'mediodía en Madrid es de día');
ok(isDaytime('Europe/Madrid', new Date('2026-08-22T02:00:00Z')) === false, 'las 4 de la madrugada no lo son');

/* --- hábitos --- */
{
  const hoy = new Date(2026, 7, 22);           // sábado
  eq(isoDay(hoy), '2026-08-22', 'fecha ISO local');
  const semana = weekDays(hoy);
  eq(semana.length, 7, 'la semana tiene 7 días');
  eq(isoDay(semana[0]), '2026-08-17', 'la semana empieza en lunes');
  eq(isoDay(semana[6]), '2026-08-23', 'y acaba en domingo');

  eq(streak(['2026-08-22','2026-08-21','2026-08-20'], hoy), 3, 'racha de 3 días');
  eq(streak(['2026-08-21','2026-08-20'], hoy), 2, 'la racha cuenta desde ayer si hoy falta');
  eq(streak(['2026-08-22','2026-08-20'], hoy), 1, 'un hueco corta la racha');
  eq(streak([], hoy), 0, 'sin marcas, racha 0');
  eq(streak(['2026-08-19'], hoy), 0, 'una marca vieja no cuenta');
  // cruce de mes
  eq(streak(['2026-08-01','2026-07-31','2026-07-30'], new Date(2026,7,1)), 3, 'la racha cruza el cambio de mes');
}

console.log(`\ntotal: ${pass} pruebas OK, ${fail} fallos`);
process.exit(fail?1:0);
