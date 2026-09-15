import { PAGE_W, PAGE_H, drawPage } from "./layout.js";
import { glyphOf, textWidth } from "./font.js";
import { weekRange } from "./plan.js";

/*
 * Escritor de PDF sin dependencias.
 * Incrusta las fuentes TrueType completas (ya vienen recortadas al alfabeto latino),
 * crea enlaces internos entre páginas y un índice de marcadores.
 */

const n2 = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};
const rgb = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => n2(c / 255)).join(" ");
};
const utf16 = (s) =>
  "<FEFF" +
  [...s]
    .map((ch) => {
      const cp = ch.codePointAt(0);
      const units = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp];
      return units.map((u) => u.toString(16).toUpperCase().padStart(4, "0")).join("");
    })
    .join("") +
  ">";

const RESOURCE = { script: "F0", sans: "F1" };

function pdfRenderer(page, fonts) {
  const H = PAGE_H;
  const ops = page.ops;
  const roundRect = (x, t, w, h, r) => {
    const X = x, Y = H - t - h, k = 0.5523 * r;
    return [
      `${n2(X + r)} ${n2(Y)} m`,
      `${n2(X + w - r)} ${n2(Y)} l ${n2(X + w - r + k)} ${n2(Y)} ${n2(X + w)} ${n2(Y + r - k)} ${n2(X + w)} ${n2(Y + r)} c`,
      `${n2(X + w)} ${n2(Y + h - r)} l ${n2(X + w)} ${n2(Y + h - r + k)} ${n2(X + w - r + k)} ${n2(Y + h)} ${n2(X + w - r)} ${n2(Y + h)} c`,
      `${n2(X + r)} ${n2(Y + h)} l ${n2(X + r - k)} ${n2(Y + h)} ${n2(X)} ${n2(Y + h - r + k)} ${n2(X)} ${n2(Y + h - r)} c`,
      `${n2(X)} ${n2(Y + r)} l ${n2(X)} ${n2(Y + r - k)} ${n2(X + r - k)} ${n2(Y)} ${n2(X + r)} ${n2(Y)} c h`,
    ].join(" ");
  };
  return {
    width: (font, size, str) => textWidth(fonts[font], size, str),
    rect(x, t, w, h, fill) {
      ops.push(`${rgb(fill)} rg ${n2(x)} ${n2(H - t - h)} ${n2(w)} ${n2(h)} re f`);
    },
    box(x, t, w, h, r, fill, stroke, lw = 0.6) {
      let s = "";
      if (fill) s += `${rgb(fill)} rg `;
      if (stroke) s += `${rgb(stroke)} RG ${n2(lw)} w `;
      ops.push(s + roundRect(x, t, w, h, r) + (fill && stroke ? " B" : fill ? " f" : " S"));
    },
    text(font, size, color, x, base, str, align) {
      const f = fonts[font];
      const w = textWidth(f, size, str);
      if (align === "center") x -= w / 2;
      else if (align === "right") x -= w;
      let hex = "";
      for (const ch of str) hex += glyphOf(f, ch).toString(16).padStart(4, "0");
      ops.push(`BT /${RESOURCE[font]} ${n2(size)} Tf ${rgb(color)} rg ${n2(x)} ${n2(H - base)} Td <${hex}> Tj ET`);
    },
    link(x, t, w, h, target) {
      if (target !== undefined) page.links.push([x, H - t - h, x + w, H - t, target]);
    },
  };
}

/**
 * Genera el PDF completo.
 * @param plan     resultado de makePlan()
 * @param fonts    { script, sans } devueltas por parseFont()
 * @param deflate  opcional: async (Uint8Array) => Uint8Array con compresión zlib
 * @returns Promise<Uint8Array>
 */
