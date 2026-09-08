// Open Food Facts lookup — enrichment for an unknown barcode. Free, no key,
// CORS-enabled. This is the same data source M9 will bulk-import.

export interface OffProduct {
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  categories: string[];
  quantity: string | null;
}

interface OffResponse {
  status: number; // 1 = found, 0 = not found
  product?: {
    product_name?: string;
    brands?: string;
    image_front_small_url?: string;
    categories_tags?: string[];
    quantity?: string;
  };
}

/**
 * Look up a barcode on Open Food Facts. Returns null when the product is not in
 * OFF (or the request fails) — the contributor can still fill it in by hand.
 * `barcode` is the raw scanned/entered code; OFF keys by the printed number.
 */
export async function fetchOpenFoodFacts(
  barcode: string,
): Promise<OffProduct | null> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json` +
    `?fields=product_name,brands,image_front_small_url,categories_tags,quantity`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as OffResponse;
    if (body.status !== 1 || !body.product) return null;

    const p = body.product;
    return {
      name: p.product_name?.trim() || null,
      brand: p.brands?.split(",")[0]?.trim() || null,
      imageUrl: p.image_front_small_url || null,
      categories: (p.categories_tags ?? []).map((t) => t.replace(/^en:/, "")),
      quantity: p.quantity?.trim() || null,
    };
  } catch {
    return null;
  }
}
