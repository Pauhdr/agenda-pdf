/**
 * Opciones de la agenda: valores por defecto, validación y conversión a/desde la URL,
 * para poder compartir un enlace con la configuración (?inicio=2026-09&meses=12&semana=lunes…).
 */
export const WEEKDAY_KEYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
export const COUNTS = [3, 6, 12, 18, 24];

export function defaults(now = new Date()) {
  return { year: now.getFullYear(), month: now.getMonth(), count: 12, weekStart: 1, numbering: "iso", lang: "es", theme: "dark" };
}

export function normalize(o, base = defaults()) {
  const int = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  return {
    year: int(o.year, 1900, 2200, base.year),
    month: int(o.month, 0, 11, base.month),
    count: COUNTS.includes(Number(o.count)) ? Number(o.count) : base.count,
    weekStart: int(o.weekStart, 0, 6, base.weekStart),
    numbering: o.numbering === "agenda" ? "agenda" : o.numbering === "iso" ? "iso" : base.numbering,
    lang: o.lang === "en" || o.lang === "es" ? o.lang : base.lang,
    theme: o.theme === "light" || o.theme === "dark" ? o.theme : base.theme,
  };
}

export function toQuery(o) {
  const q = new URLSearchParams();
  q.set("inicio", `${o.year}-${String(o.month + 1).padStart(2, "0")}`);
  q.set("meses", String(o.count));
  q.set("semana", WEEKDAY_KEYS[o.weekStart]);
  q.set("numeracion", o.numbering);
  q.set("idioma", o.lang);
  q.set("tema", o.theme === "light" ? "claro" : "oscuro");
  return q.toString();
}

export function fromQuery(search, base = defaults()) {
  const q = new URLSearchParams(search);
  const raw = { ...base };
  const start = /^(\d{4})-(\d{1,2})$/.exec(q.get("inicio") || "");
  if (start) {
    raw.year = Number(start[1]);
    raw.month = Number(start[2]) - 1;
  }
  if (q.has("meses")) raw.count = q.get("meses");
  if (q.has("semana")) {
    const s = (q.get("semana") || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const i = WEEKDAY_KEYS.indexOf(s);
    raw.weekStart = i >= 0 ? i : q.get("semana");
  }
  if (q.has("numeracion")) raw.numbering = q.get("numeracion");
  if (q.has("idioma")) raw.lang = q.get("idioma");
  if (q.has("tema")) raw.theme = { claro: "light", oscuro: "dark" }[q.get("tema")] || q.get("tema");
  return normalize(raw, base);
}
