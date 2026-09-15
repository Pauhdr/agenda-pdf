import { test } from "node:test";
import assert from "node:assert/strict";
import { dayNumber, dateParts, isoWeek } from "../src/lib/dates.js";

test("número de semana ISO en fechas conocidas", () => {
  assert.equal(isoWeek(dayNumber(2026, 0, 1)), 1);   // jueves 1 ene 2026
  assert.equal(isoWeek(dayNumber(2026, 6, 1)), 27);  // 1 jul 2026
  assert.equal(isoWeek(dayNumber(2026, 8, 1)), 36);  // 1 sep 2026
  assert.equal(isoWeek(dayNumber(2027, 0, 1)), 53);  // 2026 tiene 53 semanas
  assert.equal(isoWeek(dayNumber(2021, 0, 3)), 53);  // domingo 3 ene 2021 → semana 53 de 2020
  assert.equal(isoWeek(dayNumber(2024, 11, 30)), 1); // lunes 30 dic 2024 → semana 1 de 2025
});

test("dateParts devuelve el día de la semana correcto", () => {
  assert.deepEqual(dateParts(dayNumber(2026, 8, 15)), { y: 2026, m: 8, d: 15, dow: 2 });
  assert.equal(dateParts(dayNumber(2024, 1, 29)).d, 29);
});
