# Escritorio en la nueva pestaña

Reemplaza la página de **Nueva Pestaña** por un escritorio personal. 100 % local: sin
backend, sin cuentas, sin analítica, sin telemetría.

- **Stack:** HTML/CSS/JS vanilla con módulos ES. Sin build, sin dependencias, sin
  `npm install`. La carpeta que descargas es la que carga el navegador.
- **Estado:** todo en `chrome.storage.local`. Nunca `chrome.storage.sync`.
- **Red:** solo la que tú disparas — clima (Open-Meteo), el feed RSS que añadas y los
  favicons de tus propios accesos.

La página tiene tres zonas fijas y una libre:

| Zona | Qué es |
|---|---|
| **Reloj** | Centrado arriba, estilo pantalla de bloqueo. Las cifras **son** el cristal. Segundos opcionales. |
| **Buscador** | Pastilla pequeña bajo el reloj. Se expande al llamarla con `⌘K` o al escribir. |
| **Dock** | Barra inferior con magnificación al pasar el cursor. |
| **Escritorio** | Widgets e iconos de app, colocados a tu gusto. |

Sin barra de herramientas, sin marca y sin emojis: toda la iconografía son SVG dibujados
en `js/core/dom.js`. La tipografía es la del sistema (`-apple-system`), que en macOS es
San Francisco — la misma que usa Apple en su interfaz, sin descargar nada ni tocar la CSP.

### Toda la configuración está en el clic derecho

No hay barra de herramientas ni botones flotantes: la página es solo tu contenido.

| Dónde haces clic derecho | Qué sale |
|---|---|
| Fondo vacío | Añadir widget · Añadir favorito · Modo minimalista · Buscar · Ajustes |
| Un widget | Tamaño, ajustes de ese widget, quitar, y los ajustes generales |
| Un icono de app | Abrir, añadir al dock, editar, quitar de la pantalla |
| Un elemento del dock | Abrir, poner en la pantalla, quitar del dock |
| Un campo de texto | El menú nativo del navegador (copiar/pegar) |

En pantallas táctiles, la pulsación larga hace lo mismo. También quedan los atajos de
teclado: `,` abre ajustes y `m` alterna el modo minimalista.

### Tus enlaces, en tres sitios a la vez

| Superficie | Qué es | Cómo se ordena |
|---|---|---|
| **Widget de accesos** | Cuadrícula dentro de una tarjeta | Se añaden y quitan desde el widget |
| **Iconos sueltos** | Widgets de 1×1 en la pantalla | Arrastra uno y los demás se recolocan |
| **Dock** | Barra inferior | Arrastra para reordenar |

Y se mueven entre superficies **arrastrando**: saca un icono del dock y suéltalo en la
pantalla, o arrastra un icono de la pantalla sobre el dock. La zona de destino se ilumina
mientras arrastras.

---

## Instalación

### Chrome / Edge

1. Abre `chrome://extensions` (o `edge://extensions`).
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `nuevapestana/`.
4. Abre una pestaña nueva.

Si otra extensión ya controla la nueva pestaña, Chrome te preguntará cuál conservar.

### Orion (macOS / iOS)

Orion usa WebKit con una capa de compatibilidad para extensiones de Chrome y Firefox.

1. **Configuración** (`⌘,`) → pestaña **Extensiones**.
2. Activa **Developer Mode**.
3. Pulsa **Add Extension…** (o *Install from folder*) y selecciona la carpeta `nuevapestana/`
   descomprimida.
4. Activa la extensión en la lista y abre una pestaña nueva.

En iOS/iPadOS la instalación se hace desde **Ajustes de Orion → Extensiones**, partiendo de
un `.zip` de la carpeta.

> Si Orion no aplica el override de la nueva pestaña, la extensión sigue siendo usable:
> abre el dashboard desde el icono de la barra → **Abrir dashboard**.

### Sin extensión (desarrollo)

