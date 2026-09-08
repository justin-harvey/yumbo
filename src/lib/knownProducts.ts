/**
 * Temporary local product catalog for testing the scan -> normalise -> match
 * flow before the real Supabase `product_risk` lookup lands (M2/M3). Keyed by
 * GTIN-14. This will be deleted once the network/offline lookup exists — do not
 * build scoring on it.
 */

export interface KnownProduct {
  displayName: string;
  note?: string;
}

export const KNOWN_PRODUCTS: Record<string, KnownProduct> = {
  // Justin's test code (organic bananas). Scanned UPC-A 074904100012 normalises
  // to this GTIN-14.
  "00074904100012": { displayName: "Organic Bananas", note: "test fixture" },
};

export function lookupKnownProduct(gtin14: string): KnownProduct | null {
  return KNOWN_PRODUCTS[gtin14] ?? null;
}
