/**
 * Widget: feed RSS/Atom.
 *
 * Red: el usuario añade la URL a mano. Antes de la primera descarga pedimos el
 * permiso de host de ESE origen concreto (no `<all_urls>`) vía
 * chrome.permissions.request. Si el navegador no implementa permissions
 * (caso posible en Orion), intentamos el fetch igualmente y explicamos el
 * error de CORS en vez de romper.
 *
 * Parseo: en un Web Worker (rss-worker.js). Si los module workers no están
 * disponibles, caemos a parsear en el hilo principal con el mismo módulo.
 */

import { h, icon, iconButton, formatRelative } from '../core/dom.js';
import { permissions } from '../core/compat.js';
import * as store from '../core/store.js';
import { hostOf } from '../core/favicon.js';

const CACHE_MS = 20 * 60 * 1000;

/* ------------------------- parseo (worker + fallback) ------------------------- */

let worker = null;
let workerBroken = false;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/rss-worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (ev) => {
      const { id } = ev.data || {};
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      clearTimeout(entry.timer);
      ev.data.ok ? entry.resolve(ev.data) : entry.reject(new Error(ev.data.error || 'parse error'));
    });
    worker.addEventListener('error', (e) => {
      console.warn('[nuevapestana] worker RSS no disponible, parseo en el hilo principal:', e.message);
      workerBroken = true;
      for (const [, entry] of pending) { clearTimeout(entry.timer); entry.reject(new Error('worker-unavailable')); }
      pending.clear();
      try { worker.terminate(); } catch { /* noop */ }
      worker = null;
    });
  } catch (e) {
    console.warn('[nuevapestana] no se pudo crear el worker:', e);
    workerBroken = true;
    return null;
  }
  return worker;
}

export async function parseFeedText(xml, limit = 30) {
  const w = getWorker();
  if (w) {
    try {
      return await new Promise((resolve, reject) => {
        const id = ++seq;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('worker-timeout')); }, 4000);
        pending.set(id, { resolve, reject, timer });
        w.postMessage({ id, xml, limit });
      });
    } catch (e) {
      if (e.message !== 'worker-unavailable' && e.message !== 'worker-timeout') throw e;
      workerBroken = true; // caemos al hilo principal
    }
  }
  const mod = await import('../workers/rss-worker.js');
  return { ok: true, ...mod.parseFeed(xml, { limit }) };
}

/* --------------------------------- widget --------------------------------- */

function originPattern(url) {
  try { return `${new URL(url).origin}/*`; } catch { return null; }
}