```bash
python3 -m http.server 8777
```

Abre `http://localhost:8777/newtab.html`. Fuera de una extensión, la capa de compatibilidad
usa `localStorage` como respaldo para que puedas iterar sobre la interfaz sin recargar la
extensión en cada cambio.

---

## Galería de widgets

`Clic derecho → Añadir widget` abre una lámina inferior con la vista previa de cada uno,
como la galería de la pantalla de inicio de un iPhone. **Arrastra una tarjeta fuera de la
lámina y suéltala donde quieras**: la lámina se retrae para dejar el escritorio a la vista,
la zona de destino se ilumina y el widget se crea exactamente en esa posición, no al final.
Un toque simple también lo añade.

### Widgets disponibles

| Widget | Qué hace |
|---|---|
| **Clima** | Tiempo actual y previsión de 3 días (Open-Meteo, sin clave). Se refresca solo, la ciudad se busca en un diálogo propio con resultados según escribes. |
| **Notas** | Texto libre con autoguardado. |
| **Enfoque** | Temporizador tipo Pomodoro. |
| **Accesos** | Cuadrícula de enlaces con favicon en alta resolución. |
| **RSS** | Titulares de un feed, parseados en un Web Worker. |
| **Tareas** | Lista de pendientes; los no completados suben solos. |
| **Calendario** | El mes en curso, navegable, con hoy marcado. |
| **Reloj mundial** | Hora en otras ciudades vía `Intl` (el horario de verano se resuelve solo). |
| **Cuenta atrás** | Días hasta una fecha. |
| **Calculadora** | Evaluador propio (shunting-yard), sin `eval` ni `new Function`. |
| **Hábitos** | Siete casillas por semana y racha de días consecutivos. |
| **App** | Un acceso suelto, tamaño 1×1. |

---

## Vidrio líquido

Las tarjetas usan tres capas para imitar el cristal de Apple: `backdrop-filter` con
saturación (el fondo se ve a través, más vivo), un borde especular interior que simula el
canto biselado, y un brillo diagonal sobre la mitad superior.

Lo llevan las tarjetas, la lámina del reloj, la barra de búsqueda, el dock, el panel de
ajustes, los menús contextuales, la galería y los avisos: toda la interfaz habla el mismo
idioma. En **Ajustes → Apariencia → Vidrio de los widgets** controlas:

| Control | Rango | Efecto |
|---|---|---|
| Opacidad | 0 – 1 | Cuánto tinte tiene el cristal. A 0.1 la tarjeta es casi solo desenfoque. |
| Desenfoque | 0 – 50 px | Cuánto difumina lo que hay detrás. |
| Saturación | 100 – 260 % | Aviva los colores del fondo al atravesarlo. |

La opacidad que eliges se escala por tema: el mismo valor da un cristal legible sobre fondo
claro y otro sobre fondo oscuro o sobre una foto, porque un 60 % de blanco es sólido sobre
gris claro pero casi invisible sobre negro. El borde especular se refuerza cuando bajas
mucho la opacidad, para que la tarjeta no desaparezca del todo.

## Cristal en la tipografía

El reloj no vive dentro de una caja: son los propios glifos los que son de vidrio. Tres
capas sobre la misma silueta de la letra:

1. **Relleno translúcido en degradado** — el fondo se ve *a través* de la cifra, más claro
   arriba (donde daría la luz) y más denso abajo.
2. **Refracción** — dentro de los glifos se pinta una copia diminuta del fondo (64 px,
   ~2 KB) estirada a pantalla completa con `background-attachment: fixed`. Al estar anclada
   al viewport igual que el fondo real, lo que se ve por la letra coincide con lo que hay
   detrás, pero difuminado: como mirar a través de un cristal grueso. Sin máscaras ni SVG.
3. **Canto biselado** — dos `drop-shadow`, uno blanco y corto arriba y otro oscuro y amplio
   abajo. `drop-shadow` sigue el alfa del glifo, no su caja: por eso funciona aquí donde un
   `box-shadow` no serviría.

