import { useRef } from "react";
import { type CameraErrorKind, useCamera } from "@/scanner/useCamera";
import { useBarcodeScanner } from "@/scanner/useBarcodeScanner";

interface ErrorCopy {
  title: string;
  body: string;
  canRetry: boolean;
}

const ERROR_COPY: Record<CameraErrorKind, ErrorCopy> = {
  "insecure-context": {
    title: "Needs HTTPS",
    body: "The camera only works over a secure (https://) connection. Open the deployed link, not a plain http address.",
    canRetry: false,
  },
  unsupported: {
    title: "Camera not supported",
    body: "This browser does not expose camera access. Try Safari on iOS or Chrome on Android.",
    canRetry: false,
  },
  "permission-denied": {
    title: "Camera blocked",
    body: "Permission was denied. Enable camera access for this site in your browser settings, then try again.",
    canRetry: true,
  },
  "no-camera": {
    title: "No camera found",
    body: "No usable camera was detected on this device.",
    canRetry: true,
  },
  "in-use": {
    title: "Camera busy",
    body: "Another app is using the camera. Close it (or other camera tabs), then try again.",
    canRetry: true,
  },
  unknown: {
    title: "Camera error",
    body: "Something went wrong starting the camera. Try again.",
    canRetry: true,
  },
};

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera(videoRef);
  const scanner = useBarcodeScanner(videoRef, camera.status === "streaming");

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {/* Camera feed. Always mounted so the ref is available before play(). */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <span className="mt-3 rounded-full bg-black/50 px-3 py-1 text-sm font-semibold tracking-wide">
          Yumbo
        </span>
        {camera.status === "streaming" && (
          <span className="mt-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white/70">
            {scanner.searching ? "Searching…" : "Ready"}
          </span>
        )}
      </header>

      {/* Aiming reticle */}
      {camera.status === "streaming" && !scanner.result && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-32 w-4/5 max-w-sm rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      )}

      {/* Starting spinner */}
      {camera.status === "starting" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
          <p className="animate-pulse text-lg text-white/80">
            Starting camera…
          </p>
        </div>
      )}

      {/* Error screen */}
      {camera.status === "error" && camera.error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-[#0b0f0a] px-8 text-center">
          <h1 className="text-2xl font-bold text-red-300">
            {ERROR_COPY[camera.error].title}
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-white/80">
            {ERROR_COPY[camera.error].body}
          </p>
          {ERROR_COPY[camera.error].canRetry && (
            <button
              type="button"
              onClick={camera.retry}
              className="rounded-2xl bg-emerald-500 px-8 py-4 text-lg font-semibold text-black active:bg-emerald-400"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Result HUD (raw decode only — scoring is a later milestone) */}
      <footer className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {scanner.result ? (
          <div className="rounded-3xl bg-black/70 p-5 backdrop-blur">
            <div className="mb-2 inline-block rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-black">
              {scanner.result.format}
            </div>
            <p className="break-all font-mono text-4xl font-bold leading-tight">
              {scanner.result.text}
            </p>
          </div>
        ) : (
          camera.status === "streaming" && (
            <div className="rounded-3xl bg-black/50 p-4 text-center">
              <p className="text-base text-white/70">
                Point at a barcode to scan
              </p>
            </div>
          )
        )}
      </footer>
    </div>
  );
}
