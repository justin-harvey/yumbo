import { useCallback, useEffect, useState } from "react";
import type { CatalogRisk } from "@/lib/database.types";

const KEY = "yumbo.compare.v1";
const MAX = 3;

export interface CompareTray {
  items: CatalogRisk[];
  full: boolean;
  add: (row: CatalogRisk) => void;
  remove: (gtin: string | null) => void;
  clear: () => void;
  has: (gtin: string | null) => boolean;
}

function load(): CatalogRisk[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/**
 * Up to three scanned items held for side-by-side comparison. Deduped by GTIN
 * and persisted to localStorage so the tray survives a reload.
 */
export function useCompareTray(): CompareTray {
  const [items, setItems] = useState<CatalogRisk[]>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((row: CatalogRisk) => {
    setItems((prev) => {
      if (prev.length >= MAX || prev.some((p) => p.gtin === row.gtin)) {
        return prev;
      }
      return [...prev, row];
    });
  }, []);

  const remove = useCallback((gtin: string | null) => {
    setItems((prev) => prev.filter((p) => p.gtin !== gtin));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback(
    (gtin: string | null) => items.some((p) => p.gtin === gtin),
    [items],
  );

  return { items, full: items.length >= MAX, add, remove, clear, has };
}
