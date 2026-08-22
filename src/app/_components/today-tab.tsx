"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { WEIGH_ANCHOR_ID, checkAnchorId, plain, todayCardOrder } from "@convex/tm/logicEasy";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import { BigChoice, Card, Eyebrow } from "./ui";
import { CravingLogger } from "./craving";
import { FuelTodayCard } from "./fuel-tab";
import { TrainTodayCard } from "./train-tab";
import { StackTodayCard } from "./stack-tab";
import { SupplyTodayCard } from "./supply-tab";
import { LabsTodayCard } from "./labs-tab";
import { MindTodayCard } from "./mind-tab";
import { CaptureTodayCard } from "./capture-tab";

function subscribeHourTick(cb: () => void) {
  const t = setInterval(cb, 30_000);
  return () => clearInterval(t);
}

/**
 * The client's own hour, 0–23 — used only to reorder cards, never sent to a
 * query. Server snapshot is -1, outside todayCardOrder's valid range, so the
 * first paint matches file order on both sides and hydration cannot mismatch;
 * the real hour lands once the client mounts.
 */
function useCurrentHour(): number {
  return useSyncExternalStore(subscribeHourTick, () => new Date().getHours(), () => -1);
}

export function TodayTab() {
  const { today, actions, research } = useTimento();
  // Toggling a check is optimistic: the tick flips instantly and nothing is
  // spoken. One polite region carries the result to a screen reader.
  const [checkStatus, setCheckStatus] = useState("");
  const hourOfDay = useCurrentHour();
  if (!today) return null;
  const survival = today.user.mode === "survival";
  const easy = today.a11y.profile === "easy";
  const accent = survival ? "bg-tm-amber" : "bg-tm-green";
  const { todayDone, todayTotal } = today.stats;

  function tickCheck(c: { key: string; label: string; done: boolean }) {
    actions.toggleCheck(c.key);
    // c.done is the value before this click.
    const next = c.done ? todayDone - 1 : todayDone + 1;
    setCheckStatus(`${c.label} ${c.done ? "cleared" : "done"} — ${next} of ${todayTotal} today.`);
  }

  const allChecksDone = today.checks.every((c) => c.done);

  /*
    Which cards exist is the query's decision, not this component's — see
    convex/tm/logicEasy.ts. Standard mode gets every id in TODAY_CARDS, so the
    rendered order below is byte-for-byte the order that shipped; easy mode gets
    a short list and the rest are never built. Nothing here filters, so nothing
    here can be wrong about what easy mode means.
  */
  const cards: Record<string, ReactNode> = {
    // Compact read-outs owned by each domain slice — the full surface lives in its own tab.
    supply: <SupplyTodayCard />,
    stack: <StackTodayCard />,
    fuel: <FuelTodayCard />,
    train: <TrainTodayCard />,
    kitchen: <KitchenCard />,
    craving: <CravingLogger />,
    state: <StateCheck />,
    weigh: <WeighIn />,
    mind: <MindTodayCard />,
    labs: <LabsTodayCard />,
    capture: <CaptureTodayCard />,
    winter: research?.winterLayer ? (
      <Card>
        <Eyebrow color="bg-tm-yellow">Winter layer: PER3 +/+</Eyebrow>
        <p className="text-[14px]">
          Morning light within an hour of waking: daylight walk or the 10k-lux lamp. Sleep checks weigh heavier this season.
        </p>
      </Card>
    ) : null,
  };

  return (
    <div className="flex flex-col gap-3 pt-5">
      <p role="status" className="sr-only">
        {checkStatus}
      </p>
      {today.tripwire && (
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">
            {easy
              ? plain("Tripwire")
              : today.tripwire.level === "hard"
                ? "Hard tripwire"
                : "Soft tripwire"}
          </Eyebrow>
          <p className="text-[14px] text-tm-amber-ink">{today.tripwire.message}</p>
        </Card>
      )}

      <Card tone={survival ? "amber" : "default"}>
        <Eyebrow color={accent}>
          {easy ? "Today" : survival ? "Floor checks — only these three exist" : "Today's checks"}
        </Eyebrow>
        {easy ? (
          <>
            {/* The one next action, as a sentence, and the only place easy mode
                says it: the scoreboard's NEXT stamp is standard-only, because
                this copy sits directly above the controls that answer it and
                saying it twice is two decisions. "Next" is added here, once —
                the label itself carries no prefix. A finished day is already a
                whole sentence, so it takes no prefix at all. */}
            <p className="mb-3 text-[15px]">
              {today.nextAction.kind === "rest"
                ? today.nextAction.label
                : `Next: ${today.nextAction.label}.`}
            </p>
            <BigChoice
              question={
                allChecksDone ? "All done. Tap one to undo it." : "Which one have you done?"
              }
              options={today.checks.map((c) => ({
                id: c.key,
                label: c.label,
                detail: c.done ? "Done" : undefined,
                selected: c.done,
                onSelect: () => tickCheck(c),
              }))}
            />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {today.checks.map((c) => (
              <button
                key={c.key}
                /* The header's NEXT stamp focuses this exact row. Id from the
                   same helper the stamp targets, so the two cannot drift. */
                id={checkAnchorId(c.key)}
                onClick={() => tickCheck(c)}
                aria-pressed={c.done}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between rounded-[14px] border px-3.5 py-3 text-left text-[15px] font-medium transition-[transform,opacity] duration-150 active:scale-[0.99]",
                  // white on tm-amber 5.77:1 — it was 3.29:1, so a ticked check on
                  // the survival screen was unreadable. white on tm-green 5.99:1.
                  c.done
                    ? cn("text-white", survival ? "border-tm-amber bg-tm-amber" : "border-tm-green bg-tm-green")
                    : "border-tm-rule-strong bg-tm-panel text-tm-ink",
                )}
              >
                <span>{c.label}</span>
                <span aria-hidden className="font-tm-mono text-[14px]">{c.done ? "✓" : "—"}</span>
              </button>
            ))}
          </div>
        )}
        {survival && (
          <p className="mt-2.5 text-[14px] text-tm-amber-ink">
            {easy ? (
              "Three things. That is the whole day. Holding this is the win."
            ) : (
              <>
                No tracking. No macros. No make-up sessions. Holding the floor <i>is</i> the win this season.
              </>
            )}
          </p>
        )}
      </Card>

      <div className={cn(easy ? "flex flex-col gap-3" : "flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4")}>
        {todayCardOrder(today.a11y.cards, hourOfDay).map((id) => (
          <Fragment key={id}>{cards[id] ?? null}</Fragment>
        ))}
      </div>

      <p className="pb-2 text-center">
        <Link
          href="/why"
          className="inline-flex min-h-11 items-center justify-center px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim underline uppercase"
        >
          Why this design
        </Link>
      </p>
    </div>
  );
}

