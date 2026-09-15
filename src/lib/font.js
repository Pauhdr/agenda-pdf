/**
 * Lector mínimo de fuentes TrueType: lo justo para medir texto e incrustarlo en el PDF.
 * Devuelve el mapa de caracteres (cmap), los avances de cada glifo y las métricas generales.
 */
export function parseFont(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tables = {};
  const numTables = dv.getUint16(4);
  for (let i = 0; i < numTables; i++) {
    const o = 12 + 16 * i;
    const tag = String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
    tables[tag] = dv.getUint32(o + 8);
  }
  for (const t of ["head", "hhea", "maxp", "hmtx", "cmap", "glyf"]) {
    if (tables[t] === undefined) throw new Error(`La fuente no es TrueType válida: falta la tabla ${t}`);
  }

  const head = tables.head;
  const upm = dv.getUint16(head + 18);
  const bbox = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)];
  const ascent = dv.getInt16(tables.hhea + 4);
  const descent = dv.getInt16(tables.hhea + 6);
  const numHMetrics = dv.getUint16(tables.hhea + 34);
  const numGlyphs = dv.getUint16(tables.maxp + 4);

  const advances = new Array(numGlyphs);
  let lastAdvance = 0;
  for (let g = 0; g < numGlyphs; g++) {
    if (g < numHMetrics) lastAdvance = dv.getUint16(tables.hmtx + 4 * g);
    advances[g] = lastAdvance;
  }

  const cmap = new Map();
  const cm = tables.cmap;
  const subtables = [];
  for (let i = 0; i < dv.getUint16(cm + 2); i++) {
    const r = cm + 4 + 8 * i;
    subtables.push({ platform: dv.getUint16(r), encoding: dv.getUint16(r + 2), offset: cm + dv.getUint32(r + 4) });
  }
  const pick =
    subtables.find((s) => s.platform === 3 && s.encoding === 10 && dv.getUint16(s.offset) === 12) ||
    subtables.find((s) => s.platform === 3 && s.encoding === 1 && dv.getUint16(s.offset) === 4) ||
    subtables.find((s) => s.platform === 0 && [4, 12].includes(dv.getUint16(s.offset)));
  if (!pick) throw new Error("La fuente no tiene un cmap Unicode compatible");

  const off = pick.offset;
  const format = dv.getUint16(off);
  if (format === 4) {
    const segX2 = dv.getUint16(off + 6);
    const ends = off + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2; s += 2) {
      const end = dv.getUint16(ends + s);
      const start = dv.getUint16(starts + s);
      const delta = dv.getInt16(deltas + s);
      const ro = dv.getUint16(ranges + s);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g;
        if (ro === 0) g = (c + delta) & 0xffff;
        else {
          g = dv.getUint16(ranges + s + ro + 2 * (c - start));
          if (g !== 0) g = (g + delta) & 0xffff;
        }
        if (g !== 0) cmap.set(c, g);
      }
    }
  } else {
    const groups = dv.getUint32(off + 12);
    for (let i = 0; i < groups; i++) {
      const r = off + 16 + 12 * i;
      const start = dv.getUint32(r);
      const end = dv.getUint32(r + 4);
      const g0 = dv.getUint32(r + 8);
      for (let c = start; c <= end; c++) cmap.set(c, g0 + (c - start));
    }
  }

  return { bytes: u8, upm, bbox, ascent, descent, advances, cmap };
}

export const glyphOf = (font, ch) => font.cmap.get(ch.codePointAt(0)) || 0;

export function textWidth(font, size, str) {
  let w = 0;
  for (const ch of str) w += font.advances[glyphOf(font, ch)];
  return (w / font.upm) * size;
}
