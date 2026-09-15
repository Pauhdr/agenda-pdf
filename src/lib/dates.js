/** Fechas como número entero de días desde 1970-01-01 (UTC): sin husos ni horarios de verano. */
const DAY_MS = 864e5;

export const dayNumber = (y, m, d) => Math.round(Date.UTC(y, m, d) / DAY_MS);

export function dateParts(n) {
  const d = new Date(n * DAY_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay() };
}

/** Número de semana ISO 8601 del día n. */
export function isoWeek(n) {
  const p = dateParts(n);
  const thursday = n - ((p.dow + 6) % 7) + 3;
  const year = dateParts(thursday).y;
  return 1 + Math.floor((thursday - dayNumber(year, 0, 1)) / 7);
}
