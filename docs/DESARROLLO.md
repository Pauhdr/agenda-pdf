# Guía técnica

Cómo funciona el proyecto por dentro, cómo probarlo en local y cómo publicarlo. Si solo quieres crear tu agenda, vuelve al [README](../README.md).

Generador de planificadores en PDF para tableta (GoodNotes, Notability, etc.) con:

- **Índice anual** con los 12 meses en miniatura. Cada día enlaza a su semana.
- **Página mensual** por mes. Cada día y cada número de semana enlazan a la página de esa semana, y hay flechas al mes anterior y siguiente.
- **Página semanal** por semana, con navegación a la semana anterior y siguiente, al mes y al índice.
- Marcadores (índice lateral del lector) con meses y semanas.

Opciones: mes y año de inicio, duración (3 a 24 meses), primer día de la semana, numeración de semanas (ISO o desde el inicio), idioma (español/inglés) y tema (oscuro/claro). La configuración queda en la URL, así que puedes compartir un enlace con tus opciones.

Todo se genera en el navegador: no hay servidor, base de datos ni dependencias.

## Probarlo en local

Necesitas [Node.js](https://nodejs.org) 22 o superior.

```bash
npm start          # abre http://localhost:5173
npm test           # pruebas automáticas
```

También puedes generar una agenda desde la terminal:

```bash
npm run generate -- --inicio 2026-09 --meses 12 --semana lunes --idioma es --tema oscuro --salida agenda.pdf
npm run generate -- --ayuda
```

## Publicarlo

### Opción A: GitHub Pages (recomendada)

1. Crea un repositorio vacío en GitHub (por ejemplo `agenda-pdf`).
2. Sube el código:
   ```bash
   git init -b main
   git add .
   git commit -m "Primera versión"
   git remote add origin https://github.com/TU_USUARIO/agenda-pdf.git
   git push -u origin main
   ```
3. En GitHub, ve a **Settings → Pages** y en **Source** elige **GitHub Actions**.
4. En **Actions** verás el flujo "Pruebas y despliegue". Si falla la primera vez porque Pages aún no estaba activado, pulsa **Re-run jobs**.
5. La web queda en `https://TU_USUARIO.github.io/agenda-pdf/`.

Cada `git push` a `main` ejecuta las pruebas y, si pasan, vuelve a publicar. En los pull requests solo se ejecutan las pruebas. Cada ejecución deja una agenda de ejemplo descargable en la pestaña del flujo.

Para usar tu propio dominio: **Settings → Pages → Custom domain**.

### Opción B: Netlify

1. Sube el código a GitHub (pasos 1 y 2 de arriba).
2. En Netlify: **Add new site → Import an existing project → GitHub** y elige el repositorio.
3. Netlify lee `netlify.toml` (ejecuta las pruebas, construye y publica `dist/`). No hay que configurar nada más.

Usa solo una de las dos opciones. Si eliges Netlify, puedes borrar el job `deploy` de `.github/workflows/deploy.yml`.

## Estructura

```
index.html              página de la web
src/
  main.js               interfaz: formulario, vista previa y descarga
  styles.css            estilos de la web
  lib/
    plan.js             qué páginas hay y cómo se enlazan
    layout.js           diseño de cada página (índice, mes, semana)
    pdf.js              escritor de PDF (fuentes, enlaces, marcadores)
    canvas.js           mismo dibujo en <canvas> para la vista previa
    font.js             lector de fuentes TrueType (métricas)
    dates.js            fechas y número de semana ISO
    i18n.js             textos por idioma y colores de los temas
    options.js          valores por defecto, validación y URL
fonts/                  fuentes incrustadas y sus licencias
docs/                   esta guía e imágenes del README
scripts/
  serve.mjs             servidor local
  build.mjs             copia la web a dist/
  generate.mjs          genera PDFs desde la terminal
  build-fonts.py        regenera las fuentes a partir de los originales
test/                   pruebas (node --test)
```

## Cambios habituales

- **Colores**: `THEMES` en `src/lib/i18n.js`. Puedes añadir un tema nuevo y luego la opción en `index.html` y `src/lib/options.js`.
- **Otro idioma**: copia un bloque de `LANGS` en `src/lib/i18n.js` y añade la opción en `index.html` y `options.js`.
- **Diseño de las páginas**: `src/lib/layout.js`. La página mide 600 × 800 puntos (3:4); todas las medidas están en ese sistema. La vista previa y el PDF usan el mismo código, así que lo que ves es lo que se descarga.
- **Tipografías**: sustituye los archivos de `fonts/` por otras fuentes TrueType (`.ttf`) con los mismos nombres. `scripts/build-fonts.py` muestra cómo recortarlas.

Después de cualquier cambio, ejecuta `npm test`.

## Licencias

El código se distribuye con licencia MIT (ver [`LICENSE`](../LICENSE)). Las fuentes tienen sus propias licencias, incluidas en `fonts/`.
