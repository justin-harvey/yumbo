// Generate PWA icons: the mascot head on a brand-green field.
//   node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const head = PNG.sync.read(
  readFileSync(new URL("../public/brand/head-content.png", import.meta.url)),
);

const BG = [26, 122, 60]; // brand green

function makeIcon(size, out) {
  const img = new PNG({ width: size, height: size });

  // Mascot placed at ~72% height, centred, nudged up for the chef hat.
  const dh = Math.round(size * 0.72);
  const dw = Math.round((dh * head.width) / head.height);
  const x0 = Math.round((size - dw) / 2);
  const y0 = Math.round((size - dh) / 2);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let r = BG[0], g = BG[1], b = BG[2];

      if (x >= x0 && x < x0 + dw && y >= y0 && y < y0 + dh) {
        const sx = Math.min(head.width - 1, Math.floor(((x - x0) / dw) * head.width));
        const sy = Math.min(head.height - 1, Math.floor(((y - y0) / dh) * head.height));
        const s = (sy * head.width + sx) * 4;
        const a = head.data[s + 3] / 255;
        r = Math.round(head.data[s] * a + r * (1 - a));
        g = Math.round(head.data[s + 1] * a + g * (1 - a));
        b = Math.round(head.data[s + 2] * a + b * (1 - a));
      }

      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;
    }
  }

  writeFileSync(new URL(`../public/${out}`, import.meta.url), PNG.sync.write(img));
  console.log(`wrote public/${out} (${size}x${size})`);
}

makeIcon(192, "icon-192.png");
makeIcon(512, "icon-512.png");
makeIcon(180, "apple-touch-icon.png");
