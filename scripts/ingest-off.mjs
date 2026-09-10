// M9 — Open Food Facts ingester, focused on leading Maine grocery chains.
//
//   node scripts/ingest-off.mjs [--pages N] [--delay MS] [--brands tag1,tag2]
//
// Pulls each target chain's (private-label) products from the OFF search API,
// maps OFF category tags to our commodity slugs, and writes a REVIEWABLE CSV of
// proposed `products` rows to scripts/out/. It never writes to the database.
// Low-confidence category mappings and missing origin are flagged in a
// needs_review column so they can be hand-corrected before import.

import { mkdirSync, writeFileSync } from "node:fs";

const UA = "Yumbo-Ingest/0.1 (github.com/justin-harvey/yumbo; produce risk scanner)";
const BASE = "https://world.openfoodfacts.org/api/v2/search";
const FIELDS =
  "code,product_name,brands,categories_tags,labels_tags,origins_tags,countries_tags,quantity";

// Leading chains in Maine and their (private-label) brand tags on OFF.
const DEFAULT_BRANDS = [
  ["hannaford", "Hannaford", "Hannaford"],
  ["natures-promise", "Nature's Promise", "Hannaford"],
  ["nature-s-promise", "Nature's Promise", "Hannaford"],
  ["taste-of-inspiration", "Taste of Inspiration", "Hannaford"],
  ["o-organics", "O Organics", "Shaw's / Star Market"],
  ["signature-select", "Signature Select", "Shaw's / Star Market"],
  ["signature-farms", "Signature Farms", "Shaw's / Star Market"],
  ["open-nature", "Open Nature", "Shaw's / Star Market"],
  ["365-everyday-value", "365 Everyday Value", "Whole Foods"],
  ["365-by-whole-foods-market", "365 by Whole Foods Market", "Whole Foods"],
  ["trader-joe-s", "Trader Joe's", "Trader Joe's"],
  ["great-value", "Great Value", "Walmart"],
  ["marketside", "Marketside", "Walmart"],
  ["wyman-s", "Wyman's", "Wyman's (Maine)"],
];

// OFF category tag -> our commodity slug. `broad` tags are kept but flagged for
// review (e.g. "peppers" may be hot peppers, "squash" may be summer squash).
const CATEGORY_TO_SLUG = new Map(
  Object.entries({
    "en:spinach": "spinach",
    "en:spinaches": "spinach",
    "en:baby-spinach": "spinach",
    "en:fresh-spinach": "spinach",
    "en:kale": "kale",
    "en:kales": "kale",
    "en:carrots": "carrot",
    "en:baby-carrots": "carrot",
    "en:sweet-potatoes": "sweet_potato",
    "en:potatoes": "potato",
    "en:strawberries": "strawberry",
    "en:blueberries": "blueberry",
    "en:wild-blueberries": "blueberry",
    "en:green-beans": "green_bean",
    "en:string-beans": "green_bean",
    "en:bell-peppers": "bell_pepper",
    "en:sweet-peppers": "bell_pepper",
    "en:peaches": "peach",
    "en:peas": "pea",
    "en:green-peas": "pea",
    "en:garden-peas": "pea",
    "en:broccoli": "broccoli",
    "en:broccolis": "broccoli",
    "en:winter-squash": "winter_squash",
    "en:butternut-squash": "winter_squash",
    "en:acorn-squash": "winter_squash",
    "en:bananas": "banana",
  }),
);
// "squash" is broad (summer vs winter); keep it, but flagged low-confidence.
const BROAD_TAGS = new Set(["en:squash"]);
CATEGORY_TO_SLUG.set("en:squash", "winter_squash");

