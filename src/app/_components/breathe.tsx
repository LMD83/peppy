"use client";

import { useEffect, useState } from "react";

export function BreathingTimerInline({ onDone }: { onDone: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(120);
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (secondsLeft === 0) {
      const t = setTimeout(onDone, 1500);
      return () => clearTimeout(t);
    }
  }, [secondsLeft, onDone]);
  // Physiological sigh: double inhale (~2.5 s), long exhale (~5 s) — 8 s cycle.
  const phase = (120 - secondsLeft) % 8;
  const label =
    secondsLeft === 0
      ? "Done. Loop continues."
      : phase < 2
        ? "Inhale"
        : phase < 3
          ? "Inhale again, top up"
          : "Long exhale";
  return (
    <div className="mt-2 text-center" role="timer" aria-live="polite">
      <div className="font-tm-disp text-3xl">
        {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
      </div>
      <div className="mt-1 font-tm-mono text-[11px] tracking-[0.12em] text-tm-dim uppercase">{label}</div>
      <div className="mx-auto mt-2 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-tm-grid">
        <div
          className="h-full bg-tm-blue transition-all duration-1000"
          style={{ width: `${((120 - secondsLeft) / 120) * 100}%` }}
        />
      </div>
    </div>
  );
}
