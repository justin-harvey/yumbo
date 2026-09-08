# Yumbo — Produce Risk Scanner

A mobile-first PWA. Point your phone camera at a grocery product, decode its
barcode, and (in later milestones) see pesticide and heavy-metal risk scores.
Built to be used one-handed, in a store, on bad connectivity.

## Status

- **M1 — Camera spike (done).** Rear camera full-screen, continuous `zxing-wasm`
  decode of retail barcodes (UPC-A / UPC-E / EAN-13 / EAN-8), raw digits +
  symbology, every camera failure mode surfaced. Recoverable: pause-on-decode,
  Scan-again, hung-decode timeout, and a manual keypad fallback.
- **M2 — Supabase wiring (done).** Typed client from env, schema types, smoke
  test (`npm run smoke`).
- **M3 — GTIN lookup (done).** `normaliseToGtin14` (check-digit validated, unit
  tested) + live query on scan; raw JSON result with explicit not-found /
  invalid / error states.
- **Community submissions (done).** Unknown barcode → enrich from Open Food
  Facts → map to a commodity → submit. Contributions land in a separate
  `product_submissions` table (never the curated `products`), are scored through
  the same SQL functions, and surface to everyone immediately flagged
  `verified: false`. The app reads the unified `catalog_risk` view. Writes use
  Supabase Anonymous Sign-in. Requires enabling anonymous sign-ins in the
  project's Auth settings.
- **M6 — designed HUD (done).** Product identity + two independent risk scores
  as separate colored bars (never combined), inferred/unknown origin surfaced,
  haptic on decode, torch toggle (feature-detected), Yumbo mascot reactions.
- **Deferred:** offline mirror (Dexie) is intentionally last; until then every
  scan needs connectivity.

See [`MILESTONES.md`](./MILESTONES.md) for the full build plan and
[`CLAUDE.md`](./CLAUDE.md) for the stack and non-negotiable invariants.

## Develop

```bash
npm install
npm run dev
```

The camera requires a **secure context**. `localhost` counts, so desktop dev
works, but to test on a phone you need HTTPS — deploy to Netlify (below) or use
an HTTPS tunnel. iOS Safari is the hardest target and the real test surface.

```bash
npm run build     # tsc + vite build -> dist/
npm run preview   # serve the production build locally
```

## Deploy (Netlify)

`netlify.toml` sets the build command, SPA fallback, and a
`Permissions-Policy: camera=(self)` header (required for `getUserMedia` on some
browsers even over HTTPS). Point Netlify at this repo; no env vars needed for
M1.

## Stack

React 18 + TypeScript, Vite, Tailwind, `vite-plugin-pwa`, `zxing-wasm` for
decoding. The decoder wasm is bundled locally (not fetched from a CDN) so the
first scan does not wait on store connectivity.