## Superficies flotantes

Los ajustes no son un cajón lateral: son una tarjeta centrada de cristal, igual que los
menús contextuales, el buscador, la galería y los avisos. Todas comparten el mismo material
—translúcido, muy desenfocado y saturado— y **todas declaran su propio color de texto**.

Esto último no es un detalle: el contraste automático de más abajo elige negro o blanco
según la foto de fondo, pero un menú tiene su propio fondo encima de esa foto. Sin separar
ambas cosas se daba el caso de texto negro sobre un panel oscuro —o blanco sobre uno claro—
según el wallpaper que hubiera detrás. El material de los paneles lleva tinte suficiente
para que su texto siempre se lea, independientemente de la imagen.

### Personalizar la tipografía del reloj

En **Ajustes → Apariencia → Reloj**, con vista previa en vivo:

| Control | Qué hace |
|---|---|
| **Tipografía** | Sistema · Redondeada · Serif · Elegante · Monoespaciada · Condensada. Todas del sistema: no se descarga nada, así que no hay peticiones de red ni hace falta tocar la CSP. |
| **Grosor** | De 100 (ultrafina) a 700 (negrita). |
| **Cristal de la fuente** | De 0 % (relleno casi opaco) a 90 % (cristal casi puro, el fondo atraviesa la cifra entera). |

> Otro detalle: en el panel de ajustes y en la galería, la cabecera y las
> pestañas llevan `flex: none`. Sin eso, al desbordar el contenido flexbox les
> robaba altura —el botón activo quedaba de 15 px teniendo 14 px de relleno— y su
> píldora salía descuadrada respecto al texto. El único que debe ceder y
> desplazarse es el cuerpo.

> Detalle de implementación que costó un rato: los segundos van en un `<span>`
> dentro del reloj y al principio llevaban `opacity`. Eso les crea una capa de
> composición propia, el `background-clip: text` del padre deja de alcanzarlos y,
> como el relleno va en transparente, se volvían **invisibles** aunque estuvieran
> en el DOM. Ahora el `<span>` declara su propio recorte de fondo.

## Repintar solo cuando algo cambia

Los widgets no tocan el DOM si no hay nada nuevo que mostrar. Suena obvio, pero es la causa
de un parpadeo que costó encontrar: el temporizador recreaba el icono SVG de su botón **tres
veces por segundo aunque estuviera parado**, y el clima reescribía su pie («Actualizado hace
X min») aunque el texto fuera idéntico —asignar `textContent` reemplaza el nodo aunque el
contenido no cambie, y eso repinta la tarjeta—.

Ahora cada widget compara con lo último que pintó y escribe solo la diferencia, y los bucles
se paran cuando no hay nada que animar. Medido con un `MutationObserver`: **cero mutaciones
en 10 segundos** con el escritorio en reposo.

El clima, además, comprueba cada minuto si su caché (15 min) ha caducado —en vez de esperar
a un intervalo largo—, y también al volver a la pestaña o al recuperar la conexión. Si ya hay
datos en pantalla se actualizan en silencio, sin pasar por el estado «Cargando».

## Contraste automático del texto

Un gris translúcido se lee bien sobre fondo oscuro y desaparece sobre una foto clara. El
texto nunca es gris: es **negro o blanco**, siempre opaco, elegido midiendo la claridad real
de la superficie donde cae.

Y esa claridad no es la de la foto a secas — encima llevan la capa de oscurecido y el velo
del vidrio, que además el usuario mueve con los deslizadores. Se calcula la luminancia media
del fondo una vez (Rec. 709), se guarda, y a partir de ahí basta aritmética para recalcular
el resultado cada vez que cambias la opacidad, el oscurecido o el tema.

## Color de acento automático

