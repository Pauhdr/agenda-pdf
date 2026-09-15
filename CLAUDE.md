# CLAUDE.md

Contexto para trabajar en este repositorio con Claude Code.

## Qué es

**Agenda PDF** es una web que genera planificadores digitales en PDF para tablet (GoodNotes, Notability…). El usuario elige opciones y descarga un PDF con:

- **Índice anual**: 12 meses en miniatura (una página de índice por cada 12 meses).
- **Página mensual** por mes: cuadrícula con número de semana a la izquierda.
- **Página semanal** por semana: 7 casillas (fila 1: estrecha + ancha; fila 2: estrecha + ancha; fila 3: tres iguales) y barra de navegación inferior.
- Todo enlazado con hipervínculos internos + marcadores (outline) del PDF.

Estética de referencia: fondo negro, celdas gris oscuro redondeadas, nombre del mes en caligrafía. Hay tema claro alternativo.

Público: usuarios hispanohablantes no técnicos. **La interfaz, el README, los comentarios y los mensajes de commit van en español.** Los identificadores del código van en inglés.

Todo ocurre en el navegador: sin servidor, sin base de datos, **sin dependencias npm**. Se despliega como sitio estático en GitHub Pages.

## Comandos

Requiere Node 22+ (el glob de `node --test` lo necesita).

```bash
npm start            # servidor local en http://localhost:5173 (scripts/serve.mjs)
npm test             # node --test "test/*.test.mjs"
npm run build        # copia index.html, favicon.svg, src/ y fonts/ a dist/
npm run generate -- --inicio 2026-09 --meses 12 --semana lunes --numeracion iso --idioma es --tema oscuro --salida agenda.pdf
npm run generate -- --ayuda
```

Antes de dar un cambio por terminado: `npm test`. Si el cambio afecta al dibujo, genera un PDF con `npm run generate` y revisa las páginas (si `pdftoppm` está disponible: `pdftoppm -r 60 -png -f 1 -l 3 agenda.pdf /tmp/pag`).

## Arquitectura

Flujo: **opciones → `makePlan()` → `drawPage(renderer)` → PDF o canvas**.

```
index.html              HTML de la web (carga src/main.js como módulo ES, sin bundler)
src/main.js             UI: formulario, vista previa en <canvas>, descarga, sincroniza opciones con la URL
src/styles.css          estilos de la web (no del PDF)
src/lib/                núcleo compartido por navegador y Node (¡sin APIs de Node aquí!)
  index.js              reexporta la API pública
  options.js            defaults(), normalize(), toQuery()/fromQuery(), COUNTS, WEEKDAY_KEYS
  plan.js               makePlan(), weekRange(), fileName()
  dates.js              dayNumber(), dateParts(), isoWeek()
  layout.js             drawPage(), monthColumns(), weekCells(), PAGE_W/PAGE_H
  pdf.js                buildPDF(): escritor de PDF propio (fuentes, enlaces, marcadores, xref)
  canvas.js             canvasRenderer(): mismo dibujo en canvas para la vista previa
  font.js               parseFont() (lector TrueType mínimo), textWidth(), glyphOf()
  i18n.js               LANGS (textos por idioma) y THEMES (colores)
fonts/                  agenda-script.ttf (caligráfica), agenda-sans.ttf (Poppins) + licencias
scripts/                serve.mjs, build.mjs, generate.mjs (CLI), build-fonts.py (regenerar fuentes)
test/                   dates, plan y pdf (*.test.mjs) + helpers.mjs
docs/                   DESARROLLO.md (guía técnica) e img/ (capturas del README)
.github/workflows/deploy.yml   pruebas en cada push/PR; publica en Pages al hacer push a main
netlify.toml            alternativa de despliegue (no usar ambas a la vez)
```

Código solo para Node (fs, zlib…) va en `scripts/` o `test/`, nunca en `src/lib/`.

## Conceptos y reglas del núcleo

