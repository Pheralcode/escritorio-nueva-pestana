/**
 * Widget: temporizador de enfoque (Pomodoro simple).
 *
 * El estado se guarda como marca de tiempo absoluta (`endsAt`), no como
 * "segundos restantes": así el temporizador sobrevive a cerrar la pestaña,
 * cambiar de ventana o que el navegador congele los timers. No dependemos
 * de chrome.alarms ni de un service worker vivo (que Orion no garantiza).
 */

import { h, icon, iconButton } from '../core/dom.js';

const PHASES = {
  focus: { label: 'Enfoque', next: 'break' },
  break: { label: 'Descanso', next: 'focus' },
};

export function remainingMs(cfg, now = Date.now()) {
  if (cfg.running && cfg.endsAt) return Math.max(0, cfg.endsAt - now);
  return Math.max(0, cfg.remaining ?? 0);
}

export function mmss(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Pitido corto con WebAudio: sin permiso de notificaciones y sin ficheros. */
function beep(times = 2) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const actx = new AudioCtx();
    for (let i = 0; i < times; i++) {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain); gain.connect(actx.destination);
      osc.frequency.value = 880;
      const t0 = actx.currentTime + i * 0.32;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
      osc.start(t0); osc.stop(t0 + 0.3);
    }
    setTimeout(() => actx.close?.(), 1500);
  } catch { /* audio bloqueado: da igual, el aviso visual queda */ }
}

export default {
  type: 'timer',
  name: 'Enfoque',
  description: 'Temporizador tipo Pomodoro.',
  icon: 'wtimer',
  sizes: ['sm', 'md'],
  defaultSize: 'sm',
  defaultConfig: {
    focusMin: 25,
    breakMin: 5,
    phase: 'focus',
    running: false,
    endsAt: 0,
    remaining: 25 * 60 * 1000,
    completed: 0,
  },
  settings: [
    { key: 'focusMin', label: 'Minutos de enfoque', type: 'number', min: 1, max: 180 },
    { key: 'breakMin', label: 'Minutos de descanso', type: 'number', min: 1, max: 60 },
  ],

  create(ctx) {
    const time = h('div', { class: 'timer__time' });
    const phaseEl = h('div', { class: 'timer__phase' });
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.classList.add('timer__ring');
    const track = ring.cloneNode();
    for (const [c, cls] of [[track, 'timer__track'], [ring, 'timer__progress']]) {
      c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', '44');
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke-width', '6');
      c.classList.add(cls);
      svg.append(c);
    }
    const CIRC = 2 * Math.PI * 44;
    ring.style.strokeDasharray = String(CIRC);

    const playBtn = h('button', { class: 'btn btn--primary timer__play', type: 'button' });
    const resetBtn = iconButton('stop', 'Reiniciar', () => reset());
    const countEl = h('div', { class: 'timer__count faint' });

    const el = h('div', { class: 'timer' },
      h('div', { class: 'timer__dial' }, svg, h('div', { class: 'timer__center' }, time, phaseEl)),
      h('div', { class: 'timer__controls' }, playBtn, resetBtn),
      countEl,
    );

    let raf = null;
    let notified = false;
    // Última cosa pintada: sin esto se reescribía el DOM —icono SVG incluido—
    // varias veces por segundo aunque el temporizador estuviera parado, y eso
    // se ve como un parpadeo de la tarjeta.
    let last = { time: null, phase: null, label: null, offset: null, count: null, running: null };

    function totalMs(cfg) {
      return (cfg.phase === 'focus' ? cfg.focusMin : cfg.breakMin) * 60 * 1000;
    }

    /** Escribe en el DOM solo lo que de verdad ha cambiado. */
    function paint() {
      const cfg = ctx.config;
      const left = remainingMs(cfg);
      const total = totalMs(cfg) || 1;

      const nextTime = mmss(left);
      if (nextTime !== last.time) { time.textContent = nextTime; last.time = nextTime; }

      const nextPhase = PHASES[cfg.phase]?.label || '';
      if (nextPhase !== last.phase) { phaseEl.textContent = nextPhase; last.phase = nextPhase; }

      const offset = (CIRC * (1 - Math.min(1, left / total))).toFixed(2);
      if (offset !== last.offset) { ring.style.strokeDashoffset = offset; last.offset = offset; }

      const label = cfg.running ? 'Pausar' : (left < total ? 'Seguir' : 'Empezar');
      if (label !== last.label || cfg.running !== last.running) {
        playBtn.replaceChildren(icon(cfg.running ? 'pause' : 'play', 16), document.createTextNode(label));
        last.label = label;
      }

      const count = cfg.completed ? `${cfg.completed} sesión${cfg.completed === 1 ? '' : 'es'} hoy` : '';
      if (count !== last.count) { countEl.textContent = count; last.count = count; }

      if (cfg.running !== last.running) {
        el.classList.toggle('is-running', cfg.running);
        last.running = cfg.running;
      }
      el.classList.toggle('is-break', cfg.phase === 'break');

      if (cfg.running && left <= 0 && !notified) {
        notified = true;
        complete();
      }
      if (left > 0) notified = false;
    }

    /**
     * Parado no hay nada que animar: se pinta una vez y se para el bucle. Antes
     * seguía repintando cada segundo para siempre.
     */
    function loop() {
      paint();
      clearTimeout(raf);
      if (ctx.config.running) raf = setTimeout(loop, 250);
    }

    function complete() {
      const cfg = ctx.config;
      beep(cfg.phase === 'focus' ? 3 : 2);
      el.classList.add('is-done');
      setTimeout(() => el.classList.remove('is-done'), 2400);
      const next = PHASES[cfg.phase].next;
      ctx.setConfig({
        phase: next,
        running: false,
        endsAt: 0,
        remaining: (next === 'focus' ? cfg.focusMin : cfg.breakMin) * 60 * 1000,
        completed: cfg.phase === 'focus' ? (cfg.completed || 0) + 1 : cfg.completed,
      });
      ctx.store.bus.emit('toast', {
        message: cfg.phase === 'focus' ? '¡Sesión completada! Toca descansar.' : 'Descanso terminado. A por otra.',
        kind: 'ok',
      });
      paint();
    }

    function toggle() {
      const cfg = ctx.config;
      if (cfg.running) {
        ctx.setConfig({ running: false, remaining: remainingMs(cfg), endsAt: 0 });
      } else {
        const left = remainingMs(cfg) || totalMs(cfg);
        ctx.setConfig({ running: true, endsAt: Date.now() + left, remaining: left });
      }
      loop();
    }

    function reset() {
      const cfg = ctx.config;
      ctx.setConfig({ running: false, endsAt: 0, remaining: totalMs(cfg) });
      paint();
    }

    playBtn.addEventListener('click', toggle);
    loop();

    // Al volver a la pestaña, resincronizamos: el temporizador se apoya en una
    // marca absoluta, así que puede haber terminado mientras no mirábamos.
    const onVisible = () => { if (document.visibilityState === 'visible') loop(); };
    document.addEventListener('visibilitychange', onVisible);

    return {
      el,
      onConfig() { loop(); },
      onResize() { paint(); },
      destroy() {
        clearTimeout(raf);
        document.removeEventListener('visibilitychange', onVisible);
      },
    };
  },
};
