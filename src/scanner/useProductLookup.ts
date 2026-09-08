import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { InvalidGtinError, normaliseToGtin14 } from "@/lib/gtin";
import type { ProductRisk } from "@/lib/database.types";

export type LookupState =
  | { status: "idle" }
  | { status: "invalid"; reason: string }
  | { status: "loading"; gtin14: string }
  | { status: "found"; gtin14: string; row: ProductRisk }
  | { status: "not-found"; gtin14: string }
  | { status: "error"; gtin14: string; message: string };

/**
 * Normalises a raw scanned/entered code to GTIN-14 and looks it up in the
 * `product_risk` view. M3 queries the network directly; the offline mirror is
 * M4, so a lookup here needs connectivity.
 */
export function useProductLookup(text: string | null): LookupState {
  const [state, setState] = useState<LookupState>({ status: "idle" });

  useEffect(() => {
    if (text === null) {
      setState({ status: "idle" });
      return;
    }

    let gtin14: string;
    try {
      gtin14 = normaliseToGtin14(text);
    } catch (err) {
      setState({
        status: "invalid",
        reason:
          err instanceof InvalidGtinError
            ? err.reason.replace(/-/g, " ")
            : "unreadable",
      });
      return;
    }

    let cancelled = false;
    setState({ status: "loading", gtin14 });

    void (async () => {
      const { data, error } = await supabase
        .from("product_risk")
        .select("*")
        .eq("gtin", gtin14)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setState({ status: "error", gtin14, message: error.message });
      } else if (!data) {
        setState({ status: "not-found", gtin14 });
      } else {
        setState({ status: "found", gtin14, row: data });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [text]);

  return state;
}
