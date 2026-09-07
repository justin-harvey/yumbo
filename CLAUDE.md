# Produce Risk Scanner

A mobile-first PWA. Point the phone camera at a grocery product, decode its
barcode, and show a HUD with pesticide and heavy-metal risk scores. Used
one-handed, in a store, on bad connectivity.

## Stack — decided, do not substitute

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Barcode decode | `zxing-wasm` (sole decoder path) |
| PWA / service worker | `vite-plugin-pwa` |
| Local storage | Dexie.js over IndexedDB |
| Backend | Supabase (Postgres + PostgREST) |
| Hosting | Netlify |

If a task seems to need a different library, stop and ask rather than adding one.

## Non-negotiable invariants

These encode domain facts. Violating them produces output that is confidently
wrong, so they are worth re-reading before touching scoring or data code.

1. **GTINs are text, never numeric.** Leading zeros are significant. Normalise
   scanned UPC-A (12 digits) and EAN-13 (13 digits) to GTIN-14 by left-padding
   with zeros before any lookup.

2. **Pesticide score and heavy-metal score are never merged.** No combined
   "overall risk" number, no average, no single letter grade spanning both.
   They behave differently and the whole point of the app is to show that.

3. **`is_organic` reduces the pesticide score only.** Heavy metals are
   soil-derived; organic certification has no effect on them. Never pass
   `is_organic` into heavy-metal scoring, in SQL or in TypeScript.

4. **Supplier / co-packer data never feeds risk scoring.** `supplier_brand_links`
   exists for recall lookup and display only. Public co-packer data is sparse
   and derived mostly from pathogen recalls; scoring on it would be false
   precision.

5. **Scoring reads from local IndexedDB, not the network.** A scan must produce
   a score with the radio off. Network calls may refresh cached data in the
   background; they may never block the HUD.

6. **Unknown origin is displayed, not defaulted.** When `origin_id` is null,
   score with a neutral 1.0 multiplier *and* surface reduced confidence in the
   UI. Never silently assume US origin.

7. **Inferred data is labelled.** Anything with `evidence_strength` of
   `inferred` or `origin_confidence` of `inferred` must be visually
   distinguishable from documented data.

## Schema contract

The database is defined by `supabase/migrations/20260823000000_init_produce_risk.sql`.
Treat it as the source of truth. Generate types with:

```
supabase gen types typescript --local > src/lib/database.types.ts
```

Key tables: `commodities`, `origins`, `brands`, `products`, `plu_codes`,
`suppliers`, `supplier_brand_links`, `contamination_findings`.
Key view: `product_risk`. Key functions: `pesticide_score()`, `heavy_metal_score()`.

Scoring logic lives in Postgres functions so methodology can change without an
app release. The TypeScript implementation in `src/lib/scoring.ts` is a mirror
for offline use — if you change one, change both, and keep the parity test
passing.

## Offline model

- `commodities`, `origins`, `plu_codes` — mirrored in full to IndexedDB. Small,
  change rarely. Sync deltas by `updated_at` on app launch.
- `products` — too large to mirror. Cache individual lookups
  stale-while-revalidate. A cache miss with no network shows a clear
  "not in local cache" state, not a spinner.
- App shell — precached by the service worker.

## Environment

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` come from Netlify environment
variables. The anon key ships in the bundle; that is expected. RLS is the
security boundary, not key secrecy. Never commit a service-role key.

## Conventions

- Path alias `@/` maps to `src/`.
- Prefer plain functions and hooks over classes.
- No global state library; React context is sufficient at this size.
- Every camera and decode failure path needs a visible user-facing state.
  Silent failure in a store is indistinguishable from a broken app.

## Device reality

Development happens on desktop; the app is only ever really tested on a phone
over HTTPS. Assume iOS Safari is the hardest target. Torch control and
`BarcodeDetector` are Chrome/Android only — feature-detect, degrade silently,
never assume availability.
