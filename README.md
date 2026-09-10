# Yumbo — Produce Risk Scanner

A mobile-first PWA. Point your phone camera at a grocery product, decode its
barcode, and see pesticide and heavy-metal risk scores. Built to be used
one-handed, in a store, on bad connectivity.

Live: https://yumbo.netlify.app · Repo: https://github.com/justin-harvey/yumbo

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
- **M7 — compare tray (done).** Hold up to 3 items (persisted across reloads);
  compare-mode scans append; side-by-side view aligns both scores and marks the
  lower-risk pick per score independently, saying so when they disagree.
- **M8 — PLU entry (done).** Loose-produce keypad (4–5 digits), organic derived
  from a 9-prefixed code, scored via the `plu_risk` view. Only banana PLUs are
  seeded; a full IFPS import is gated on expanding commodities (see HANDOFF.md).
- **M9 — Open Food Facts ingest (done).** `npm run ingest` pulls leading Maine
  chains' produce into a reviewable CSV; `npm run import-sql` turns the reviewed
  CSV into an insert migration. Never writes the DB directly.
- **Brand + mascot (done).** Yumbo raccoon-chef throughout, plus a persistent
  YumboBuddy helper (blink/wink, heart-eyes on tap, rotating produce tips).
- **Deferred:** offline mirror (Dexie) is intentionally last; until then every
  scan needs connectivity.

See [`MILESTONES.md`](./MILESTONES.md) for the full build plan,
[`CLAUDE.md`](./CLAUDE.md) for the stack and non-negotiable invariants, and
[`HANDOFF.md`](./HANDOFF.md) for the full project state + the commodity-expansion
task.

## Commodity reference (current scoring tiers)

Risk tiers are **1 (low) … 5 (high)**. The two scores are always kept separate.
`organic mit.` is how much organic certification reduces the *pesticide* score
only (0–1); it never touches heavy metals (soil-derived). These 14 are seeded
values drawn from Consumer Reports (2024) pesticide analysis and As You Sow /
USDA PDP / peer-reviewed accumulation data; they are pending a fully sourced
expansion (see [`HANDOFF.md`](./HANDOFF.md)).

| Commodity | Category | Pesticide tier | Heavy-metal tier | Organic mit. |
|---|---|:--:|:--:|:--:|
| Banana | tropical | 1 | 1 | 0.70 |
| Bell pepper | fruiting | 5 | 2 | 0.85 |
| Blueberry | berry | 5 | 2 | 0.85 |
| Broccoli | brassica | 2 | 2 | 0.70 |
| Carrot | root | 2 | 4 | 0.70 |
| Green bean | legume | 5 | 2 | 0.85 |
| Kale | leafy_green | 4 | 4 | 0.75 |
| Pea | legume | 1 | 2 | 0.70 |
| Peach | stone_fruit | 4 | 2 | 0.85 |
| Potato | root | 3 | 4 | 0.75 |
| Spinach | leafy_green | 3 | 5 | 0.75 |
| Strawberry | berry | 5 | 2 | 0.85 |
| Sweet potato | root | 2 | 4 | 0.70 |
| Winter squash | gourd | 2 | 2 | 0.70 |

Origins add a multiplier (country-level today): US 1.00, MX 1.40 pesticide,
CN 1.30 pesticide / 1.50 heavy-metal, etc. See the init migration for the full
set and provenance notes.

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

`netlify.toml` sets the build command, SPA fallback, Node 20, and a
`Permissions-Policy: camera=(self)` header (required for `getUserMedia` on some
browsers even over HTTPS). Point Netlify at this repo and set the two build-time
env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (they are inlined at
build, so **redeploy after changing them**). Without them the app throws on load
and white-screens — see [`HANDOFF.md`](./HANDOFF.md).

## Stack

React 18 + TypeScript, Vite, Tailwind, `vite-plugin-pwa`, `zxing-wasm` for
decoding. The decoder wasm is bundled locally (not fetched from a CDN) so the
first scan does not wait on store connectivity.
