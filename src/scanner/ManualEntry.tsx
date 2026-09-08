import { useState } from "react";
import { InvalidGtinError, normaliseToGtin14 } from "@/lib/gtin";

interface ManualEntryProps {
  onSubmit: (code: string) => void;
  onClose: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];

function reasonMessage(err: InvalidGtinError): string {
  switch (err.reason) {
    case "non-numeric":
      return "Digits only.";
    case "bad-length":
      return "A UPC/EAN is 8, 12, 13, or 14 digits.";
    case "bad-check-digit":
      return "That code's check digit doesn't add up — re-check it.";
  }
}

/**
 * Numeric keypad for entering a barcode by hand. The reliable recovery path
 * when the camera can't focus, and the way to drive a test code like the
 * organic-banana UPC without good lighting.
 */
export default function ManualEntry({ onSubmit, onClose }: ManualEntryProps) {
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const press = (key: string) => {
    setProblem(null);
    if (key === "⌫") {
      setCode((c) => c.slice(0, -1));
      return;
    }
    if (key === "OK") {
      try {
        normaliseToGtin14(code);
        onSubmit(code);
      } catch (err) {
        setProblem(
          err instanceof InvalidGtinError
            ? reasonMessage(err)
            : "Invalid code.",
        );
      }
      return;
    }
    if (code.length < 14) setCode((c) => c + key);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/80 backdrop-blur">
      <div className="rounded-t-3xl bg-[#12180f] p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <img
              src="/brand/head-content.png"
              alt=""
              className="h-8 w-8 object-contain"
            />
            Enter a barcode
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>

        <div className="mb-1 min-h-[3.5rem] rounded-2xl bg-black/50 px-4 py-3 font-mono text-3xl font-bold tracking-wider">
          {code || <span className="text-white/30">000000000000</span>}
        </div>
        <p className="mb-3 h-5 text-sm text-red-300">{problem ?? ""}</p>

        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className={`rounded-2xl py-4 text-2xl font-semibold active:opacity-70 ${
                key === "OK"
                  ? "bg-emerald-500 text-black"
                  : "bg-white/10 text-white"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
