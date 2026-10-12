/**
 * Widget: reloj mundial.
 *
 * Usa Intl.DateTimeFormat con `timeZone`: el navegador ya trae la base de datos
 * de husos horarios, así que no hace falta red ni tabla propia de offsets
 * (ni preocuparse por el horario de verano, que Intl resuelve solo).
 */

import { h, iconButton } from '../core/dom.js';
import { uid } from '../core/state.js';

const SUGGESTED = [
  { label: 'Ciudad de México', tz: 'America/Mexico_City' },
  { label: 'Santiago', tz: 'America/Santiago' },
  { label: 'Madrid', tz: 'Europe/Madrid' },
  { label: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires' },
  { label: 'Nueva York', tz: 'America/New_York' },
  { label: 'Londres', tz: 'Europe/London' },
  { label: 'Tokio', tz: 'Asia/Tokyo' },
];

export function timeIn(tz, date = new Date(), hour24 = true) {
  try {
    return new Intl.DateTimeFormat('es', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: !hour24,
    }).format(date);
  } catch { return '--:--'; }
}

/** Diferencia en horas respecto a la hora local, con signo. */
export function offsetLabel(tz, date = new Date()) {
  try {
    const there = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    const here = new Date(date.toLocaleString('en-US'));
    const diff = Math.round((there - here) / 3600000);
    if (diff === 0) return 'misma hora';
    return `${diff > 0 ? '+' : ''}${diff} h`;
  } catch { return ''; }
}

/** ¿Es de día allí? Para pintar el indicador. */
export function isDaytime(tz, date = new Date()) {
  try {
    const hour = Number(new Intl.DateTimeFormat('en', {
      timeZone: tz, hour: '2-digit', hour12: false,
    }).format(date));
    return hour >= 7 && hour < 20;
  } catch { return true; }
}

export default {
  type: 'worldclock',
  name: 'Reloj mundial',
  description: 'La hora en otras ciudades.',
  icon: 'wworld',
  sizes: ['sm', 'md'],
  defaultSize: 'sm',
  configurable: true,
  defaultConfig: {
    zones: [
      { id: 'z1', label: 'Madrid', tz: 'Europe/Madrid' },
      { id: 'z2', label: 'Nueva York', tz: 'America/New_York' },
    ],
  },

  create(ctx) {
    const list = h('div', { class: 'wclock__list' });
    const el = h('div', { class: 'wclock' }, list);
    let timer = null;

    function render() {
      const cfg = ctx.config;
      const hour24 = ctx.store.getState().settings.clock?.hour24 !== false;
      const now = new Date();
      const zones = cfg.zones || [];

      list.replaceChildren(...zones.map((z) => h('div', { class: 'wclock__row' },
        h('span', { class: `wclock__dot${isDaytime(z.tz, now) ? ' is-day' : ''}` }),
        h('div', { class: 'wclock__where' },
          h('span', { class: 'wclock__city' }, z.label),
          h('span', { class: 'wclock__off faint' }, offsetLabel(z.tz, now)),
        ),
        h('span', { class: 'wclock__time' }, timeIn(z.tz, now, hour24)),
        iconButton('close', `Quitar ${z.label}`, () => {
          ctx.setConfig({ zones: zones.filter((x) => x.id !== z.id) });
          render();
        }, 'wclock__remove'),
      )));

      if (!zones.length) list.append(h('p', { class: 'faint' }, 'Sin ciudades.'));

      if (zones.length < 6) {
        list.append(h('button', {
          class: 'wclock__add', type: 'button', onClick: openPicker,
        }, 'Añadir ciudad'));
      }
    }

    function openPicker() {
      const used = new Set((ctx.config.zones || []).map((z) => z.tz));
      const options = SUGGESTED.filter((s) => !used.has(s.tz));
      const select = h('select', { class: 'input' },
        ...options.map((o) => h('option', { value: o.tz }, o.label)),
        h('option', { value: '__custom' }, 'Otra (escribir zona IANA)…'),
      );
      const custom = h('input', { class: 'input', type: 'text', placeholder: 'Europe/Lisbon', hidden: true });
      select.addEventListener('change', () => { custom.hidden = select.value !== '__custom'; });

      const form = h('form', { class: 'wclock__form' },
        select, custom,
        h('div', { class: 'row-end' },
          h('button', { class: 'btn btn--ghost', type: 'button', onClick: render }, 'Cancelar'),
          h('button', { class: 'btn btn--primary', type: 'submit' }, 'Añadir'),
        ),
      );
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        let tz = select.value;
        let label = options.find((o) => o.tz === tz)?.label;
        if (tz === '__custom') {
          tz = custom.value.trim();
          if (!tz) return;
          label = tz.split('/').pop().replace(/_/g, ' ');
        }
        // Validamos contra Intl antes de guardar: una zona inválida lanza aquí.
        try { new Intl.DateTimeFormat('es', { timeZone: tz }); }
        catch { custom.focus(); return; }
        ctx.setConfig({ zones: [...(ctx.config.zones || []), { id: uid('z'), label, tz }] });
        render();
      });
      list.replaceChildren(form);
    }

    render();
    timer = setInterval(() => { if (document.visibilityState === 'visible') render(); }, 20000);

    return {
      el,
      onConfig: render,
      onResize: render,
      openSettings: openPicker,
      destroy() { clearInterval(timer); },
    };
  },
};
