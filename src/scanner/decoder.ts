import {
  prepareZXingModule,
  readBarcodes,
  type ReaderOptions,
} from "zxing-wasm/reader";
// Bundle the decoder wasm with the app instead of fetching it from a CDN, so
// the first scan does not depend on a round trip over flaky store connectivity.
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) =>
      path.endsWith(".wasm") ? wasmUrl : prefix + path,
  },
});

// Grocery packaging carries retail linear symbologies only. Restricting the
// format set makes each decode cheaper and cuts false positives.
const READER_OPTIONS: ReaderOptions = {
  formats: ["EAN-13", "EAN-8", "UPC-A", "UPC-E"],
  tryHarder: true,
  maxNumberOfSymbols: 1,
};

export interface DecodedBarcode {
  /** Raw decoded digits, exactly as read. Normalisation happens later (M3). */
  text: string;
  /** Detected symbology, e.g. "UPC-A" or "EAN-13". */
  format: string;
}

/**
 * Decode a single frame. Returns the first valid barcode found, or null when
 * the frame contains no readable code.
 */
export async function decodeFrame(
  image: ImageData,
): Promise<DecodedBarcode | null> {
  const results = await readBarcodes(image, READER_OPTIONS);
  for (const r of results) {
    if (r.isValid && r.text) {
      return { text: r.text, format: r.format };
    }
  }
  return null;
}
