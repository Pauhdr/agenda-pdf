import {
  makePlan, buildPDF, parseFont, drawPage, canvasRenderer, fileName, weekRange,
  PAGE_W, PAGE_H, LANGS, COUNTS, defaults, normalize, toQuery, fromQuery,
} from "./lib/index.js";

const $ = (id) => document.getElementById(id);
const form = $("options");
const MONTHS = LANGS.es.months;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const FAMILIES = { script: '"AgendaScript", Georgia, serif', sans: '"AgendaSans", system-ui, sans-serif' };

let fonts = null;
let plan = null;
let pageIndex = 0;
let links = [];

/* ---------- Formulario ---------- */
$("month").innerHTML = MONTHS.map((m, i) => `<option value="${i}">${capitalize(m)}</option>`).join("");
$("count").innerHTML = COUNTS.map((n) => `<option value="${n}">${n} meses</option>`).join("");

function writeForm(o) {
  $("month").value = String(o.month);
  $("year").value = String(o.year);
  $("count").value = String(o.count);
  $("weekStart").value = String(o.weekStart);
  $("numbering").value = o.numbering;
  form.elements.lang.value = o.lang;
  form.elements.theme.value = o.theme;
}

function readForm() {
  return normalize(
    {
      year: $("year").value,
      month: $("month").value,
      count: $("count").value,
      weekStart: $("weekStart").value,
      numbering: $("numbering").value,
      lang: form.elements.lang.value,
      theme: form.elements.theme.value,
    },
    plan ? plan.o : defaults(),
  );
}

/* ---------- Plan y vista previa ---------- */
function update() {
  const previous = plan ? plan.pages[pageIndex] : null;
  const o = readForm();
  plan = makePlan(o);
  history.replaceState(null, "", `?${toQuery(o)}`);

  $("numbering-hint").hidden = !(o.weekStart !== 1 && o.numbering === "iso");
  $("summary").textContent = `${plan.pages.length} páginas · ${plan.months.length} meses · ${plan.weeks.length} semanas`;

  // Mantener un sitio parecido en la vista previa al cambiar opciones
  if (!previous) pageIndex = 0;
  else if (previous.type === "index") pageIndex = plan.pageOf["i" + Math.min(previous.i, plan.indexCount - 1)];
  else {
    const mi = Math.min(previous.mi, plan.months.length - 1);
    const M = plan.months[mi];
    pageIndex = previous.type === "week" && M.filed.length ? plan.pageOf["w" + M.filed[0]] : plan.pageOf["m" + mi];
  }

  $("jump").innerHTML =
    Array.from({ length: plan.indexCount }, (_, i) =>
      `<option value="${plan.pageOf["i" + i]}">Índice${plan.indexCount > 1 ? ` ${i + 1}` : ""}</option>`).join("") +
    plan.months.map((M, mi) => `<option value="${plan.pageOf["m" + mi]}">${capitalize(MONTHS[M.m])} ${M.y}</option>`).join("");

  render();
}

function describe(page) {
  if (page.type === "index") return "índice anual";
  const M = plan.months[page.mi];
  if (page.type === "month") return `mes de ${MONTHS[M.m]} ${M.y}`;
  return `semana ${plan.weekNo(page.w)}, ${weekRange(LANGS.es, page.w)}`;
}

function render() {
  if (!plan) return;
  const canvas = $("canvas");
  $("page-number").textContent = `${pageIndex + 1} / ${plan.pages.length}`;
  $("prev").disabled = pageIndex === 0;
  $("next").disabled = pageIndex === plan.pages.length - 1;

  let section = 0;
  [...$("jump").options].forEach((op, i) => { if (Number(op.value) <= pageIndex) section = i; });
  $("jump").selectedIndex = section;

  if (!fonts) return;
  const cssWidth = canvas.clientWidth || 480;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(((cssWidth * PAGE_H) / PAGE_W) * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(canvas.width / PAGE_W, 0, 0, canvas.height / PAGE_H, 0, 0);
  links = [];
  const page = plan.pages[pageIndex];
  drawPage(canvasRenderer(ctx, fonts, FAMILIES, links), plan, page);
  canvas.setAttribute("aria-label", `Vista previa: ${describe(page)}`);
}

function goTo(i) {
  pageIndex = Math.max(0, Math.min(plan.pages.length - 1, i));
  render();
}

function linkAt(event) {
  const r = $("canvas").getBoundingClientRect();
  const x = ((event.clientX - r.left) / r.width) * PAGE_W;
  const y = ((event.clientY - r.top) / r.height) * PAGE_H;
  for (let i = links.length - 1; i >= 0; i--) {
    const l = links[i];
    if (x >= l.x && x <= l.x + l.w && y >= l.t && y <= l.t + l.h) return l;
  }
  return null;
}

/* ---------- Descarga ---------- */
async function deflate(bytes) {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function download() {
  const button = $("download");
  button.disabled = true;
  button.textContent = "Generando…";
  $("msg").textContent = "";
  try {
    const bytes = await buildPDF(plan, fonts, { deflate });
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName(plan);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (err) {
    console.error(err);
    $("msg").textContent = "No se pudo generar el PDF. Inténtalo de nuevo.";
  } finally {
    button.disabled = false;
    button.textContent = "Descargar PDF";
  }
}

/* ---------- Eventos ---------- */
form.addEventListener("change", (e) => {
  if (e.target.id === "year") $("year").value = String(readForm().year);
  update();
});
$("year").addEventListener("input", () => {
  const y = Number($("year").value);
  if (Number.isInteger(y) && y >= 1900 && y <= 2200) update();
});
$("prev").addEventListener("click", () => goTo(pageIndex - 1));
$("next").addEventListener("click", () => goTo(pageIndex + 1));
$("jump").addEventListener("change", () => goTo(Number($("jump").value)));
$("download").addEventListener("click", download);
$("canvas").addEventListener("click", (e) => { const l = linkAt(e); if (l) goTo(l.target); });
$("canvas").addEventListener("mousemove", (e) => { $("canvas").style.cursor = linkAt(e) ? "pointer" : "default"; });
document.addEventListener("keydown", (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowLeft") goTo(pageIndex - 1);
  if (e.key === "ArrowRight") goTo(pageIndex + 1);
});
new ResizeObserver(() => render()).observe($("canvas"));

/* ---------- Arranque ---------- */
writeForm(fromQuery(location.search));
update();

try {
  const load = async (path) => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return parseFont(new Uint8Array(await res.arrayBuffer()));
  };
  const [script, sans] = await Promise.all([load("fonts/agenda-script.ttf"), load("fonts/agenda-sans.ttf")]);
  await Promise.all([document.fonts.load('20px "AgendaScript"'), document.fonts.load('20px "AgendaSans"')]);
  fonts = { script, sans };
  $("download").disabled = false;
  render();
} catch (err) {
  console.error(err);
  $("msg").textContent = "No se pudieron cargar las fuentes. Recarga la página.";
}
