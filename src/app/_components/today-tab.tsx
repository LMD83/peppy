"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import { Card, Eyebrow, TmButton } from "./ui";
import { CravingLogger } from "./craving";
import { BreathingTimerInline } from "./breathe";

export function TodayTab() {
  const { today, actions, research } = useTimento();
  if (!today) return null;
  const survival = today.user.mode === "survival";
  const accent = survival ? "bg-tm-amber" : "bg-tm-green";

  return (
    <div className="flex flex-col gap-3 pt-4">
      {today.tripwire && (
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">
            {today.tripwire.level === "hard" ? "Hard tripwire" : "Soft tripwire"}
          </Eyebrow>
          <p className="text-[13px] text-tm-amber-ink">{today.tripwire.message}</p>
        </Card>
      )}

      <Card tone={survival ? "amber" : "default"}>
        <Eyebrow color={accent}>
          {survival ? "Floor checks — only these three exist" : "Today's checks"}
        </Eyebrow>
        <div className="flex flex-col gap-2">
          {today.checks.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => actions.toggleCheck(c.key)}
              aria-pressed={c.done}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-between rounded-[10px] border px-3.5 py-3 text-left text-sm font-medium transition-[transform,opacity] duration-150 active:scale-[0.99] active:opacity-80",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/25",
                c.done
                  ? cn("text-white shadow-inner", survival ? "border-tm-amber bg-tm-amber" : "border-tm-green bg-tm-green")
                  : "border-tm-rule bg-tm-panel text-tm-ink",
              )}
            >
              <span>{c.label}</span>
              <span
                aria-hidden
                className={cn(
                  "inline-block size-3.5 rounded-[3px] border",
                  c.done ? "border-white bg-white" : "border-tm-rule",
                )}
              />
            </button>
          ))}
        </div>
        {survival && (
          <p className="mt-2.5 text-[12.5px] text-tm-amber-ink">
            No tracking. No macros. No make-up sessions. Holding the floor <i>is</i> the win this season.
          </p>
        )}
      </Card>

      <KitchenCard />

      {today.session && (
        <Card>
          <Eyebrow color="bg-tm-green">Session — {today.session.name}</Eyebrow>
          <ul>
            {today.session.exercises.map((ex) => (
              <li
                key={ex.name}
                className="flex items-center justify-between border-b border-tm-grid py-2 last:border-0"
              >
                <span className="text-[13.5px] font-medium">{ex.name}</span>
                <span className="flex items-center gap-2">
                  {ex.flag && (
                    <span className="rounded bg-tm-green px-1.5 py-0.5 font-tm-mono text-[9.5px] text-white">
                      {ex.flag}
                    </span>
                  )}
                  <span className="font-tm-mono text-[10.5px] text-tm-dim">{ex.repRange}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
            Top set ≥12 reps at the same load, two sessions running, earns the +2.5 kg flag.
          </p>
          <TmButton
            className="mt-3 w-full"
            variant={today.day.sessionDone ? "soft" : "primary"}
            disabled={today.day.sessionDone}
            onClick={() => actions.markSessionDone()}
          >
            {today.day.sessionDone ? "Session logged" : "Mark session done"}
          </TmButton>
        </Card>
      )}

      <CravingLogger />

      <StateCheck />

      <WeighIn />

      {research?.winterLayer && (
        <Card>
          <Eyebrow color="bg-tm-yellow">Winter layer: PER3 +/+</Eyebrow>
          <p className="text-[12.5px]">
            Morning light within an hour of waking: daylight walk or the 10k-lux lamp. Sleep checks weigh heavier this
            season.
          </p>
        </Card>
      )}

      <p className="pb-2 text-center">
        <Link href="/why" className="font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase underline decoration-tm-rule underline-offset-4">
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
  const tick = useSyncExternalStore(
    subscribeTick,
    () => Math.floor(Date.now() / 30_000),
    () => 0,
  );
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
  const kitchenStreak = today.stats.streak > 0 ? today.stats.streak : null;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow color="bg-tm-red" className="mb-0">
          Kitchen closes
        </Eyebrow>
        {kitchenStreak !== null && (
          <span className="font-tm-mono text-[10px] text-tm-dim">streak {kitchenStreak}</span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-tm-disp text-[34px] leading-none">{close}</span>
        {countdown && <span className="font-tm-mono text-[11px] text-tm-dim">{countdown}</span>}
      </div>
      <button
        type="button"
        onClick={() => actions.markRitual()}
        disabled={today.day.ritualDone}
        className={cn(
          "mt-2.5 min-h-11 w-full cursor-pointer rounded-[10px] px-3 py-2.5 text-left text-[12.5px] transition-[transform,opacity] duration-150 active:scale-[0.99] active:opacity-80 disabled:opacity-70 disabled:active:scale-100",
          today.day.ritualDone ? "bg-[#e8f1eb] text-tm-green" : "bg-tm-soft text-tm-ink",
        )}
      >
        <b>20:15 close-out ritual:</b> skyr · 2 squares dark · decaf. Same cue, same reward, swapped routine.
        <span className="mt-1 block font-tm-mono text-[10px] text-tm-dim">
          {today.day.ritualDone ? "✓ done tonight" : "tap when done"}
        </span>
      </button>
    </Card>
  );
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
      <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
        Feeds the trigger map&apos;s emotion channel and the weekly review. Tracked and correlated, never diagnosed.
      </p>
      {stress !== null && stress >= 4 && <BreathePrompt />}
    </Card>
  );
}

function ScaleRow({
  label,
  value,
  onPick,
}: {
  label: string;
  value: number | null;
  onPick: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onPick(v)}
            className={cn(
              "size-9 cursor-pointer rounded-md border font-tm-mono text-[11px] transition-[transform,opacity] duration-150 active:scale-[0.96] active:opacity-80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/25",
              value === v ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule bg-tm-panel text-tm-dim",
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
      <p className="text-[12.5px]">Stress is high. Two minutes of breathing helps the next hour.</p>
      {open ? (
        <BreathingTimerInline onDone={() => setOpen(false)} />
      ) : (
        <TmButton className="mt-1.5" onClick={() => setOpen(true)}>
          Start 2-min timer
        </TmButton>
      )}
    </div>
  );
}

function WeighIn() {
  const { today, actions } = useTimento();
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  if (!today) return null;
  const logged = today.day.weightKg;
  const showForm = logged === null || editing;

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Weigh-in</Eyebrow>
      {!showForm && logged !== null ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px]">
            Logged: <b className="font-tm-mono">{logged.toFixed(1)} kg</b>
            <span className="ml-2 font-tm-mono text-[10px] text-tm-dim">
              house rule: you can eat the cake; you can&apos;t stop measuring
            </span>
          </p>
          <TmButton
            variant="ghost"
            className="shrink-0"
            onClick={() => {
              setValue(logged.toFixed(1));
              setEditing(true);
            }}
          >
            Correct
          </TmButton>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const kg = Number(value);
            if (Number.isFinite(kg) && kg > 30 && kg < 250) {
              actions.logWeight(Math.round(kg * 10) / 10);
              setEditing(false);
              setValue("");
            }
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder="kg"
            aria-label="Weight in kilograms"
            className="min-h-11 w-24 rounded-[10px] border border-tm-rule bg-tm-panel px-3 py-2 font-tm-mono text-sm text-tm-ink outline-none focus:border-tm-ink focus-visible:ring-2 focus-visible:ring-tm-ink/25"
          />
          <TmButton type="submit">Log</TmButton>
          {editing && (
            <TmButton
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setValue("");
              }}
            >
              Cancel
            </TmButton>
          )}
        </form>
      )}
    </Card>
  );
}
