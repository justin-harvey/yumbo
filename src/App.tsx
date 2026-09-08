import { useRef, useState } from "react";
import { type CameraErrorKind, useCamera } from "@/scanner/useCamera";
import { useBarcodeScanner } from "@/scanner/useBarcodeScanner";
import { useProductLookup } from "@/scanner/useProductLookup";
import ManualEntry from "@/scanner/ManualEntry";

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
  const lookup = useProductLookup(scanner.result?.text ?? null);
  const [keypadOpen, setKeypadOpen] = useState(false);

  const handleManualSubmit = (code: string) => {
    scanner.submitManual(code);
    setKeypadOpen(false);
  };

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
        {camera.status === "streaming" && !scanner.result && !scanner.error && (
          <span className="mt-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white/70">
            {scanner.searching ? "Searching…" : "Ready"}
          </span>
        )}
      </header>

      {/* Aiming reticle */}
      {camera.status === "streaming" && !scanner.result && !scanner.error && (
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

      {/* Decoder-wedged error (recoverable) */}
      {scanner.error && camera.status === "streaming" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-[#0b0f0a]/95 px-8 text-center">
          <h1 className="text-2xl font-bold text-amber-300">Scanner stalled</h1>
          <p className="max-w-sm text-base leading-relaxed text-white/80">
            The barcode decoder stopped responding. Reset it, or enter the code
            by hand.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={scanner.reset}
              className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-semibold text-black active:bg-emerald-400"
            >
              Reset scanner
            </button>
            <button
              type="button"
              onClick={() => setKeypadOpen(true)}
              className="rounded-2xl bg-white/10 px-6 py-4 text-lg font-semibold active:opacity-70"
            >
              Enter code
            </button>
          </div>
        </div>
      )}

      {/* Camera error screen */}
      {camera.status === "error" && camera.error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-[#0b0f0a] px-8 text-center">
          <h1 className="text-2xl font-bold text-red-300">
            {ERROR_COPY[camera.error].title}
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-white/80">
            {ERROR_COPY[camera.error].body}
          </p>
          <div className="flex gap-3">
            {ERROR_COPY[camera.error].canRetry && (
              <button
                type="button"
                onClick={camera.retry}
                className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-semibold text-black active:bg-emerald-400"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={() => setKeypadOpen(true)}
              className="rounded-2xl bg-white/10 px-6 py-4 text-lg font-semibold active:opacity-70"
            >
              Enter code
            </button>
          </div>
        </div>
      )}

      {/* Bottom HUD */}
      <footer className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {scanner.result ? (
          <div className="max-h-[70vh] overflow-y-auto rounded-3xl bg-black/70 p-5 backdrop-blur">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-black">
                {scanner.result.format}
              </span>
              {"gtin14" in lookup && (
                <span className="font-mono text-xs text-white/50">
                  {lookup.gtin14}
                </span>
              )}
            </div>
            <p className="break-all font-mono text-3xl font-bold leading-tight">
              {scanner.result.text}
            </p>

            {/* M3: raw product_risk result rendered as JSON. The designed HUD
                (two separate score bars, never combined) is M6. */}
            <div className="mt-3">
              {lookup.status === "loading" && (
                <p className="animate-pulse text-base text-white/70">
                  Looking up…
                </p>
              )}
              {lookup.status === "invalid" && (
                <p className="text-base text-red-300">
                  Not a valid barcode ({lookup.reason})
                </p>
              )}
              {lookup.status === "not-found" && (
                <p className="text-base text-amber-300">
                  Not in database{" "}
                  <span className="text-white/40">({lookup.gtin14})</span>
                </p>
              )}
              {lookup.status === "error" && (
                <p className="text-base text-red-300">
                  Lookup failed: {lookup.message}
                </p>
              )}
              {lookup.status === "found" && (
                <div>
                  <p className="text-lg font-semibold text-emerald-300">
                    {lookup.row.display_name}
                  </p>
                  <p className="text-sm text-white/60">
                    {lookup.row.commodity_name}
                    {lookup.row.is_organic ? " · organic" : ""}
                    {lookup.row.origin_unknown
                      ? " · origin unknown"
                      : lookup.row.origin_name
                        ? ` · ${lookup.row.origin_name}`
                        : ""}
                  </p>
                  {/* Two scores, deliberately separate — never merged. */}
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-white/5 p-2">
                      <div className="text-white/50">Pesticide</div>
                      <div className="text-2xl font-bold">
                        {lookup.row.pesticide_score ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2">
                      <div className="text-white/50">Heavy metal</div>
                      <div className="text-2xl font-bold">
                        {lookup.row.heavy_metal_score ?? "—"}
                      </div>
                    </div>
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-black/50 p-3 text-xs text-white/70">
                    {JSON.stringify(lookup.row, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={scanner.reset}
                className="flex-1 rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-semibold text-black active:bg-emerald-400"
              >
                Scan again
              </button>
              <button
                type="button"
                onClick={() => setKeypadOpen(true)}
                className="rounded-2xl bg-white/10 px-6 py-4 text-lg font-semibold active:opacity-70"
              >
                Enter code
              </button>
            </div>
          </div>
        ) : (
          camera.status === "streaming" &&
          !scanner.error && (
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-3xl bg-black/50 p-4 text-center">
                <p className="text-base text-white/70">
                  Point at a barcode to scan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKeypadOpen(true)}
                className="rounded-3xl bg-white/10 px-5 py-4 text-base font-semibold active:opacity-70"
              >
                Enter code
              </button>
            </div>
          )
        )}
      </footer>

      {keypadOpen && (
        <ManualEntry
          onSubmit={handleManualSubmit}
          onClose={() => setKeypadOpen(false)}
        />
      )}
    </div>
  );
}
