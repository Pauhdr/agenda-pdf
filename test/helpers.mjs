import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { parseFont } from "../src/lib/index.js";

export async function loadFonts() {
  const read = async (name) => parseFont(await readFile(new URL(`../fonts/${name}`, import.meta.url)));
  return { script: await read("agenda-script.ttf"), sans: await read("agenda-sans.ttf") };
}

export const deflate = async (b) => new Uint8Array(deflateSync(b));
