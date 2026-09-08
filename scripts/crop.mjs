// One-off brand-asset slicer. Not shipped.
//   node scripts/crop.mjs <x> <y> <w> <h> <out.png> [keyR,keyG,keyB tol]
// Coordinates are in the source image's actual pixels (1536x1024).
// Optional last two args chroma-key a background colour to transparent.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";

const [, , xs, ys, ws, hs, out, key, tolS] = process.argv;
const x = +xs, y = +ys, w = +ws, h = +hs;

const src = PNG.sync.read(readFileSync(new URL("../yumbo branding.png", import.meta.url)));
const dst = new PNG({ width: w, height: h });

const [kr, kg, kb] = key ? key.split(",").map(Number) : [];
const tol = tolS ? +tolS : 0;

for (let j = 0; j < h; j++) {
  for (let i = 0; i < w; i++) {
    const sIdx = ((y + j) * src.width + (x + i)) * 4;
    const dIdx = (j * w + i) * 4;
    const r = src.data[sIdx], g = src.data[sIdx + 1], b = src.data[sIdx + 2];
    dst.data[dIdx] = r;
    dst.data[dIdx + 1] = g;
    dst.data[dIdx + 2] = b;
    let a = src.data[sIdx + 3];
    if (key) {
      const dist = Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb);
      if (dist <= tol) a = 0;
    }
    dst.data[dIdx + 3] = a;
  }
}

mkdirSync(new URL("../public/brand/", import.meta.url), { recursive: true });
writeFileSync(new URL(`../public/brand/${out}`, import.meta.url), PNG.sync.write(dst));
console.log(`wrote public/brand/${out} (${w}x${h})`);
