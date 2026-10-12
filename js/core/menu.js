/**
 * Menú contextual ligero (clic derecho / botón "···").
 * Se usa desde los accesos, los iconos de app y el dock.
 */

import { h, icon } from './dom.js';

let current = null;

export function closeMenu() {
  if (!current) return;
  current.remove();
  current = null;
  window.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', closeMenu);
  window.removeEventListener('scroll', closeMenu, true);
}

function onOutside(ev) {
  if (current && !current.contains(ev.target)) closeMenu();
}

function onKey(ev) {
  if (ev.key === 'Escape') { ev.stopPropagation(); closeMenu(); }
}

/**
 * @param {{x:number,y:number}} at coordenadas de cliente
 * @param {Array<{label:string, icon?:string, danger?:boolean, run:Function}|'sep'>} items
 */
export function openMenu(at, items) {
  closeMenu();
  const menu = h('div', { class: 'ctxmenu', role: 'menu' },
    ...items.map((it) => (it === 'sep'
      ? h('div', { class: 'ctxmenu__sep' })
      : h('button', {
          class: `ctxmenu__item${it.danger ? ' is-danger' : ''}`,
          type: 'button',
          role: 'menuitem',
          onClick: () => { closeMenu(); it.run(); },
        }, it.icon ? icon(it.icon, 15) : null, h('span', {}, it.label)))),
  );
  menu.style.visibility = 'hidden';
  document.body.append(menu);

  // Colocación: se ajusta para no salirse de la ventana.
  const r = menu.getBoundingClientRect();
  const pad = 8;
  const x = Math.min(at.x, window.innerWidth - r.width - pad);
  const y = at.y + r.height + pad > window.innerHeight ? at.y - r.height : at.y;
  menu.style.left = `${Math.max(pad, x)}px`;
  menu.style.top = `${Math.max(pad, y)}px`;
  menu.style.visibility = '';

  current = menu;
  // `pointerdown` en captura para cerrar antes de que el clic haga otra cosa.
  setTimeout(() => {
    window.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
  }, 0);
  return menu;
}

/**
 * Ata un menú contextual a un elemento (clic derecho + pulsación larga táctil).
 * `opts.skip(target)` permite dejar pasar el menú nativo (p. ej. en campos de texto).
 */
export function attachContextMenu(el, buildItems, opts = {}) {
  el.addEventListener('contextmenu', (ev) => {
    if (opts.skip?.(ev.target)) return;
    ev.preventDefault();
    ev.stopPropagation();
    openMenu({ x: ev.clientX, y: ev.clientY }, buildItems());
  });

  // Pulsación larga para táctil.
  let timer = null;
  el.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch' || opts.skip?.(ev.target)) return;
    timer = setTimeout(() => {
      openMenu({ x: ev.clientX, y: ev.clientY }, buildItems());
    }, 520);
  });
  const cancel = () => { clearTimeout(timer); };
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointermove', cancel);
  el.addEventListener('pointercancel', cancel);
}
