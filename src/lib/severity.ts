export interface Severity {
  label: string;
  color: string;
}

// Scores are 0–5 (higher = worse). Bands are deliberately coarse: a store
// glance needs "is this bad?", not false precision. Shared by the HUD and the
// compare view so a score always reads the same way.
export function severity(score: number | null): Severity {
  if (score == null) return { label: "no data", color: "#9ca3af" };
  if (score < 1.5) return { label: "Low", color: "#22c55e" };
  if (score < 3) return { label: "Moderate", color: "#eab308" };
  if (score < 4) return { label: "High", color: "#f97316" };
  return { label: "Very high", color: "#ef4444" };
}
