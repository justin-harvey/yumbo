import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CatalogRisk, PluRisk } from "@/lib/database.types";
import RiskHud from "@/scanner/RiskHud";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];

// Present a PLU result through the same designed HUD as a barcode scan. Loose
// produce has no packaged origin, so origin is unknown and scoring is neutral.
function toCatalog(r: PluRisk): CatalogRisk {
  return {
    source: "plu",
    verified: true,
    submission_id: null,
    product_id: null,
    gtin: null,
    display_name: r.display_name,
    brand_name: null,
    commodity_name: r.commodity_name,
    category: r.category,
    form: "fresh",
    is_organic: r.is_organic,
    origin_name: null,
    origin_confidence: "inferred",
    pesticide_score: r.pesticide_score,
    heavy_metal_score: r.heavy_metal_score,
    origin_unknown: true,
    created_at: null,
  };
}

type Status = "input" | "loading" | "found" | "not-found";

export default function PluEntry({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("input");
  const [row, setRow] = useState<CatalogRisk | null>(null);

  // A 5-digit code beginning with 9 is organic — derived, never asked.
  const looksOrganic = code.length === 5 && code[0] === "9";

  const reset = () => {
    setCode("");
    setRow(null);
    setStatus("input");
  };

  const press = async (key: string) => {
    if (key === "⌫") {
      setCode((c) => c.slice(0, -1));
      return;
    }
    if (key === "OK") {
      if (!/^[0-9]{4,5}$/.test(code)) return;
      setStatus("loading");
      const { data } = await supabase
        .from("plu_risk")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (data) {
        setRow(toCatalog(data));
        setStatus("found");
      } else {
        setStatus("not-found");
      }
      return;
    }
    if (code.length < 5) setCode((c) => c + key);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/80 backdrop-blur">
      <div className="max-h-[92vh] overflow-y-auto rounded-t-3xl bg-[#12180f] p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <img
              src="/brand/mascot-standing.png"
              alt=""
              className="h-8 w-8 object-contain"
            />
            Loose produce (PLU)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-4 py-2 text-sm"
          >
            Close
          </button>
        </div>

        {status === "found" && row ? (
          <div>
            <div className="rounded-3xl bg-black/40 p-4">
              <RiskHud row={row} />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-2xl bg-brand-green px-6 py-4 text-lg font-semibold text-white active:opacity-90"
              >
                Enter another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl bg-white/10 px-6 py-4 text-lg font-semibold active:opacity-70"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-1 flex min-h-[3.5rem] items-center justify-between rounded-2xl bg-black/50 px-4 py-3">
              <span className="font-mono text-3xl font-bold tracking-widest">
                {code || <span className="text-white/30">4-5 digits</span>}
              </span>
              {looksOrganic && (
                <span className="rounded-full bg-brand-green/40 px-2 py-1 text-xs font-semibold text-emerald-200">
                  🌱 organic
                </span>
              )}
            </div>
            <p className="mb-3 h-5 text-sm text-amber-300">
              {status === "not-found"
                ? `PLU ${code} isn't in the catalog yet.`
                : status === "loading"
                  ? "Looking up…"
                  : ""}
            </p>

            <div className="grid grid-cols-3 gap-3">
              {KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => press(key)}
                  className={`rounded-2xl py-4 text-2xl font-semibold active:opacity-70 ${
                    key === "OK"
                      ? "bg-brand-green text-white"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-white/40">
              Try 4011 (banana) or 94011 (organic banana).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
