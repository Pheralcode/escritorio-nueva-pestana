/**
 * Grid de widgets con reordenado por arrastre y redimensionado.
 *
 * Decisiones:
 *  - Pointer Events en vez de HTML5 Drag&Drop: el DnD nativo es irregular en
 *    WebKit (Orion/Safari) y no permite animaciones decentes. Pointer Events
 *    funcionan igual en Chrome, Edge y WebKit, y además dan soporte táctil gratis.
 *  - El elemento arrastrado se "levanta" con transform y se reordena el DOM en
 *    vivo mediante hit-testing; el orden del DOM es la fuente de verdad visual y
 *    al soltar se persiste el array de ids.
 *  - Redimensionado: un tirador en la esquina que calcula columnas/filas deseadas
 *    y hace snap al tamaño válido más cercano (sm | md | lg).
 */

/**
 * La rejilla base es fina (columnas de ~112 px) para que un icono de app ocupe
 * exactamente 1x1 y se vea cuadrado, como en la pantalla de inicio de un iPhone.
 * Los widgets normales ocupan varias columnas, así que conservan sus proporciones.
 * Lo que se persiste es la CLAVE ('sm', 'md'…), no los spans: cambiar esta tabla
 * no rompe los layouts ya guardados.
 */
export const SIZES = {
  xs: { cols: 1, rows: 1, label: 'Icono' },
  sm: { cols: 2, rows: 2, label: 'Pequeño' },
  md: { cols: 4, rows: 2, label: 'Mediano' },
  lg: { cols: 4, rows: 4, label: 'Grande' },
};

export const SIZE_ORDER = ['xs', 'sm', 'md', 'lg'];

const DRAG_THRESHOLD = 4; // px antes de considerar que es un arrastre y no un clic

/**
 * @param {object} opts
 * @param {Array<{el:HTMLElement, accepts:(card)=>boolean, onDrop:(card, ev)=>void}>} opts.dropZones
 *        Zonas fuera del grid donde se puede soltar una tarjeta (el dock).
 */
