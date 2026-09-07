# Build milestones

Paste one at a time. Do not move on until the previous one is confirmed working
**on your phone**, not just in desktop dev tools.

---

## M1 — Camera spike (do this first, alone)

> Set up a React + TypeScript + Vite project with Tailwind and `vite-plugin-pwa`.
> Build a single page that opens the rear-facing camera with `getUserMedia`
> (`facingMode: 'environment'`), streams it to a full-screen video element, and
> decodes barcodes continuously using `zxing-wasm`. Display the raw decoded
> digits and the detected symbology as large text overlaid on the video.
> Handle and visibly display these states: permission denied, no camera found,
> camera in use by another app, and decoding-but-nothing-found. Downscale frames
> before decoding to limit battery drain. Add a `netlify.toml` and a `_redirects`
> file with SPA fallback, plus a `Permissions-Policy` header allowing
> `camera=(self)`. No database, no scoring, no styling beyond legibility.

**Gate:** deploy to Netlify, open on your phone, scan a real UPC from your
pantry. If iOS Safari can't decode, stop and solve that before anything else.

---

## M2 — Supabase wiring and type generation

> Add the Supabase client. Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
> from the environment with a clear startup error if either is missing. Apply
> the migration in `supabase/migrations/`, generate TypeScript types into
> `src/lib/database.types.ts`, and add a `src/lib/supabase.ts` exporting a typed
> client. Write one smoke-test query that fetches all rows from `commodities`
> and logs the count.

---

## M3 — GTIN normalisation and product lookup

> Add `src/lib/gtin.ts` with a `normaliseToGtin14(raw: string): string` function
> that left-pads UPC-A and EAN-13 to 14 digits, validates the check digit, and
> throws a typed error on invalid input. Unit test it with real UPC-A codes
> including ones with leading zeros. Then wire the scanner: on decode, normalise
> and query the `product_risk` view by `gtin`. Render the raw result as JSON on
> screen. Handle the not-found case explicitly.

---

## M4 — Offline mirror

> Add Dexie. Create an IndexedDB schema mirroring `commodities`, `origins`, and
> `plu_codes`, plus a `product_cache` table for individual product lookups and a
> `sync_meta` table tracking last-sync timestamps. On app launch, pull rows
> changed since the last sync using `updated_at` and upsert them locally. Product
> lookups read from `product_cache` first and revalidate in the background.
> A cache miss with no network shows an explicit "not in local cache" state.

---

## M5 — Scoring in TypeScript, with parity test

> Implement `src/lib/scoring.ts` mirroring the Postgres `pesticide_score()` and
> `heavy_metal_score()` functions exactly, reading from the local Dexie tables so
> scoring works offline. Write a parity test that runs a table of fixture inputs
> through both the SQL functions and the TypeScript implementation and asserts
> identical output. Re-read invariants 2, 3, and 4 in CLAUDE.md before writing
> this file.

---

## M6 — The HUD

> Replace the JSON dump with the real scan UI. Show product name, brand,
> commodity, form, organic status, and origin, plus the two scores rendered as
> separate labelled bars — never combined. Visually mark inferred origin and
> unknown origin. Fire a haptic pulse (`navigator.vibrate`) on successful decode.
> Design for one-handed reach and fluorescent-light glare: large tap targets,
> high contrast, bottom-anchored controls. Add torch toggle via
> `track.applyConstraints({ advanced: [{ torch: true }] })`, feature-detected and
> hidden when unavailable.

---

## M7 — Compare tray

> Add a tray holding up to three scanned items. Scanning while the tray is open
> appends rather than replaces. Show the items side by side with both scores
> aligned for comparison, and mark the lower-risk option per score independently
> (there may be no single winner — say so when the two scores disagree). Persist
> the tray across reloads.

---

## M8 — PLU entry for loose produce

> Add a manual PLU entry mode: numeric keypad, 4–5 digits, looked up against
> `plu_codes`. A 5-digit code beginning with 9 is organic — derive this rather
> than asking the user. Show the same HUD as a barcode scan, minus brand.

---

## M9 — Data population

> Write a Node script under `scripts/` that ingests the Open Food Facts bulk
> export, filters to US produce categories, maps their category taxonomy to our
> `commodities` slugs, and generates a reviewable CSV of proposed `products` rows
> — do not write directly to the database. Flag low-confidence category mappings
> and missing origin separately so they can be hand-corrected before import.

---

## Later, optional

- Origin OCR from package labels (Tesseract.js) with user confirmation
- User-contributed origin submissions with confidence flags
- Recall lookup surfacing `contamination_findings` for a scanned brand
- Curator write role with custom JWT claim for editing reference data
