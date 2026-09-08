import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureAnonymousSession } from "@/lib/auth";
import { fetchOpenFoodFacts, type OffProduct } from "@/lib/off";
import type {
  CommodityOption,
  OriginOption,
} from "@/scanner/useReferenceData";

interface ContributeSheetProps {
  gtin14: string;
  rawText: string;
  commodities: CommodityOption[];
  origins: OriginOption[];
  referenceLoading: boolean;
  onSubmitted: () => void;
  onClose: () => void;
}

/**
 * Community contribution flow for an unknown barcode: enrich from Open Food
 * Facts, map to one of our commodities, and submit as an unverified entry that
 * shows to everyone immediately.
 */
export default function ContributeSheet({
  gtin14,
  rawText,
  commodities,
  origins,
  referenceLoading,
  onSubmitted,
  onClose,
}: ContributeSheetProps) {
  const [off, setOff] = useState<OffProduct | null>(null);
  const [searching, setSearching] = useState(true);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [isOrganic, setIsOrganic] = useState(false);
  const [originId, setOriginId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enrich from Open Food Facts on open.
  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    void (async () => {
      const result = await fetchOpenFoodFacts(rawText);
      if (cancelled) return;
      setOff(result);
      if (result?.name) setName(result.name);
      if (result?.brand) setBrand(result.brand);
      setSearching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawText]);

  const canSubmit = name.trim().length > 0 && commodityId !== "" && !submitting;

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await ensureAnonymousSession();
      const { error: insertError } = await supabase
        .from("product_submissions")
        .insert({
          gtin: gtin14,
          display_name: name.trim(),
          commodity_id: commodityId,
          brand_name: brand.trim() || null,
          is_organic: isOrganic,
          origin_id: originId || null,
          off_data: off ? JSON.parse(JSON.stringify(off)) : null,
        });
      if (insertError) throw new Error(insertError.message);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/80 backdrop-blur">
      <div className="max-h-[90vh] overflow-y-auto rounded-t-3xl bg-[#12180f] p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add to catalog</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>

        <p className="mb-3 font-mono text-xs text-white/40">{gtin14}</p>

        {searching ? (
          <p className="animate-pulse py-4 text-white/70">
            Searching Open Food Facts…
          </p>
        ) : off ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            {off.imageUrl && (
              <img
                src={off.imageUrl}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            )}
            <div className="text-sm text-white/70">
              <div className="font-semibold text-white/90">
                Found on Open Food Facts
              </div>
              {off.categories.length > 0 && (
                <div className="text-white/50">
                  {off.categories.slice(-2).join(", ")}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-white/50">
            Not on Open Food Facts — fill it in by hand.
          </p>
        )}

        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-white/60">Product name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Organic Baby Spinach"
            className="w-full rounded-xl bg-black/50 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-white/60">
            Brand (optional)
          </span>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full rounded-xl bg-black/50 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-white/60">
            What is it? (drives the score)
          </span>
          <select
            value={commodityId}
            onChange={(e) => setCommodityId(e.target.value)}
            className="w-full rounded-xl bg-black/50 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">
              {referenceLoading ? "Loading…" : "Select a commodity"}
            </option>
            {commodities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name} ({c.category})
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 flex items-center gap-3">
          <input
            type="checkbox"
            checked={isOrganic}
            onChange={(e) => setIsOrganic(e.target.checked)}
            className="h-5 w-5 accent-emerald-500"
          />
          <span className="text-base">Certified organic</span>
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-white/60">
            Country of origin (optional)
          </span>
          <select
            value={originId}
            onChange={(e) => setOriginId(e.target.value)}
            className="w-full rounded-xl bg-black/50 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Unknown</option>
            {origins.map((o) => (
              <option key={o.id} value={o.id}>
                {o.display_name}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="w-full rounded-2xl bg-emerald-500 py-4 text-lg font-semibold text-black active:bg-emerald-400 disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Submit for everyone"}
        </button>
        <p className="mt-2 text-center text-xs text-white/40">
          Shared instantly, flagged unverified until a curator confirms it.
        </p>
      </div>
    </div>
  );
}
