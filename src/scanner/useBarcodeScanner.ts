import { type RefObject, useEffect, useRef, useState } from "react";
import { type DecodedBarcode, decodeFrame } from "@/scanner/decoder";

/** Longest edge, in px, the frame is downscaled to before decoding. */
const MAX_DECODE_EDGE = 640;
/** Minimum gap between decode attempts, to bound CPU and battery drain. */
const DECODE_INTERVAL_MS = 350;

export interface ScannerState {
  /** Most recent successful decode, or null if nothing found yet. */
  result: DecodedBarcode | null;
  /** True while the loop is actively pulling and decoding frames. */
  searching: boolean;
}

/**
 * Continuously grabs frames from `videoRef`, downscales them, and decodes with
 * zxing-wasm. Overlapping decodes are suppressed with a busy flag so a slow
 * decode never queues up behind itself.
 */
export function useBarcodeScanner(
  videoRef: RefObject<HTMLVideoElement>,
  enabled: boolean,
): ScannerState {
  const [result, setResult] = useState<DecodedBarcode | null>(null);
  const [searching, setSearching] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSearching(false);
      return;
    }

    let rafId = 0;
    let stopped = false;
    let busy = false;
    let lastRun = 0;

    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    setSearching(true);

    const tick = async (now: number) => {
      if (stopped) return;
      rafId = requestAnimationFrame(tick);

      const video = videoRef.current;
      if (
        !ctx ||
        !video ||
        video.readyState < video.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        busy ||
        now - lastRun < DECODE_INTERVAL_MS
      ) {
        return;
      }
      lastRun = now;
      busy = true;

      try {
        const scale = Math.min(
          1,
          MAX_DECODE_EDGE / Math.max(video.videoWidth, video.videoHeight),
        );
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;

        ctx.drawImage(video, 0, 0, w, h);
        const image = ctx.getImageData(0, 0, w, h);
        const found = await decodeFrame(image);
        if (!stopped && found) setResult(found);
      } catch {
        // A single dropped frame is not worth surfacing; the loop retries.
      } finally {
        busy = false;
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      setSearching(false);
    };
  }, [videoRef, enabled]);

  return { result, searching };
}
