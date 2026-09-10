# Yumbo — Handoff

Everything a fresh session needs to continue, with the **commodity-expansion**
task specified at the end. Read `CLAUDE.md` (invariants) and `MILESTONES.md`
(plan) alongside this.

> Secrets note: this repo is **public**. The GitHub PAT and any true secret live
> in `CREDENTIALS.local.md` (gitignored), never here. The Supabase anon key and
> URL below are safe to expose (they ship in the client bundle; RLS is the
> security boundary).

---

## 1. What Yumbo is

Mobile-first PWA. Point the phone camera at grocery produce, decode the barcode
(or type a PLU / barcode), and show **two separate risk scores** — pesticide and
heavy-metal — that are **never combined**. Scoring model:

```
pesticide_score = round(least(5, commodity.pesticide_tier * origin.pesticide_multiplier)
                        * (organic ? (1 - commodity.organic_pesticide_mitigation) : 1), 2)
heavy_metal_score = round(least(5, commodity.heavy_metal_tier * origin.heavy_metal_multiplier), 2)
```

Non-negotiables (full list in `CLAUDE.md`): scores never merged; `is_organic`
reduces pesticide only (heavy metals are soil-derived); unknown origin is shown,
not defaulted; inferred data is labelled; supplier data never feeds scoring.

## 2. Access & credentials

| Thing | Value |
|---|---|
| GitHub repo | `justin-harvey/yumbo` (public) |
| GitHub owner/account | `justin-harvey` |
| GitHub PAT | in `CREDENTIALS.local.md` (gitignored). Fine-grained, needs **Contents: read/write** on the repo. User also pastes a fresh PAT inline per push. |
| Netlify site | https://yumbo.netlify.app (auto-deploys on push to `main`) |
| Supabase project ref | `npsjplanxeeuidtsqdru` |
| Supabase URL | `https://npsjplanxeeuidtsqdru.supabase.co` |
| Supabase anon key | in `CREDENTIALS.local.md` and in local `.env` (public-safe) |
| Supabase dashboard | https://supabase.com/dashboard/project/npsjplanxeeuidtsqdru |

Push pattern (PAT inline, not persisted to git config):
```
git push "https://x-access-token:<PAT>@github.com/justin-harvey/yumbo.git" main
```

## 3. Deploy & environments

- Netlify builds from `main`. `netlify.toml` pins **Node 20**, sets SPA fallback
  and `Permissions-Policy: camera=(self)`.
