import { test } from "node:test";
import assert from "node:assert/strict";
import { makePlan, fileName, fromQuery, toQuery, normalize, defaults } from "../src/lib/index.js";
import { dateParts } from "../src/lib/dates.js";

const base = { year: 2026, month: 8, count: 12, weekStart: 1, numbering: "iso", lang: "es", theme: "dark" };

test("septiembre 2026 a agosto 2027 con semanas de lunes", () => {
  const p = makePlan(base);
  assert.equal(p.months.length, 12);
  assert.equal(p.weeks.length, 53);
  assert.equal(p.pages.length, 1 + 12 + 53);
  assert.equal(p.weekNo(p.weeks[0]), 36);
  assert.equal(fileName(p), "agenda-sep2026-ago2027.pdf");
});

for (let weekStart = 0; weekStart < 7; weekStart++) {
  for (const count of [3, 12, 24]) {
    test(`coherencia: semana empieza en ${weekStart}, ${count} meses`, () => {
      const p = makePlan({ ...base, weekStart, count });
      // Cada semana empieza en el día elegido
      for (const w of p.weeks) assert.equal(dateParts(w).dow, weekStart);
      // Cada semana está archivada exactamente una vez
      const filed = p.months.flatMap((M) => M.filed);
      assert.equal(filed.length, p.weeks.length);
      assert.equal(new Set(filed).size, p.weeks.length);
      // Todas las semanas que aparecen en un mes tienen página
      for (const M of p.months) for (const w of M.weeks) assert.ok(p.pageOf["w" + w] !== undefined);
      // Semanas consecutivas y sin huecos
      for (let i = 1; i < p.weeks.length; i++) assert.equal(p.weeks[i] - p.weeks[i - 1], 7);
      // Un índice por cada 12 meses
      assert.equal(p.indexCount, Math.ceil(count / 12));
    });
  }
}

test("numeración desde el inicio de la agenda", () => {
  const p = makePlan({ ...base, numbering: "agenda" });
  assert.deepEqual(p.weeks.slice(0, 3).map(p.weekNo), [1, 2, 3]);
});

test("opciones: ida y vuelta por la URL", () => {
  const o = { ...base, weekStart: 0, numbering: "agenda", lang: "en", theme: "light", count: 18 };
  assert.deepEqual(fromQuery(toQuery(o), defaults()), o);
  assert.equal(fromQuery("semana=sábado", base).weekStart, 6);
});

test("opciones: los valores inválidos vuelven a los de base", () => {
  assert.deepEqual(normalize({ year: "abc", month: 14, count: 7, weekStart: 9, numbering: "x", lang: "fr", theme: "rosa" }, base), base);
});
