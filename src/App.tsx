import { useRef, useState } from "react";
import { type CameraErrorKind, useCamera } from "@/scanner/useCamera";
import { useBarcodeScanner } from "@/scanner/useBarcodeScanner";
import { useProductLookup } from "@/scanner/useProductLookup";
import { useReferenceData } from "@/scanner/useReferenceData";
import ManualEntry from "@/scanner/ManualEntry";
import ContributeSheet from "@/scanner/ContributeSheet";
import RiskHud from "@/scanner/RiskHud";

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
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const lookup = useProductLookup(scanner.result?.text ?? null, refreshToken);
  const reference = useReferenceData(contributeOpen);

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
        <img
          src="/brand/wordmark.png"
          alt="Yumbo — real food, verified"
          className="mt-3 h-10 drop-shadow-lg"
        />
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
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-brand-ink/80">
          <img
            src="/brand/head-content.png"
            alt=""
            className="h-24 w-24 animate-bounce object-contain"
          />
          <p className="text-lg text-white/80">Starting camera…</p>
        </div>
      )}

      {/* Decoder-wedged error (recoverable) */}
      {scanner.error && camera.status === "streaming" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-brand-ink/95 px-8 text-center">
          <img
            src="/brand/head-confused.png"
            alt=""
            className="h-24 w-24 object-contain"
          />
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
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-brand-ink px-8 text-center">
          <img
            src="/brand/head-confused.png"
            alt=""
            className="h-24 w-24 object-contain"
          />
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
            {lookup.status !== "found" && (
              <p className="break-all font-mono text-3xl font-bold leading-tight">
                {scanner.result.text}
              </p>
            )}

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
                <div className="flex items-center gap-3">
                  <img
                    src="/brand/head-confused.png"
                    alt=""
                    className="h-16 w-16 shrink-0 object-contain"
                  />
                  <div>
                    <p className="text-base text-amber-300">
                      Not in our catalog yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setContributeOpen(true)}
                      className="mt-2 rounded-2xl bg-brand-green px-5 py-3 text-base font-semibold text-white active:opacity-90"
                    >
                      Search &amp; add it
                    </button>
                  </div>
                </div>
              )}
              {lookup.status === "error" && (
                <p className="text-base text-red-300">
                  Lookup failed: {lookup.message}
                </p>
              )}
              {lookup.status === "found" && <RiskHud row={lookup.row} />}
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
              {camera.torch.supported && (
                <button
                  type="button"
                  onClick={camera.torch.toggle}
                  aria-label="Toggle flashlight"
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl active:opacity-70 ${
                    camera.torch.on
                      ? "bg-amber-300 text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  🔦
                </button>
              )}
              <div className="flex flex-1 items-center justify-center gap-3 rounded-3xl bg-black/50 p-4 text-center">
                <img
                  src="/brand/head-happy.png"
                  alt=""
                  className="h-10 w-10 object-contain"
                />
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

      {contributeOpen && "gtin14" in lookup && (
        <ContributeSheet
          gtin14={lookup.gtin14}
          rawText={scanner.result?.text ?? ""}
          commodities={reference.commodities}
          origins={reference.origins}
          referenceLoading={reference.loading}
          onClose={() => setContributeOpen(false)}
          onSubmitted={() => {
            setContributeOpen(false);
            setRefreshToken((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
