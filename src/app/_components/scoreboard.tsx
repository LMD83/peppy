"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { withDestination, type NextActionWithDestination } from "@convex/tm/logicEasy";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import { useFileNav } from "./file-nav";
import { fileWidth, TmButton, TmSheet } from "./ui";

export function Scoreboard() {
  const { today, actions, date } = useTimento();
  const [confirmMode, setConfirmMode] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const modePanelId = useId();
  const goFileNav = useFileNav();
  if (!today) return null;

  const { user, stats, latestKg, deltaKg, dayNumber } = today;
  const survival = user.mode === "survival";
  const title = survival ? `Floor protocol — hold < ${user.ceilingKg}` : user.protocolTitle;
  // The file's own to-do line, reused rather than reforecast — nextAction is
  // computed once, in logicEasy.ts; this only adds which control answers it.
  const next = withDestination(today.nextAction);
  const easy = today.a11y.profile === "easy";

  function goNext(focusId: string) {
    goFileNav(next.tab);
    // The tab switch commits before the next frame, so the control exists by
    // the time this runs. Focus, not merely scroll: the header hands the
    // keyboard over rather than naming a row and leaving someone to find it.
    requestAnimationFrame(() => {
      const el = document.getElementById(focusId);
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  }

  // Swatches are aria-hidden decoration, but they still have to be visible:
  // tm-onink replaces tm-dim2 here because dim2 is now a dark-on-light grey.
  const cells: [string, string, string, string][] = [
    ["Mass", `${latestKg.toFixed(1)} kg`, survival ? `ceiling ${user.ceilingKg.toFixed(1)}` : `Δ ${deltaKg > 0 ? "+" : ""}${deltaKg.toFixed(1)} kg`, "bg-tm-blue"],
    ["Day", `${dayNumber}`, `week ${Math.ceil(dayNumber / 7)}`, "bg-tm-onink"],
    survival
      ? ["Floor", `${stats.todayDone}/${stats.todayTotal}`, "today's checks", "bg-tm-amber-lift"]
      : ["Adherence", `${stats.adherence7}%`, `${stats.streak}-day streak`, "bg-tm-green"],
  ];

  return (
    <header className="bg-tm-ink px-4 pt-5 pb-5">
      <div className={fileWidth}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-tm-mono text-[11.5px] tracking-[0.16em] text-tm-onink uppercase">
            Performance file · {user.name}
          </p>
          <button
            type="button"
            onClick={() => setFileOpen(true)}
            aria-label="File menu"
            className="-mr-2 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-[8px] px-2 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-onink uppercase"
          >
            File
          </button>
        </div>
        <h1 className="mt-2 font-tm-disp text-2xl leading-[1.1] tracking-tight text-white uppercase md:text-3xl">{title}</h1>
        {survival && (
          <p className="mt-1.5 text-[14px] leading-relaxed text-tm-amber-lift">
            Executing as designed.{user.reviewDate ? ` Review prompt: ${user.reviewDate}.` : ""} Zero guilt clause active.
          </p>
        )}
        <button
          type="button"
          onClick={() => setConfirmMode((open) => !open)}
          aria-expanded={confirmMode}
          aria-controls={modePanelId}
          className={cn(
            "mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-[22px] border px-4 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
            survival ? "border-tm-amber-lift bg-tm-amber-lift text-tm-ink" : "border-tm-inkrule bg-tm-ink3 text-tm-onink",
          )}
        >
          {user.mode} mode ⇄ · change
        </button>
        <dl className="mt-3 flex overflow-hidden rounded-[10px] border border-tm-inkrule bg-tm-ink2">
          {cells.map(([label, value, sub, color], i) => (
            <div key={label} className={cn("min-w-0 flex-1 px-3 py-3", i > 0 && "border-l border-tm-inkrule")}>
              <dt className="font-tm-mono text-[11.5px] tracking-[0.08em] text-tm-onink uppercase">{label}</dt>
              <dd className="my-0.5 font-tm-disp text-[22px] text-white">{value}</dd>
              <dd className="flex items-center gap-1.5">
                <span aria-hidden className={cn("inline-block h-[3px] w-3 shrink-0", color)} />
                <span className="font-tm-mono text-[11.5px] leading-tight text-tm-onink">{sub}</span>
              </dd>
            </div>
          ))}
        </dl>
        {!easy && <NextStamp next={next} onGo={goNext} />}
        {confirmMode && (
          <ModeSwitcher
            id={modePanelId}
            current={user.mode}
            date={date}
            onClose={() => setConfirmMode(false)}
            onPick={(m, review) => {
              actions.setMode(m, undefined, review);
              setConfirmMode(false);
            }}
          />
        )}
        <TmSheet open={fileOpen} onClose={() => setFileOpen(false)} title="File" label="File menu">
          <div className="flex flex-col gap-3">
            <p className="font-tm-mono text-[13px] text-tm-ink">
              Kitchen closes <b>{user.kitchenClose}</b>
            </p>
            <Link
              href="/why"
              className="inline-flex min-h-11 items-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase underline decoration-tm-rule underline-offset-4"
              onClick={() => setFileOpen(false)}
            >
              Why this design
            </Link>
            <TmButton
              variant="danger"
              aria-label="Sign out"
              onClick={() => {
                setFileOpen(false);
                actions.logout();
              }}
            >
              Sign out
            </TmButton>
          </div>
        </TmSheet>
      </div>
    </header>
  );
}

/** The dark chip both stamp states wear, so the day's end is not a downgrade. */
const stampShell =
  "mt-2 flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-tm-inkrule bg-tm-ink2 px-3.5 py-2.5 text-left";

/**
 * The file's own to-do line, as a fourth header element.
 *
 * Standard profile only. Easy mode says the same sentence directly above the
 * controls that answer it (today-tab.tsx) and one screen may say it once — a
 * second copy up here would be a second decision, which is the one thing easy
 * mode exists to prevent. It could not be an honest control there either:
 * easy mode's next action names the real day, so it can point at a check
 * outside the three on screen, and nothing can focus what is not rendered.
 */
function NextStamp({
  next,
  onGo,
}: {
  next: NextActionWithDestination;
  onGo: (focusId: string) => void;
}) {
  // Nowhere to go is a state, not an errand. It keeps the chip — the header
  // never goes quiet — but drops the button role, the arrow and the press
  // animation, because a control that promises a task and then does nothing
  // is worse than dead text.
  if (next.focusId === null)
    return (
      <p className={stampShell}>
        <span className="min-w-0">
          <span className="block font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-onink uppercase">Done</span>
          <span className="mt-0.5 block truncate text-[15px] font-medium text-white uppercase">
            Executed as designed
          </span>
        </span>
      </p>
    );

  const focusId = next.focusId;
  return (
    <button
      type="button"
      onClick={() => onGo(focusId)}
      /*
        No aria-label. The eyebrow is part of the accessible name, so the
        computed name is "Next 8k+ steps" — the word appears once, in the DOM,
        and cannot drift from the visible text (2.5.3). Spelling it out here as
        well is what made Chrome read "Next: Next: 8k+ steps."
      */
      className={cn(stampShell, "cursor-pointer transition-transform duration-150 active:scale-[0.98]")}
    >
      <span className="min-w-0">
        <span className="block font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-onink uppercase">Next</span>
        <span className="mt-0.5 block truncate text-[15px] font-medium text-white">{next.label}</span>
      </span>
      <span aria-hidden className="shrink-0 font-tm-mono text-[15px] text-tm-onink">
        →
      </span>
    </button>
  );
}

function ModeSwitcher({
  id,
  current,
  date,
  onClose,
  onPick,
}: {
  id: string;
  current: "cut" | "maintain" | "survival";
  date: string;
  onClose: () => void;
  onPick: (mode: "cut" | "maintain" | "survival", reviewDate?: string) => void;
}) {
  const options = [
    { mode: "cut" as const, blurb: "Full five checks, deficit targets, weekly weigh-in." },
    { mode: "maintain" as const, blurb: "Band goal ±1.5 kg. Four checks. Tripwires pre-written." },
    { mode: "survival" as const, blurb: "Three checks only. Ceiling re-anchors. An executed decision, not a lapse." },
  ];
  const defaultReview = `${Number(date.slice(0, 4))}-${date.slice(5, 7)}-${date.slice(8, 10)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div id={id} className="mt-3 rounded-[10px] border border-tm-inkrule bg-tm-ink3 p-3">
      <p className="mb-2 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-onink uppercase">Switch mode. Takes effect now</p>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <button
            key={o.mode}
            type="button"
            disabled={o.mode === current}
            onClick={() => onPick(o.mode, o.mode === "survival" ? nextReview(defaultReview) : undefined)}
            className="min-h-11 cursor-pointer rounded-md border border-tm-inkrule bg-tm-ink2 px-3 py-2.5 text-left text-[14px] text-white disabled:opacity-40"
          >
            <span className="font-tm-mono text-[11.5px] tracking-[0.12em] uppercase">{o.mode}</span>
            <span className="mt-0.5 block text-[14px] leading-snug text-tm-onink">{o.blurb}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full cursor-pointer rounded-md font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-onink uppercase">
        Keep {current}
      </button>
    </div>
  );
}

function nextReview(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 28);
  return d.toISOString().slice(0, 10);
}
