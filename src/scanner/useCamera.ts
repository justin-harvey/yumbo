import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// `torch` is a real MediaTrack capability/constraint on Chrome/Android but is
// not in the TS DOM lib yet.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraintSet = MediaTrackConstraintSet & { torch?: boolean };

export interface TorchControl {
  supported: boolean;
  on: boolean;
  toggle: () => void;
}

/**
 * The distinct failure modes a store user can hit. Each one needs its own
 * visible message: silent failure in a store is indistinguishable from a broken
 * app (CLAUDE.md, "Device reality").
 */
export type CameraErrorKind =
  | "insecure-context"
  | "unsupported"
  | "permission-denied"
  | "no-camera"
  | "in-use"
  | "unknown";

export type CameraStatus = "idle" | "starting" | "streaming" | "error";

export interface CameraState {
  status: CameraStatus;
  error: CameraErrorKind | null;
  retry: () => void;
  torch: TorchControl;
}

function classifyError(err: unknown): CameraErrorKind {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "permission-denied";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "no-camera";
      case "NotReadableError":
      case "TrackStartError":
      case "AbortError":
        return "in-use";
      default:
        return "unknown";
    }
  }
  return "unknown";
}

/**
 * Opens the rear-facing camera and streams it into `videoRef`. Manages the
 * MediaStream lifecycle and classifies failures into user-facing states.
 */
export function useCamera(videoRef: RefObject<HTMLVideoElement>): CameraState {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const toggleTorch = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    void track
      .applyConstraints({ advanced: [{ torch: next } as TorchConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => {
        // Some devices reject torch while focusing; leave the state unchanged.
      });
  }, [torchOn]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      setStatus("starting");
      setError(null);

      if (!window.isSecureContext) {
        setError("insecure-context");
        setStatus("error");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("unsupported");
        setStatus("error");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (err) {
        // OverconstrainedError: the "environment" hint could not be satisfied.
        // Retry once with a bare video request before giving up.
        if (err instanceof DOMException && err.name === "OverconstrainedError") {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: true,
            });
          } catch (fallbackErr) {
            if (!cancelled) {
              setError(classifyError(fallbackErr));
              setStatus("error");
            }
            return;
          }
        } else {
          if (!cancelled) {
            setError(classifyError(err));
            setStatus("error");
          }
          return;
        }
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // Autoplay can reject if the element is not yet interactable; the
          // stream is still attached and iOS resumes it on the first paint.
        }
      }

      // Torch is Chrome/Android only — feature-detect and hide otherwise.
      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;
      const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
      setTorchSupported(!!caps?.torch);
      setTorchOn(false);

      setStatus("streaming");
    }

    void start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
      setTorchSupported(false);
      setTorchOn(false);
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [videoRef, attempt]);

  return {
    status,
    error,
    retry,
    torch: { supported: torchSupported, on: torchOn, toggle: toggleTorch },
  };
}
