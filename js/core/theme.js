/** Tema (claro/oscuro/sistema) y color de acento como CSS custom properties. */

const root = document.documentElement;
let mediaQuery = null;
let mediaHandler = null;

export function applyTheme(theme) {
  root.dataset.theme = theme;
  if (mediaQuery && mediaHandler) {
    // WebKit antiguo solo soporta addListener/removeListener.
    if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', mediaHandler);
    else if (mediaQuery.removeListener) mediaQuery.removeListener(mediaHandler);
  }
  if (theme === 'system') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaHandler = () => { root.dataset.resolvedTheme = mediaQuery.matches ? 'dark' : 'light'; };
    mediaHandler();
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', mediaHandler);
    else if (mediaQuery.addListener) mediaQuery.addListener(mediaHandler);
  } else {
    root.dataset.resolvedTheme = theme;
  }
}

export function resolvedTheme() {
  return root.dataset.resolvedTheme === 'dark' ? 'dark' : 'light';
}

/* --------- utilidades de color (sin depender de color-mix) --------- */

export function hexToRgb(hex) {
  let s = String(hex).replace('#', '').trim();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) s = '6d5efc';
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

/** Luminancia relativa (WCAG) para decidir texto blanco/negro sobre el acento. */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function applyAccent(hex) {
  const accent = /^#?[0-9a-fA-F]{3,6}$/.test(String(hex)) ? (hex.startsWith('#') ? hex : `#${hex}`) : '#6d5efc';
  const { r, g, b } = hexToRgb(accent);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  root.style.setProperty('--accent-strong', mix(accent, '#000000', 0.18));
  root.style.setProperty('--accent-soft', mix(accent, '#ffffff', 0.72));
  root.style.setProperty('--accent-contrast', luminance(accent) > 0.45 ? '#101014' : '#ffffff');
}

/** Vidrio: opacidad, desenfoque y saturación como custom properties globales. */
export function applyGlass(glass = {}) {
  const opacity = Math.min(1, Math.max(0, Number(glass.opacity ?? 0.62)));
  const blur = Math.min(60, Math.max(0, Number(glass.blur ?? 18)));
  const sat = Math.min(300, Math.max(100, Number(glass.saturation ?? 180)));
  root.style.setProperty('--glass-opacity', String(opacity));
  root.style.setProperty('--glass-blur', `${blur}px`);
  root.style.setProperty('--glass-sat', `${sat}%`);
  // Con muy poca opacidad el borde especular es lo único que dibuja la tarjeta:
  // lo reforzamos para que el widget no se pierda contra el fondo.
  root.classList.toggle('glass-faint', opacity < 0.25);
}

/* ------------------------------------------------------------------ *
 * Tipografía del reloj
 * ------------------------------------------------------------------ */

/**
 * Fuentes disponibles. Todas son del sistema: no se descarga nada, así que no
 * hay peticiones de red ni hace falta tocar la CSP de la extensión. Los
 * genéricos `ui-*` los resuelve el propio motor a la familia nativa (en macOS,
 * la familia SF correspondiente).
 */
export const CLOCK_FONTS = {
  system: {
    label: 'Sistema',
    stack: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", system-ui, sans-serif',
  },
  rounded: {
    label: 'Redondeada',
    stack: 'ui-rounded, "SF Pro Rounded", "Varela Round", "Hiragino Maru Gothic ProN", system-ui, sans-serif',
  },
  serif: {
    label: 'Serif',
    stack: 'ui-serif, "New York", Georgia, "Times New Roman", serif',
  },
  elegant: {
    label: 'Elegante',
    stack: 'Didot, "Bodoni 72", "Playfair Display", Georgia, serif',
  },
  mono: {
    label: 'Monoespaciada',
    stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
  condensed: {
    label: 'Condensada',
    stack: '"Avenir Next Condensed", "HelveticaNeue-CondensedBold", "Arial Narrow", "Roboto Condensed", sans-serif',
  },
};

/** Aplica fuente, grosor y cuánto cristal tiene la tipografía del reloj. */
export function applyClockStyle(clock = {}) {
  const font = CLOCK_FONTS[clock.font] || CLOCK_FONTS.system;
  const weight = Math.min(900, Math.max(100, Number(clock.weight ?? 250)));
  // El deslizador se expresa como transparencia (0 = sólido); en CSS es cómodo
  // el valor complementario.
  const transparency = Math.min(1, Math.max(0, Number(clock.transparency ?? 0)));
  root.style.setProperty('--clock-font', font.stack);
  root.style.setProperty('--clock-weight', String(weight));
  root.style.setProperty('--clock-solid', String(1 - transparency));
}
