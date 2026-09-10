import { useEffect, useRef, useState } from "react";
import { tipAt, TIPS } from "@/lib/tips";

export type BuddyMood = "idle" | "searching" | "good" | "concern";

const HEAD = {
  happy: "/brand/head-happy.png",
  blink: "/brand/head-blink.png",
  wink: "/brand/head-wink.png",
  content: "/brand/head-content.png",
  heart: "/brand/head-heart-eyes.png",
  confused: "/brand/head-confused.png",
};

type IdleFrame = "happy" | "blink" | "wink";

/**
 * A persistent little Yumbo helper. Blinks and winks on its own, shows
 * heart-eyes when you tap it, and shares rotating produce tips. Its base
 * expression follows the app's mood so it feels like it's reacting with you.
 */
export default function YumboBuddy({ mood }: { mood: BuddyMood }) {
  const [idleFrame, setIdleFrame] = useState<IdleFrame>("happy");
  const [reacting, setReacting] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [bubbleOpen, setBubbleOpen] = useState(true);
  const reactTimer = useRef<number | undefined>(undefined);

  // Preload the head frames so blinks don't flash on first play.
  useEffect(() => {
    Object.values(HEAD).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Idle blink/wink loop (only when genuinely idle and not mid-reaction).
  useEffect(() => {
    if (mood !== "idle" || reacting) return;
    let alive = true;
    let outer: number;
    const schedule = () => {
      outer = window.setTimeout(
        () => {
          if (!alive) return;
          const r = Math.random();
          if (r < 0.25) {
            setIdleFrame("wink");
            window.setTimeout(() => alive && setIdleFrame("happy"), 480);
          } else if (r < 0.75) {
            setIdleFrame("blink");
            window.setTimeout(() => alive && setIdleFrame("happy"), 150);
          }
          schedule();
        },
        2200 + Math.random() * 2600,
      );
    };
    schedule();
    return () => {
      alive = false;
      window.clearTimeout(outer);
    };
  }, [mood, reacting]);

  // Auto-rotate tips.
  useEffect(() => {
    const id = window.setInterval(
      () => setTipIndex((i) => i + 1),
      9000,
    );
    return () => window.clearInterval(id);
  }, []);

  const onTap = () => {
    if (navigator.vibrate) navigator.vibrate(15);
    setBubbleOpen(true);
    setTipIndex((i) => i + 1);
    setReacting(true);
    window.clearTimeout(reactTimer.current);
    reactTimer.current = window.setTimeout(() => setReacting(false), 1300);
  };

  let key: keyof typeof HEAD;
  if (reacting) key = "heart";
  else if (mood === "idle") key = idleFrame;
  else if (mood === "searching") key = "content";
  else if (mood === "good") key = "heart";
  else key = "confused";

  return (
    <div className="pointer-events-none fixed left-3 z-30 flex items-end gap-2 top-[calc(env(safe-area-inset-top)_+_3.5rem)]">
      <button
        type="button"
        onClick={onTap}
        aria-label="Yumbo helper — tap for a tip"
        className="pointer-events-auto shrink-0 active:scale-95"
      >
        <img
          src={HEAD[key]}
          alt=""
          className={`h-16 w-16 object-contain drop-shadow-lg ${reacting ? "animate-bounce" : ""}`}
        />
      </button>
      {bubbleOpen && (
        <button
          type="button"
          onClick={() => setTipIndex((i) => i + 1)}
          aria-label="Next tip"
          className="pointer-events-auto max-w-[60vw] rounded-2xl rounded-bl-sm bg-black/70 px-3 py-2 text-left text-xs leading-snug text-white/90 backdrop-blur"
        >
          {tipAt(tipIndex % TIPS.length)}
        </button>
      )}
    </div>
  );
}