function subscribeTick(cb: () => void) {
  const t = setInterval(cb, 30_000);
  return () => clearInterval(t);
}

function KitchenCard() {
  const { today, actions } = useTimento();
  // 0 on the server; a 30-second-granular timestamp on the client.
  const tick = useSyncExternalStore(subscribeTick, () => Math.floor(Date.now() / 30_000), () => 0);
  const now = tick === 0 ? null : new Date(tick * 30_000);
  if (!today) return null;

  const close = today.user.kitchenClose;
  let countdown: string | null = null;
  if (now) {
    const [h, m] = close.split(":").map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const diffMin = Math.round((target.getTime() - now.getTime()) / 60_000);
    countdown =
      diffMin > 0
        ? `in ${Math.floor(diffMin / 60)} h ${String(diffMin % 60).padStart(2, "0")} m`
        : "closed for tonight";
  }
  const kitchenStreak = countStreak(today);

  return (
    <Card className="overflow-hidden">
      <div className="relative -mx-4 -mt-4 mb-3 h-28">
        <Image
          src="/why/evening-window.png"
          alt="Night kitchen window at the evening hour"
          fill
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex items-center justify-between">
        <Eyebrow color="bg-tm-red" className="mb-0">Kitchen closes</Eyebrow>
        {kitchenStreak !== null && <span className="font-tm-mono text-[11.5px] text-tm-dim">streak {kitchenStreak}</span>}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-tm-disp text-[40px] leading-none tracking-tight">{close}</span>
        {countdown && <span className="font-tm-mono text-[11.5px] text-tm-dim">{countdown}</span>}
      </div>
      <button
        type="button"
        onClick={() => {
          // aria-disabled, not the disabled attribute — a disabled element
          // drops out of the tab order, which is how the done state used to
          // vanish from keyboard and screen-reader users the moment it was
          // reached. Guard the handler instead so a stray click stays inert.
          if (!today.day.ritualDone) actions.markRitual();
        }}
        aria-disabled={today.day.ritualDone}
        className={cn(
          "mt-2.5 min-h-11 w-full rounded-[14px] px-3 py-2.5 text-left text-[14px]",
          today.day.ritualDone ? "cursor-default bg-tm-green-faint text-tm-green" : "cursor-pointer bg-tm-soft text-tm-ink",
        )}
      >
        <b>20:15 close-out ritual:</b> skyr · 2 squares dark · decaf. Same cue, same reward, swapped routine.
        <span className="mt-1 block font-tm-mono text-[11.5px] text-tm-dim">
          {today.day.ritualDone ? "✓ done tonight" : "tap when done"}
        </span>
      </button>
    </Card>
  );
}

