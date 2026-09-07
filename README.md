# Yumbo — Produce Risk Scanner

A mobile-first PWA. Point your phone camera at a grocery product, decode its
barcode, and (in later milestones) see pesticide and heavy-metal risk scores.
Built to be used one-handed, in a store, on bad connectivity.

## Status

**M1 — Camera spike (done).** Opens the rear camera, streams it full-screen, and
decodes retail barcodes (UPC-A / UPC-E / EAN-13 / EAN-8) continuously with
`zxing-wasm`, showing the raw digits and detected symbology. All camera failure
modes are surfaced with distinct on-screen states. No database, no scoring yet.

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
