import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { makePlan, buildPDF, textWidth } from "../src/lib/index.js";
import { loadFonts, deflate } from "./helpers.mjs";

const fonts = await loadFonts();
const latin1 = (bytes) => Buffer.from(bytes).toString("latin1");

test("las fuentes tienen los caracteres que usa la agenda", () => {
  for (const f of [fonts.script, fonts.sans]) {
    for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789áéíóúñÁÉÍÓÚÑ–‹›") {
      assert.ok(f.cmap.get(ch.codePointAt(0)), `falta «${ch}»`);
    }
  }
  assert.ok(textWidth(fonts.sans, 42, "SEMANA") > 100);
});

function checkStructure(pdf, plan) {
  const s = latin1(pdf);
  assert.ok(s.startsWith("%PDF-1.7"));
  assert.ok(s.trimEnd().endsWith("%%EOF"));

  // La tabla xref apunta al inicio de cada objeto
  const xrefAt = Number(/startxref\n(\d+)/.exec(s)[1]);
  assert.equal(s.slice(xrefAt, xrefAt + 4), "xref");
  const size = Number(/\/Size (\d+)/.exec(s.slice(xrefAt))[1]);
  const rows = s.slice(xrefAt).split("\n").slice(3, 2 + size);
  rows.forEach((row, i) => {
    const offset = Number(row.slice(0, 10));
    assert.ok(s.startsWith(`${i + 1} 0 obj`, offset), `objeto ${i + 1} mal referenciado`);
  });

  // Número de páginas y enlaces a páginas existentes
  assert.equal(Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(s)[1]), plan.pages.length);
  const pageObjs = new Set([...s.matchAll(/(\d+) 0 obj\n<< \/Type \/Page /g)].map((m) => m[1]));
  const dests = [...s.matchAll(/\/Dest \[(\d+) 0 R/g)].map((m) => m[1]);
  assert.ok(dests.length > plan.pages.length);
  for (const d of dests) assert.ok(pageObjs.has(d), `enlace a un objeto que no es página: ${d}`);
  return s;
}

test("agenda por defecto: estructura, enlaces y marcadores", async () => {
  const plan = makePlan({ year: 2026, month: 8, count: 12, weekStart: 1, numbering: "iso", lang: "es", theme: "dark" });
  const pdf = await buildPDF(plan, fonts, { deflate });
  const s = checkStructure(pdf, plan);
  assert.equal((s.match(/\/Subtype \/Link/g) || []).length, 1731);
  assert.equal((s.match(/\/Type \/Outlines/g) || []).length, 1);
  // Los flujos comprimidos se descomprimen bien
  const m = /<< \/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/.exec(s);
  const start = m.index + m[0].length;
  const content = inflateSync(Buffer.from(pdf.slice(start, start + Number(m[1])))).toString("latin1");
  assert.match(content, /Tj ET/);
});

test("todas las combinaciones generan un PDF válido", async () => {
  for (const weekStart of [0, 1, 3, 6]) {
    for (const lang of ["es", "en"]) {
      for (const theme of ["dark", "light"]) {
        for (const count of [3, 24]) {
          const plan = makePlan({ year: 2027, month: 10, count, weekStart, numbering: "agenda", lang, theme });
          checkStructure(await buildPDF(plan, fonts), plan);
        }
      }
    }
  }
});
