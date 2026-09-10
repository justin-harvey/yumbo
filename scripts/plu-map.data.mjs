// Ordered IFPS-name -> commodity-slug rules for the PLU ingest.
//
// Matching is first-hit-wins on a lowercased substring of the FULL produce name,
// so ORDER MATTERS. Specific rules come before general ones so that, e.g.:
//   - "Banana (Yellow Long) Peppers"  -> bell_pepper, not banana
//   - "Acorn Squash"                  -> winter_squash, not sweet_corn
//   - "Turnip Greens"                 -> collard_greens, not turnip
//   - "Pearl Onions"                  -> onion, not pear
//   - "Potato/Yam/Kumara"             -> sweet_potato, not potato
//   - "Mangosteen"                    -> (ignored), not mango
//
// slug === IGNORE means "known exotic / no commodity we score" — recorded as
// unmatched rather than force-fit. Anything with no rule at all is also
// unmatched. Unmatched PLUs are reported, never silently dropped.

export const IGNORE = Symbol("ignore");

// [substring, slug]
export const RULES = [
  // --- compound names that would false-match if left to the general rules.
  //     These MUST stay at the top so the specific reading wins. ---
  ["mangosteen", IGNORE],          // not mango
  ["passion", IGNORE],             // passion fruit, not banana ("Banana Passion fruit")
  ["prickly pear", IGNORE],        // cactus fruit, not pear
  ["cactus pear", IGNORE],
  ["lemongrass", IGNORE],          // herb, not lemon
  ["apple banana", "banana"],      // a banana cultivar, not apple
  ["lemon cucumber", "cucumber"],  // a cucumber, not lemon

  // --- pome (before citrus so "Cox Orange Pippin Apples" is an apple; pineapple
  //     before apple because "pineapple" contains "apple") ---
  ["pineapple", "pineapple"],
  ["quince", "apple"],
  ["apple", "apple"],

  // --- leafy "greens" phrases (before their root/veg homographs) ---
  ["collard", "collard_greens"],
  ["mustard green", "collard_greens"],
  ["turnip greens", "collard_greens"],
  ["beet greens", "collard_greens"],
  ["dandelion", "collard_greens"],
  ["polk greens", "collard_greens"],
  ["chard", "collard_greens"],
  ["silverbeet", "collard_greens"],

  // --- alliums (scallion/spring/green onion before generic onion) ---
  ["scallion", "scallion"],
  ["spring onion", "scallion"],
  ["green onion", "scallion"],
  ["green (scallions)", "scallion"],
  ["shallot", "onion"],
  ["onion", "onion"],
  ["leek", "leek"],
  ["garlic", "garlic"],

  // --- peppers (all capsicum/chili variants; before banana for banana peppers) ---
  ["pepper", "bell_pepper"],
  ["capsicum", "bell_pepper"],
  ["chili", "bell_pepper"],
  ["chilli", "bell_pepper"],
  ["jalapeno", "bell_pepper"],
  ["habanero", "bell_pepper"],
  ["pimiento", "bell_pepper"],

  // --- squash: summer variants, winter variants, then generic (before corn/banana) ---
  ["zucchini", "summer_squash"],
  ["courgette", "summer_squash"],
  ["scallopini", "summer_squash"],
  ["patty pan", "summer_squash"],
  ["pattypan", "summer_squash"],
  ["crookneck", "summer_squash"],
  ["sunburst", "summer_squash"],
  ["cucuzza", "summer_squash"],
  ["marrow", "summer_squash"],
  ["chayote", "summer_squash"],
  ["choko", "summer_squash"],
  ["opo squash", "summer_squash"],
  ["yellow squash", "summer_squash"],
  ["white squash", "summer_squash"],
  ["baby summer", "summer_squash"],
  ["acorn", "winter_squash"],
  ["butternut", "winter_squash"],
  ["buttercup", "winter_squash"],
  ["hubbard", "winter_squash"],
  ["kabocha", "winter_squash"],
  ["delicata", "winter_squash"],
  ["dumpling squash", "winter_squash"],
  ["gem squash", "winter_squash"],
  ["golden nugget", "winter_squash"],
  ["turban", "winter_squash"],
  ["spaghetti", "winter_squash"],
  ["calabaza", "winter_squash"],
  ["red kuri", "winter_squash"],
  ["banana squash", "winter_squash"],
  ["crown prince", "winter_squash"],
  ["carnival squash", "winter_squash"],
  ["australian blue", "winter_squash"],
  ["golden delicious squash", "winter_squash"],
  ["sweet mama", "winter_squash"],
  ["squash", "winter_squash"],
  ["pumpkin", "pumpkin"],
  ["gourd", "winter_squash"],

  // --- brussels before generic sprouts/cabbage ---
  ["brussels", "brussels_sprouts"],

  // --- brassica / asian greens ---
  ["kohlrabi", "cabbage"],
  ["bok choy", "cabbage"],
  ["pak choi", "cabbage"],
  ["choy sum", "cabbage"],
  ["choi sum", "cabbage"],
  ["gai lan", "cabbage"],
  ["gai choy", "cabbage"],
  ["napa", "cabbage"],
  ["nappa", "cabbage"],
  ["chinese cabbage", "cabbage"],
  [" choi", "cabbage"],
  [" choy", "cabbage"],
  ["cabbage", "cabbage"],
  ["cauliflower", "cauliflower"],
  ["broccoli", "broccoli"],

  // --- melons: watermelon/honeydew/cantaloupe before generic melon ---
  ["watermelon", "watermelon"],
  ["honeydew", "honeydew"],
  ["cantaloupe", "cantaloupe"],
  ["rockmelon", "cantaloupe"],
  ["muskmelon", "cantaloupe"],
  ["melon", "melon"],

  // --- citrus (grapefruit before grape; tangerine family before orange) ---
  ["grapefruit", "grapefruit"],
  ["tangelo", "mandarin"],
  ["tangerine", "mandarin"],
  ["mandarin", "mandarin"],
  ["clementine", "mandarin"],
  ["satsuma", "mandarin"],
  ["kumquat", "mandarin"],
  ["calamondin", "mandarin"],
  ["limequat", "lime"],
  ["lemon", "lemon"],
  ["lime", "lime"],
  ["orange", "orange"],

  // --- berries (specific before any generic) ---
  ["strawberr", "strawberry"],
  ["blueberr", "blueberry"],
  ["bilberr", "blueberry"],
  ["saskatoon", "blueberry"],
  ["gooseberr", "blueberry"],
  ["raspberr", "raspberry"],
  ["blackberr", "blackberry"],
  ["boysenberr", "blackberry"],
  ["loganberr", "blackberry"],
  ["marionberr", "blackberry"],
  ["dewberr", "blackberry"],
  ["cranberr", "cranberry"],
  ["currant", "blueberry"],   // fresh Ribes currants (dried "raisins" handled below)
  ["berries", "blueberry"],
  ["berry", "blueberry"],

  // --- vine (grapefruit is matched earlier in the citrus block) ---
  ["raisin", "grape"],
  ["sultana", "grape"],
  ["grape", "grape"],

  // --- stone fruit (nectarine distinct; prunes = dried plum) ---
  ["nectarine", "nectarine"],
  ["apricot", "apricot"],
  ["cherry", "cherry"],
  ["cherries", "cherry"],
  ["peach", "peach"],
  ["prune", "plum"],
  ["plum", "plum"],

  // --- tropical ---
  ["avocado", "avocado"],
  ["mango", "mango"],
  ["papaya", "papaya"],
  ["pawpaw", "papaya"],
  ["kiwi", "kiwi"],
  ["pomegranate", "pomegranate"],
  ["fig", "fig"],
  ["date", "date"],
  ["plantain", "banana"],
  ["banana", "banana"],

  // --- roots (turnip/beet greens already handled above) ---
  ["horseradish", "radish"],
  ["daikon", "radish"],
  ["radish", "radish"],
  ["swede", "turnip"],
  ["rutabaga", "turnip"],
  ["turnip", "turnip"],
  ["beetroot", "beet"],
  ["beet", "beet"],
  ["parsnip", "carrot"],
  ["carrot", "carrot"],
  ["ginger", "ginger"],
  ["boniato", "sweet_potato"],
  ["yam", "sweet_potato"],
  ["kumara", "sweet_potato"],
  ["sweet potato", "sweet_potato"],
  ["potato", "potato"],

  // --- salad & stalk ---
  ["radicchio", "radicchio"],
  ["romaine", "romaine"],
  ["cos lettuce", "romaine"],
  ["lettuce", "lettuce"],
  ["arugula", "lettuce"],
  ["rocket", "lettuce"],
  ["endive", "lettuce"],
  ["escarole", "lettuce"],
  ["frisee", "lettuce"],
  ["chicory", "lettuce"],
  ["watercress", "lettuce"],
  ["mesclun", "lettuce"],
  ["mizuna", "lettuce"],
  ["sorrel", "lettuce"],
  ["spinach", "spinach"],
  ["kale", "kale"],
  ["celeriac", "celery"],
  ["celery root", "celery"],
  ["celery", "celery"],
  ["fennel", "celery"],
  ["rhubarb", "celery"],
  ["asparagus", "asparagus"],
  ["artichoke", "artichoke"],
  ["mushroom", "mushroom"],
  ["cucumber", "cucumber"],
  ["tomato", "tomato"],
  ["eggplant", "eggplant"],
  ["aubergine", "eggplant"],
  ["okra", IGNORE],

  // --- corn (after squash so "acorn" never lands here) ---
  ["corn", "sweet_corn"],

  // --- legumes / pulses (green beans etc; chickpea -> pea) ---
  ["bean sprout", IGNORE],
  ["mung bean", IGNORE],
  ["chickpea", "pea"],
  ["garbanzo", "pea"],
  ["edamame", "pea"],
  ["soybean", "pea"],
  ["snow pea", "pea"],
  ["snap pea", "pea"],
  ["sugar snap", "pea"],
  ["peas", "pea"],
  ["green bean", "green_bean"],
  ["snap bean", "green_bean"],
  ["string bean", "green_bean"],
  ["wax bean", "green_bean"],
  ["runner bean", "green_bean"],
  ["broad bean", "green_bean"],
  ["fava", "green_bean"],
  ["lima", "green_bean"],
  ["long bean", "green_bean"],
  ["bean", "green_bean"],
  ["peanut", "peanut"],

  // --- late single-word fruit whose substrings would clash if placed earlier ---
  ["pear", "pear"],
];
