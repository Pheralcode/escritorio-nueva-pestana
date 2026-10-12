/**
 * Contraste automático del texto sobre el fondo.
 *
 * El problema: un gris translúcido se lee bien sobre un fondo oscuro y
 * desaparece sobre una foto clara. Aquí calculamos qué claridad tiene de verdad
 * la superficie donde cae el texto y elegimos negro o blanco, siempre opaco.
 *
 * La claridad efectiva no es la de la foto a secas: encima lleva la capa de
 * oscurecido y el tinte del vidrio, y ambos los mueve el usuario. Por eso se
 * recalcula desde la luminancia guardada (barata) en vez de volver a analizar
 * la imagen cada vez.
 */

import * as store from './store.js';
import { resolvedTheme } from './theme.js';

const root = document.documentElement;
const UMBRAL = 0.56;   // por encima de esto, el fondo se considera claro

export function effectiveLuminance() {
  const s = store.getState().settings;
  const base = typeof s.wallpaperLum === 'number' ? s.wallpaperLum : null;
  if (base == null) return null;

  // 1. la capa de oscurecido apaga la foto
  const dimmed = base * (1 - (s.wallpaper.dim || 0));
  // 2. el vidrio pone un velo (blanco en oscuro, blanco también en claro)
  const veil = Math.min(0.95, Math.max(0, (s.glass.opacity ?? 0.62) * (resolvedTheme() === 'dark' ? 0.38 : 0.88)));
  return dimmed * (1 - veil) + 1 * veil;
}

/**
 * Claridad de la franja del reloj. A diferencia de los widgets, el reloj está
 * siempre en el mismo sitio, así que puede decidir su color por lo que tiene
 * justo detrás en vez de por la media de toda la foto. Aquí el velo del vidrio
 * no interviene: el reloj no se apoya en ninguna tarjeta.
 */
export function heroEffectiveLuminance() {
  const s = store.getState().settings;
  const base = typeof s.wallpaperLumHero === 'number' ? s.wallpaperLumHero : s.wallpaperLum;
  if (typeof base !== 'number') return null;
  return base * (1 - (s.wallpaper.dim || 0));
}

export function applyContrast() {
  const s = store.getState().settings;
  const hasWallpaper = !!store.getWallpaper() && s.wallpaper.enabled;
  if (!hasWallpaper) {
    root.classList.remove('wp-light', 'wp-dark', 'hero-light', 'hero-dark');
    return null;
  }
  const eff = effectiveLuminance();
  if (eff == null) { root.classList.remove('wp-light', 'wp-dark'); return null; }
  const claro = eff > UMBRAL;
  root.classList.toggle('wp-light', claro);
  root.classList.toggle('wp-dark', !claro);

  const heroEff = heroEffectiveLuminance();
  if (heroEff != null) {
    // El reloj no lleva velo detrás, así que su umbral es algo más alto.
    const heroClaro = heroEff > 0.62;
    root.classList.toggle('hero-light', heroClaro);
    root.classList.toggle('hero-dark', !heroClaro);
  }
  return { eff, claro, heroEff };
}
