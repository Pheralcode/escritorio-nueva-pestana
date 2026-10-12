/**
 * Widget: "app" — un único acceso directo suelto en la pantalla, al estilo de
 * los iconos de inicio de un iPhone.
 *
 * Es un widget normal, así que hereda gratis el motor de arrastre: al mover uno,
 * el resto se recoloca solo. Diferencias con los demás widgets:
 *  - `chrome: 'none'`: sin barra de título; la tarjeta entera es el asa.
 *  - Un arrastre real NO debe abrir el enlace: escuchamos `widget:dragend`.
 */

import { h, icon } from '../core/dom.js';
import { faviconEl, hostOf, openIconDialog } from '../core/favicon.js';
import { attachContextMenu } from '../core/menu.js';

export default {
  type: 'app',
  name: 'App',
  description: 'Un acceso suelto, como un icono de inicio.',
  icon: 'wapp',
  sizes: ['xs', 'sm'],
  defaultSize: 'xs',
  chrome: 'none',
  defaultConfig: { title: '', url: '' },
  configurable: true,
  settings: [
    { key: 'url', label: 'URL', type: 'text', placeholder: 'https://ejemplo.com' },
    { key: 'title', label: 'Nombre', type: 'text' },
  ],

  create(ctx) {
    const el = h('div', { class: 'appicon' });
    let justDragged = false;

    // El motor del grid avisa cuando ha habido arrastre real (no un clic).
    ctx.card.addEventListener('widget:dragend', () => {
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 250);
    });

    function open() {
      const { url } = ctx.config;
      if (url) window.location.href = url;
    }

    function render() {
      const cfg = ctx.config;
      if (!cfg.url) return renderForm();

      const thirdParty = ctx.store.getState().settings.thirdPartyFavicons;
      const item = { title: cfg.title, url: cfg.url };
      const size = ctx.size === 'sm' ? 72 : 52;

      const tile = h('div', {
        class: 'appicon__tile',
        role: 'link',
        tabindex: '0',
        title: `${cfg.title || hostOf(cfg.url)}\n${cfg.url}`,
        onClick: () => { if (!justDragged) open(); },
        onKeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } },
      },
        faviconEl(item, { thirdParty, size }),
        h('span', { class: 'appicon__label' }, cfg.title || hostOf(cfg.url)),
      );

      el.replaceChildren(tile);
    }

    function renderForm() {
      const url = h('input', { class: 'input input--sm', type: 'url', placeholder: 'https://…', 'data-no-drag': '' });
      const name = h('input', { class: 'input input--sm', type: 'text', placeholder: 'Nombre', 'data-no-drag': '' });
      const form = h('form', { class: 'appicon__form', 'data-no-drag': '' },
        url, name,
        h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Guardar'),
      );
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        let value = url.value.trim();
        if (!value) return;
        if (!/^[a-z]+:\/\//i.test(value)) value = `https://${value}`;
        try { new URL(value); } catch { url.focus(); return; }
        ctx.setConfig({ url: value, title: name.value.trim() || hostOf(value) });
        render();
      });
      el.replaceChildren(form);
      setTimeout(() => url.focus(), 30);
    }

    // Sobre toda la tarjeta, no solo sobre el icono: el margen también responde.
    attachContextMenu(ctx.card, () => {
      const cfg = ctx.config;
      return [
        cfg.url && { label: 'Abrir', icon: 'external', run: open },
        cfg.url && { label: 'Añadir al dock', icon: 'plus', run: () => {
          ctx.store.bus.emit('dock-add', { title: cfg.title, url: cfg.url });
        } },
        { label: 'Editar', icon: 'edit', run: renderForm },
        cfg.url && { label: 'Cambiar icono…', icon: 'image', run: () => openIconDialog(cfg.url, render) },
        'sep',
        { label: 'Quitar de la pantalla', icon: 'trash', danger: true, run: () => {
          ctx.store.bus.emit('remove-widget', { id: ctx.id });
        } },
      ].filter(Boolean);
    });

    render();

    return {
      el,
      onConfig: render,
      onResize: render,
      openSettings: renderForm,
    };
  },
};
