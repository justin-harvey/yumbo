// Commodity keyword map for FDA/USDA recall free-text (openFDA food/enforcement).
//
// Recall descriptions are prose ("Ready to Eat salad containing iceberg lettuce,
// red cabbage and/or carrots"), so unlike the PLU map this returns ALL matched
// commodities and uses strict word boundaries. Prose-ambiguous homographs
// (date, fig, lime, corn, pea) are deliberately OMITTED — a false "recall on
// Dates" from the phrase "expiration date" is worse than missing a rare hit.
// Recalls are DISPLAY-ONLY and never feed scoring (invariant #4); the generated
// output is reviewed in a PR before it ever reaches the database, so this map
// favours precision over recall.

// [regex, slug] — regex tested against the lowercased product description + reason.
export const RECALL_RULES = [
  [/\bromaine\b/, "romaine"],
  [/\biceberg\b/, "lettuce"],
  [/\blettuce\b/, "lettuce"],
  [/\bspring mix\b/, "lettuce"],
  [/\bspinach\b/, "spinach"],
  [/\bkale\b/, "kale"],
  [/\bcollard(s| greens)?\b/, "collard_greens"],
  [/\bcucumbers?\b/, "cucumber"],
  [/\bcantaloupes?\b/, "cantaloupe"],
  [/\bmuskmelons?\b/, "cantaloupe"],
  [/\bhoneydew\b/, "honeydew"],
  [/\bwatermelons?\b/, "watermelon"],
  [/\bonions?\b/, "onion"],
  [/\bscallions?\b/, "scallion"],
  [/\bgreen onions?\b/, "scallion"],
  [/\btomatoes\b/, "tomato"],
  [/\bbell peppers?\b/, "bell_pepper"],
  [/\bjalapenos?\b/, "bell_pepper"],
  [/\bserranos?\b/, "bell_pepper"],
  [/\bmushrooms?\b/, "mushroom"],
  [/\bcarrots?\b/, "carrot"],
  [/\bcelery\b/, "celery"],
  [/\bpeach(es)?\b/, "peach"],
  [/\bnectarines?\b/, "nectarine"],
  [/\bplums?\b/, "plum"],
  [/\bapricots?\b/, "apricot"],
  [/\bapples?\b/, "apple"],
  [/\bpears?\b/, "pear"],
  [/\bgrapes\b/, "grape"],
  [/\bstrawberr/, "strawberry"],
  [/\bblueberr/, "blueberry"],
  [/\braspberr/, "raspberry"],
  [/\bblackberr/, "blackberry"],
  [/\bcranberr/, "cranberry"],
  [/\bmangoe?s?\b/, "mango"],
  [/\bpapayas?\b/, "papaya"],
  [/\bpineapples?\b/, "pineapple"],
  [/\bavocados?\b/, "avocado"],
  [/\bmandarins?\b/, "mandarin"],
  [/\btangerines?\b/, "mandarin"],
  [/\bclementines?\b/, "mandarin"],
  [/\bgrapefruits?\b/, "grapefruit"],
  [/\bbroccoli\b/, "broccoli"],
  [/\bcauliflower\b/, "cauliflower"],
  [/\bcabbage\b/, "cabbage"],
  [/\bsweet potato(es)?\b/, "sweet_potato"],
  [/\bpotatoes\b/, "potato"],
  [/\bgreen beans?\b/, "green_bean"],
];

// Pathogen names worth capturing into `analyte` when present.
export const PATHOGENS = [
  ["listeria", "Listeria monocytogenes"],
  ["salmonella", "Salmonella"],
  ["escherichia coli", "E. coli"],
  ["e. coli", "E. coli"],
  ["e.coli", "E. coli"],
  ["cyclospora", "Cyclospora"],
  ["hepatitis a", "Hepatitis A"],
  ["norovirus", "Norovirus"],
  ["shigella", "Shigella"],
];
