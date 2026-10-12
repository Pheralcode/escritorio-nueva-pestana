/**
 * Widget: clima con Open-Meteo (sin API key, sin registro).
 *
 * Red: solo se llama cuando el usuario ha elegido una ubicación, y con caché
 * de 30 min en storage. Open-Meteo envía `Access-Control-Allow-Origin: *`, así
 * que no hacen falta host_permissions ni en Chrome MV3 ni en Orion.
 */

import { h, icon, iconButton, formatRelative, setChildren } from '../core/dom.js';
import * as store from '../core/store.js';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const CACHE_MS = 15 * 60 * 1000;   // los datos se consideran frescos 15 min
const CHECK_MS = 60 * 1000;        // cada minuto se comprueba si ya caducaron

/** Códigos WMO -> etiqueta + icono (día/noche). */
export const WMO = {
  0: ['Despejado', 'cSun', 'cMoon'],
  1: ['Mayormente despejado', 'cSun', 'cMoon'],
  2: ['Parcialmente nublado', 'cPartly', 'cCloud'],
  3: ['Nublado', 'cCloud', 'cCloud'],
  45: ['Niebla', 'cFog', 'cFog'],
  48: ['Niebla helada', 'cFog', 'cFog'],
  51: ['Llovizna ligera', 'cDrizzle', 'cDrizzle'],
  53: ['Llovizna', 'cDrizzle', 'cDrizzle'],
  55: ['Llovizna intensa', 'cRain', 'cRain'],
  56: ['Llovizna helada', 'cDrizzle', 'cDrizzle'],
  57: ['Llovizna helada', 'cDrizzle', 'cDrizzle'],
  61: ['Lluvia ligera', 'cDrizzle', 'cDrizzle'],
  63: ['Lluvia', 'cRain', 'cRain'],
  65: ['Lluvia fuerte', 'cRain', 'cRain'],
  66: ['Lluvia helada', 'cRain', 'cRain'],
  67: ['Lluvia helada', 'cRain', 'cRain'],
  71: ['Nieve ligera', 'cSnow', 'cSnow'],
  73: ['Nieve', 'cSnow', 'cSnow'],
  75: ['Nieve intensa', 'cSnow', 'cSnow'],
  77: ['Granos de nieve', 'cSnow', 'cSnow'],
  80: ['Chubascos', 'cRain', 'cRain'],
  81: ['Chubascos', 'cRain', 'cRain'],
  82: ['Chubascos fuertes', 'cStorm', 'cStorm'],
  85: ['Chubascos de nieve', 'cSnow', 'cSnow'],
  86: ['Chubascos de nieve', 'cSnow', 'cSnow'],
  95: ['Tormenta', 'cStorm', 'cStorm'],
  96: ['Tormenta con granizo', 'cStorm', 'cStorm'],
  99: ['Tormenta con granizo', 'cStorm', 'cStorm'],
};

export function describeCode(code, isDay = true) {
  const entry = WMO[code] || ['—', 'cThermo', 'cThermo'];
  return { label: entry[0], icon: isDay ? entry[1] : entry[2] };
}