Por defecto sale del fondo y nada más. Si prefieres fijarlo tú, hay un interruptor
**Ajustes → Apariencia → Color de acento automático**: al apagarlo aparece el selector y tu
color manda; al encenderlo vuelve a derivarse de la imagen.

No se elige a mano: se extrae del fondo. La imagen se muestrea a 40×40, los píxeles se
agrupan en cubos de color y gana el cubo con mejor puntuación de *población × saturación ×
cercanía a una luminosidad media*. Así sale el color vivo que domina la foto y no el gris
que suele ser mayoritario. Después se normaliza (saturación mínima garantizada y
luminosidad ajustada al tema) para que funcione de verdad como acento.

Se recalcula al cambiar el fondo y al cambiar de tema —un tono que luce sobre oscuro suele
quedar lavado sobre claro—. Sin fondo se usa un azul neutro. El resultado se cachea en el
estado para que el arranque no tenga que analizar la imagen.

## Dock

Barra inferior con magnificación gaussiana calculada sobre la posición del cursor (no con
`:hover`, que da saltos), igual que el Dock real.

- **Reordenar:** arrastra un icono en horizontal.
- **Mover a la pantalla:** sácalo del dock y suéltalo sobre el escritorio; aparece como
  icono de app en el punto donde lo sueltas. Y al revés: arrastra un icono de app sobre el
  dock y pasa a formar parte de él.
- **Quitar del todo:** clic derecho → *Quitar del dock*.
- **Añadir:** botón `+` (elige entre tus accesos o escribe una URL).
- **Ajustes → Dock:** mostrar/ocultar, magnificación on/off y tamaño de icono (36–76 px).

En modo minimalista el dock se oculta.

---

## Permisos

| Permiso | Cuándo | Por qué |
|---|---|---|
| `storage` | Siempre (declarado) | Guardar ajustes, layout y contenido de los widgets. |
| `bookmarks` | **Solo si activas el sync**, vía `chrome.permissions.request` | Espejo bidireccional entre tus accesos y la carpeta «Escritorio». |
| host de un feed | **Solo al añadir un feed RSS**, y únicamente ese origen | Descargar ese XML. Nunca `<all_urls>` concedido de golpe. |

La extensión funciona **completa** sin el permiso de marcadores. Si lo revocas desde
Ajustes → Marcadores, el sync se detiene y los accesos siguen viviendo en `storage.local`.

---

## Estructura

```
nuevapestana/
├── manifest.json            MV3, chrome_url_overrides.newtab, permisos mínimos
├── newtab.html              la página
├── popup.html / js/popup.js popup del icono de la barra
├── background.js            service worker mínimo y prescindible (JS clásico)
├── assets/icons/            iconos 16/32/48/128
├── css/
│   ├── theme.css            tokens de diseño (claro/oscuro/wallpaper)
│   ├── base.css             reset + primitivas (botones, campos, switch)
│   ├── dashboard.css        topbar, grid, tarjeta de widget, modo minimalista
│   └── widgets.css          estilos por widget + panel + spotlight
├── data/quotes.js           frases locales del modo minimalista
├── js/
│   ├── boot.js              script bloqueante: tema/fondo antes del primer pintado
│   ├── main.js              arranque
│   ├── core/
│   │   ├── compat.js        shim de APIs (chrome/browser, promesa vs callback, has())
│   │   ├── store.js         estado + persistencia con debounce
│   │   ├── state.js         estado por defecto, saneado y migraciones
│   │   ├── grid.js          drag & drop y redimensionado (Pointer Events)
│   │   ├── dashboard.js     montaje/desmontaje de instancias de widget
│   │   ├── registry.js      registro de widgets (import dinámico)
│   │   ├── theme.js         tema y color de acento
│   │   ├── image.js         optimización del wallpaper (3 estrategias)
│   │   ├── favicon.js       favicons con respaldo local
│   │   ├── accent.js        acento automático a partir del fondo
│   │   ├── contrast.js      texto negro o blanco según la claridad del fondo
│   │   ├── time.js          formato de hora, fecha y saludo
│   │   ├── menu.js          menú contextual (clic derecho / pulsación larga)
│   │   ├── fuzzy.js         puntuación difusa del buscador
│   │   ├── dom.js           helpers e iconos SVG inline
│   │   └── events.js        emisor mínimo
│   ├── widgets/             weather · notes · timer · bookmarks · rss · tasks ·
│   │                        calendar · worldclock · countdown · calculator · habits · app
│   ├── features/            hero · search · spotlight · gallery · settings · minimal ·
│   │                        backup · bookmarks-sync · dock
│   └── workers/             rss-worker.js · image-worker.js
└── tests/                   pruebas unitarias en Node (parser RSS, fuzzy, quotes)
```