### Opciones
`{ year, month (0-11), count, weekStart (0=domingo…6=sábado), numbering: "iso"|"agenda", lang: "es"|"en", theme: "dark"|"light" }`.
Pasa siempre por `normalize()`. `count` solo admite `COUNTS` (3, 6, 12, 18, 24). En la URL los parámetros están en español: `inicio=AAAA-MM`, `meses`, `semana=lunes`, `numeracion`, `idioma`, `tema=oscuro|claro`. La CLI usa los mismos nombres.

### Fechas
Los días son **enteros** (días desde 1970-01-01 en UTC) creados con `dayNumber(y, m, d)` y leídos con `dateParts(n)`. Nunca hagas aritmética con `Date` local (husos y horario de verano rompen las semanas). Una semana se identifica por el número de su primer día.

### Plan (`makePlan`)
- `months[mi]`: `{ y, m, weeks, filed }`. `weeks` = semanas que tocan el mes (filas de la página mensual, 4 a 6). `filed` = semanas cuya página va detrás de ese mes.
- **Cada semana se archiva una sola vez**, en el mes de su día central (`w + 3`), limitado al primer/último mes del periodo.
- `weeks`: todas las semanas únicas, ordenadas y consecutivas.
- `weekNo(w)`: `"iso"` → `isoWeek(w + 3)`; `"agenda"` → 1, 2, 3… desde la primera semana.
- `pages`: orden = índices, luego cada mes seguido de sus semanas archivadas. `pageOf` mapea claves a índice de página: `"i" + n` (índice), `"m" + mi` (mes), `"w" + w` (semana). El índice de un mes es `"i" + Math.floor(mi / 12)`.
- `monthIndexOf(y, m)` devuelve -1 si el mes está fuera del periodo (sin enlace).

### Maquetación y renderers
- Página de **600 × 800 pt**, origen **arriba a la izquierda**, `y` hacia abajo. Todas las medidas de `layout.js` están en ese sistema.
- `layout.js` no sabe si dibuja en PDF o canvas. Usa solo esta interfaz:
  - `rect(x, top, w, h, fill)`
  - `box(x, top, w, h, radius, fill|null, stroke|null, lineWidth = 0.6)`
  - `text(font, size, color, x, baseline, str, align = "left"|"center"|"right")` con `font` = `"script"` o `"sans"`
  - `width(font, size, str)`
  - `link(x, top, w, h, pageIndex)` (si `pageIndex` es `undefined` se ignora)
- **Si añades una primitiva, impleméntala en `pdf.js` y en `canvas.js`.** La vista previa debe ser idéntica al PDF.
- La alineación y los anchos se calculan con las métricas de la fuente (`textWidth`), no con `measureText` del canvas, para que PDF y vista previa coincidan.
- Colores: solo desde `plan.C` (`THEMES`). Textos: solo desde `plan.L` (`LANGS`). Nada de literales de color o texto en `layout.js`.
- En la página mensual, sábado y domingo son columnas más anchas (peso 1,24), estén donde estén según `weekStart`.
- En la semanal, el día 1 de un mes lleva la abreviatura del mes junto al número.

### PDF (`pdf.js`)
- Escritor propio: fuentes Type0/CIDFontType2 con `Identity-H` (el texto se escribe como IDs de glifo en hex), `ToUnicode` para copiar/buscar, enlaces `/Link` con `/Dest [página /Fit]`, marcadores (meses plegados con sus semanas) y tabla `xref` calculada por bytes.
- `buildPDF(plan, fonts, { deflate })` es asíncrona. `deflate` es opcional (zlib en Node, `CompressionStream` en el navegador); sin ella los flujos van sin comprimir y el PDF sigue siendo válido.
- Si tocas la serialización, las pruebas verifican que cada entrada de `xref` apunta a `N 0 obj` y que todos los enlaces apuntan a páginas reales.

