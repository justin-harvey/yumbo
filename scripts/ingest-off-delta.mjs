// Poll Open Food Facts for RECENTLY CREATED fresh produce and propose new
// `products` rows — the feasible version of the "OFF webhooks" idea (OFF has no
// per-product push, so we pull the newest additions on a schedule instead).
//
//   node scripts/ingest-off-delta.mjs [--since-days 14] [--pages 3]
//
// Writes data/incoming/off_delta.csv (tracked, overwritten) in the SAME schema
// as ingest-off.mjs, so the existing reviewer flow applies:
//   review the CSV -> `npm run import-sql -- --in data/incoming/off_delta.csv`
// Never writes the DB. Commodity is mapped with the 67-commodity keyword map
// (scripts/plu-map.data.mjs); everything is flagged needs_review because these
// are unreviewed community entries.

import { mkdirSync, writeFileSync } from "node:fs";
import { COMMODITIES } from "./commodities.data.mjs";
import { RULES, IGNORE } from "./plu-map.data.mjs";

const EXISTING = [
  "spinach", "kale", "carrot", "sweet_potato", "potato", "strawberry",
  "blueberry", "green_bean", "bell_pepper", "peach", "pea", "broccoli",
  "winter_squash", "banana",
];
const ALL_SLUGS = new Set([...EXISTING, ...COMMODITIES.map((c) => c.slug)]);

const UA = "Yumbo-Ingest/0.1 (github.com/justin-harvey/yumbo; produce risk scanner)";
const BASE = "https://world.openfoodfacts.org/api/v2/search";
const FIELDS = "code,product_name,brands,categories_tags,labels_tags,origins_tags,created_t";
const CATEGORIES = ["en:fresh-fruits", "en:fresh-vegetables"];

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const SINCE_DAYS = Number(arg("since-days", "14"));
const PAGES = Number(arg("pages", "3"));
const sinceEpoch = Math.floor(Date.now() / 1000) - SINCE_DAYS * 86400;

const EXCLUDE_RE =
  /juice|smoothie|sauce|jam|jelly|dried|chips?|snack|puree|pur[ée]e|cake|yogurt|bar\b|candy|chocolate|beverage|soda|drink|powder|dressing|canned/i;
const ORIGIN_TAG_TO_CC = {
  "en:united-states": "US", "en:usa": "US", "en:mexico": "MX", "en:canada": "CA",
  "en:peru": "PE", "en:chile": "CL", "en:china": "CN", "en:turkey": "TR", "en:india": "IN",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function classify(name, cats) {
  const hay = `${name} ${cats.join(" ").replace(/en:/g, " ").replace(/-/g, " ")}`.toLowerCase();
  for (const [sub, slug] of RULES) {
    if (slug === IGNORE) { if (hay.includes(sub)) return null; continue; }
    if (hay.includes(sub)) return ALL_SLUGS.has(slug) ? slug : null;
  }
  return null;
}

function gtin14(code) {
  const c = String(code).trim();
  return /^[0-9]{8,14}$/.test(c) ? c.padStart(14, "0") : null;
}

async function fetchPage(cat, page) {
  const url = `${BASE}?categories_tags=${encodeURIComponent(cat)}` +
    `&countries_tags=en:united-states&sort_by=created_t&fields=${FIELDS}&page_size=100&page=${page}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) { await sleep(4000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      if (attempt === 3) { console.warn(`  fetch failed (${cat} p${page}): ${e.message}`); return { products: [] }; }
      await sleep(4000 * (attempt + 1));
    }
  }
  return { products: [] };
}

async function main() {
  const rows = [];
  const seen = new Set();
  let fetched = 0, tooOld = 0;

  for (const cat of CATEGORIES) {
    for (let page = 1; page <= PAGES; page++) {
      const body = await fetchPage(cat, page);
      const products = body.products ?? [];
      if (!products.length) break;
      fetched += products.length;
      let stop = false;

      for (const p of products) {
        if ((p.created_t ?? 0) < sinceEpoch) { tooOld++; stop = true; continue; }
        const gtin = gtin14(p.code);
        if (!gtin || seen.has(gtin)) continue;
        const name = p.product_name ?? "";
        const cats = p.categories_tags ?? [];
        if (EXCLUDE_RE.test(name)) continue;
        const slug = classify(name, cats);
        if (!slug) continue;

        seen.add(gtin);
        const organic = (p.labels_tags ?? []).some((l) => /organic/.test(l));
        const originTag = (p.origins_tags ?? []).find((t) => ORIGIN_TAG_TO_CC[t]);
        const cc = originTag ? ORIGIN_TAG_TO_CC[originTag] : "";
        const reasons = ["community-entry-unreviewed"];
        if (!cc) reasons.push("missing-origin");

        rows.push({
          gtin, display_name: name || slug, brand: p.brands || "", chain: "",
          commodity_slug: slug, form: "fresh", is_organic: organic,
          origin_country_code: cc, origin_raw: (p.origins_tags ?? [])[0] ?? "",
          mapping_source: "name", mapping_confidence: "low",
          needs_review: true, review_reasons: reasons.join("; "),
          off_code: p.code, off_url: `https://world.openfoodfacts.org/product/${p.code}`,
        });
      }
      await sleep(6000);
      if (stop) break; // sorted newest-first; once we pass the window, stop paging
    }
  }

  const headers = ["gtin", "display_name", "brand", "chain", "commodity_slug", "form",
    "is_organic", "origin_country_code", "origin_raw", "mapping_source",
    "mapping_confidence", "needs_review", "review_reasons", "off_code", "off_url"];
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n");
  mkdirSync(new URL("../data/incoming/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../data/incoming/off_delta.csv", import.meta.url), csv + "\n");

  const byCommodity = {};
  for (const r of rows) byCommodity[r.commodity_slug] = (byCommodity[r.commodity_slug] ?? 0) + 1;
  console.log(`window:         last ${SINCE_DAYS} days`);
  console.log(`fetched:        ${fetched} (stopped past window: ${tooOld})`);
  console.log(`new produce:    ${rows.length}`);
  console.log(`by commodity:   ${JSON.stringify(byCommodity)}`);
  console.log("wrote: data/incoming/off_delta.csv");
}

await main();
