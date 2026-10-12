/**
 * Widget: accesos directos.
 *
 * Fuente de verdad = `state.shortcuts` en storage.local. Si el usuario activa la
 * sincronización (features/bookmarks-sync.js), ese módulo mantiene el espejo con
 * chrome.bookmarks; el widget no habla nunca con la API de marcadores directamente.
 */

import { h, icon, iconButton } from '../core/dom.js';
import { faviconEl, hostOf, openIconDialog } from '../core/favicon.js';
import { uid } from '../core/state.js';
import { attachContextMenu } from '../core/menu.js';

export default {
  type: 'bookmarks',
  name: 'Accesos',
  description: 'Enlaces rápidos con favicon automático.',
  icon: 'link',
  sizes: ['sm', 'md', 'lg'],
  defaultSize: 'lg',
  defaultConfig: { columns: 'auto' },

  create(ctx) {
    const list = h('div', { class: 'shortcuts' });
    const el = h('div', { class: 'shortcuts-wrap' }, list);

    function render() {
      const state = ctx.store.getState();
      const thirdParty = state.settings.thirdPartyFavicons;
      const items = state.shortcuts || [];

      const tiles = items.map((item) => {
        const a = h('a', {
          class: 'shortcut',
          href: item.url,
          title: `${item.title}\n${item.url}`,
          draggable: 'false',
        },
          faviconEl(item, { thirdParty }),
          h('span', { class: 'shortcut__title' }, item.title || hostOf(item.url)),
        );
        a.append(iconButton('close', 'Quitar acceso', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          ctx.store.update((s) => { s.shortcuts = s.shortcuts.filter((x) => x.id !== item.id); });
          ctx.store.bus.emit('shortcuts-changed', { reason: 'remove', item });
          render();
        }, 'shortcut__remove'));

        // Clic derecho: llevar este acceso al dock o soltarlo en la pantalla.
        attachContextMenu(a, () => [
          { label: 'Abrir', icon: 'external', run: () => { window.location.href = item.url; } },
          { label: 'Poner en la pantalla', icon: 'grid', run: () => {
            ctx.store.bus.emit('add-app-widget', { title: item.title, url: item.url });
          } },
          { label: 'Añadir al dock', icon: 'plus', run: () => {
            ctx.store.bus.emit('dock-add', { title: item.title, url: item.url });
          } },
          { label: 'Cambiar icono…', icon: 'image', run: () => openIconDialog(item.url, render) },
          'sep',
          { label: 'Quitar acceso', icon: 'trash', danger: true, run: () => {
            ctx.store.update((s) => { s.shortcuts = s.shortcuts.filter((x) => x.id !== item.id); });
            ctx.store.bus.emit('shortcuts-changed', { reason: 'remove', item });
            render();
          } },
        ]);
        return a;
      });

      const addBtn = h('button', {
        class: 'shortcut shortcut--add', type: 'button',
        'aria-label': 'Añadir acceso directo', onClick: openAdd,
      },
        h('span', { class: 'favicon favicon--add' }, icon('plus', 20)),
        h('span', { class: 'shortcut__title' }, 'Añadir'),
      );

      list.replaceChildren(...tiles, addBtn);
    }

    function openAdd() {
      const titleInput = h('input', { class: 'input', type: 'text', placeholder: 'Nombre (opcional)' });
      const urlInput = h('input', { class: 'input', placeholder: 'https://ejemplo.com', type: 'url' });
      const form = h('form', { class: 'shortcut-form' },
        h('div', { class: 'field' }, h('label', {}, 'URL'), urlInput),
        h('div', { class: 'field' }, h('label', {}, 'Nombre'), titleInput),
        h('div', { class: 'row-end' },
          h('button', { type: 'button', class: 'btn btn--ghost', onClick: render }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn btn--primary' }, 'Guardar'),
        ),
      );
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        let url = urlInput.value.trim();
        if (!url) return;
        if (!/^[a-z]+:\/\//i.test(url)) url = `https://${url}`;
        try { new URL(url); } catch { urlInput.focus(); return; }
        const item = { id: uid('sc'), title: titleInput.value.trim() || hostOf(url), url };
        ctx.store.update((s) => { s.shortcuts = [...(s.shortcuts || []), item]; });
        ctx.store.bus.emit('shortcuts-changed', { reason: 'add', item });
        render();
      });
      list.replaceChildren(form);
      urlInput.focus();
    }

    const off = ctx.store.bus.on('shortcuts-updated', render);
    render();

    return {
      el,
      onResize: render,
      onExternalChange: render,
      destroy() { off(); },
    };
  },
};
