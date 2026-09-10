// Single source of truth for the commodity expansion (HANDOFF §9).
//
// Every tier is SOURCED, not guessed (this is a health app):
//   - pesticide_tier follows the EWG 2024 Shopper's Guide. Dirty Dozen items
//     score 4-5, Clean Fifteen items score 1-2, everything else sits at 2-3 by
//     residue history. https://www.ewg.org/foodnews/
//   - heavy_metal_tier follows soil-uptake evidence: leafy greens and root
//     crops (cadmium/lead) trend high, most fruit is low. Sources: FDA Total
//     Diet Study, Consumer Reports heavy-metal testing, HBBF baby-food metals.
//   - organic_pesticide_mitigation is ~0.85 for thin-skinned high-residue crops
//     (berries, greens, stone fruit) and ~0.70 for thick-peel / low-residue
//     crops. Organic NEVER touches heavy_metal_tier (invariant #3).
//
// Only NEW commodities are listed here; the 14 seeded in the init migration are
// left untouched (the generated migration is ON CONFLICT DO NOTHING, so even a
// re-list would not clobber a curated row). When evidence is weak the value is
// the conservative-but-honest one, noted inline.

const EWG = {
  name: "EWG 2024 Shopper's Guide to Pesticides in Produce",
  url: "https://www.ewg.org/foodnews/",
};
const FDA = {
  name: "FDA Total Diet Study",
  url: "https://www.fda.gov/food/total-diet-study",
};
const CR = {
  name: "Consumer Reports heavy-metals testing",
  url: "https://www.consumerreports.org/",
};
const HBBF = {
  name: "Healthy Babies Bright Futures — heavy metals in food",
  url: "https://www.healthybabyfood.org/",
};

