/**
 * Widget: calendario.
 *
 * Mes en curso, con el día de hoy marcado. Todo se calcula en local: no pide
 * permisos de calendario ni sale a la red. La semana empieza en lunes.
 */

import { h, iconButton } from '../core/dom.js';

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Lunes = 0 … domingo = 6 (getDay() devuelve domingo = 0). */
export function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

/** Matriz de días de la cuadrícula, incluidos los de relleno del mes vecino. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = mondayIndex(first);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default {
  type: 'calendar',
  name: 'Calendario',
  description: 'El mes de un vistazo.',
  icon: 'wcalendar',
  sizes: ['sm', 'md'],
  defaultSize: 'sm',
  defaultConfig: {},

  create(ctx) {
    const el = h('div', { class: 'cal' });
    let offset = 0;   // meses respecto al actual
    let timer = null;

    function render() {
      const today = new Date();
      const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const year = base.getFullYear();
      const month = base.getMonth();
      const isThisMonth = year === today.getFullYear() && month === today.getMonth();

      const head = h('div', { class: 'cal__head' },
        iconButton('chevronLeft', 'Mes anterior', () => { offset--; render(); }),
        h('button', {
          class: 'cal__title', type: 'button',
          title: 'Volver a hoy',
          onClick: () => { offset = 0; render(); },
        }, `${MONTHS[month]} ${year !== today.getFullYear() ? year : ''}`.trim()),
        iconButton('chevron', 'Mes siguiente', () => { offset++; render(); }),
      );

      const grid = h('div', { class: 'cal__grid' },
        ...WEEK.map((d) => h('span', { class: 'cal__dow' }, d)),
        ...monthGrid(year, month).map((day) => {
          if (day == null) return h('span', { class: 'cal__cell is-empty' });
          const isToday = isThisMonth && day === today.getDate();
          const weekend = false;
          return h('span', {
            class: `cal__cell${isToday ? ' is-today' : ''}${weekend ? ' is-weekend' : ''}`,
          }, String(day));
        }),
      );

      el.replaceChildren(head, grid);
    }

    render();
    // A medianoche el "hoy" cambia de casilla.
    const scheduleMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => { render(); scheduleMidnight(); }, next - now);
    };
    scheduleMidnight();

    return { el, onResize: render, destroy() { clearTimeout(timer); } };
  },
};
