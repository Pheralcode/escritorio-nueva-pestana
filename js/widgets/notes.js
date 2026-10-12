/** Widget: notas rápidas con autoguardado (debounce en el store). */

import { h } from '../core/dom.js';

export default {
  type: 'notes',
  name: 'Notas',
  description: 'Texto libre con autoguardado.',
  icon: 'wnotes',
  sizes: ['sm', 'md', 'lg'],
  defaultSize: 'md',
  defaultConfig: { text: '', updatedAt: 0 },

  create(ctx) {
    const status = h('span', { class: 'notes__status faint' }, '');
    const area = h('textarea', {
      class: 'notes__area',
      placeholder: 'Escribe aquí… se guarda solo.',
      'aria-label': 'Notas rápidas',
      spellcheck: 'false',
    });
    area.value = ctx.config.text || '';

    const el = h('div', { class: 'notes' }, area, h('div', { class: 'notes__foot' }, status));

    let saveTimer = null;
    let clearTimer = null;

    area.addEventListener('input', () => {
      status.textContent = 'Escribiendo…';
      clearTimeout(saveTimer);
      // El store ya hace debounce de la escritura a disco; este segundo debounce
      // evita generar objetos de estado en cada pulsación.
      saveTimer = setTimeout(() => {
        ctx.setConfig({ text: area.value, updatedAt: Date.now() });
        status.textContent = 'Guardado';
        clearTimeout(clearTimer);
        clearTimer = setTimeout(() => { status.textContent = ''; }, 1600);
      }, 400);
    });

    // Guardado inmediato al salir del campo o cerrar la pestaña.
    const flushNow = () => {
      clearTimeout(saveTimer);
      if (area.value !== ctx.config.text) ctx.setConfig({ text: area.value, updatedAt: Date.now() });
    };
    area.addEventListener('blur', flushNow);
    window.addEventListener('pagehide', flushNow);

    return {
      el,
      onConfig(cfg) {
        // Solo pisamos el textarea si el cambio vino de fuera (otra pestaña).
        if (document.activeElement !== area && cfg.text !== area.value) area.value = cfg.text || '';
      },
      destroy() {
        flushNow();
        window.removeEventListener('pagehide', flushNow);
        clearTimeout(saveTimer);
        clearTimeout(clearTimer);
      },
    };
  },
};
