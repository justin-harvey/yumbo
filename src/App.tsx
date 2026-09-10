import { useEffect, useRef, useState } from "react";
import { type CameraErrorKind, useCamera } from "@/scanner/useCamera";
import { useBarcodeScanner } from "@/scanner/useBarcodeScanner";
import { useProductLookup } from "@/scanner/useProductLookup";
import { useReferenceData } from "@/scanner/useReferenceData";
import ManualEntry from "@/scanner/ManualEntry";
import PluEntry from "@/scanner/PluEntry";
import ContributeSheet from "@/scanner/ContributeSheet";
import RiskHud from "@/scanner/RiskHud";
import { BarcodeIcon, CompareIcon, LeafIcon, TorchIcon } from "@/scanner/Icons";
import CompareSheet from "@/scanner/CompareSheet";
import { useCompareTray } from "@/scanner/useCompareTray";
import YumboBuddy, { type BuddyMood } from "@/scanner/YumboBuddy";

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
  const [pluOpen, setPluOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const lookup = useProductLookup(scanner.result?.text ?? null, refreshToken);
  const reference = useReferenceData(contributeOpen);
  const tray = useCompareTray();
  const [compareMode, setCompareMode] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // In compare mode a found item is appended to the tray and scanning resumes,
  // so successive scans accumulate rather than replace one another.
  useEffect(() => {
    if (!compareMode || lookup.status !== "found") return;
    if (tray.full && !tray.has(lookup.gtin14)) return; // leave result + "full" note
    tray.add(lookup.row);
    scanner.reset();
  }, [compareMode, lookup]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualSubmit = (code: string) => {
    scanner.submitManual(code);
    setKeypadOpen(false);
  };

  // The helper mascot's mood follows the app: it researches while you scan,
  // cheers a clean pick, and looks concerned at a high score.
  const found = lookup.status === "found" ? lookup.row : null;
  const worst = found
    ? Math.max(found.pesticide_score ?? 0, found.heavy_metal_score ?? 0)
    : 0;
  // Default is the happy idle head (blink/wink). Only a found result nudges the
  // mood to celebrate a clean pick or look concerned at a high score.
  const buddyMood: BuddyMood = found
    ? worst < 1.5
      ? "good"
      : worst >= 4
        ? "concern"
        : "idle"
    : "idle";

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
        <a
          href="https://github.com/justin-harvey/yumbo"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Yumbo on GitHub"
          className="mt-3 active:opacity-70"
        >
          <img
            src="/brand/wordmark.png"
            alt="Yumbo, real food, verified"
            className="h-10 drop-shadow-lg"
          />
        </a>
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
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-brand-ink">
          <img
            src="/brand/main-logo.png"
            alt="Yumbo"
            className="w-56 max-w-[70vw] animate-pulse object-contain"
          />
          <p className="text-lg text-white/70">Starting camera…</p>
        </div>
      )}

      {/* Persistent mascot helper (hidden behind full-screen sheets) */}
      {camera.status === "streaming" && <YumboBuddy mood={buddyMood} />}

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
        {/* Compare tray bar */}
        {(compareMode || tray.items.length > 0) &&
          camera.status !== "error" && (
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-black/70 p-2 backdrop-blur">
              <span className="shrink-0 px-1 text-sm font-semibold">
                Compare {tray.items.length}/3
              </span>
              <div className="flex flex-1 gap-1 overflow-x-auto">
                {tray.items.map((it) => (
                  <button
                    key={it.gtin}
                    type="button"
                    onClick={() => tray.remove(it.gtin)}
                    className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs"
                  >
                    {it.commodity_name ?? it.display_name} ✕
                  </button>
                ))}
                {tray.items.length === 0 && (
                  <span className="px-1 text-xs text-white/40">
                    scan items to add…
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={tray.items.length < 2}
                onClick={() => setCompareOpen(true)}
                className="shrink-0 rounded-full bg-brand-green px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                View
              </button>
              <button
                type="button"
                aria-label="Exit compare"
                onClick={() => {
                  tray.clear();
                  setCompareMode(false);
                }}
                className="shrink-0 rounded-full bg-white/10 px-2.5 py-1.5 text-xs"
              >
                ✕
              </button>
            </div>
          )}

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
              {compareMode &&
                lookup.status === "found" &&
                tray.full &&
                !tray.has(lookup.gtin14) && (
                  <p className="mt-2 text-sm text-amber-300">
                    Compare is full (3/3). View or clear it to add more.
                  </p>
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
              {lookup.status === "found" &&
                !tray.has(lookup.gtin14) &&
                !tray.full && (
                  <button
                    type="button"
                    onClick={() => tray.add(lookup.row)}
                    className="rounded-2xl bg-white/10 px-4 py-4 text-lg font-semibold active:opacity-70"
                  >
                    ＋ Compare
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
        ) : (
          camera.status === "streaming" &&
          !scanner.error && (
            <div className="flex items-center gap-3">
              {camera.torch.supported && (
                <button
                  type="button"
                  onClick={camera.torch.toggle}
                  aria-label="Toggle flashlight"
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full active:opacity-70 ${
                    camera.torch.on
                      ? "bg-amber-300 text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  <TorchIcon className="h-7 w-7" />
                </button>
              )}
              <div className="flex flex-1 items-center justify-center">
                <img
                  src="/brand/mascot-research.png"
                  alt="Scanning for a barcode"
                  className="h-20 w-20 object-contain drop-shadow-lg"
                />
              </div>
              <button
                type="button"
                onClick={() => setCompareMode((m) => !m)}
                aria-label="Toggle compare mode"
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full active:opacity-70 ${
                  compareMode ? "bg-brand-green text-white" : "bg-white/10 text-white"
                }`}
              >
                <CompareIcon className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={() => setPluOpen(true)}
                aria-label="Enter a PLU for loose produce"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:opacity-70"
              >
                <LeafIcon className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={() => setKeypadOpen(true)}
                aria-label="Enter a barcode"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:opacity-70"
              >
                <BarcodeIcon className="h-7 w-7" />
              </button>
            </div>
          )
        )}
      </footer>

      {compareOpen && (
        <CompareSheet
          items={tray.items}
          onRemove={tray.remove}
          onClear={() => {
            tray.clear();
            setCompareOpen(false);
          }}
          onClose={() => setCompareOpen(false)}
          onScanMore={() => {
            setCompareOpen(false);
            setCompareMode(true);
            scanner.reset();
          }}
        />
      )}

      {keypadOpen && (
        <ManualEntry
          onSubmit={handleManualSubmit}
          onClose={() => setKeypadOpen(false)}
        />
      )}

      {pluOpen && <PluEntry onClose={() => setPluOpen(false)} />}

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