- **Required build-time env vars** (Netlify → Site config → Environment
  variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Vite inlines them at
  build, so **redeploy after any change** (Clear cache and deploy). Missing env →
  `src/lib/supabase.ts` throws at load → **white screen on every device**.
- Do NOT mark those env vars "secret" in Netlify — Vite inlines them into the
  bundle and Netlify's secret-scanner would fail the build.
- Local dev: `npm run dev` (localhost is a secure context, camera works). Local
  `.env` holds the two vars.

## 4. Supabase & migrations

**Every migration/seed SQL file must be pasted by hand** into the Supabase SQL
Editor (user is free-tier; chose dashboard paste over CLI/Branching). No Docker
locally, so no `supabase start`. Forgetting to paste a migration has bitten us
twice (blank app / empty results).

Migrations in `supabase/migrations/`. The first four are **applied**; the last
two are **generated and pending paste** (see §9):
1. `20260823000000_init_produce_risk.sql` — schema, `product_risk` view, scoring
   functions, RLS, seed 13 commodities + 8 origins.
2. `20260824000000_seed_test_products.sql` — banana commodity + 3 test products.
3. `20260825000000_product_submissions.sql` — `product_submissions` table + RLS +
   `catalog_risk` view (curated ∪ community).
4. `20260826000000_plu_risk_and_seed.sql` — `plu_risk` view + banana PLUs.
5. `20260910122841_expand_commodities.sql` — **PENDING** — +53 commodities with
   sourced tiers (EWG 2024 / FDA / CR). Regenerate with `npm run gen-commodities`.
6. `20260910124427_seed_plu_codes.sql` — **PENDING** — 1,812 PLU codes (907
   conventional IFPS + organic 9-twins). Paste AFTER #5. Regenerate with
   `npm run ingest-plu && npm run plu-sql`.

Also required: **Authentication → Anonymous sign-ins = ON** (for community
submissions).

Views the app reads: `catalog_risk` (barcodes), `plu_risk` (loose produce).
`product_risk` is the curated-only base that `catalog_risk` unions.

## 5. Current data state (as of handoff)

| Table | Rows | Note |
|---|---|---|
| commodities | 14 | scoring backbone (tiers in README) |
| origins | 8 | country-level only; `region` column unused |
| products | 3 | seeds only; M9 CSV (~60 Maine items) generated but not yet imported |
| plu_codes | 2 | banana 4011 / 94011 only |
| product_submissions | 0 | community adds |
| contamination_findings | 0 | recalls (optional, unbuilt) |
| suppliers | 0 | display-only |

## 6. Architecture map

- `src/App.tsx` — orchestrates camera, lookup, HUD, modals, compare, buddy.
- `src/scanner/useCamera.ts` — getUserMedia lifecycle, error classes, **torch**.
- `src/scanner/useBarcodeScanner.ts` — zxing decode loop, pause-on-decode,
  hung-decode timeout, `submitManual`.
- `src/scanner/decoder.ts` — zxing-wasm (wasm bundled locally, not CDN).
- `src/lib/gtin.ts` — `normaliseToGtin14` (check-digit validated); unit-tested
  in `gtin.test.ts` (vitest, `npm test`).
- `src/scanner/useProductLookup.ts` — queries `catalog_risk` by GTIN-14.
- `src/scanner/RiskHud.tsx` — the designed result (two bars, chips, mascot).
- `src/scanner/useCompareTray.ts` + `CompareSheet.tsx` — M7 compare.
- `src/scanner/ContributeSheet.tsx` + `src/lib/off.ts` + `src/lib/auth.ts` —
  community submission (OFF enrich + anon sign-in).
- `src/scanner/PluEntry.tsx` — M8 loose produce.
- `src/scanner/YumboBuddy.tsx` + `src/lib/tips.ts` — persistent mascot helper
  (blink 4s, wink 60s, tips 15s, heart-eyes on tap).
- `src/lib/severity.ts` — shared 0–5 → colour/label bands.
- `src/lib/database.types.ts` — hand-authored to mirror the migrations
  (regenerate with `supabase gen types typescript --linked` once linked).
- `public/brand/` — all mascot/logo art (source of truth; `dist/brand` is build
  output and gitignored).

## 7. Scripts / commands

```
npm run dev            # local dev
npm run build          # tsc + vite build  (Node 18 locally: prefix
                       #   NODE_OPTIONS="--experimental-global-webcrypto")
npm test               # vitest (gtin tests)
npm run smoke          # REST count of commodities (sanity-check env/DB)
npm run ingest         # M9: OFF -> scripts/out/proposed_products_*.csv
npm run import-sql     # M9: reviewed CSV -> scripts/out/import_*.sql (paste it)
npm run gen-commodities# commodity expansion -> proposed_commodities.csv + migration
npm run ingest-plu     # IFPS PLU list -> proposed_plu.csv + unmatched_plu.csv
npm run plu-sql        # reviewed proposed_plu.csv -> seed_plu_codes.sql (paste it)
node scripts/make-icons.mjs   # regenerate PWA icons from the mascot head
node scripts/crop.mjs ...     # slice regions from yumbo branding.png
```

## 8. Gotchas

- **Node 18 has no global `crypto`** → local prod build needs
  `NODE_OPTIONS="--experimental-global-webcrypto"`. Netlify uses Node 20, fine.
- **supabase-js opens a realtime WebSocket** that Node <22 lacks → `smoke.mjs`
  hits PostgREST via `fetch`, not the client. Browser is unaffected.
- **Migrations are manual** (paste in dashboard). Don't forget the newest one.
- **Env vars are build-time**; redeploy after changing.
- **Brand assets** belong in `public/brand/`, not `dist/brand` (dist is wiped).
- **PAT** must be fine-grained with Contents:write and must never be committed.

## 9. TASK — Commodity + PLU expansion

> **STATUS (done, pending paste):** both halves are built as generated
> migrations. The data pipeline lives in `scripts/` and is driven off two
> reviewable CSVs in `scripts/out/`:
> - `proposed_commodities.csv` (53 rows) → `20260910122841_expand_commodities.sql`
> - `proposed_plu.csv` (907 rows) → `20260910124427_seed_plu_codes.sql` (1,812
>   codes with organic twins); `unmatched_plu.csv` (94 rows) is the audit trail
>   of names with no defensible commodity (herbs, tree nuts, exotic tropicals) —
>   deliberately NOT force-fit, per the health-data discipline.
> - IFPS source list bundled at `scripts/data/ifps_plu.csv` (public domain).
> - Keyword→slug rules in `scripts/plu-map.data.mjs`; commodity tiers +
>   citations in `scripts/commodities.data.mjs`. PLU coverage is ~92% of
>   mappable codes.
>
> **Remaining for a human:** review the two CSVs, then paste #5 then #6 into the
> Supabase SQL Editor (order matters). To widen coverage, add commodities in
> `commodities.data.mjs` (with sources) and/or rules in `plu-map.data.mjs`, then
> re-run `npm run gen-commodities && npm run ingest-plu && npm run plu-sql`.

Original spec retained below for context.

**Why:** only 14 commodities exist. This caps both barcode coverage (a scanned
product can't score without its commodity) and PLU coverage (a PLU can't map to
a missing commodity). Expanding commodities is the single highest-leverage data
input. It is also the prerequisite for a real IFPS PLU import.

**Schema** (`commodities`): `slug` (unique), `display_name`, `category`,
`heavy_metal_tier` smallint 1–5, `pesticide_tier` smallint 1–5,
`organic_pesticide_mitigation` numeric(3,2) 0–1 (default 0.70), `notes`,
`sources` jsonb (currently empty — **fill it**).

**Deliverable:** a new migration
`supabase/migrations/<UTCstamp>_expand_commodities.sql` with
`insert into commodities (...) values (...) on conflict (slug) do nothing;`,
then the user pastes it. Target ~25–35 common produce items, e.g.: apple, grape,
tomato, lettuce, romaine, cucumber, celery, orange, pear, cherry, lemon, lime,
grapefruit, onion, garlic, mango, pineapple, avocado, cantaloupe, watermelon,
cauliflower, cabbage, asparagus, mushroom, sweet_corn, eggplant, summer_squash,
apricot, nectarine, plum, raspberry, blackberry, cranberry, brussels_sprouts.

**How to source each tier (cite it in `sources`):**
- `pesticide_tier` — EWG Dirty Dozen / Clean Fifteen (latest), USDA Pesticide
  Data Program (PDP), Consumer Reports. Dirty Dozen ≈ tier 4–5, Clean Fifteen
  ≈ tier 1–2.
- `heavy_metal_tier` — FDA Total Diet Study, Consumer Reports heavy-metal
  testing, As You Sow, HBBF (baby-food metals), peer-reviewed accumulation
  studies. Leafy greens & root crops trend higher (cadmium/lead uptake).
- `organic_pesticide_mitigation` — ~0.85 for thin-skinned high-residue crops
  (berries, greens, stone fruit), ~0.70 for thick-peel/low-residue crops.
- Put citations in `sources`, e.g.
  `'[{"name":"EWG 2024 Dirty Dozen","url":"https://ewg.org/..."}]'::jsonb`.

**Discipline (health app):** tiers must be sourced, not guessed; when evidence is
weak, pick the conservative-but-honest value and note it; keep the two scores
independent; organic must never touch `heavy_metal_tier`. Consider producing a
reviewable CSV first (like M9) so a human signs off before the migration.

**After commodities → PLU import:** build `scripts/ingest-plu.mjs` that maps the
**IFPS PLU** list to the (now larger) commodity set into a reviewable CSV, then a
csv→SQL step into `plu_codes` (only for commodities that exist). `plu_risk`
already scores them. Do not hand-type PLU→commodity mappings.

## 10. Milestone status

Done: M1 (camera), M2 (Supabase), M3 (GTIN lookup), M6 (HUD), M7 (compare),
M8 (PLU entry — mechanism only, banana seeded), M9 (OFF ingest + importer),
community submissions, full branding + mascot helper, **commodity expansion +
IFPS PLU import** (§9 — migrations generated, pending paste).

Not done: paste migrations #5/#6, M4 (offline mirror / Dexie — deferred to last),
M5 (TS scoring parity test — only meaningful once offline scoring exists),
curator review UI, sub-national origins, recalls.
