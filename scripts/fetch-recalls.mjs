// Poll the openFDA food-enforcement (recall) API for our commodities and emit:
//   data/incoming/recalls.csv     <- REVIEW this in the PR (tracked, overwritten)
//   supabase/seed/recalls.sql     <- idempotent seed, pending paste (tracked)
//
//   node scripts/fetch-recalls.mjs [--limit 500] [--since-days 540]
//
// Recalls are DISPLAY-ONLY. They land in contamination_findings and NEVER feed
// the pesticide/heavy-metal scores (invariant #4). The SQL is idempotent (a
// NOT EXISTS guard on source_url + commodity), so pasting it repeatedly only
// adds genuinely new findings. No API key needed; set OPENFDA_API_KEY to raise
// the rate limit. Network hiccups are tolerated — we write what we got.

import { mkdirSync, writeFileSync } from "node:fs";
import { COMMODITIES } from "./commodities.data.mjs";
import { RECALL_RULES, PATHOGENS } from "./recall-map.data.mjs";

const EXISTING = [
  "spinach", "kale", "carrot", "sweet_potato", "potato", "strawberry",
  "blueberry", "green_bean", "bell_pepper", "peach", "pea", "broccoli",
  "winter_squash", "banana",
];
const ALL_SLUGS = new Set([...EXISTING, ...COMMODITIES.map((c) => c.slug)]);

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const LIMIT = Number(arg("limit", "500"));
const SINCE_DAYS = Number(arg("since-days", "540"));
const KEY = process.env.OPENFDA_API_KEY ? `&api_key=${process.env.OPENFDA_API_KEY}` : "";
const BASE = "https://api.fda.gov/food/enforcement.json";
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fdaDate(s) {
  // openFDA dates are YYYYMMDD strings.
  return /^[0-9]{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
}

// Only microbial/chemical contamination recalls matter for a produce-risk app;
// this also filters out the noise (undeclared-allergen, mislabeling, foreign
// object) that merely happens to mention a produce word.
const CONTAMINATION_RE =
  /listeria|salmonella|escherichia|e\.?\s?coli|cyclospora|hepatitis|norovirus|shigella|\bpathogen|pesticide|herbicide|fungicide|chlorpyrifos|\bresidue|\blead\b|cadmium|arsenic|mercury|heavy metal/;

// If the recalled item is a processed food that merely contains produce (e.g.
// strawberry ice cream, onion bouillon), it is not a produce recall — skip it.
const PROCESSED_RE =
  /ice cream|gelato|\bcake|cookie|pastr|bouillon|\bsauce|dressing|\bsoup|\bdip\b|hummus|\bbar\b|\bcandy|chocolate|\bpizza|prepared meal|\bmeal\b|snack|\bchip|cracker|smoothie|\bjuice|beverage|\bdrink|yogurt|cheese|granola|cereal|\bpie\b|muffin|\bbread|tortilla|\bwrap|burrito|salsa|pesto|dumpling|spring roll|egg roll|entr[ée]e|sandwich|ravioli|bouill/;

function classify(text) {
  if (/pesticide|herbicide|fungicide|chlorpyrifos|residue/.test(text)) return "pesticide_residue";
  if (/lead|cadmium|arsenic|mercury|heavy metal/.test(text)) return "heavy_metal";
  // Undeclared-allergen and microbial recalls both map to the closest enum we
  // have; produce recalls are overwhelmingly microbial, so pathogen is the
  // honest default. The verbatim reason rides along in `summary`.
  return "pathogen";
}

function analyteOf(text) {
  for (const [needle, name] of PATHOGENS) if (text.includes(needle)) return name;
  return null;
}

async function fetchPage(skip, pageSize) {
  const since = new Date(Date.now() - SINCE_DAYS * 864e5)
    .toISOString().slice(0, 10).replace(/-/g, "");
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const url =
    `${BASE}?search=report_date:[${since}+TO+${today}]` +
    `&sort=report_date:desc&limit=${pageSize}&skip=${skip}${KEY}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Yumbo-Recalls/0.1" } });
      if (res.status === 404) return { results: [] }; // openFDA 404 = no matches
      if (res.status === 429 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      if (attempt === 3) { console.warn(`  fetch failed (skip ${skip}): ${e.message}`); return { results: [] }; }
      await sleep(1500 * (attempt + 1));
    }
  }
  return { results: [] };
}

async function main() {
  const pageSize = 100;
  const rows = [];
  const seen = new Set(); // recall_number + slug
  let scanned = 0;

  for (let skip = 0; skip < LIMIT; skip += pageSize) {
    const body = await fetchPage(skip, Math.min(pageSize, LIMIT - skip));
    const results = body.results ?? [];
    if (!results.length) break;
    scanned += results.length;

    for (const r of results) {
      const desc = (r.product_description ?? "").toLowerCase();
      const reason = (r.reason_for_recall ?? "").toLowerCase();
      const text = `${desc} ${reason}`;
      if (!CONTAMINATION_RE.test(reason)) continue; // not a contamination recall
      if (PROCESSED_RE.test(desc)) continue;        // processed food, not produce
      const slugs = new Set();
      for (const [re, slug] of RECALL_RULES) if (re.test(text) && ALL_SLUGS.has(slug)) slugs.add(slug);
      if (!slugs.size) continue;

      const reported_on = fdaDate(r.recall_initiation_date) ?? fdaDate(r.report_date);
      if (!reported_on) continue;
      const kind = classify(text);
      const analyte = kind === "pathogen" ? analyteOf(text) : null;
      const num = r.recall_number ?? "";
      const source_url = num
        ? `https://api.fda.gov/food/enforcement.json?search=recall_number:%22${encodeURIComponent(num)}%22`
        : "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts";
      const summary = `[${r.classification ?? "Recall"}] ${(r.reason_for_recall ?? "").trim()}`
        .replace(/\s+/g, " ").slice(0, 500);

      for (const slug of slugs) {
        const dedup = `${num}|${slug}`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);
        rows.push({
          recall_number: num, reported_on, classification: r.classification ?? "",
          commodity_slug: slug, kind, analyte: analyte ?? "",
          recalling_firm: r.recalling_firm ?? "", source_url, summary,
        });
      }
    }
    await sleep(400);
  }

  // 1. reviewable CSV
  const cols = ["recall_number", "reported_on", "classification", "commodity_slug",
    "kind", "analyte", "recalling_firm", "summary", "source_url"];
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
  mkdirSync(new URL("../data/incoming/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../data/incoming/recalls.csv", import.meta.url), csv + "\n");

  // 2. idempotent seed
  const sql = [
    "-- FDA food-recall findings (display-only; never feeds scoring — invariant #4).",
    "-- Auto-generated by scripts/fetch-recalls.mjs from the openFDA API.",
    "-- Idempotent: re-paste anytime; the NOT EXISTS guard skips existing rows.",
    "-- Paste AFTER the schema/commodity migrations.",
    "",
  ];
  for (const r of rows) {
    sql.push(
      "insert into contamination_findings (kind, analyte, commodity_id, reported_on, source_name, source_url, summary)",
      `select ${q(r.kind)}, ${r.analyte ? q(r.analyte) : "null"}, c.id, ${q(r.reported_on)}, 'FDA', ${q(r.source_url)}, ${q(r.summary)}`,
      `from commodities c where c.slug = ${q(r.commodity_slug)}`,
      "and not exists (select 1 from contamination_findings f",
      `  where f.source_url = ${q(r.source_url)} and f.commodity_id = c.id);`,
      "",
    );
  }
  mkdirSync(new URL("../supabase/seed/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../supabase/seed/recalls.sql", import.meta.url), sql.join("\n"));

  const byCommodity = {};
  for (const r of rows) byCommodity[r.commodity_slug] = (byCommodity[r.commodity_slug] ?? 0) + 1;
  console.log(`scanned recalls:  ${scanned}`);
  console.log(`produce findings: ${rows.length}`);
  console.log(`by commodity:     ${JSON.stringify(byCommodity)}`);
  console.log("wrote: data/incoming/recalls.csv + supabase/seed/recalls.sql");
}

await main();
