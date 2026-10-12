/**
 * Modo minimalista: reloj grande, meta del día y frase diaria.
 * Comparte estado con el resto (la meta vive en settings.goal).
 */

import { h, icon } from '../core/dom.js';
import * as store from '../core/store.js';
import { formatTime, formatDate } from '../core/time.js';
import { quoteOfTheDay } from '../../data/quotes.js';

let el = null;
let timer = null;

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function mountMinimal(container) {
  const timeEl = h('div', { class: 'minimal__time' });
  const dateEl = h('div', { class: 'minimal__date' });

  const goalInput = h('input', {
    class: 'minimal__goal-input',
    type: 'text',
    placeholder: '¿Cuál es tu meta de hoy?',
    'aria-label': 'Meta del día',
    maxlength: '140',
  });
  const goalCheck = h('button', {
    class: 'icon-btn minimal__goal-check',
    type: 'button',
    title: 'Marcar como hecha',
    'aria-label': 'Marcar meta como hecha',
  }, icon('check', 20));
  const goalRow = h('div', { class: 'minimal__goal' }, goalCheck, goalInput);

  const quoteEl = h('blockquote', { class: 'minimal__quote' });

  el = h('section', { class: 'minimal' }, timeEl, dateEl, goalRow, quoteEl);
  container.append(el);

  /* --- meta del día: se limpia sola al cambiar de día --- */
  function loadGoal() {
    const s = store.getState().settings;
    if (s.goalDate && s.goalDate !== todayKey()) {
      store.update((st) => { st.settings.goal = ''; st.settings.goalDone = false; st.settings.goalDate = todayKey(); });
    }
    const st = store.getState().settings;
    goalInput.value = st.goal || '';
    goalRow.classList.toggle('is-done', !!st.goalDone);
  }

  goalInput.addEventListener('input', () => {
    store.update((st) => {
      st.settings.goal = goalInput.value;
      st.settings.goalDate = todayKey();
    });
  });
  goalCheck.addEventListener('click', () => {
    store.update((st) => { st.settings.goalDone = !st.settings.goalDone; });
    goalRow.classList.toggle('is-done', !!store.getState().settings.goalDone);
  });

  /* --- reloj + frase --- */
  function paint() {
    const now = new Date();
    const cfg = store.getState().settings.clock || {};
    timeEl.textContent = formatTime(now, { hour24: cfg.hour24 !== false, seconds: !!cfg.seconds });
    dateEl.textContent = formatDate(now);
    const q = quoteOfTheDay(now);
    quoteEl.replaceChildren(document.createTextNode(`“${q.text}”`), h('cite', {}, q.author));
    clearTimeout(timer);
    timer = setTimeout(paint, (60 - now.getSeconds()) * 1000 + 50);
  }

  loadGoal();
  paint();
  store.bus.on('external-change', loadGoal);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { paint(); loadGoal(); }
  });

  return { el, refresh: () => { paint(); loadGoal(); } };
}

export function setMinimal(on) {
  document.documentElement.classList.toggle('is-minimal', !!on);
  store.setSetting('minimal', !!on);
}

export function toggleMinimal() {
  setMinimal(!store.getState().settings.minimal);
  return store.getState().settings.minimal;
}