export default {
  type: 'rss',
  name: 'RSS',
  description: 'Titulares de un feed RSS o Atom.',
  icon: 'wrss',
  sizes: ['md', 'lg'],
  defaultSize: 'lg',
  defaultConfig: { url: '', limit: 12, showSummary: true },
  configurable: true,
  settings: [
    { key: 'url', label: 'URL del feed', type: 'text', placeholder: 'https://sitio.com/feed.xml' },
    { key: 'limit', label: 'Máximo de titulares', type: 'number', min: 3, max: 40 },
    { key: 'showSummary', label: 'Mostrar resumen', type: 'checkbox' },
  ],

  create(ctx) {
    const el = h('div', { class: 'rss' });
    let abort = null;

    const cacheKey = () => `rss:${ctx.id}`;

    async function ensurePermission(url) {
      const pattern = originPattern(url);
      if (!pattern) return false;
      if (!permissions.supported()) return true; // lo intentamos igualmente
      if (await permissions.contains({ origins: [pattern] })) return true;
      return permissions.request({ origins: [pattern] });
    }

    async function load({ force = false, gesture = false } = {}) {
      const cfg = ctx.config;
      if (!cfg.url) return renderSetup();

      if (!force) {
        const cached = await store.readCache(cacheKey());
        if (cached && Date.now() - cached.at < CACHE_MS && cached.url === cfg.url) {
          return renderItems(cached.title, cached.items, cached.at);
        }
      }

      renderLoading();
      if (gesture) {
        const granted = await ensurePermission(cfg.url);
        if (!granted) return renderError(new Error('Permiso denegado para ese dominio.'), true);
      }

      abort?.abort();
      abort = new AbortController();
      try {
        const res = await fetch(cfg.url, { signal: abort.signal, redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        const parsed = await parseFeedText(xml, cfg.limit);
        const items = parsed.items.slice(0, cfg.limit);
        await store.writeCache(cacheKey(), { at: Date.now(), url: cfg.url, title: parsed.title, items });
        renderItems(parsed.title, items, Date.now());
      } catch (e) {
        if (e.name === 'AbortError') return;
        const cached = await store.readCache(cacheKey());
        if (cached && cached.url === cfg.url) renderItems(cached.title, cached.items, cached.at, 'Sin conexión: caché');
        else renderError(e);
      }
    }

    function renderLoading() {
      el.replaceChildren(h('div', { class: 'rss__loading faint' }, 'Cargando feed…'));
    }

    function renderSetup(prefill = '') {
      const input = h('input', {
        class: 'input',
        type: 'url',
        placeholder: 'https://sitio.com/feed.xml',
        value: prefill,
      });
      const form = h('form', { class: 'rss__setup' },
        h('p', { class: 'faint' }, 'Pega la URL de un feed RSS o Atom.'),
        input,
        h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Cargar feed'),
        h('p', { class: 'faint' }, 'Se te pedirá permiso solo para ese dominio.'),
      );
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const url = input.value.trim();
        if (!url) return;
        ctx.setConfig({ url });
        await load({ force: true, gesture: true }); // dentro del gesto del usuario
      });
      el.replaceChildren(form);
    }

    function renderError(e, permIssue = false) {
      const msg = permIssue
        ? 'Sin permiso para ese dominio.'
        : 'No se pudo leer el feed. Puede ser CORS, un dominio caído o una URL que no es un feed.';
      el.replaceChildren(h('div', { class: 'rss__error' },
        h('p', {}, msg),
        h('p', { class: 'faint' }, String(e.message || e)),
        h('div', { class: 'row-end' },
          h('button', { class: 'btn btn--ghost', onClick: () => renderSetup(ctx.config.url) }, 'Cambiar URL'),
          h('button', { class: 'btn', onClick: () => load({ force: true, gesture: true }) }, 'Reintentar'),
        ),
      ));
    }

    function renderItems(title, items, at, notice) {
      const cfg = ctx.config;
      const head = h('div', { class: 'rss__head' },
        h('span', { class: 'rss__title', title: cfg.url }, title || hostOf(cfg.url)),
        iconButton('refresh', 'Actualizar', () => load({ force: true, gesture: true })),
      );
      const list = h('ul', { class: 'rss__list' },
        ...items.slice(0, cfg.limit).map((it) => h('li', {},
          h('a', { class: 'rss__item', href: it.link || '#', title: it.title },
            h('span', { class: 'rss__item-title' }, it.title),
            cfg.showSummary && ctx.size === 'lg' && it.summary
              ? h('span', { class: 'rss__item-summary' }, it.summary)
              : null,
            h('span', { class: 'rss__item-meta faint' },
              it.date ? formatRelative(it.date) : '',
              it.author ? ` · ${it.author}` : ''),
          ),
        )),
      );
      const foot = h('div', { class: 'rss__foot faint' }, notice || `Actualizado ${formatRelative(at)}`);
      el.replaceChildren(head, items.length ? list : h('p', { class: 'faint' }, 'El feed no trae entradas.'), foot);
    }

    load();

    return {
      el,
      onConfig() { load({ force: true, gesture: true }); },
      onResize() { load(); },
      openSettings() { if (!ctx.config.url) renderSetup(); },
      destroy() { abort?.abort(); },
    };
  },
};
