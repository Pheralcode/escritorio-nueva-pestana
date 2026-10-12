/** Formato de hora y fecha. Compartido por el reloj principal y el modo minimalista. */

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function formatTime(date, { hour24 = true, seconds = false } = {}) {
  let h12 = date.getHours();
  let suffix = '';
  if (!hour24) {
    suffix = h12 >= 12 ? ' PM' : ' AM';
    h12 = h12 % 12 || 12;
  }
  const hh = hour24 ? String(date.getHours()).padStart(2, '0') : String(h12);
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}${seconds ? `:${ss}` : ''}${suffix}`;
}

/** "sábado, 22 de agosto" (como la pantalla de bloqueo de iOS). */
export function formatDate(date) {
  return `${DAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

/**
 * Programa la siguiente actualización justo en el cambio de minuto (o de segundo),
 * en vez de sondear cada segundo: cero repintados de más.
 */
export function scheduleTick(fn, { seconds = false } = {}) {
  let timer = null;
  const run = () => {
    fn();
    const now = new Date();
    const ms = seconds
      ? 1000 - now.getMilliseconds()
      : (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    timer = setTimeout(run, Math.max(200, ms));
  };
  run();
  return () => clearTimeout(timer);
}