export function createGrid(root, { onReorder, onResize, dropZones = [] }) {
  let drag = null;
  let resize = null;

  root.addEventListener('pointerdown', onPointerDown);

  function cardFrom(target) {
    return target.closest?.('.widget');
  }

  function onPointerDown(ev) {
    if (ev.button != null && ev.button !== 0) return;
    const handle = ev.target.closest?.('[data-resize-handle]');
    if (handle) return startResize(ev, cardFrom(handle));
    // Los botones flotantes de una tarjeta-icono viven DENTRO del asa de arrastre.
    if (ev.target.closest?.('[data-no-drag]')) return;
    const grip = ev.target.closest?.('[data-drag-handle]');
    if (grip) return startDrag(ev, cardFrom(grip));
  }

  /* ---------------------------- arrastre ---------------------------- */

  function startDrag(ev, card) {
    if (!card) return;
    ev.preventDefault();
    const rect = card.getBoundingClientRect();
    drag = {
      card,
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      offsetX: ev.clientX - rect.left,
      offsetY: ev.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      active: false,
    };
    try { card.setPointerCapture(ev.pointerId); } catch { /* noop */ }
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  function activateDrag() {
    const { card, width, height } = drag;
    // Placeholder que conserva el hueco en el grid.
    const ph = document.createElement('div');
    ph.className = 'widget widget--placeholder';
    ph.style.gridColumn = getComputedStyle(card).gridColumn;
    ph.style.gridRow = getComputedStyle(card).gridRow;
    card.after(ph);
    drag.placeholder = ph;

    card.classList.add('is-dragging');
    card.style.position = 'fixed';
    card.style.zIndex = '900';
    card.style.width = `${width}px`;
    card.style.height = `${height}px`;
    card.style.left = '0';
    card.style.top = '0';
    card.style.pointerEvents = 'none';
    root.classList.add('is-reordering');
    document.body.classList.add('no-select');
    drag.active = true;
    drag.rafId = requestAnimationFrame(autoScrollStep);
  }

  /* Auto-scroll: sin esto no se puede mover un widget más allá de lo visible. */
  const EDGE = 72;      // px desde el borde donde empieza a desplazarse
  const MAX_SPEED = 18; // px por frame

  function autoScrollStep() {
    if (!drag || !drag.active) return;
    const y = drag.lastY;
    let delta = 0;
    if (y < EDGE) delta = -MAX_SPEED * (1 - y / EDGE);
    else if (y > window.innerHeight - EDGE) delta = MAX_SPEED * (1 - (window.innerHeight - y) / EDGE);
    if (delta) {
      const before = window.scrollY;
      window.scrollBy(0, delta);
      // Al desplazar, la tarjeta debe seguir bajo el cursor.
      const moved = window.scrollY - before;
      if (moved) {
        drag.card.style.transform =
          `translate(${drag.lastX - drag.offsetX}px, ${drag.lastY - drag.offsetY}px) scale(1.02)`;
        hitTest(drag.lastX, drag.lastY);
      }
    }
    drag.rafId = requestAnimationFrame(autoScrollStep);
  }

  function stopAutoScroll() {
    if (drag?.rafId) cancelAnimationFrame(drag.rafId);
    if (drag) drag.rafId = null;
  }

  /** Zona externa (dock) bajo el puntero que acepte esta tarjeta. */
  function zoneAt(x, y) {
    for (const zone of dropZones) {
      const el = typeof zone.el === 'function' ? zone.el() : zone.el;
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        if (!zone.accepts || zone.accepts(drag.card)) return zone;
      }
    }
    return null;
  }

  /** Coloca el placeholder según la tarjeta que haya bajo el puntero. */
  function hitTest(x, y) {
    const zone = zoneAt(x, y);
    if (zone !== drag.zone) {
      drag.zone?.el?.classList?.remove('is-drop-target');
      (typeof zone?.el === 'function' ? zone.el() : zone?.el)?.classList.add('is-drop-target');
      drag.zone = zone;
      drag.card.classList.toggle('is-over-zone', !!zone);
    }
    if (zone) return;   // sobre el dock no reordenamos el grid

    const under = document.elementFromPoint(x, y);
    const target = under?.closest?.('.widget:not(.is-dragging):not(.widget--placeholder)');
    if (!target || target === drag.placeholder) return;
    const r = target.getBoundingClientRect();
    const beforeTarget = (y < r.top + r.height / 2)
      || (y < r.bottom && x < r.left + r.width / 2);
    if (beforeTarget) target.before(drag.placeholder);
    else target.after(drag.placeholder);
  }

  function onDragMove(ev) {
    if (!drag) return;
    drag.lastX = ev.clientX;
    drag.lastY = ev.clientY;
    if (!drag.active) {
      if (Math.abs(ev.clientX - drag.startX) < DRAG_THRESHOLD &&
          Math.abs(ev.clientY - drag.startY) < DRAG_THRESHOLD) return;
      activateDrag();
    }
    drag.card.style.transform =
      `translate(${ev.clientX - drag.offsetX}px, ${ev.clientY - drag.offsetY}px) scale(1.02)`;

    // La tarjeta arrastrada tiene pointer-events:none, así que elementFromPoint
    // devuelve la tarjeta que hay debajo del cursor.
    hitTest(ev.clientX, ev.clientY);
  }

  function endDrag(ev) {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    if (!drag) return;
    stopAutoScroll();
    const { card, placeholder, pointerId, active } = drag;
    try { card.releasePointerCapture(pointerId); } catch { /* noop */ }

    if (active) {
      stopAutoScroll();
      const zone = drag.zone;
      (typeof zone?.el === 'function' ? zone.el() : zone?.el)?.classList.remove('is-drop-target');
      placeholder.replaceWith(card);
      card.classList.remove('is-dragging', 'is-over-zone');
      // Quitamos SOLO lo que puso activateDrag: un `cssText = ''` se llevaría
      // por delante --w-cols/--w-rows y el widget perdería su tamaño.
      card.style.removeProperty('position');
      card.style.removeProperty('z-index');
      card.style.removeProperty('width');
      card.style.removeProperty('height');
      card.style.removeProperty('left');
      card.style.removeProperty('top');
      card.style.removeProperty('transform');
      card.style.removeProperty('pointer-events');
      root.classList.remove('is-reordering');
      document.body.classList.remove('no-select');
      applySize(card, card.dataset.size); // reafirma --w-cols/--w-rows
      // Una tarjeta que es a la vez enlace (icono de app) necesita saber que esto
      // fue un arrastre y no un clic, para no navegar al soltar.
      card.dispatchEvent(new CustomEvent('widget:dragend', { detail: { moved: true } }));

      if (zone) {
        zone.onDrop(card, ev);   // se va al dock: la zona decide qué hacer
        drag = null;
        return;
      }

      card.classList.add('just-dropped');
      setTimeout(() => card.classList.remove('just-dropped'), 320);
      onReorder?.(currentOrder());
    }
    drag = null;
  }

  /* -------------------------- redimensionado -------------------------- */

  function metrics() {
    const cs = getComputedStyle(root);
    const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const gap = parseFloat(cs.gap || cs.columnGap || '16') || 16;
    const rowH = parseFloat(cs.gridAutoRows) || 110;
    const colW = (root.clientWidth - gap * (cols - 1)) / cols;
    return { cols, gap, rowH, colW };
  }

  function startResize(ev, card) {
    if (!card) return;
    ev.preventDefault();
    ev.stopPropagation();
    const rect = card.getBoundingClientRect();
    const allowed = (card.dataset.sizes || SIZE_ORDER.join(',')).split(',');
    resize = {
      card,
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      startW: rect.width,
      startH: rect.height,
      original: card.dataset.size,
      allowed,
      current: card.dataset.size,
    };
    card.classList.add('is-resizing');
    document.body.classList.add('no-select');
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', endResize);
    window.addEventListener('pointercancel', endResize);
  }

  function onResizeMove(ev) {
    if (!resize) return;
    const { colW, rowH, gap, cols } = metrics();
    const w = resize.startW + (ev.clientX - resize.startX);
    const h = resize.startH + (ev.clientY - resize.startY);
    const wantCols = Math.max(1, Math.min(cols, Math.round((w + gap) / (colW + gap))));
    const wantRows = Math.max(1, Math.round((h + gap) / (rowH + gap)));

    // Snap al tamaño permitido con menor distancia (cols pesa más que rows).
    let best = resize.allowed[0];
    let bestScore = Infinity;
    for (const key of resize.allowed) {
      const s = SIZES[key];
      if (!s) continue;
      const score = Math.abs(s.cols - wantCols) * 2 + Math.abs(s.rows - wantRows);
      if (score < bestScore) { bestScore = score; best = key; }
    }
    if (best !== resize.current) {
      resize.current = best;
      applySize(resize.card, best);
    }
  }

  function endResize() {
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', endResize);
    window.removeEventListener('pointercancel', endResize);
    if (!resize) return;
    resize.card.classList.remove('is-resizing');
    document.body.classList.remove('no-select');
    if (resize.current !== resize.original) {
      onResize?.(resize.card.dataset.id, resize.current);
    }
    resize = null;
  }

  function currentOrder() {
    return [...root.querySelectorAll('.widget:not(.widget--placeholder)')]
      .map((el) => el.dataset.id)
      .filter(Boolean);
  }

  return {
    currentOrder,
    destroy() {
      root.removeEventListener('pointerdown', onPointerDown);
    },
  };
}

/** Aplica el tamaño a una tarjeta (spans del grid + atributo data). */
export function applySize(card, size) {
  const s = SIZES[size] || SIZES.md;
  card.dataset.size = size;
  card.style.setProperty('--w-cols', s.cols);
  card.style.setProperty('--w-rows', s.rows);
  card.dispatchEvent(new CustomEvent('widget:resized', { detail: { size }, bubbles: false }));
}

/** Siguiente tamaño en el ciclo, limitado a los permitidos por el widget. */
export function nextSize(size, allowed = SIZE_ORDER) {
  const list = SIZE_ORDER.filter((s) => allowed.includes(s));
  const i = list.indexOf(size);
  return list[(i + 1) % list.length] || list[0];
}
