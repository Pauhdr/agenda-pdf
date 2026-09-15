/** Textos del calendario por idioma. Añade un idioma copiando un bloque. */
export const LANGS = {
  es: {
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    short: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    long: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
    initials: ["D", "L", "M", "X", "J", "V", "S"],
    week: "SEMANA",
    year: "año",
    index: "Índice",
    weekWord: "Semana",
  },
  en: {
    months: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"],
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    initials: ["S", "M", "T", "W", "T", "F", "S"],
    week: "WEEK",
    year: "year",
    index: "Year overview",
    weekWord: "Week",
  },
};

/** Paletas de la agenda. Todos los colores del PDF salen de aquí. */
export const THEMES = {
  dark: {
    bg: "#000000", cell: "#222527", edge: "#2E3235", inner: "#2C3033",
    txt: "#E6E7E8", muted: "#6E7378", dim: "#4A4F54", active: "#3B4044", actEdge: "#555B60",
  },
  light: {
    bg: "#F1F1EE", cell: "#FFFFFF", edge: "#D6D8D3", inner: "#E6E7E2",
    txt: "#1E2226", muted: "#8A8F94", dim: "#C5C8CB", active: "#E2E5E8", actEdge: "#9AA0A6",
  },
};
