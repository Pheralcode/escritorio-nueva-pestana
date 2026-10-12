/**
 * Widget: cuenta atrás.
 * Días (u horas y minutos, si queda poco) hasta una fecha señalada.
 */

import { h } from '../core/dom.js';

/** Días completos entre dos fechas, ignorando la hora del día. */
export function daysUntil(target, from = new Date()) {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

export function describeRemaining(target, from = new Date()) {
  const days = daysUntil(target, from);
  if (days > 1) return { value: String(days), unit: days === 1 ? 'día' : 'días', past: false };
  if (days === 1) return { value: '1', unit: 'día', past: false };
  if (days === 0) return { value: 'Hoy', unit: '', past: false };
  const n = Math.abs(days);
  return { value: String(n), unit: n === 1 ? 'día atrás' : 'días atrás', past: true };
}

export default {
  type: 'countdown',
  name: 'Cuenta atrás',
  description: 'Días hasta una fecha.',
  icon: 'wcountdown',
  sizes: ['sm', 'md'],
  defaultSize: 'sm',
  configurable: true,
  defaultConfig: { title: '', date: '' },
  settings: [
    { key: 'title', label: 'Título', type: 'text', placeholder: 'Vacaciones' },
    { key: 'date', label: 'Fecha', type: 'date' },
  ],

  create(ctx) {
    const el = h('div', { class: 'cdown' });
    let timer = null;

    function render() {
      const cfg = ctx.config;
      if (!cfg.date) return renderForm();
      const target = new Date(`${cfg.date}T12:00:00`);
      if (Number.isNaN(target.getTime())) return renderForm();
      const { value, unit, past } = describeRemaining(target);
      el.classList.toggle('is-past', past);
      el.replaceChildren(
        h('div', { class: 'cdown__value' }, value),
        unit ? h('div', { class: 'cdown__unit' }, unit) : null,
        h('div', { class: 'cdown__title' }, cfg.title || 'Sin título'),
        h('div', { class: 'cdown__date faint' },
          target.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })),
      );
    }

    function renderForm() {
      const title = h('input', { class: 'input input--sm', type: 'text', placeholder: 'Título', value: ctx.config.title || '' });
      const date = h('input', { class: 'input input--sm', type: 'date', value: ctx.config.date || '' });
      const form = h('form', { class: 'cdown__form' },
        title, date,
        h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Guardar'),
      );
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (!date.value) { date.focus(); return; }
        ctx.setConfig({ title: title.value.trim(), date: date.value });
        render();
      });
      el.replaceChildren(form);
    }

    render();
    // Basta con revisar cada media hora: lo que cambia es el día.
    timer = setInterval(render, 30 * 60 * 1000);

    return { el, onConfig: render, onResize: render, openSettings: renderForm, destroy() { clearInterval(timer); } };
  },
};
