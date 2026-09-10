// Short, factual produce tips the mascot shares. Keep them true and on-brand
// (real food, verified) — no scare tactics, no unearned precision.
export const TIPS: string[] = [
  "Two scores, never one. Organic cuts pesticides, it does nothing for heavy metals.",
  "Heavy metals come from soil, so washing won't remove them. Variety helps.",
  "Spinach is a top cadmium accumulator. Great food, just rotate your greens.",
  "Strawberries top the pesticide charts most years. Organic makes a real dent.",
  "Bananas: thick peel, low residue. Snack away.",
  "Frozen produce is picked ripe and flash-frozen, nutrition holds up well.",
  "Scrubbing and peeling root veg cuts surface pesticide residue.",
  "Unknown origin? I lower the confidence and tell you, no silent guesses.",
  "A 5-digit PLU starting with 9 means organic.",
  "Imported samples drive most high-pesticide findings, origin matters.",
  "Green beans have a history of banned-pesticide detections. Organic is worth it.",
  "Rinse produce under plain running water. It lifts dirt and some residue, skip the soap.",
  "Root veg like carrots and beets can draw lead and cadmium up from the soil.",
  "A 4-digit PLU means conventionally grown, 5 digits starting with 9 means organic.",
  "Grapes, cherries, and peaches often rank high for pesticides. Organic is worth it here.",
  "Avocado, pineapple, and sweet corn test near the bottom for pesticide residue.",
  "Rice and leafy greens are common sources of dietary cadmium, so mix up your plate.",
  "Variety beats worry. Rotating what you eat limits any single contaminant.",
  "Tap me for a fresh tip anytime!",
];

export function tipAt(i: number): string {
  return TIPS[((i % TIPS.length) + TIPS.length) % TIPS.length];
}