export async function buildPDF(plan, fonts, { deflate } = {}) {
  const enc = new TextEncoder();
  const compress = async (bytes) => {
    if (!deflate) return null;
    try { return await deflate(bytes); } catch { return null; }
  };
  const stream = async (dict, bytes, extra = "") => {
    const z = await compress(bytes);
    const body = z || bytes;
    return [`<< /Length ${body.length}${extra}${z ? " /Filter /FlateDecode" : ""}${dict} >>\nstream\n`, body, "\nendstream"];
  };

  const pages = plan.pages.map(() => ({ ops: [], links: [] }));
  plan.pages.forEach((pg, i) => drawPage(pdfRenderer(pages[i], fonts), plan, pg));

  const objs = [null];
  const alloc = () => objs.push(null) - 1;
  const catalogId = alloc(), pagesId = alloc(), infoId = alloc(), outlinesId = alloc();
  const pageIds = pages.map(() => alloc());
  const contentIds = pages.map(() => alloc());

  // Fuentes (Type0 / CIDFontType2, codificación Identity-H)
  const fontIds = {};
  for (const [key, psName] of [["script", "AgendaScript"], ["sans", "AgendaSans"]]) {
    const F = fonts[key];
    const scale = 1000 / F.upm;
    const [type0, cid, desc, file, toUni] = [alloc(), alloc(), alloc(), alloc(), alloc()];
    fontIds[key] = type0;

    objs[file] = await stream("", F.bytes, ` /Length1 ${F.bytes.length}`);
    objs[desc] = `<< /Type /FontDescriptor /FontName /${psName} /Flags 32 /FontBBox [${F.bbox.map((v) => Math.round(v * scale)).join(" ")}] /ItalicAngle 0 /Ascent ${Math.round(F.ascent * scale)} /Descent ${Math.round(F.descent * scale)} /CapHeight ${Math.round(F.ascent * scale)} /StemV 80 /FontFile2 ${file} 0 R >>`;
    objs[cid] = `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${psName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /CIDToGIDMap /Identity /W [0 [${F.advances.map((a) => Math.round(a * scale)).join(" ")}]] >>`;
    objs[type0] = `<< /Type /Font /Subtype /Type0 /BaseFont /${psName} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${toUni} 0 R >>`;

    const pairs = [...F.cmap.entries()].filter(([cp]) => cp <= 0xffff).map(([cp, g]) => [g, cp]).sort((a, b) => a[0] - b[0]);
    let cmap =
      "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n" +
      "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n" +
      "/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n";
    for (let i = 0; i < pairs.length; i += 100) {
      const block = pairs.slice(i, i + 100);
      cmap += `${block.length} beginbfchar\n` +
        block.map(([g, cp]) => `<${g.toString(16).padStart(4, "0")}> <${cp.toString(16).padStart(4, "0")}>`).join("\n") +
        "\nendbfchar\n";
    }
    cmap += "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";
    objs[toUni] = await stream("", enc.encode(cmap));
  }
  const fontResources = `<< /F0 ${fontIds.script} 0 R /F1 ${fontIds.sans} 0 R >>`;

  // Páginas y enlaces
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    objs[contentIds[i]] = await stream("", enc.encode(p.ops.join("\n")));
    const annots = p.links
      .map(([a, b, c, d, t]) => `<< /Type /Annot /Subtype /Link /Rect [${n2(a)} ${n2(b)} ${n2(c)} ${n2(d)}] /Border [0 0 0] /Dest [${pageIds[t]} 0 R /Fit] >>`)
      .join(" ");
    objs[pageIds[i]] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font ${fontResources} >> /Contents ${contentIds[i]} 0 R` +
      (annots ? ` /Annots [${annots}]` : "") + " >>";
  }
  objs[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  // Marcadores: índice(s), meses y, dentro de cada mes, sus semanas
  const { L } = plan;
  const tree = [];
  for (let i = 0; i < plan.indexCount; i++) {
    tree.push({ title: L.index + (plan.indexCount > 1 ? ` ${i + 1}` : ""), page: plan.pageOf["i" + i], kids: [] });
  }
  plan.months.forEach((M, mi) => {
    const name = L.months[M.m];
    tree.push({
      title: `${name[0].toUpperCase()}${name.slice(1)} ${M.y}`,
      page: plan.pageOf["m" + mi],
      kids: M.filed.map((w) => ({ title: `${L.weekWord} ${plan.weekNo(w)} · ${weekRange(L, w)}`, page: plan.pageOf["w" + w], kids: [] })),
    });
  });
  const writeLevel = (items, parent) => {
    const ids = items.map(() => alloc());
    items.forEach((it, i) => {
      let s = `<< /Title ${utf16(it.title)} /Parent ${parent} 0 R /Dest [${pageIds[it.page]} 0 R /Fit]`;
      if (i > 0) s += ` /Prev ${ids[i - 1]} 0 R`;
      if (i < items.length - 1) s += ` /Next ${ids[i + 1]} 0 R`;
      if (it.kids.length) {
        const kids = writeLevel(it.kids, ids[i]);
        s += ` /First ${kids[0]} 0 R /Last ${kids[kids.length - 1]} 0 R /Count -${kids.length}`;
      }
      objs[ids[i]] = s + " >>";
    });
    return ids;
  };
  const top = writeLevel(tree, outlinesId);
  objs[outlinesId] = `<< /Type /Outlines /First ${top[0]} 0 R /Last ${top[top.length - 1]} 0 R /Count ${top.length} >>`;

  const a = plan.months[0];
  const b = plan.months[plan.months.length - 1];
  objs[infoId] = `<< /Title ${utf16(`Agenda ${L.months[a.m]} ${a.y} – ${L.months[b.m]} ${b.y}`)} /Producer (Agenda PDF) >>`;
  objs[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R /Outlines ${outlinesId} 0 R >>`;

  // Serialización con tabla xref
  const chunks = [];
  let length = 0;
  const offsets = [];
  const push = (x) => {
    const bytes = typeof x === "string" ? enc.encode(x) : x;
    chunks.push(bytes);
    length += bytes.length;
  };
  push("%PDF-1.7\n");
  push(new Uint8Array([37, 226, 227, 207, 211, 10]));
  for (let id = 1; id < objs.length; id++) {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    const o = objs[id];
    if (Array.isArray(o)) o.forEach(push);
    else push(o);
    push("\nendobj\n");
  }
  const xrefAt = length;
  let xref = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objs.length} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  push(xref);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
