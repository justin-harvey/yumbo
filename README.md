# Yumbo — Produce Risk Scanner

A mobile-first PWA. Point your phone camera at a grocery product, decode its
barcode, and see pesticide and heavy-metal risk scores. Built to be used
one-handed, in a store, on bad connectivity.

Live: https://yumbo.netlify.app · Repo: https://github.com/justin-harvey/yumbo

## The data keeps itself fresh 🔄

Most risk-scanner apps ship a one-time data dump that rots the day it's built.
Yumbo doesn't. A **scheduled GitHub Actions pipeline runs every week**, polls
public food-safety sources, and opens a **pull request** with whatever changed —
so the catalog stays current with no one re-keying data, and **nothing reaches
the database unreviewed**. (External datasets don't offer webhooks, so it polls;
recall data is display-only and never moves a score.)

- **FDA recall watch** — pulls the [openFDA food-enforcement API](https://open.fda.gov/apis/food/enforcement/),
  keeps only genuine contamination recalls of *actual produce* (two precision
  gates: the reason must be microbial/chemical — Listeria, Salmonella, E. coli,
  Cyclospora, pesticide, heavy metal — and the item must not be a processed
  food), and maps each to its commodity.
- **New-produce intake** — watches Open Food Facts for **newly added produce**
  worldwide and proposes it into the catalog, mapped through the same
  67-commodity engine (the feasible stand-in for "live webhooks," which OFF
  doesn't provide).
- **Human in the loop** — every run lands as a reviewable diff you approve before
  the SQL is pasted. Freshness *and* discipline, not one at the expense of the
  other.

Run it on demand from **Actions → "Refresh produce data" → Run workflow**, or let
the Monday cron do it. See [`HANDOFF.md`](./HANDOFF.md) §9b for the internals.

## What's in the catalog

Yumbo scores produce two ways — barcoded packages (by GTIN) and loose produce
(by PLU) — off a curated, **sourced** database:

| | Count |
|---|--:|
| Produce commodities (the scoring backbone) | **67** |
| PLU codes for loose produce | **1,812** |
| — distinct commodities those PLUs cover | 67 |
| Country-level origins (risk multipliers) | 8 |

The PLU set is **907 conventional IFPS codes** — about **92% of every mappable
code in the International Federation for Produce Standards list** — plus their
organic (9-prefixed) twins. Every commodity tier is **sourced, never guessed**:
pesticide tiers from the [EWG 2024 Shopper's Guide](https://www.ewg.org/foodnews/)
(Dirty Dozen / Clean Fifteen), heavy-metal tiers from the FDA Total Diet Study,
Consumer Reports, and Healthy Babies Bright Futures. Names with no defensible
tier (fresh herbs, tree nuts, exotic tropicals) are deliberately left out rather
than faked.

It's fully reproducible: commodity tiers live in
[`scripts/commodities.data.mjs`](./scripts/commodities.data.mjs), the IFPS
name→commodity rules in
[`scripts/plu-map.data.mjs`](./scripts/plu-map.data.mjs), and both feed
re-runnable migrations in `supabase/migrations/`. See
[`HANDOFF.md`](./HANDOFF.md) §9 for the pipeline.

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
  from a 9-prefixed code, scored via the `plu_risk` view. Backed by a full IFPS
  import — **1,812 PLU codes** across 67 commodities (see *What's in the catalog*
  above).
- **M9 — Open Food Facts ingest (done).** `npm run ingest` pulls leading Maine
  chains' produce into a reviewable CSV; `npm run import-sql` turns the reviewed
  CSV into an insert migration. Never writes the DB directly.
- **Brand + mascot (done).** Yumbo raccoon-chef throughout, plus a persistent
  YumboBuddy helper (blink/wink, heart-eyes on tap, rotating produce tips).
- **Automated data refresh (done).** A weekly GitHub Actions workflow polls the
  openFDA food-recall API and Open Food Facts for newly added produce, then opens
  a PR with the regenerated, reviewable artifacts — external sources have no
  webhooks, so it polls, and it never writes the database directly. FDA recalls
  are display-only and never feed scoring. See [`HANDOFF.md`](./HANDOFF.md) §9b.
- **Deferred:** offline mirror (Dexie) is intentionally last; until then every
  scan needs connectivity.

See [`MILESTONES.md`](./MILESTONES.md) for the full build plan,
[`CLAUDE.md`](./CLAUDE.md) for the stack and non-negotiable invariants, and
[`HANDOFF.md`](./HANDOFF.md) for the full project state + the commodity-expansion
task.

## Commodity reference (current scoring tiers)

Risk tiers are **1 (low) … 5 (high)**. The two scores are always kept separate.
`organic mit.` is how much organic certification reduces the *pesticide* score
only (0–1); it never touches heavy metals (soil-derived). The 14 originals are
shown below; the expansion adds **53 more (67 total)** with the same discipline.
The full sourced list with citations is in
[`scripts/commodities.data.mjs`](./scripts/commodities.data.mjs).

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
