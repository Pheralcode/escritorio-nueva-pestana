/**
 * Widget: tareas.
 *
 * Lista de comprobación local. Distinta de las notas: aquí cada línea tiene
 * estado, se reordena y las completadas se pueden barrer de una vez.
 */

import { h, icon, iconButton, setChildren } from '../core/dom.js';
import { uid } from '../core/state.js';

export default {
  type: 'tasks',
  name: 'Tareas',
  description: 'Lista de pendientes con casillas.',
  icon: 'wtasks',
  sizes: ['sm', 'md', 'lg'],
  defaultSize: 'md',
  defaultConfig: { items: [], hideDone: false },
  settings: [
    { key: 'hideDone', label: 'Ocultar completadas', type: 'checkbox' },
  ],

  create(ctx) {
    const list = h('ul', { class: 'tasks__list' });
    const input = h('input', {
      class: 'tasks__input',
      type: 'text',
      placeholder: 'Añadir tarea',
      'aria-label': 'Nueva tarea',
      maxlength: '160',
    });
    const form = h('form', { class: 'tasks__form' },
      h('span', { class: 'tasks__plus' }, icon('plus', 15)),
      input,
    );
    const foot = h('div', { class: 'tasks__foot' });
    const el = h('div', { class: 'tasks' }, form, list, foot);

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      ctx.setConfig({ items: [...ctx.config.items, { id: uid('t'), text, done: false }] });
      input.value = '';
      render();
    });

    function toggle(id) {
      ctx.setConfig({
        items: ctx.config.items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)),
      });
      render();
    }

    function remove(id) {
      ctx.setConfig({ items: ctx.config.items.filter((it) => it.id !== id) });
      render();
    }

    function clearDone() {
      ctx.setConfig({ items: ctx.config.items.filter((it) => !it.done) });
      render();
    }

    function render() {
      const cfg = ctx.config;
      const items = cfg.hideDone ? cfg.items.filter((it) => !it.done) : cfg.items;
      // Pendientes arriba: lo que queda por hacer es lo que importa.
      const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done));

      list.replaceChildren(...sorted.map((it) => {
        const box = h('button', {
          class: `tasks__check${it.done ? ' is-done' : ''}`,
          type: 'button',
          role: 'checkbox',
          'aria-checked': String(it.done),
          'aria-label': it.text,
          onClick: () => toggle(it.id),
        }, it.done ? icon('check', 13) : null);

        return h('li', { class: `tasks__item${it.done ? ' is-done' : ''}` },
          box,
          h('span', { class: 'tasks__text', onClick: () => toggle(it.id) }, it.text),
          iconButton('close', 'Quitar', () => remove(it.id), 'tasks__remove'),
        );
      }));

      if (!sorted.length) {
        list.replaceChildren(h('li', { class: 'tasks__empty faint' },
          cfg.items.length ? 'Todo hecho.' : 'Sin tareas.'));
      }

      const done = cfg.items.filter((it) => it.done).length;
      setChildren(foot,
        h('span', { class: 'faint' }, cfg.items.length ? `${done}/${cfg.items.length} completadas` : ''),
        done ? h('button', { class: 'tasks__clear', type: 'button', onClick: clearDone }, 'Limpiar') : null,
      );
    }

    render();
    return { el, onConfig: render, onResize: render };
  },
};