### Fuentes
- `fonts/agenda-script.ttf`: derivada de TeX Gyre Chorus (GUST Font License), convertida a TrueType, recortada a latín y **renombrada** (la licencia lo pide para derivadas). `fonts/agenda-sans.ttf`: Poppins Regular (OFL 1.1).
- Solo contienen ASCII, Latin-1 y `– — ‘ ’ “ ” … ‹ ›`. **Un carácter fuera de ese conjunto se dibuja como glifo vacío.** Para idiomas nuevos o símbolos, regenera con `scripts/build-fonts.py` (requiere fonttools y los originales) y amplía `UNICODES`.
- Mantén los archivos de licencia de `fonts/`. No incorpores fuentes sin licencia que permita incrustarlas y redistribuirlas.

## Web (`src/main.js`)
- Rutas **relativas** siempre (`fonts/...`, `src/...`): en GitHub Pages el sitio vive en `/agenda-pdf/`. Nunca uses rutas que empiecen por `/`.
- Al cambiar opciones: recalcula el plan, actualiza la URL con `history.replaceState`, intenta conservar la posición de la vista previa y vuelve a dibujar.
- La vista previa es clicable: guarda las zonas de `link()` y navega a la página destino.
- La descarga crea un `Blob` y un enlace temporal. El botón está desactivado hasta que cargan las fuentes.
- Accesibilidad: el canvas actualiza su `aria-label`; hay navegación con ← →; respeta foco visible.

## Pruebas
- `test/dates.test.mjs`: semanas ISO en fechas límite (años con 53 semanas, cambios de año).
- `test/plan.test.mjs`: coherencia para los 7 posibles `weekStart` y varias duraciones; opciones ↔ URL; validación.
- `test/pdf.test.mjs`: caracteres presentes en las fuentes, estructura del PDF, enlaces válidos, marcadores, compresión y combinaciones de idioma/tema/duración.
- **Ojo:** una prueba fija el número total de enlaces del PDF por defecto (sept 2026, 12 meses, lunes) en 1731. Si cambias enlaces a propósito, actualiza ese número y explica por qué en el commit.
- Añade pruebas para lógica nueva (fechas, plan, opciones). Para cambios visuales, además de las pruebas, revisa el PDF generado.

### Casos límite que conviene revisar al tocar el diseño
- Meses de 4, 5 y 6 filas (p. ej. febrero que empieza en `weekStart`, meses de 31 días que empiezan en sábado).
- `weekStart` distinto de lunes (columnas, iniciales del índice, orden de casillas).
- Barra inferior de la semana con 6 semanas archivadas (primer/último mes del periodo): debe caber en 600 pt.
- Nombres de mes largos en la píldora del mes ("septiembre", "november").
- 18 y 24 meses (dos índices), semana 53, periodos que cruzan de año.
- Ambos temas y ambos idiomas.

## Despliegue
- `push` a `main` → GitHub Actions ejecuta pruebas, genera una agenda de ejemplo (artefacto descargable) y publica `dist/` en GitHub Pages. En PRs solo pruebas.
- `dist/` y los `*.pdf` están en `.gitignore`; no los subas.

## Documentación
- `README.md` es para **usuarios no técnicos**: qué hace, cómo usarla, cómo navegar, preguntas frecuentes. Si cambia algo visible (opciones, páginas, navegación), actualízalo y, si hace falta, regenera las capturas de `docs/img/`.
- `docs/DESARROLLO.md` es la guía técnica. Actualízala si cambian comandos, estructura o despliegue.

## Forma de trabajar
- No añadas dependencias, bundlers ni frameworks sin preguntar: el proyecto es deliberadamente sin dependencias.
- Cambios pequeños y enfocados; commits en español, en imperativo ("Añade vista diaria", "Corrige número de semana en domingo").
- Si una petición afecta a la estructura del PDF (nuevos tipos de página, tamaños distintos de 600 × 800), propón primero el plan: toca `plan.js` (páginas y `pageOf`), `layout.js` (dibujo), los marcadores en `pdf.js`, el selector de la vista previa en `main.js`, las pruebas y el README.

## Ideas pendientes
Festivos por país, más idiomas, tamaños A4 / tablet horizontal, páginas de notas, vista diaria enlazada desde cada semana, portada personalizable.