// Categories that mean "this is a processed product, not fresh/frozen/canned
// produce" — a scanned strawberry SODA or carrot CAKE must never be scored as
// produce. If any of these appear, the product is skipped entirely.
const EXCLUDE_RE =
  /beverages|sodas|soft-drinks|energy-drinks|waters|yogurts|dairies|milks|cheeses|creams|desserts|ice-cream|frozen-desserts|cakes|pastries|biscuits|cookies|snacks|crackers|chips|sauces|condiments|dressings|spices|seasonings|waffles|pancakes|cereals|candies|confectioneries|chocolates|jams|jellies|marmalades|preserves|compotes|spreads|nut-butters|seed-butters|syrups|smoothies|granolas?|breads|pasta|pizzas|prepared-meals|soups|dips|hummus/;

// Some OFF entries have no categories, so also reject obviously-processed names.
// Kept names are simple ("Cut Green Beans", "Whole Strawberries"); processed
// ones carry extra nouns. Also drops dried legumes that aren't our garden pea.
// \bbutters?\b is safe: it won't match "butternut" (no word boundary after
// "butter" there), but does catch "apple/almond/peanut butter".
const EXCLUDE_NAME_RE =
  /cake|yogurt|waffle|pancake|powder|popper|blend|smoothie|soda|\bbar\b|oatmeal|protein|\bbutters?\b|chip|cookie|muffin|bread|sauce|dressing|ice cream|\bpie\b|\bjam\b|jelly|marmalade|preserves?|compote|spread|syrup|cereal|chocolate|candy|drink|fries|tots?|tater|split peas?|black.?eyed?|yelloweye|lentil|chick.?pea|hummus|crisp|baby food|\bwraps?\b|tortilla|pur[eé]e|pouch|quinoa|chia/i;

// Ordered name fallbacks (low confidence). Order matters: sweet potato first.
const NAME_KEYWORDS = [
  [/sweet potato/i, "sweet_potato"],
  [/\bspinach\b/i, "spinach"],
  [/\bkale\b/i, "kale"],
  [/\bcarrots?\b/i, "carrot"],
  [/strawberr/i, "strawberry"],
  [/blueberr/i, "blueberry"],
  [/green beans?/i, "green_bean"],
  [/bell peppers?/i, "bell_pepper"],
  [/\bpeach(es)?\b/i, "peach"],
  [/\bpeas\b/i, "pea"],
  [/broccoli/i, "broccoli"],
  [/butternut|acorn|winter squash/i, "winter_squash"],
  [/\bpotatoes?\b/i, "potato"],
  [/banana/i, "banana"],
];

