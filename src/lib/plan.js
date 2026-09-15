import { LANGS, THEMES } from "./i18n.js";
import { dayNumber, dateParts, isoWeek } from "./dates.js";

/**
 * Calcula todas las páginas de la agenda y cómo se enlazan.
 * @param {{year:number, month:number, count:number, weekStart:number, numbering:"iso"|"agenda", lang:string, theme:string}} o
 */
export function makePlan(o) {
  const L = LANGS[o.lang] || LANGS.es;
  const C = THEMES[o.theme] || THEMES.dark;

  const months = [];
  for (let i = 0; i < o.count; i++) {
    const t = o.month + i;
    months.push({ y: o.year + Math.floor(t / 12), m: ((t % 12) + 12) % 12 });
  }

  // Semanas que tocan cada mes (empiezan en o.weekStart).
  const weeksOfMonth = (y, m) => {
    const first = dayNumber(y, m, 1);
    const last = dayNumber(y, m + 1, 0);
    const out = [];
    for (let s = first - ((dateParts(first).dow - o.weekStart + 7) % 7); s <= last; s += 7) out.push(s);
    return out;
  };

  const unique = new Set();
  for (const M of months) {
    M.weeks = weeksOfMonth(M.y, M.m);
    M.filed = [];
    M.weeks.forEach((w) => unique.add(w));
  }
  const weeks = [...unique].sort((a, b) => a - b);

  // Cada semana se archiva una sola vez: en el mes de su día central (limitado al periodo).
  const firstKey = months[0].y * 12 + months[0].m;
  for (const w of weeks) {
    const mid = dateParts(w + 3);
    const k = Math.min(o.count - 1, Math.max(0, mid.y * 12 + mid.m - firstKey));
    months[k].filed.push(w);
  }

  const sequence = new Map(weeks.map((w, i) => [w, i + 1]));
  const weekNo = (w) => (o.numbering === "agenda" ? sequence.get(w) : isoWeek(w + 3));
  const monthIndexOf = (y, m) => {
    const k = y * 12 + m - firstKey;
    return k >= 0 && k < o.count ? k : -1;
  };

  // Orden de páginas: índices, y cada mes seguido de sus semanas.
  const pages = [];
  const pageOf = {};
  const indexCount = Math.ceil(o.count / 12);
  for (let i = 0; i < indexCount; i++) {
    pageOf["i" + i] = pages.length;
    pages.push({ type: "index", i });
  }
  months.forEach((M, mi) => {
    pageOf["m" + mi] = pages.length;
    pages.push({ type: "month", mi });
    for (const w of M.filed) {
      pageOf["w" + w] = pages.length;
      pages.push({ type: "week", w, mi });
    }
  });

  return { o, L, C, months, weeks, pages, pageOf, weekNo, monthIndexOf, indexCount };
}

/** "14–20 septiembre" o "28 sep – 4 oct". */
export function weekRange(L, w) {
  const a = dateParts(w);
  const b = dateParts(w + 6);
  const abbr = (m) => L.months[m].slice(0, 3);
  return a.m === b.m
    ? `${a.d}–${b.d} ${L.months[a.m]}`
    : `${a.d} ${abbr(a.m)} – ${b.d} ${abbr(b.m)}`;
}

/** Nombre de archivo sugerido: agenda-sep2026-ago2027.pdf */
export function fileName(plan) {
  const a = plan.months[0];
  const b = plan.months[plan.months.length - 1];
  const abbr = (m) => plan.L.months[m].slice(0, 3);
  return `agenda-${abbr(a.m)}${a.y}-${abbr(b.m)}${b.y}.pdf`;
}