function countStreak(today: NonNullable<ReturnType<typeof useTimento>["today"]>): number | null {
  return today.stats.streak > 0 ? today.stats.streak : null;
}

function StateCheck() {
  const { today, actions } = useTimento();
  if (!today) return null;
  const { stress, energy } = today.day;

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">State check: stress · energy</Eyebrow>
      <div className="flex flex-col gap-2">
        <ScaleRow label="Stress" value={stress} onPick={(v) => actions.logState({ stress: v })} />
        <ScaleRow label="Energy" value={energy} onPick={(v) => actions.logState({ energy: v })} />
      </div>
      <p className="mt-2 font-tm-mono text-[11.5px] leading-relaxed text-tm-dim">
        Feeds the trigger map&apos;s emotion channel and the weekly review. Tracked and correlated, never diagnosed.
      </p>
      {stress !== null && stress >= 4 && <BreathePrompt />}
    </Card>
  );
}

const SCALE_OPTIONS = [1, 2, 3, 4, 5] as const;

function ScaleRow({ label, value, onPick }: { label: string; value: number | null; onPick: (v: number) => void }) {
  // Roving tabindex: the checked option is the one Tab stops at, or the
  // first when nothing is picked yet — five buttons were all landing in the
  // tab order before this, which is not what a radio group sounds like to a
  // screen reader and is five stops for one decision on a keyboard.
  const activeIndex = value !== null && SCALE_OPTIONS.includes(value as (typeof SCALE_OPTIONS)[number])
    ? SCALE_OPTIONS.indexOf(value as (typeof SCALE_OPTIONS)[number])
    : 0;
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(from: number, delta: number) {
    const next = (from + delta + SCALE_OPTIONS.length) % SCALE_OPTIONS.length;
    onPick(SCALE_OPTIONS[next]);
    buttonRefs.current[next]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    // Space/Enter need nothing extra — a native <button> already fires
    // click on both, which is exactly "selects" for this row.
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(index, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(index, -1);
    }
  }

  return (
    /* flex-wrap, because five 44px targets plus a label do not fit across a
       320px viewport (1.4.10 Reflow). The label drops to its own line rather
       than the page scrolling sideways — the targets never shrink to make
       room, which is the trade this app always makes. */
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[14px] font-medium">{label}</span>
      {/* size-11 = 44×44 (2.5.8). Was size-8. */}
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {SCALE_OPTIONS.map((v, i) => (
          <button
            key={v}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            role="radio"
            aria-checked={value === v}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => onPick(v)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "size-11 cursor-pointer rounded-md border font-tm-mono text-[13px]",
              value === v ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule-strong bg-tm-panel text-tm-dim",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function BreathePrompt() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-[14px] bg-tm-soft px-3 py-2.5">
      <p className="text-[14px]">Stress is high. Two minutes of breathing helps the next hour.</p>
      {open ? (
        <BreathingTimerInline onDone={() => setOpen(false)} />
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-1.5 inline-flex min-h-11 cursor-pointer items-center rounded-md bg-tm-ink px-4 font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase"
        >
          Start 2-min timer
        </button>
      )}
    </div>
  );
}

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
  const label = secondsLeft === 0 ? "Done. Loop continues." : phase < 2 ? "Inhale" : phase < 3 ? "Inhale again — top up" : "Long exhale";
  // Spoken separately from the visible label, and deliberately coarser: it
  // changes twice per 8-second cycle, so a screen reader gets the instruction
  // and nothing else. The old markup put aria-live on the ticking digits, which
  // announced a number every second for two minutes — during a calming exercise.
  const spoken = secondsLeft === 0 ? "Done" : phase < 3 ? "Breathe in" : "Breathe out";
  return (
    <div className="mt-2 text-center">
      <div role="timer" aria-label="Two-minute breathing timer">
        <div aria-hidden className="font-tm-disp text-3xl">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</div>
        <div aria-hidden className="mt-1 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">{label}</div>
        <div aria-hidden className="mx-auto mt-2 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-tm-grid">
          <div className="h-full bg-tm-blue transition-all duration-1000" style={{ width: `${((120 - secondsLeft) / 120) * 100}%` }} />
        </div>
      </div>
      <p role="status" className="sr-only">
        {spoken}
      </p>
    </div>
  );
}

/** 30–250 kg, exclusive — the same bound the submit handler enforces. */
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 250;

function WeighIn() {
  const { today, actions } = useTimento();
  // Prefilled with the latest known weight, not blank — the app already
  // knows roughly what to expect, so logging an unchanged-ish number is
  // select-and-adjust rather than recall-and-type from scratch every night.
  // Lazy initializer: by the time this renders, TodayTab has already gated
  // on `today` being present, so `today.latestKg` is available at mount.
  const [value, setValue] = useState(() => (today ? today.latestKg.toFixed(1) : ""));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!today) return null;
  const logged = today.day.weightKg;
  const showForm = logged === null || editing;

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Weigh-in</Eyebrow>
      {!showForm && logged !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px]">
            Logged: <b className="font-tm-mono">{logged.toFixed(1)} kg</b>
            <span className="ml-2 font-tm-mono text-[11.5px] text-tm-dim">house rule: you can eat the cake; you can&apos;t stop measuring</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setValue(logged.toFixed(1));
              setEditing(true);
              setError(null);
            }}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim underline uppercase"
          >
            Correct
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const kg = Number(value);
            if (!Number.isFinite(kg)) {
              setError(`"${value}" isn't a number. Enter your weight in kg.`);
              return;
            }
            if (kg <= MIN_WEIGHT_KG || kg >= MAX_WEIGHT_KG) {
              setError(`That reads ${value} kg — outside ${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG}. Check the scale.`);
              return;
            }
            actions.logWeight(Math.round(kg * 10) / 10);
            setEditing(false);
            setError(null);
            setValue("");
          }}
        >
          <div className="flex gap-2">
            <input
              /* Where "next: weigh yourself" lands — the field itself, not the
                 card, so the keyboard is already in the right place. */
              id={WEIGH_ANCHOR_ID}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              inputMode="decimal"
              placeholder="kg"
              aria-label="Weight in kilograms"
              aria-invalid={error !== null}
              className="min-h-11 w-24 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 py-2 font-tm-mono text-base outline-none focus:border-tm-ink"
            />
            <button type="submit" className="min-h-11 cursor-pointer rounded-[14px] bg-tm-ink px-5 font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase">
              Log
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setValue("");
                }}
                className="inline-flex min-h-11 cursor-pointer items-center px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim underline uppercase"
              >
                Cancel
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="rounded-[14px] border border-tm-red bg-tm-red-bg px-3 py-2.5 text-[14px] text-tm-red">
              {error}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
