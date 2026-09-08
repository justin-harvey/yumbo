import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { type DecodedBarcode, decodeFrame } from "@/scanner/decoder";

/** Longest edge, in px, the frame is downscaled to before decoding. */
const MAX_DECODE_EDGE = 640;
/** Minimum gap between decode attempts, to bound CPU and battery drain. */
const DECODE_INTERVAL_MS = 350;
/** A single decode may not exceed this before it is abandoned as hung. */
const DECODE_TIMEOUT_MS = 4000;
/** Consecutive hung decodes before we declare the decoder broken. */
const MAX_TIMEOUT_STREAK = 6;

export type ScannerError = "decoder-failed";

export interface ScannerState {
  /** Most recent decode (from camera or manual entry), or null. */
  result: DecodedBarcode | null;
  /** True while the loop is actively decoding frames. */
  searching: boolean;
  /** Set when the decoder wedges (e.g. wasm fails to load on this device). */
  error: ScannerError | null;
  /** Clear the current result/error and resume scanning. */
  reset: () => void;
  /** Inject a code as if it had been scanned (manual keypad entry). */
  submitManual: (text: string, format?: string) => void;
}

/** Reject if `promise` has not settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("decode-timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

/**
 * Continuously grabs frames from `videoRef`, downscales them, and decodes with
 * zxing-wasm. Pauses on a successful decode so the result is stable and the
 * radio/CPU idle until the user asks to scan again — this is what makes a stuck
 * scan recoverable.
 */
export function useBarcodeScanner(
  videoRef: RefObject<HTMLVideoElement>,
  enabled: boolean,
): ScannerState {
  const [result, setResult] = useState<DecodedBarcode | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<ScannerError | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Read inside the raf loop without re-subscribing the effect on every change.
  const pausedRef = useRef(false);
  pausedRef.current = result !== null || error !== null;

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const submitManual = useCallback((text: string, format = "MANUAL") => {
    setResult({ text, format });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSearching(false);
      return;
    }

    let rafId = 0;
    let stopped = false;
    let busy = false;
    let lastRun = 0;
    let timeoutStreak = 0;

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
        pausedRef.current ||
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
        const found = await withTimeout(decodeFrame(image), DECODE_TIMEOUT_MS);
        timeoutStreak = 0;
        if (!stopped && found) {
          if (navigator.vibrate) navigator.vibrate(30);
          setResult(found);
        }
      } catch (err) {
        // A hung decode (wasm stalled) must not silently wedge the loop. Count
        // consecutive timeouts and, past a threshold, surface a recoverable
        // error instead of appearing frozen forever.
        if (err instanceof Error && err.message === "decode-timeout") {
          timeoutStreak += 1;
          if (timeoutStreak >= MAX_TIMEOUT_STREAK && !stopped) {
            setError("decoder-failed");
          }
        }
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

  return { result, searching, error, reset, submitManual };
}
