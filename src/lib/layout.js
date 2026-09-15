import { dateParts } from "./dates.js";

/** Tamaño de página en puntos (3:4, pensado para tabletas). */
export const PAGE_W = 600;
export const PAGE_H = 800;

/**
 * Dibuja una página con un "renderer" que puede ser el PDF o un canvas.
 * Coordenadas desde la esquina superior izquierda.
 *
 * El renderer debe implementar:
 *   rect(x, top, w, h, fill)
 *   box(x, top, w, h, radius, fill|null, stroke|null, lineWidth?)
 *   text(font "script"|"sans", size, color, x, baseline, text, align?)
 *   width(font, size, text) -> number
 *   link(x, top, w, h, pageIndex)
 */
export function drawPage(R, plan, page) {
  R.rect(0, 0, PAGE_W, PAGE_H, plan.C.bg);
  if (page.type === "index") drawIndex(R, plan, page.i);
  else if (page.type === "month") drawMonth(R, plan, page.mi);
  else drawWeek(R, plan, page.w, page.mi);
}

const centered = (R, font, size, color, cx, base, s) => R.text(font, size, color, cx, base, s, "center");

/* ---------- Índice anual ---------- */
function drawIndex(R, P, i) {
  const { L, C, months, o } = P;
  const slice = months.slice(i * 12, i * 12 + 12);
  const a = slice[0];
  const b = slice[slice.length - 1];

  centered(R, "script", 54, C.txt, PAGE_W / 2, 78, a.y === b.y ? String(a.y) : `${a.y} – ${b.y}`);
  centered(R, "sans", 11, C.muted, PAGE_W / 2, 104, `${L.months[a.m]} ${a.y} – ${L.months[b.m]} ${b.y}`);

  const x0 = 27, x1 = 573, gap = 10, top0 = 124;
  const tileW = (x1 - x0 - 2 * gap) / 3;
  const tileH = (784 - top0 - 3 * gap) / 4;

  slice.forEach((M, k) => {
    const mi = i * 12 + k;
    const x = x0 + (k % 3) * (tileW + gap);
    const top = top0 + Math.floor(k / 3) * (tileH + gap);

    R.box(x, top, tileW, tileH, 8, C.cell, C.edge);
    centered(R, "script", 21, C.txt, x + tileW / 2, top + 26, L.months[M.m]);
    R.text("sans", 7.5, C.muted, x + tileW - 10, top + 22, String(M.y), "right");
    R.link(x, top, tileW, 34, P.pageOf["m" + mi]);

    const cw = (tileW - 16) / 7;
    for (let d = 0; d < 7; d++) {
      centered(R, "sans", 7.5, C.muted, x + 8 + cw * (d + 0.5), top + 46, L.initials[(o.weekStart + d) % 7]);
    }
    const rh = (tileH - 64) / 6;
    M.weeks.forEach((w, r) => {
      for (let d = 0; d < 7; d++) {
        const p = dateParts(w + d);
        if (p.m !== M.m) continue;
        const cx = x + 8 + cw * (d + 0.5);
        const rt = top + 52 + r * rh;
        centered(R, "sans", 8, C.txt, cx, rt + rh * 0.68, String(p.d));
        R.link(cx - cw / 2, rt, cw, rh, P.pageOf["w" + w]);
      }
    });
  });
}

/* ---------- Mes ---------- */
export function monthColumns(weekStart) {
  const x0 = 27, x1 = 591, gap = 3.5;
  const dows = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
  const weights = dows.map((d) => (d === 0 || d === 6 ? 1.24 : 1)); // fin de semana más ancho
  const unit = (x1 - x0 - 6 * gap) / weights.reduce((s, v) => s + v, 0);
  let x = x0;
  return dows.map((dow, i) => {
    const col = { x, w: unit * weights[i], dow };
    x += col.w + gap;
    return col;
  });
}

function drawMonth(R, P, mi) {
  const { L, C, months, o } = P;
  const M = months[mi];
  const x0 = 27, x1 = 591;
  const indexPage = P.pageOf["i" + Math.floor(mi / 12)];

  // Barra del título: ‹ año   mes   ›
  R.box(x0, 14, x1 - x0, 40, 8, C.cell, C.edge);
  centered(R, "script", 56, C.txt, (x0 + x1) / 2, 47, L.months[M.m]);
  R.link(x0 + 120, 6, x1 - x0 - 240, 52, indexPage);

  const hasPrev = mi > 0;
  const hasNext = mi < months.length - 1;
  centered(R, "sans", 20, hasPrev ? C.txt : C.dim, x0 + 22, 41, "‹");
  if (hasPrev) R.link(x0, 14, 40, 40, P.pageOf["m" + (mi - 1)]);
  centered(R, "sans", 20, hasNext ? C.txt : C.dim, x1 - 22, 41, "›");
  if (hasNext) R.link(x1 - 54, 14, 54, 40, P.pageOf["m" + (mi + 1)]);
  R.text("sans", 10, C.muted, x0 + 44, 38, String(M.y));
  R.link(x0 + 40, 14, 50, 40, indexPage);

  const cols = monthColumns(o.weekStart);
  for (const c of cols) {
    R.box(c.x, 58, c.w, 38, 6, C.cell, C.edge);
    centered(R, "sans", 12.5, C.txt, c.x + c.w / 2, 82, L.short[c.dow]);
  }

  const rows = M.weeks.length;
  const top0 = 100, bottom = 784, gap = 4;
  const rh = (bottom - top0 - (rows - 1) * gap) / rows;

  M.weeks.forEach((w, r) => {
    const top = top0 + r * (rh + gap);
    const target = P.pageOf["w" + w];
    centered(R, "script", 15, C.muted, 13.5, top + rh * 0.45, String(P.weekNo(w)));
    R.link(0, top, x0 - 2, rh, target);

    cols.forEach((c, i) => {
      const p = dateParts(w + i);
      R.box(c.x, top, c.w, rh, 6, C.cell, C.edge);
      R.box(c.x + 8, top + 24, c.w - 16, rh - 32, 2, null, C.inner);
      if (p.m === M.m) R.text("script", 15, C.txt, c.x + c.w - 9, top + 18, String(p.d), "right");
      R.link(c.x, top, c.w, rh, target);
    });
  });
}

