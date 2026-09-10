// Map the bundled IFPS PLU list to our commodity slugs (HANDOFF §9, part 2).
//
//   node scripts/ingest-plu.mjs
//
// Reads   scripts/data/ifps_plu.csv   (public-domain IFPS list, 4-digit codes)
// Writes  scripts/out/proposed_plu.csv        <- REVIEW this (code, name, slug)
//         scripts/out/unmatched_plu.csv        <- names with no commodity (audit)
//
// "Retailer Assigned" ranges (3000-3199 etc.) are skipped. Codes only map to
// commodities we actually have tiers for; everything else is reported as
// unmatched rather than force-fit. Organic (9-prefixed) twins are NOT emitted
// here — the SQL step derives them, matching how the init migration seeds banana.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { COMMODITIES } from "./commodities.data.mjs";
import { RULES, IGNORE } from "./plu-map.data.mjs";

const EXISTING = [
  "spinach", "kale", "carrot", "sweet_potato", "potato", "strawberry",
  "blueberry", "green_bean", "bell_pepper", "peach", "pea", "broccoli",
  "winter_squash", "banana",
];
const ALL_SLUGS = new Set([...EXISTING, ...COMMODITIES.map((c) => c.slug)]);

function parseCsv(text) {
  const rows = [];
  for (const line of text.trim().split("\n")) {
    const cells = [];
    let cur = "", q = false;
    for (const c of line) {
      if (c === '"') q = !q;
      else if (c === "," && !q) { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Tidy the IFPS label for display in the PLU entry UI.
function cleanName(raw) {
  return raw
    .replace(/\s*\(capsicums?\)/i, "")
    .replace(/\s*\(aubergine\)/i, "")
    .replace(/(berries|berry)\s+berries$/i, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function classify(name) {
  const hay = name.toLowerCase();
  for (const [sub, slug] of RULES) {
    if (hay.includes(sub)) return slug;
  }
  return null;
}

function main() {
  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  const rows = parseCsv(readFileSync(new URL("./data/ifps_plu.csv", import.meta.url), "utf8"));

  const matched = [];
  const unmatched = [];
  let retailer = 0, ignored = 0, badSlug = 0;
  const perCommodity = new Map();

  for (const r of rows) {
    const code = r["PLU Code"];
    const raw = r["Name"];
    if (!/^[0-9]{4}$/.test(code)) continue;
    if (/retailer assigned|for use with all/i.test(raw)) { retailer++; continue; }

    const slug = classify(raw);
    if (slug === IGNORE) { ignored++; unmatched.push([code, raw, "exotic/ignored"]); continue; }
    if (!slug) { unmatched.push([code, raw, "no rule"]); continue; }
    if (!ALL_SLUGS.has(slug)) { badSlug++; unmatched.push([code, raw, `unknown slug ${slug}`]); continue; }

    matched.push({ code, display_name: cleanName(raw), slug });
    perCommodity.set(slug, (perCommodity.get(slug) ?? 0) + 1);
  }

  // proposed_plu.csv
  const head = ["code", "display_name", "commodity_slug"];
  const csv = [head.join(",")];
  for (const m of matched) csv.push([m.code, m.display_name, m.slug].map(csvCell).join(","));
  writeFileSync(new URL("./out/proposed_plu.csv", import.meta.url), csv.join("\n") + "\n");

  // unmatched_plu.csv
  const ucsv = ["code,name,reason"];
  for (const u of unmatched) ucsv.push(u.map(csvCell).join(","));
  writeFileSync(new URL("./out/unmatched_plu.csv", import.meta.url), ucsv.join("\n") + "\n");

  const real = matched.length + unmatched.length - ignored;
  console.log(`retailer-assigned skipped: ${retailer}`);
  console.log(`matched:   ${matched.length}`);
  console.log(`unmatched: ${unmatched.length} (of which ${ignored} known exotics)`);
  console.log(`coverage:  ${((matched.length / real) * 100).toFixed(1)}% of mappable PLUs`);
  if (badSlug) console.log(`WARNING: ${badSlug} rows hit a slug not in the commodity set`);
  console.log(`\nper-commodity (top 25):`);
  [...perCommodity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    .forEach(([s, n]) => console.log(`  ${String(n).padStart(4)}  ${s}`));
}

main();