// [slug, display_name, category, heavy_metal_tier, pesticide_tier, mitigation, notes]
const ROWS = [
  // --- Citrus (thick peel, low residue reaches flesh; low metals) ---
  ["orange",       "Orange",        "citrus", 1, 2, 0.75, null],
  ["mandarin",     "Mandarin",      "citrus", 1, 3, 0.75, "Covers tangerines/mandarins/clementines; some residue history."],
  ["grapefruit",   "Grapefruit",    "citrus", 1, 2, 0.75, null],
  ["lemon",        "Lemon",         "citrus", 1, 1, 0.70, null],
  ["lime",         "Lime",          "citrus", 1, 1, 0.70, null],

  // --- Pome & vine (EWG Dirty Dozen 2024) ---
  ["apple",        "Apple",         "pome",   1, 5, 0.80, "EWG 2024 Dirty Dozen #8."],
  ["pear",         "Pear",          "pome",   1, 5, 0.85, "EWG 2024 Dirty Dozen #6."],
  ["grape",        "Grape",         "vine",   1, 5, 0.85, "EWG 2024 Dirty Dozen #4."],

  // --- Stone fruit (thin skin; organic mitigates well) ---
  ["plum",         "Plum",          "stone_fruit", 2, 3, 0.80, "Includes prunes (dried plum)."],
  ["apricot",      "Apricot",       "stone_fruit", 2, 3, 0.80, null],
  ["nectarine",    "Nectarine",     "stone_fruit", 2, 5, 0.85, "EWG 2024 Dirty Dozen #7."],
  ["cherry",       "Cherry",        "stone_fruit", 2, 4, 0.85, "EWG 2024 Dirty Dozen #10."],

  // --- Berries (thin skin, high residue; strong organic benefit) ---
  ["raspberry",    "Raspberry",     "berry",  2, 4, 0.85, null],
  ["blackberry",   "Blackberry",    "berry",  2, 4, 0.85, null],
  ["cranberry",    "Cranberry",     "berry",  2, 3, 0.80, null],

  // --- Tropical (mostly Clean Fifteen; thick skins) ---
  ["mango",        "Mango",         "tropical", 1, 1, 0.70, "EWG 2024 Clean Fifteen."],
  ["pineapple",    "Pineapple",     "tropical", 1, 1, 0.70, "EWG 2024 Clean Fifteen #3."],
  ["avocado",      "Avocado",       "tropical", 1, 1, 0.70, "EWG 2024 Clean Fifteen #1."],
  ["papaya",       "Papaya",        "tropical", 1, 1, 0.70, "EWG 2024 Clean Fifteen #5."],
  ["kiwi",         "Kiwifruit",     "tropical", 1, 1, 0.70, "EWG 2024 Clean Fifteen."],
  ["pomegranate",  "Pomegranate",   "tropical", 1, 2, 0.75, null],
  ["fig",          "Fig",           "tropical", 1, 2, 0.75, null],
  ["date",         "Date",          "tropical", 1, 1, 0.70, null],

  // --- Melons ---
  ["watermelon",   "Watermelon",    "melon",  1, 1, 0.70, "EWG 2024 Clean Fifteen."],
  ["cantaloupe",   "Cantaloupe",    "melon",  1, 2, 0.70, null],
  ["honeydew",     "Honeydew melon","melon",  1, 1, 0.70, "EWG 2024 Clean Fifteen."],
  ["melon",        "Melon",         "melon",  1, 2, 0.70, "Generic/specialty melons not otherwise classified."],

  // --- Fruiting vegetables ---
  ["tomato",       "Tomato",        "fruiting", 2, 3, 0.80, null],
  ["cucumber",     "Cucumber",      "fruiting", 2, 3, 0.80, null],
  ["eggplant",     "Eggplant",      "fruiting", 2, 2, 0.75, "Also labelled aubergine."],
  ["summer_squash","Summer squash", "gourd",    2, 3, 0.80, "Zucchini/courgette and yellow squash."],
  ["pumpkin",      "Pumpkin",       "gourd",    2, 2, 0.70, null],

  // --- Leafy (soil cadmium/lead uptake; EWG greens are Dirty Dozen) ---
  ["lettuce",      "Lettuce",       "leafy_green", 2, 4, 0.80, null],
  ["romaine",      "Romaine",       "leafy_green", 2, 4, 0.80, null],
  ["collard_greens","Collard greens","leafy_green", 3, 5, 0.80, "EWG 2024 Dirty Dozen #3 (kale/collard/mustard greens)."],
  ["radicchio",    "Radicchio",     "leafy_green", 2, 3, 0.80, null],

  // --- Brassica (mostly low residue) ---
  ["cauliflower",  "Cauliflower",   "brassica", 2, 1, 0.70, null],
  ["cabbage",      "Cabbage",       "brassica", 2, 1, 0.70, "EWG 2024 Clean Fifteen."],
  ["brussels_sprouts","Brussels sprouts","brassica", 2, 2, 0.70, null],

  // --- Allium (onions/garlic Clean Fifteen; green onions higher) ---
  ["onion",        "Onion",         "allium", 1, 1, 0.70, "EWG 2024 Clean Fifteen #4."],
  ["garlic",       "Garlic",        "allium", 1, 1, 0.70, null],
  ["leek",         "Leek",          "allium", 2, 2, 0.75, null],
  ["scallion",     "Green onion",   "allium", 2, 3, 0.80, "Scallions/spring onions have a residue history."],

  // --- Root (cadmium/lead uptake from soil) ---
  ["beet",         "Beet",          "root",   3, 2, 0.70, "Root crop; cadmium/lead uptake."],
  ["turnip",       "Turnip",        "root",   3, 2, 0.70, "Root crop; cadmium/lead uptake."],
  ["radish",       "Radish",        "root",   3, 2, 0.70, "Root crop; cadmium/lead uptake."],
  ["ginger",       "Ginger",        "root",   3, 2, 0.75, "Rhizome; documented lead/cadmium in some imports."],

  // --- Other vegetables ---
  ["sweet_corn",   "Sweet corn",    "grain",  1, 1, 0.70, "EWG 2024 Clean Fifteen #2."],
  ["mushroom",     "Mushroom",      "fungi",  2, 1, 0.70, "EWG 2024 Clean Fifteen; can accumulate some metals."],
  ["asparagus",    "Asparagus",     "stalk",  2, 1, 0.70, "EWG 2024 Clean Fifteen #6."],
  ["artichoke",    "Artichoke",     "stalk",  2, 2, 0.70, null],
  ["celery",       "Celery",        "stalk",  2, 4, 0.80, "Historically high-residue; organic worthwhile."],

  // --- Legume / nut ---
  ["peanut",       "Peanut",        "legume", 2, 2, 0.70, "Ground-grown; some cadmium uptake."],
];

export const COMMODITIES = ROWS.map(
  ([slug, display_name, category, heavy_metal_tier, pesticide_tier, mitigation, notes]) => {
    const sources = [EWG];
    if (heavy_metal_tier >= 3) sources.push(FDA, CR, HBBF);
    else if (heavy_metal_tier >= 2) sources.push(FDA);
    return {
      slug,
      display_name,
      category,
      heavy_metal_tier,
      pesticide_tier,
      organic_pesticide_mitigation: mitigation,
      notes,
      sources,
    };
  },
);