/* ---------- Semana ---------- */
export function weekCells() {
  const x0 = 33, x1 = 567, g = 10, top = 122, h = 198;
  const third = (x1 - x0 - 2 * g) / 3;
  const wide = x1 - x0 - g - third;
  return [
    [x0, top, third], [x0 + third + g, top, wide],
    [x0, top + h + g, third], [x0 + third + g, top + h + g, wide],
    [x0, top + 2 * (h + g), third], [x0 + third + g, top + 2 * (h + g), third], [x0 + 2 * (third + g), top + 2 * (h + g), third],
  ].map(([x, t, w]) => ({ x, top: t, w, h }));
}

function drawWeek(R, P, w, mi) {
  const { L, C, months, weeks } = P;
  const M = months[mi];

  // Cabecera: SEMANA [nº] → vuelve al mes
  const size = 42, boxW = 80, boxH = 58;
  const labelW = R.width("sans", size, L.week);
  const total = labelW + 24 + boxW;
  const sx = (PAGE_W - total) / 2;
  R.text("sans", size, C.txt, sx, 98, L.week);
  const bx = sx + labelW + 24;
  R.box(bx, 50, boxW, boxH, 8, C.cell, C.edge);
  centered(R, "script", 34, C.txt, bx + boxW / 2, 91, String(P.weekNo(w)));
  R.link(sx, 44, total, 70, P.pageOf["m" + mi]);

  // Días
  weekCells().forEach(({ x, top, w: cw, h }, i) => {
    const p = dateParts(w + i);
    R.box(x, top, cw, h, 8, C.cell, C.edge);
    R.box(x + 12, top + 36, cw - 24, h - 48, 2, null, C.inner);
    R.text("sans", 13, C.txt, x + 14, top + 25, L.long[p.dow]);
    const num = String(p.d);
    R.text("script", 19, C.txt, x + cw - 13, top + 24, num, "right");
    if (p.d === 1) {
      // marca el cambio de mes dentro de la semana
      const nw = R.width("script", 19, num);
      R.text("sans", 9, C.muted, x + cw - 13 - nw - 5, top + 23, L.months[p.m].slice(0, 3), "right");
    }
    const k = P.monthIndexOf(p.y, p.m);
    if (k >= 0) R.link(x + cw - 64, top, 64, 34, P.pageOf["m" + k]);
  });

  // Navegación inferior: ‹ año mes [semanas] ›
  const NT = 748, NH = 34, arrow = 34, yearW = 46, monthW = 116, pillW = 44, pillGap = 6, sep = 8;
  const list = M.filed;
  const k = weeks.indexOf(w);
  const width = arrow + sep + yearW + sep + monthW + sep + list.length * pillW + (list.length - 1) * pillGap + sep + arrow;
  let nx = (PAGE_W - width) / 2;

  const hasPrev = k > 0;
  const hasNext = k < weeks.length - 1;

  R.box(nx, NT, arrow, NH, 6, hasPrev ? C.cell : C.bg, C.edge);
  centered(R, "sans", 16, hasPrev ? C.txt : C.dim, nx + arrow / 2, NT + 23, "‹");
  if (hasPrev) R.link(nx, NT, arrow, NH, P.pageOf["w" + weeks[k - 1]]);
  nx += arrow + sep;

  R.box(nx, NT, yearW, NH, 6, C.cell, C.edge);
  centered(R, "sans", 10, C.muted, nx + yearW / 2, NT + 21, L.year);
  R.link(nx, NT, yearW, NH, P.pageOf["i" + Math.floor(mi / 12)]);
  nx += yearW + sep;

  R.box(nx, NT, monthW, NH, 6, C.cell, C.edge);
  centered(R, "script", 20, C.txt, nx + monthW / 2, NT + 23, L.months[M.m]);
  R.link(nx, NT, monthW, NH, P.pageOf["m" + mi]);
  nx += monthW + sep;

  for (const other of list) {
    const current = other === w;
    R.box(nx, NT, pillW, NH, 6, current ? C.active : C.cell, current ? C.actEdge : C.edge);
    centered(R, "script", 17, current ? C.txt : C.muted, nx + pillW / 2, NT + 23, String(P.weekNo(other)));
    if (!current) R.link(nx, NT, pillW, NH, P.pageOf["w" + other]);
    nx += pillW + pillGap;
  }
  nx += sep - pillGap;

  R.box(nx, NT, arrow, NH, 6, hasNext ? C.cell : C.bg, C.edge);
  centered(R, "sans", 16, hasNext ? C.txt : C.dim, nx + arrow / 2, NT + 23, "›");
  if (hasNext) R.link(nx, NT, arrow, NH, P.pageOf["w" + weeks[k + 1]]);
}