---

## Añadir un widget nuevo

1. Crea `js/widgets/mi-widget.js`:

```js
import { h } from '../core/dom.js';

export default {
  type: 'mi-widget',
  name: 'Mi widget',
  description: 'Lo que hace.',
  icon: '✨',
  sizes: ['xs', 'sm', 'md', 'lg'],   // 1x1 · 2x2 · 4x2 · 4x4 celdas
  defaultSize: 'md',
  // chrome: 'none',                 // sin barra de título; la tarjeta es el asa
  defaultConfig: { saludo: 'hola' },
  settings: [{ key: 'saludo', label: 'Saludo', type: 'text' }],

  create(ctx) {
    const el = h('div', {}, ctx.config.saludo);
    return {
      el,
      onConfig(cfg) { el.textContent = cfg.saludo; },
      onResize(size) {},
      destroy() {},
    };
  },
};
```

2. Añade su import a `MODULES` en `js/core/registry.js`.

Ya aparece en la galería de Ajustes → Widgets, en el buscador y con sus opciones
renderizadas a partir del esquema `settings`.

---

## Atajos

| Atajo | Acción |
|---|---|
| `⌘K` / `Ctrl+K` o `/` | Enfoca la barra de búsqueda (o el overlay en modo minimalista) |
| `↑` `↓` · `⏎` · `⇧⏎` | Navegar · abrir · abrir en pestaña nueva |
| `m` | Modo minimalista |
| `,` | Ajustes |
| `Esc` | Cerrar |

---

## Notas de compatibilidad con Orion

Decisiones tomadas específicamente para no depender de cosas que Orion no garantiza:

- **`chrome.offscreen`: no se usa en absoluto.** No hace falta: el wallpaper se procesa
  desde la propia página con `Worker + OffscreenCanvas`, y si eso falla se prueba
  `OffscreenCanvas` en el hilo principal y, por último, un `<canvas>` oculto clásico.
  Las tres rutas producen el mismo resultado (probadas: 1920 px, ~39 KB).
- **Service worker MV3: prescindible.** `background.js` solo registra la fecha de
  instalación y el clic del icono. Si nunca se ejecuta, el dashboard funciona igual.
  El temporizador guarda una marca de tiempo absoluta (`endsAt`), no un contador, así que
  sobrevive a que el navegador congele los timers.
- **`chrome.storage.sync`: no se usa.** `storage.local` es la única fuente de verdad.
- **`chrome.bookmarks` y `chrome.permissions`: detectados en caliente.** Si no existen o
  lanzan, la opción de sync no se muestra y el resto de la extensión no se entera.
- **Promesas vs callbacks:** `compat.js` detecta una sola vez, con una lectura idempotente,
  si la API devuelve promesas, y usa esa vía de forma consistente.
- **Module workers**, `OffscreenCanvas`, `matchMedia.addEventListener`: todos con respaldo.
- **CSS:** sin `color-mix`, sin unidades de container query, con prefijos `-webkit-` en
  `backdrop-filter`, `line-clamp` y `user-select`.

En **Ajustes → Datos → Diagnóstico de compatibilidad** verás qué APIs expone el navegador
en el que estés. Es la forma rápida de comparar Chrome y Orion.