const ORIGIN_TAG_TO_CC = {
  "en:united-states": "US",
  "en:usa": "US",
  "en:maine": "US",
  "en:california": "US",
  "en:florida": "US",
  "en:mexico": "MX",
  "en:canada": "CA",
  "en:peru": "PE",
  "en:chile": "CL",
  "en:china": "CN",
  "en:turkey": "TR",
  "en:india": "IN",
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const MAX_PAGES = Number(arg("pages", "6"));
const DELAY_MS = Number(arg("delay", "6500"));
const brandsArg = arg("brands", "");
const BRANDS = brandsArg
  ? brandsArg.split(",").map((t) => [t.trim(), t.trim(), "custom"])
  : DEFAULT_BRANDS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(brandTag, page) {
  const url =
    `${BASE}?brands_tags=${encodeURIComponent(brandTag)}` +
    `&countries_tags=en:united-states&fields=${FIELDS}` +
    `&page_size=100&page=${page}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 || res.status >= 500) {
      const wait = DELAY_MS * (attempt + 2);
      console.warn(`  ${res.status} on ${brandTag} p${page}; backing off ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${brandTag} p${page}`);
    return res.json();
  }
  throw new Error(`giving up on ${brandTag} p${page}`);
}

function mapCommodity(cats, name) {
  for (const tag of cats) {
    const slug = CATEGORY_TO_SLUG.get(tag);
    if (slug) {
      return {
        slug,
        source: "category",
        confidence: BROAD_TAGS.has(tag) ? "low" : "high",
      };
    }
  }
  for (const [re, slug] of NAME_KEYWORDS) {
    if (re.test(name)) return { slug, source: "name", confidence: "low" };
  }
  return null;
}

function detectForm(cats, name) {
  const s = `${cats.join(" ")} ${name}`.toLowerCase();
  if (/frozen/.test(s)) return "frozen";
  if (/canned|\bcan\b/.test(s)) return "canned";
  if (/juice/.test(s)) return "juice";
  if (/dried|dehydrated/.test(s)) return "dried";
  return "fresh";
}

function detectOrganic(labels) {
  return labels.some((l) => /organic/.test(l));
}

function mapOrigin(originTags) {
  for (const tag of originTags) {
    if (ORIGIN_TAG_TO_CC[tag]) return { cc: ORIGIN_TAG_TO_CC[tag], raw: tag };
  }
  return { cc: "", raw: originTags[0] ?? "" };
}

function normaliseGtin14(code) {
  const clean = String(code).trim();
  if (!/^[0-9]{8,14}$/.test(clean)) return null;
  return clean.padStart(14, "0");
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const rows = [];
  const seen = new Set();
  const stats = { fetched: 0, kept: 0, byCommodity: {}, needsReview: 0 };

  for (const [tag, label, chain] of BRANDS) {
    let page = 1;
    let total = Infinity;
    console.log(`\n# ${label} (${chain}) [${tag}]`);
    while (page <= MAX_PAGES && (page - 1) * 100 < total) {
      let body;
      try {
        body = await fetchPage(tag, page);
      } catch (e) {
        console.warn(`  ${e.message}`);
        break;
      }
      total = body.count ?? 0;
      const products = body.products ?? [];
      stats.fetched += products.length;
      if (page === 1) console.log(`  ${total} products in brand`);

      for (const p of products) {
        const gtin = normaliseGtin14(p.code);
        if (!gtin || seen.has(gtin)) continue;
        const cats = p.categories_tags ?? [];
        const name = p.product_name ?? "";
        if (EXCLUDE_RE.test(cats.join(" ")) || EXCLUDE_NAME_RE.test(name)) {
          continue; // processed, not produce
        }
        const match = mapCommodity(cats, name);
        if (!match) continue;

        seen.add(gtin);
        const organic = detectOrganic(p.labels_tags ?? []);
        const origin = mapOrigin(p.origins_tags ?? []);
        const reasons = [];
        if (match.confidence === "low")
          reasons.push(`low-confidence-${match.source}-mapping`);
        if (!origin.cc) reasons.push("missing-origin");

        if (reasons.length) stats.needsReview += 1;
        stats.kept += 1;
        stats.byCommodity[match.slug] = (stats.byCommodity[match.slug] ?? 0) + 1;

        rows.push({
          gtin,
          display_name: name || match.slug,
          brand: p.brands || label,
          chain,
          commodity_slug: match.slug,
          form: detectForm(cats, name),
          is_organic: organic,
          origin_country_code: origin.cc,
          origin_raw: origin.raw,
          mapping_source: match.source,
          mapping_confidence: match.confidence,
          needs_review: reasons.length > 0,
          review_reasons: reasons.join("; "),
          off_code: p.code,
          off_url: `https://world.openfoodfacts.org/product/${p.code}`,
        });
      }
      page += 1;
      await sleep(DELAY_MS);
    }
  }

  const headers = [
    "gtin",
    "display_name",
    "brand",
    "chain",
    "commodity_slug",
    "form",
    "is_organic",
    "origin_country_code",
    "origin_raw",
    "mapping_source",
    "mapping_confidence",
    "needs_review",
    "review_reasons",
    "off_code",
    "off_url",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ].join("\n");

  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outUrl = new URL(`./out/proposed_products_${stamp}.csv`, import.meta.url);
  writeFileSync(outUrl, csv);

  console.log("\n=== summary ===");
  console.log("fetched (all brand products):", stats.fetched);
  console.log("kept (mapped to a commodity):", stats.kept);
  console.log("needs review:", stats.needsReview);
  console.log("by commodity:", JSON.stringify(stats.byCommodity));
  console.log("wrote:", outUrl.pathname);
}

await main();
