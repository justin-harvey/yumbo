import type { CatalogRisk } from "@/lib/database.types";
import { severity } from "@/lib/severity";

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  const sev = severity(score);
  // Keep a sliver visible even at 0 so the bar never looks broken.
  const pct = score == null ? 0 : Math.max(4, (score / 5) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-base font-semibold">{label}</span>
        <span className="font-bold" style={{ color: sev.color }}>
          {score == null ? "—" : score.toFixed(1)}
          <span className="ml-1 text-xs font-normal text-white/40">
            /5 · {sev.label}
          </span>
        </span>
      </div>
      <div className="mt-1.5 h-3.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, backgroundColor: sev.color }}
        />
      </div>
    </div>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "leaf" | "warn";
}) {
  const cls =
    tone === "leaf"
      ? "bg-brand-green/30 text-emerald-200"
      : tone === "warn"
        ? "bg-amber-500/25 text-amber-200"
        : "bg-white/10 text-white/70";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

/**
 * The designed scan result: product identity, then two independent risk scores
 * as separate bars — never combined (invariant #2). Inferred and unknown origin
 * are surfaced, not hidden (invariants #6, #7).
 */
export default function RiskHud({ row }: { row: CatalogRisk }) {
  const verified = row.verified === true;

  // Mascot reacts to the worse of the two scores: thumbs-up when it's a clean
  // pick, worried when it's high, neutral otherwise.
  const worst = Math.max(row.pesticide_score ?? 0, row.heavy_metal_score ?? 0);
  const mascot =
    worst < 1.5
      ? "/brand/mascot-thumbs-up.png"
      : worst >= 4
        ? "/brand/head-confused.png"
        : verified
          ? "/brand/mascot-full.png"
          : "/brand/head-content.png";

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {verified ? (
            <span className="mb-1 inline-block rounded-full bg-brand-green px-2 py-0.5 text-xs font-bold text-white">
              ✓ Verified
            </span>
          ) : (
            <span className="mb-1 inline-block rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-bold text-black">
              Community · unverified
            </span>
          )}
          <p className="truncate text-2xl font-bold leading-tight">
            {row.display_name}
          </p>
          {row.brand_name && (
            <p className="truncate text-sm text-white/50">{row.brand_name}</p>
          )}
        </div>
        <img
          src={mascot}
          alt=""
          className="animate-yumbo-found h-24 w-24 shrink-0 object-contain drop-shadow-xl"
        />
      </div>

      {/* Identity chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {row.commodity_name && <Chip tone="leaf">{row.commodity_name}</Chip>}
        {row.form && <Chip>{row.form}</Chip>}
        {row.is_organic && <Chip tone="leaf">🌱 organic</Chip>}
        {row.origin_unknown ? (
          <Chip tone="warn">origin unknown</Chip>
        ) : (
          row.origin_name && (
            <Chip tone={row.origin_confidence === "documented" ? "neutral" : "warn"}>
              {row.origin_name}
              {row.origin_confidence !== "documented" &&
                ` · ${row.origin_confidence}`}
            </Chip>
          )
        )}
      </div>

      {row.origin_unknown && (
        <p className="mt-2 text-xs text-white/40">
          Origin unknown, scored with a neutral origin, so confidence is lower.
        </p>
      )}

      {/* Two independent scores, never merged into one number. */}
      <div className="mt-4 space-y-3">
        <ScoreBar label="Pesticide" score={row.pesticide_score} />
        <ScoreBar label="Heavy metal" score={row.heavy_metal_score} />
      </div>
      <p className="mt-2 text-xs text-white/40">
        Two separate scores. Buying organic lowers pesticide risk only, never
        heavy metals.
      </p>
    </div>
  );
}