---

## Pruebas

```bash
for t in tests/*.test.mjs; do node "$t"; done
```

100 pruebas que cubren el parser RSS/Atom (CDATA, entidades, HTML escapado, `rel=alternate`,
feeds corruptos), la puntuación del buscador, la rotación diaria de frases, el evaluador de
la calculadora (precedencia, menos unario, paréntesis desbalanceados, división por cero),
la cuadrícula del calendario (meses bisiestos, primer día de la semana), los husos horarios
y el cálculo de rachas.

---

## Favicons nítidos

`/favicon.ico` casi siempre son 16 o 32 px: ampliado a 48 px en el dock se ve borroso. Antes
de pintar nada se prueban, por orden de calidad, los iconos grandes que los sitios ya
publican para iOS y Android:

```
/apple-touch-icon.png  →  /apple-touch-icon-precomposed.png  →  /favicon.svg
   →  /favicon-192x192.png  →  [icons.duckduckgo.com]  →  /favicon.ico
```

Se acepta el primero que cargue **y** tenga resolución suficiente para su tamaño en
pantalla. Resultados reales: GitHub 120 px, Wikipedia 160 px, Open-Meteo 180 px, MDN 192 px
—frente a los 16-48 px del `.ico`—. Cuando un sitio no publica ninguno (YouTube, por
ejemplo), su icono de 16 px se dibuja **a tamaño real y centrado** en vez de ampliarse: un
icono pequeño y nítido se ve mejor que uno grande y borroso, que es lo que hacen los
lanzadores del sistema.

Los iconos se pintan **a sangre**, llenando su tesela: los `apple-touch-icon` ya vienen
diseñados así (iOS los recorta en squircle), de modo que añadirles margen solo los afeaba.
El redondeo lo aporta el contenedor. La única excepción son los iconos más pequeños que su
tesela, que no pueden llenarla sin emborronarse: esos se centran a tamaño real sobre un
lienzo claro.

El sondeo se hace una sola vez por dominio y se cachea un mes.

**El caso de YouTube.** Algunos sitios no publican ningún icono grande en una ruta fija:
YouTube declara uno de 144 px, pero en `/s/desktop/<hash>/img/…`, y ese hash cambia en cada
despliegue. Leerlo obligaría a descargar y parsear su HTML, que es una petición cross-origin
bloqueada por CORS salvo que le des permiso de host al dominio. Por eso, cuando no hay nada
mejor, se recurre al servicio de iconos de **DuckDuckGo** (32 px para YouTube frente a los
16 px de su `.ico`), al que solo se le envía el dominio. Es la única petición a un tercero
de todo el proyecto y se apaga en **Ajustes → Marcadores → Mejorar iconos de baja
resolución**.

Si quieres un icono concreto perfecto, **clic derecho sobre él → Cambiar icono…** (en el
dock, en los iconos sueltos y en el widget de accesos): subes una imagen del disco —se
reescala a 128 px y se guarda como PNG, unos 8 KB— o pegas una URL. Se guarda para todo el
dominio y no caduca.

## Privacidad

- Sin analítica, sin telemetría, sin servidor propio, sin cuentas.
- Peticiones de red, todas opcionales y disparadas por ti:
  - **Clima:** `api.open-meteo.com` y `geocoding-api.open-meteo.com` (sin clave, sin registro).
  - **RSS:** el dominio del feed que añadas.
  - **Favicons:** los iconos grandes del propio sitio que marcaste. Cuando un sitio no
    publica ninguno, el servicio de iconos de DuckDuckGo recibe el dominio (activado por
    defecto para que los iconos no se vean borrosos; se apaga en Ajustes → Marcadores).
- **Exportar/Importar JSON** en Ajustes → Datos. El backup incluye el fondo, así que
  restaurarlo en otro dispositivo deja el dashboard idéntico.
