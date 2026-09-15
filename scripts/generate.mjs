#!/usr/bin/env node
// Genera la agenda desde la terminal, con las mismas opciones que la web.
//
//   npm run generate -- --inicio 2026-09 --meses 12 --semana lunes --idioma es --tema oscuro --salida agenda.pdf
//
import { readFile, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { parseArgs } from "node:util";
import { makePlan, buildPDF, parseFont, fromQuery, fileName } from "../src/lib/index.js";

const { values } = parseArgs({
  options: {
    inicio: { type: "string" },
    meses: { type: "string" },
    semana: { type: "string" },
    numeracion: { type: "string" },
    idioma: { type: "string" },
    tema: { type: "string" },
    salida: { type: "string" },
    ayuda: { type: "boolean", short: "h" },
  },
});

if (values.ayuda) {
  console.log(`Uso: npm run generate -- [opciones]
  --inicio      AAAA-MM            mes de inicio (por defecto, el actual)
  --meses       3|6|12|18|24       duración (12)
  --semana      lunes…domingo      primer día de la semana (lunes)
  --numeracion  iso|agenda         número de semana (iso)
  --idioma      es|en              idioma del calendario (es)
  --tema        oscuro|claro       tema (oscuro)
  --salida      archivo.pdf        nombre del archivo`);
  process.exit(0);
}

const query = new URLSearchParams(Object.entries(values).filter(([k, v]) => v && k !== "salida"));
const options = fromQuery(query.toString());
const plan = makePlan(options);
const font = async (name) => parseFont(await readFile(new URL(`../fonts/${name}`, import.meta.url)));
const fonts = { script: await font("agenda-script.ttf"), sans: await font("agenda-sans.ttf") };
const pdf = await buildPDF(plan, fonts, { deflate: async (b) => new Uint8Array(deflateSync(b)) });
const out = values.salida || fileName(plan);
await writeFile(out, pdf);
console.log(`${out}: ${plan.pages.length} páginas, ${(pdf.length / 1024).toFixed(0)} KB`);
