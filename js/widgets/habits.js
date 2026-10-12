/**
 * Widget: hábitos.
 *
 * Una fila por hábito con los siete días de la semana. Se guarda un conjunto de
 * fechas marcadas (ISO corto), no un contador: así la racha se recalcula sola y
 * el historial sobrevive a cambios de zona horaria o a saltarse días.
 */

import { h, icon, iconButton, setChildren } from '../core/dom.js';
import { uid } from '../core/state.js';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Los siete días de la semana en curso, de lunes a domingo. */
export function weekDays(today = new Date()) {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Días consecutivos marcados terminando hoy (o ayer, si hoy aún no toca). */
export function streak(done, today = new Date()) {
  const set = new Set(done);
  let count = 0;
  const cursor = new Date(today);
  if (!set.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(isoDay(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export default {
  type: 'habits',
  name: 'Hábitos',
  description: 'Marca cada día y mira la racha.',
  icon: 'check',
  sizes: ['md', 'lg'],
  defaultSize: 'md',
  defaultConfig: { items: [] },

  create(ctx) {
    const el = h('div', { class: 'habits' });

    function toggle(id, iso) {
      const items = ctx.config.items.map((it) => {
        if (it.id !== id) return it;
        const done = new Set(it.done || []);
        done.has(iso) ? done.delete(iso) : done.add(iso);
        // Guardamos como máximo 400 días: suficiente historial, tamaño acotado.
        return { ...it, done: [...done].sort().slice(-400) };
      });
      ctx.setConfig({ items });
      render();
    }

    function render() {
      const items = ctx.config.items || [];
      const days = weekDays();
      const todayIso = isoDay(new Date());

      const header = h('div', { class: 'habits__head' },
        h('span', {}, ''),
        ...days.map((d) => h('span', {
          class: `habits__dow${isoDay(d) === todayIso ? ' is-today' : ''}`,
        }, DOW[(d.getDay() + 6) % 7])),
        h('span', {}, ''),
      );

      const rows = items.map((it) => {
        const done = new Set(it.done || []);
        const n = streak(it.done || []);
        return h('div', { class: 'habits__row' },
          h('span', { class: 'habits__name', title: it.name }, it.name),
          ...days.map((d) => {
            const iso = isoDay(d);
            const future = d > new Date() && iso !== todayIso;
            return h('button', {
              class: `habits__dot${done.has(iso) ? ' is-done' : ''}${iso === todayIso ? ' is-today' : ''}`,
              type: 'button',
              disabled: future,
              'aria-label': `${it.name} · ${iso}`,
              'aria-pressed': String(done.has(iso)),
              onClick: () => toggle(it.id, iso),
            });
          }),
          h('span', { class: `habits__streak${n > 0 ? ' is-active' : ''}` }, n ? String(n) : '·'),
        );
      });

      const input = h('input', {
        class: 'habits__input', type: 'text', placeholder: 'Nuevo hábito', maxlength: '40',
      });
      const form = h('form', { class: 'habits__form' },
        h('span', { class: 'habits__plus' }, icon('plus', 14)), input);
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        ctx.setConfig({ items: [...items, { id: uid('h'), name, done: [] }] });
        render();
      });

      const list = h('div', { class: 'habits__list' }, ...rows);
      rows.forEach((row, i) => {
        row.append(iconButton('close', `Quitar ${items[i].name}`, () => {
          ctx.setConfig({ items: items.filter((x) => x.id !== items[i].id) });
          render();
        }, 'habits__remove'));
      });

      setChildren(el,
        items.length ? header : h('p', { class: 'faint' }, 'Añade un hábito para empezar.'),
        list,
        items.length < 8 ? form : null,
      );
    }

    render();
    return { el, onConfig: render, onResize: render };
  },
};
