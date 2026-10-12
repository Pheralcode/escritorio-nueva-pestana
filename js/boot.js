/**
 * Script bloqueante y diminuto que corre ANTES del CSS pesado.
 *
 * chrome.storage.local es asíncrono, así que el primer frame llegaría sin tema
 * ni fondo (flash blanco). Guardamos un espejo del aspecto en localStorage
 * SOLO para pintar ese primer frame. No es fuente de verdad: main.js sobrescribe
 * todo con lo que haya en chrome.storage.local en cuanto resuelve.
 * Se puede desactivar en Ajustes → "Caché de primer pintado".
 */
(function () {
  var root = document.documentElement;
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem('pt.firstPaint') || 'null'); } catch (e) { /* noop */ }

  var theme = (cached && cached.theme) || 'system';
  root.dataset.theme = theme;
  root.dataset.resolvedTheme = theme === 'system'
    ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  if (cached && cached.accent) {
    root.style.setProperty('--accent', cached.accent);
  }
  if (cached && cached.glass) {
    root.style.setProperty('--glass-opacity', String(cached.glass.opacity));
    root.style.setProperty('--glass-blur', cached.glass.blur + 'px');
    root.style.setProperty('--glass-sat', cached.glass.saturation + '%');
  }
  if (cached && cached.dock) root.classList.add('has-dock');
  if (cached && cached.contrast) root.classList.add('wp-' + cached.contrast);
  if (cached && cached.heroContrast) root.classList.add('hero-' + cached.heroContrast);
  if (cached && cached.minimal) root.classList.add('is-minimal');
  if (cached && cached.wp) {
    root.style.setProperty('--wallpaper', 'url("' + cached.wp + '")');
    root.style.setProperty('--wallpaper-dim', String(cached.dim != null ? cached.dim : 0.35));
    root.style.setProperty('--wallpaper-blur', (cached.blur || 0) + 'px');
    root.classList.add('has-wallpaper');
  }
})();
