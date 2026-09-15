// Copia los archivos públicos a dist/ (lo que se publica en GitHub Pages o Netlify).
import { cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";

const out = "dist";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const entry of ["index.html", "favicon.svg", "src", "fonts"]) {
  cpSync(entry, `${out}/${entry}`, { recursive: true });
}
writeFileSync(`${out}/.nojekyll`, "");
console.log("Sitio listo en dist/");
