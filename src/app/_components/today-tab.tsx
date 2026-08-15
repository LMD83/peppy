"use client";

import { Fragment, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { plain } from "@convex/tm/logic-easy";
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

export function TodayTab() {
  const { today, actions, research } = useTimento();
  // Toggling a check is optimistic: the tick flips instantly and nothing is
  // spoken. One polite region carries the result to a screen reader.
  const [checkStatus, setCheckStatus] = useState("");
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
    convex/tm/logic-easy.ts. Standard mode gets every id in TODAY_CARDS, so the
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
        <Eyebrow color="bg-tm-yellow">Winter layer — PER3 +/+</Eyebrow>
        <p className="text-[14px]">
          Morning light within an hour of waking — daylight walk or the 10k-lux lamp. Sleep checks weigh heavier this season.
        </p>
      </Card>
    ) : null,
  };

  return (
    <div className="flex flex-col gap-3 pt-4">
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
            {/* The one next action, as a sentence. Not a control — the controls
                are the answers below, and saying it twice is two decisions. */}
            <p className="mb-3 text-[15px]">{today.nextAction.label}</p>
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
                onClick={() => tickCheck(c)}
                aria-pressed={c.done}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between rounded-lg border px-3.5 py-3 text-left text-[15px] font-medium",
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

      {today.a11y.cards.map((id) => (
        <Fragment key={id}>{cards[id] ?? null}</Fragment>
      ))}

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
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow color="bg-tm-red" className="mb-0">Kitchen closes</Eyebrow>
        {kitchenStreak !== null && <span className="font-tm-mono text-[11.5px] text-tm-dim">streak {kitchenStreak}</span>}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-tm-disp text-[34px] leading-none">{close}</span>
        {countdown && <span className="font-tm-mono text-[11.5px] text-tm-dim">{countdown}</span>}
      </div>
      <button
        onClick={() => actions.markRitual()}
        disabled={today.day.ritualDone}
        className={cn(
          "mt-2.5 min-h-11 w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-[14px]",
          // tm-green on #e8f1eb is 5.20:1 after the retune (was 4.38:1).
          today.day.ritualDone ? "bg-[#e8f1eb] text-tm-green" : "bg-tm-soft text-tm-ink",
        )}
      >
        <b>20:15 close-out ritual:</b> skyr · 2 squares dark · decaf. Same cue, same reward — swapped routine.
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
      <Eyebrow color="bg-tm-blue">State check — stress · energy</Eyebrow>
      <div className="flex flex-col gap-2">
        <ScaleRow label="Stress" value={stress} onPick={(v) => actions.logState({ stress: v })} />
        <ScaleRow label="Energy" value={energy} onPick={(v) => actions.logState({ energy: v })} />
      </div>
      <p className="mt-2 font-tm-mono text-[11.5px] leading-relaxed text-tm-dim">
        Feeds the trigger map&apos;s emotion channel and the weekly review. Tracked, correlated — never diagnosed.
      </p>
      {stress !== null && stress >= 4 && <BreathePrompt />}
    </Card>
  );
}

function ScaleRow({ label, value, onPick }: { label: string; value: number | null; onPick: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[14px] font-medium">{label}</span>
      {/* size-11 = 44×44 (2.5.8). Was size-8. */}
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            onClick={() => onPick(v)}
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
    <div className="mt-2 rounded-lg bg-tm-soft px-3 py-2.5">
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

function WeighIn() {
  const { today, actions } = useTimento();
  const [value, setValue] = useState("");
  if (!today) return null;
  const logged = today.day.weightKg;

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Weigh-in</Eyebrow>
      {logged !== null ? (
        <p className="text-[14px]">
          Logged: <b className="font-tm-mono">{logged.toFixed(1)} kg</b>
          <span className="ml-2 font-tm-mono text-[11.5px] text-tm-dim">house rule: you can eat the cake; you can&apos;t stop measuring</span>
        </p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const kg = Number(value);
            if (Number.isFinite(kg) && kg > 30 && kg < 250) actions.logWeight(Math.round(kg * 10) / 10);
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder="kg"
            aria-label="Weight in kilograms"
            className="min-h-11 w-24 rounded-lg border border-tm-rule-strong bg-tm-panel px-3 py-2 font-tm-mono text-base outline-none focus:border-tm-ink"
          />
          <button type="submit" className="min-h-11 cursor-pointer rounded-lg bg-tm-ink px-5 font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase">
            Log
          </button>
        </form>
      )}
    </Card>
  );
}
