"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { fileWidth } from "./ui";

/**
 * The guided walkthrough — nine stops through a day that runs itself.
 *
 * This is a coach card, not a modal: the app stays live underneath, every stop
 * navigates to the real screen with the real data, and the card only narrates
 * what the screen is already doing. Nothing here is a mockup, so nothing here
 * can drift from the product — if a stop's claim stops being true, the screen
 * behind it says so first.
 *
 * The card sits above the bottom nav, inside the same file width as the page.
 * Escape ends the tour; so does the button that says so.
 */

export type TourDestination = {
  tab: "today" | "fuel" | "train" | "body" | "mind" | "shop" | "remind";
  sub?: "stack" | "supply" | "labs" | "checkin";
};

type TourStop = TourDestination & {
  eyebrow: string;
  heading: string;
  text: string;
};

const STOPS: TourStop[] = [
  {
    tab: "today",
    eyebrow: "Today",
    heading: "The day is already decided",
    text:
      "Nothing here asks you to plan. Checks, doses and the session come from the profile — the day starts answered, and you tick as you go.",
  },
  {
    tab: "fuel",
    eyebrow: "Fuel",
    heading: "Meals pick themselves",
    text:
      "Generate a day or a week inside your kitchen's real limits — time, hands, equipment, allergens. Every planned meal writes the shopping list on its own.",
  },
  {
    tab: "shop",
    eyebrow: "Shopping",
    heading: "The list wrote itself",
    text:
      "Aisle order, packs rounded, cupboard subtracted. Pick your supermarket once and it stays picked. The buttons say exactly what they do — no Irish grocer takes orders from an app yet, and the day one does, this screen is ready.",
  },
  {
    tab: "train",
    eyebrow: "Train",
    heading: "Tap, tap, tap",
    text:
      "Sets arrive pre-filled from last session. One button logs a set and starts the rest clock, and Next exercise is one tap when the rack is taken.",
  },
  {
    tab: "body",
    sub: "stack",
    eyebrow: "Stack",
    heading: "Tick a dose, the file does the rest",
    text:
      "Adherence, cycle phase and what a floor day defers are computed for you. A logged dose also counts your stock down.",
  },
  {
    tab: "body",
    sub: "supply",
    eyebrow: "Supply",
    heading: "Never run out",
    text:
      "Sixty tablets at two a day is thirty days; the order-by date lands before the gap does. A prescription that needs the GP says so, with the message ready to read out.",
  },
  {
    tab: "body",
    sub: "labs",
    eyebrow: "Bloods",
    heading: "Enter once, tracked forever",
    text:
      "A panel becomes flags, trends and recheck dates. When a recheck falls due it becomes a reminder, not a memory test.",
  },
  {
    tab: "mind",
    sub: "checkin",
    eyebrow: "Check-in",
    heading: "Only what's due, only when due",
    text:
      "Questionnaires surface on their own cadence — never twice in a fortnight, fewer on the floor. Go quiet for days and the file asks the only question that matters: are you ok?",
  },
  {
    tab: "remind",
    eyebrow: "Reminders",
    heading: "The app speaks first",
    text:
      "Quiet hours, a daily cap, and never a word about something already done. Where the lock screen allows buttons you answer from it; everywhere else the tap lands on the right screen. The day runs on answers, not on opening apps.",
  },
];

export function Walkthrough({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (d: TourDestination) => void;
}) {
  const [step, setStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const stop = STOPS[Math.min(step, STOPS.length - 1)];
  const last = step >= STOPS.length - 1;

  // Each stop shows the real screen it talks about.
  useEffect(() => {
    onNavigate({ tab: stop.tab, sub: stop.sub });
    // Navigation is the stop's side effect; re-running on onNavigate identity
    // churn would fight the user's own tapping between steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-x-0 bottom-[84px] z-40 print:hidden">
      <div className={cn(fileWidth, "px-4")}>
        <div
          ref={cardRef}
          tabIndex={-1}
          role="region"
          aria-label="Guided walkthrough"
          className="rounded-[14px] border border-tm-ink bg-tm-ink p-4 text-white shadow-lg outline-none"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-amber-lift uppercase">
              {stop.eyebrow} · stop {step + 1} of {STOPS.length}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 cursor-pointer items-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-onink underline uppercase"
            >
              End tour
            </button>
          </div>
          <div aria-live="polite">
            <h2 className="font-tm-disp text-xl leading-[1.15] tracking-tight uppercase">
              {stop.heading}
            </h2>
            <p className="mt-1.5 text-[14px] leading-snug text-tm-onink">{stop.text}</p>
          </div>
          <div className="mt-3 flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex min-h-11 flex-none cursor-pointer items-center rounded-[10px] border border-tm-onink px-4 text-[14px] text-white transition-transform duration-150 active:scale-[0.98]"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onClose() : setStep((s) => s + 1))}
              className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] bg-white px-4 text-[15px] font-medium text-tm-ink transition-transform duration-150 active:scale-[0.98]"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
