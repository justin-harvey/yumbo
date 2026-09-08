import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface CommodityOption {
  id: string;
  display_name: string;
  category: string;
}

export interface OriginOption {
  id: string;
  display_name: string;
  country_code: string;
}

export interface ReferenceData {
  commodities: CommodityOption[];
  origins: OriginOption[];
  loading: boolean;
}

/**
 * Loads the small reference lists used to map a submission to our taxonomy.
 * Fetched lazily (when the contribute flow first needs them).
 */
export function useReferenceData(enabled: boolean): ReferenceData {
  const [commodities, setCommodities] = useState<CommodityOption[]>([]);
  const [origins, setOrigins] = useState<OriginOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || (commodities.length > 0 && origins.length > 0)) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const [c, o] = await Promise.all([
        supabase
          .from("commodities")
          .select("id, display_name, category")
          .order("display_name"),
        supabase
          .from("origins")
          .select("id, display_name, country_code")
          .order("display_name"),
      ]);
      if (cancelled) return;
      if (c.data) setCommodities(c.data);
      if (o.data) setOrigins(o.data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, commodities.length, origins.length]);

  return { commodities, origins, loading };
}