export async function geocode(name, signal) {
  const url = `${GEOCODE}?name=${encodeURIComponent(name)}&count=5&language=es&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocoding ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: r.name,
    admin: r.admin1 || '',
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export async function fetchWeather({ lat, lon, unit = 'celsius' }, signal) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,relative_humidity_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '4',
    temperature_unit: unit,
    wind_speed_unit: unit === 'fahrenheit' ? 'mph' : 'kmh',
  });
  const res = await fetch(`${FORECAST}?${params}`, { signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

export default {
  type: 'weather',
  name: 'Clima',
  description: 'Tiempo actual y previsión (Open-Meteo, sin clave).',
  icon: 'cPartly',
  sizes: ['sm', 'md', 'lg'],
  defaultSize: 'sm',
  defaultConfig: { place: null, unit: 'celsius' },
  configurable: true,

  create(ctx) {
    const el = h('div', { class: 'weather' });
    let abort = null;
    let refreshTimer = null;

    const cacheKey = () => `weather:${ctx.id}`;

    async function load({ force = false } = {}) {
      const cfg = ctx.config;
      if (!cfg.place) return renderPicker();

      if (!force) {
        const cached = await store.readCache(cacheKey());
        if (cached && Date.now() - cached.at < CACHE_MS && cached.unit === cfg.unit) {
          return renderData(cached.data, cfg, cached.at);
        }
      }

      // Solo mostramos "Cargando" si no hay nada que enseñar: si ya hay datos en
      // pantalla se actualizan en silencio y la tarjeta no parpadea.
      if (!el.querySelector('.weather__temp')) renderLoading();
      abort?.abort();
      abort = new AbortController();
      try {
        const data = await fetchWeather({ ...cfg.place, unit: cfg.unit }, abort.signal);
        await store.writeCache(cacheKey(), { at: Date.now(), unit: cfg.unit, data });
        renderData(data, cfg, Date.now());
      } catch (e) {
        if (e.name === 'AbortError') return;
        const cached = await store.readCache(cacheKey());
        if (cached) renderData(cached.data, cfg, cached.at, 'Sin conexión: datos en caché');
        else renderError(e);
      }
    }

    function renderLoading() {
      el.replaceChildren(h('div', { class: 'weather__loading' }, 'Cargando clima…'));
    }

    function renderError(e) {
      el.replaceChildren(
        h('div', { class: 'weather__error' },
          h('p', {}, 'No se pudo obtener el clima.'),
          h('p', { class: 'faint' }, String(e.message || e)),
          h('div', { class: 'row' },
            h('button', { class: 'btn', type: 'button', onClick: () => load({ force: true }) }, 'Reintentar'),
            h('button', { class: 'btn btn--ghost', type: 'button', onClick: openLocationDialog }, 'Cambiar ciudad'),
          ),
        ),
      );
    }

    /**
     * Estado vacío: dentro de la tarjeta solo cabe un aviso y un botón. La
     * búsqueda de verdad se hace en un diálogo aparte, donde la lista de
     * ciudades tiene sitio: dentro del widget pequeño quedaba recortada.
     */
    function renderPicker(message) {
      el.replaceChildren(h('div', { class: 'weather__empty' },
        h('span', { class: 'weather__glyph' }, icon('cPartly', 34)),
        h('p', { class: 'faint' }, message || 'Sin ubicación'),
        h('button', {
          class: 'btn btn--primary', type: 'button', onClick: openLocationDialog,
        }, 'Elegir ubicación'),
      ));
    }

    /** Diálogo de búsqueda de ciudad (también es el panel de ajustes del widget). */
    function openLocationDialog() {
      const input = h('input', {
        class: 'input', type: 'search', placeholder: 'Escribe una ciudad',
        'aria-label': 'Buscar ciudad', autocomplete: 'off',
      });
      const list = h('ul', { class: 'weather__results' });
      const status = h('p', { class: 'faint' }, 'Escribe al menos dos letras.');

      const unitSelect = h('select', { class: 'input' },
        h('option', { value: 'celsius', selected: ctx.config.unit !== 'fahrenheit' }, 'Celsius (°C)'),
        h('option', { value: 'fahrenheit', selected: ctx.config.unit === 'fahrenheit' }, 'Fahrenheit (°F)'),
      );
      unitSelect.addEventListener('change', () => {
        ctx.setConfig({ unit: unitSelect.value });
        load({ force: true });
      });

      const dialog = h('div', { class: 'overlay' },
        h('div', { class: 'minidialog' },
          h('h3', {}, 'Ubicación del clima'),
          h('div', { class: 'field' }, h('label', {}, 'Ciudad'), input),
          status,
          list,
          h('div', { class: 'field' }, h('label', {}, 'Unidad'), unitSelect),
          h('div', { class: 'row-end' },
            h('button', {
              class: 'btn btn--ghost', type: 'button',
              onClick: () => { useGeolocation(status, dialog); },
            }, 'Usar mi ubicación'),
            h('button', { class: 'btn', type: 'button', onClick: () => dialog.remove() }, 'Cerrar'),
          ),
        ),
      );
      dialog.addEventListener('pointerdown', (ev) => { if (ev.target === dialog) dialog.remove(); });
      document.body.append(dialog);
      setTimeout(() => input.focus(), 40);

      let searchTimer = null;
      let searchAbort = null;
      const runSearch = async () => {
        const q = input.value.trim();
        if (q.length < 2) { list.replaceChildren(); status.textContent = 'Escribe al menos dos letras.'; return; }
        status.textContent = 'Buscando…';
        list.replaceChildren();
        searchAbort?.abort();
        searchAbort = new AbortController();
        try {
          const places = await geocode(q, searchAbort.signal);
          if (!places.length) { status.textContent = `Sin resultados para «${q}».`; return; }
          status.textContent = `${places.length} resultado${places.length === 1 ? '' : 's'}:`;
          list.replaceChildren(...places.map((p) => h('li', {},
            h('button', {
              class: 'weather__result', type: 'button',
              onClick: () => {
                ctx.setConfig({ place: p, unit: unitSelect.value });
                dialog.remove();
                load({ force: true });
              },
            },
              h('span', { class: 'weather__result-name' }, p.name),
              h('span', { class: 'weather__result-where faint' },
                [p.admin, p.country].filter(Boolean).join(' · ')),
            ),
          )));
        } catch (e) {
          if (e.name === 'AbortError') return;
          status.textContent = 'No se pudo buscar. Revisa la conexión.';
        }
      };
      // Búsqueda al escribir, sin tener que pulsar ningún botón.
      input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runSearch, 320);
      });
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); clearTimeout(searchTimer); runSearch(); }
      });
    }

    function useGeolocation(status, dialog) {
      if (!navigator.geolocation) { status.textContent = 'Este navegador no da la ubicación.'; return; }
      status.textContent = 'Pidiendo ubicación…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          ctx.setConfig({ place: { name: 'Mi ubicación', admin: '', country: '', lat: pos.coords.latitude, lon: pos.coords.longitude } });
          dialog.remove();
          load({ force: true });
        },
        () => { status.textContent = 'Permiso denegado o no disponible. Busca la ciudad a mano.'; },
        { timeout: 8000, maximumAge: 600000 },
      );
    }

    function renderData(data, cfg, at, notice) {
      const cur = data.current || {};
      const isDay = cur.is_day !== 0;
      const { label, icon: glyph } = describeCode(cur.weather_code, isDay);
      const u = cfg.unit === 'fahrenheit' ? '°F' : '°C';
      const size = ctx.size;

      const head = h('div', { class: 'weather__head' },
        h('span', { class: 'weather__glyph' }, icon(glyph, 44)),
        h('div', { class: 'weather__now' },
          h('div', { class: 'weather__temp' }, `${Math.round(cur.temperature_2m)}${u}`),
          h('div', { class: 'weather__label' }, label),
        ),
      );

      const place = h('div', { class: 'weather__place' },
        h('span', {}, cfg.place.name + (cfg.place.country ? `, ${cfg.place.country}` : '')),
        iconButton('refresh', 'Actualizar', () => load({ force: true })),
      );

      const children = [place, head];

      if (size !== 'sm') {
        children.push(h('div', { class: 'weather__meta' },
          h('span', {}, `Sensación ${Math.round(cur.apparent_temperature)}${u}`),
          h('span', {}, `Humedad ${cur.relative_humidity_2m}%`),
          h('span', {}, `Viento ${Math.round(cur.wind_speed_10m)} ${cfg.unit === 'fahrenheit' ? 'mph' : 'km/h'}`),
        ));
      }

      if (size === 'lg' && data.daily) {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const rows = data.daily.time.slice(1).map((iso, i) => {
          const d = new Date(`${iso}T12:00:00`);
          const w = describeCode(data.daily.weather_code[i + 1], true);
          return h('div', { class: 'weather__day' },
            h('span', {}, days[d.getDay()]),
            h('span', { class: 'weather__dayglyph' }, icon(w.icon, 18)),
            h('span', { class: 'muted' }, `${Math.round(data.daily.temperature_2m_min[i + 1])}°`),
            h('span', {}, `${Math.round(data.daily.temperature_2m_max[i + 1])}°`),
          );
        });
        children.push(h('div', { class: 'weather__forecast' }, ...rows));
      }

      lastFoot = notice || `Actualizado ${formatRelative(at)}`;
      children.push(h('div', {
        class: 'weather__foot faint',
        dataset: notice ? { notice: '1' } : {},
      }, lastFoot));
      setChildren(el, ...children);
    }

    /**
     * Refresco automático. Se comprueba cada minuto si la caché ya caducó, en
     * vez de esperar a un intervalo largo: así una pestaña que lleva horas
     * abierta —o que vuelve de segundo plano— se pone al día enseguida. La red
     * solo se toca cuando los datos están realmente caducados.
     */
    let lastCheck = 0;
    async function refreshIfStale({ force = false } = {}) {
      if (!ctx.config.place || document.visibilityState !== 'visible') return;
      // Los eventos de visibilidad pueden llegar en ráfaga; no hace falta
      // consultar el almacenamiento más de una vez cada pocos segundos.
      const now = Date.now();
      if (!force && now - lastCheck < 10000) return;
      lastCheck = now;
      const cached = await store.readCache(cacheKey());
      if (!cached || now - cached.at >= CACHE_MS) load({ force: true });
      else updateFreshness(cached.at);
    }

    /**
     * Refresca el "hace X min" sin pedir nada a la red y —importante— sin tocar
     * el DOM si el texto no ha cambiado: asignar textContent reemplaza el nodo
     * aunque el contenido sea idéntico, y eso repinta la tarjeta.
     */
    let lastFoot = '';
    function updateFreshness(at) {
      const foot = el.querySelector('.weather__foot');
      if (!foot || foot.dataset.notice) return;
      const text = `Actualizado ${formatRelative(at)}`;
      if (text === lastFoot) return;
      foot.textContent = text;
      lastFoot = text;
    }

    const onVisible = () => { if (document.visibilityState === 'visible') refreshIfStale(); };
    const onOnline = () => refreshIfStale();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    load();
    refreshTimer = setInterval(refreshIfStale, CHECK_MS);

    return {
      el,
      onConfig() { load({ force: true }); },
      onResize() { load(); },
      openSettings: openLocationDialog,
      destroy() {
        abort?.abort();
        clearInterval(refreshTimer);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', onOnline);
      },
    };
  },
};
