import type { CatalogRisk } from "@/lib/database.types";
import { severity } from "@/lib/severity";

interface CompareSheetProps {
  items: CatalogRisk[];
  onRemove: (gtin: string | null) => void;
  onClear: () => void;
  onClose: () => void;
  onScanMore: () => void;
}

type ScoreKey = "pesticide_score" | "heavy_metal_score";

function values(items: CatalogRisk[], key: ScoreKey): (number | null)[] {
  return items.map((i) => i[key]);
}

function minNonNull(vals: (number | null)[]): number | null {
  const present = vals.filter((v): v is number => v != null);
  return present.length ? Math.min(...present) : null;
}

function allEqual(vals: (number | null)[]): boolean {
  const present = vals.filter((v): v is number => v != null);
  return present.length > 0 && present.every((v) => v === present[0]);
}

// The single lowest-risk item for a score, or null if it's a tie / no data.
function soleBest(items: CatalogRisk[], key: ScoreKey): CatalogRisk | null {
  const min = minNonNull(values(items, key));
  if (min == null) return null;
  const winners = items.filter((i) => i[key] === min);
  return winners.length === 1 ? winners[0] : null;
}

function shortName(row: CatalogRisk): string {
  return row.display_name ?? "Item";
}

function ScoreRow({
  label,
  items,
  scoreKey,
}: {
  label: string;
  items: CatalogRisk[];
  scoreKey: ScoreKey;
}) {
  const vals = values(items, scoreKey);
  const min = minNonNull(vals);
  const differentiated = items.length > 1 && !allEqual(vals);

  return (
    <>
      <div className="flex items-center py-2 text-sm font-semibold text-white/80">
        {label}
      </div>
      {items.map((row, idx) => {
        const score = vals[idx];
        const sev = severity(score);
        const isBest = differentiated && score != null && score === min;
        const pct = score == null ? 0 : Math.max(6, (score / 5) * 100);
        return (
          <div
            key={row.gtin ?? idx}
            className={`rounded-xl p-2 ${isBest ? "bg-emerald-500/15 ring-1 ring-emerald-400/50" : ""}`}
          >
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold" style={{ color: sev.color }}>
                {score == null ? "—" : score.toFixed(1)}
              </span>
              {isBest && <span title="Lowest risk">🏆</span>}
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: sev.color }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Side-by-side comparison of up to three items, scores aligned by row. */
export default function CompareSheet({
  items,
  onRemove,
  onClear,
  onClose,
  onScanMore,
}: CompareSheetProps) {
  if (items.length === 0) {
    return (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-brand-ink px-8 text-center">
        <p className="text-white/70">Nothing to compare yet.</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl bg-brand-green px-6 py-3 font-semibold text-white"
        >
          Close
        </button>
      </div>
    );
  }

  const pBest = soleBest(items, "pesticide_score");
  const hBest = soleBest(items, "heavy_metal_score");

  let summary: string;
  if (items.length < 2) {
    summary = "Scan or add another item to compare.";
  } else if (pBest && hBest && pBest.gtin === hBest.gtin) {
    summary = `${shortName(pBest)} is the lower-risk pick on both scores.`;
  } else {
    const p = pBest ? `${shortName(pBest)} is lowest in pesticide` : "pesticide is a tie";
    const h = hBest ? `${shortName(hBest)} is lowest in heavy metal` : "heavy metal is a tie";
    summary = `No single winner — ${p}; ${h}.`;
  }

  // Grid: a label column + one column per item.
  const gridTemplateColumns = `minmax(72px, 0.7fr) repeat(${items.length}, 1fr)`;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-brand-ink">
      <header className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <h2 className="text-lg font-semibold">Compare ({items.length}/3)</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-4 py-2 text-sm"
        >
          Close
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="grid gap-2" style={{ gridTemplateColumns }}>
          {/* Header row: spacer + item identity */}
          <div />
          {items.map((row, idx) => (
            <div key={row.gtin ?? idx} className="text-center">
              <img
                src={row.verified ? "/brand/mascot-full.png" : "/brand/head-content.png"}
                alt=""
                className="mx-auto h-12 w-12 object-contain"
              />
              <p className="truncate text-xs font-semibold" title={shortName(row)}>
                {shortName(row)}
              </p>
              <p className="truncate text-[10px] text-white/40">
                {row.commodity_name}
              </p>
              <button
                type="button"
                onClick={() => onRemove(row.gtin)}
                className="mt-1 text-xs text-white/40 underline"
              >
                remove
              </button>
            </div>
          ))}

          <ScoreRow label="Pesticide" items={items} scoreKey="pesticide_score" />
          <ScoreRow label="Heavy metal" items={items} scoreKey="heavy_metal_score" />
        </div>

        <div className="mt-4 rounded-2xl bg-white/5 p-4 text-center text-sm text-white/80">
          {summary}
        </div>
        <p className="mt-2 text-center text-xs text-white/40">
          🏆 marks the lower-risk item for each score. The two are judged
          independently — a pick can win one and lose the other.
        </p>
      </div>

      <footer className="flex gap-3 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <button
          type="button"
          onClick={onClear}
          className="rounded-2xl bg-white/10 px-6 py-4 text-base font-semibold active:opacity-70"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onScanMore}
          className="flex-1 rounded-2xl bg-brand-green px-6 py-4 text-lg font-semibold text-white active:opacity-90"
        >
          Scan more
        </button>
      </footer>
    </div>
  );
}
