import { textWidth } from "./font.js";

/**
 * Renderer para <canvas>: dibuja exactamente lo mismo que el PDF (vista previa)
 * y guarda las zonas enlazadas para que se puedan pulsar.
 */
export function canvasRenderer(ctx, fonts, families, links) {
  const path = (x, t, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, t);
    ctx.arcTo(x + w, t, x + w, t + h, r);
    ctx.arcTo(x + w, t + h, x, t + h, r);
    ctx.arcTo(x, t + h, x, t, r);
    ctx.arcTo(x, t, x + w, t, r);
    ctx.closePath();
  };
  return {
    width: (font, size, str) => textWidth(fonts[font], size, str),
    rect(x, t, w, h, fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, t, w, h);
    },
    box(x, t, w, h, r, fill, stroke, lw = 0.6) {
      path(x, t, w, h, r);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    },
    text(font, size, color, x, base, str, align) {
      const w = textWidth(fonts[font], size, str);
      if (align === "center") x -= w / 2;
      else if (align === "right") x -= w;
      ctx.font = `${size}px ${families[font]}`;
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(str, x, base);
    },
    link(x, t, w, h, target) {
      if (target !== undefined) links.push({ x, t, w, h, target });
    },
  };
}
