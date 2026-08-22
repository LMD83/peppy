"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { MINDSET_PROMPTS, type BandTone } from "@convex/tm/data/instruments";
import { mindsetPromptForDate } from "@convex/tm/logicMind";
import { useTimento } from "../_lib/backend";
import type { MindData } from "../_lib/types";
import { Card, Eyebrow, Stat, TmButton } from "./ui";

/**
 * Mind — validated self-report instruments, implementation intentions and
 * reflection. Everything here is tracked and correlated; nothing here is a
 * diagnosis, and no copy on this screen may imply one.
 */

type InstrumentView = MindData["instruments"][number];
type HistoryEntry = MindData["history"][number];
type IntentionView = MindData["intentions"][number];
type DueItem = MindData["due"][number];
type Suggestion = MindData["suggestions"][number];

const TONE_TEXT: Record<BandTone, string> = {
  green: "text-tm-green",
  blue: "text-tm-blue",
  amber: "text-tm-amber",
  red: "text-tm-red",
};

const TONE_BORDER: Record<BandTone, string> = {
  green: "border-tm-green",
  blue: "border-tm-blue",
  amber: "border-tm-amber",
  red: "border-tm-red",
};

const TONE_BAR: Record<BandTone, string> = {
  green: "bg-tm-green",
  blue: "bg-tm-blue",
  amber: "bg-tm-amber",
  red: "bg-tm-red",
};

const TONE_MARK: Record<BandTone, string> = {
  green: "stroke-tm-green fill-tm-green",
  blue: "stroke-tm-blue fill-tm-blue",
  amber: "stroke-tm-amber fill-tm-amber",
  red: "stroke-tm-red fill-tm-red",
};

function dueLabel(d: DueItem): string {
  if (d.daysSince === null) return "not yet on file";
  return `${d.daysSince} days since · every ${d.cadenceDays}`;
}

/* ===== the quiet-check acknowledgement =====
 *
 * "I'm ok" is UI state, not health data — it lives in localStorage, never the
 * backend (same store, same pattern as tm.shop.ticked). Keyed by date: an ok
 * covers the day it was tapped, and a new quiet day asks the question fresh.
 */

const QUIET_ACK_KEY = "tm.mind.quietAck";

const quietAckListeners = new Set<() => void>();

function readQuietAck(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(QUIET_ACK_KEY);
  } catch {
    return null;
  }
}

function writeQuietAck(date: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUIET_ACK_KEY, date);
  } catch {
    // A blocked store forgets the answer; the card simply asks again.
  }
  for (const listener of quietAckListeners) listener();
}

function subscribeQuietAck(onChange: () => void): () => void {
  quietAckListeners.add(onChange);
  if (typeof window !== "undefined") window.addEventListener("storage", onChange);
  return () => {
    quietAckListeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
  };
}

function useQuietAck(date: string) {
  const stored = useSyncExternalStore(subscribeQuietAck, readQuietAck, () => null);
  const ack = useCallback(() => writeQuietAck(date), [date]);
  return { acked: stored === date, ack };
}

/* ===== the tab ===== */

export function MindTab() {
  const { mind } = useTimento();
  if (!mind) return <MindSkeleton />;

  if (mind.survival) {
    const top = mind.intentions[0] ?? null;
    return (
      <div className="flex flex-col gap-4 pt-5">
        {mind.safetyNotice.active && <SafetyCard text={mind.safetyNotice.text} />}
        {mind.quietCheck && <QuietCard quiet={mind.quietCheck} />}
        <EncouragementCard encouragement={mind.encouragement} survival />
        <DueCard due={mind.due} instruments={mind.instruments} survival />
        {top && <IntentionCard intention={top} survival />}
        <Card tone="amber">
          <p className="text-[14px] text-tm-amber-ink">
            Two short check-ins, one pre-written plan. Nothing else is offered on the floor. A worse
            week is not the week to add questionnaires.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-3 lg:col-span-7">
      {mind.safetyNotice.active && <SafetyCard text={mind.safetyNotice.text} />}
      {mind.quietCheck && <QuietCard quiet={mind.quietCheck} />}
      <EncouragementCard encouragement={mind.encouragement} survival={false} />
      <DueCard due={mind.due} instruments={mind.instruments} survival={false} />
      <HistoryCard history={mind.history} />
      </div>
      <div className="flex flex-col gap-3 lg:col-span-5">
      <IntentionsCard intentions={mind.intentions} suggestions={mind.suggestions} />
      <ReflectionCard prompt={mind.weeklyPrompt} reflections={mind.reflections} />
      </div>
    </div>
  );
}

/* ===== the compact card for Today ===== */

export function MindTodayCard() {
  const { mind } = useTimento();
  if (!mind) {
    return <div className="h-24 rounded-[14px] border border-tm-rule bg-tm-panel" aria-busy="true" />;
  }
  const top = mind.intentions[0] ?? null;
  const wins = mind.intentions.reduce((s, i) => s + i.wins, 0);

  return (
    <>
      {/* The quiet check rides with the compact card so it is seen on the
          screen a returning person actually lands on, not only in this tab. */}
      {mind.quietCheck && <QuietCard quiet={mind.quietCheck} />}
      <Card tone={mind.survival ? "amber" : "default"}>
        <Eyebrow color={mind.survival ? "bg-tm-amber" : "bg-tm-purple"}>
          {mind.survival ? "Mind — floor" : "Mind"}
        </Eyebrow>
        <p className="text-[13px] font-semibold">{mind.encouragement.headline}</p>
        <dl className="mt-2 flex items-end justify-between gap-2">
          <Stat value={`${mind.due.length}`} label="check-ins due" />
          <Stat value={`${mind.intentions.length}`} label="plans active" />
          <Stat value={`${wins}`} label="plan wins" />
        </dl>
        {top && (
          <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
            if {top.trigger.toLowerCase()} → {top.action.toLowerCase()}
          </p>
        )}
      </Card>
    </>
  );
}

/* ===== pieces ===== */

function MindSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-[14px] border border-tm-rule bg-tm-panel" />
      ))}
    </div>
  );
}

/**
 * Three-plus days of nothing logged surface one question, not a scoreboard.
 * Same non-negotiable as the safety card: this is support, never an assessment
 * — no streak arithmetic, no penance, and the support lines are the real ones.
 */
function QuietCard({ quiet }: { quiet: NonNullable<MindData["quietCheck"]> }) {
  const { date } = useTimento();
  const { acked, ack } = useQuietAck(date);
  const [supportOpen, setSupportOpen] = useState(false);
  if (acked) return null;

  return (
    <Card tone="amber">
      <Eyebrow color="bg-tm-amber">Checking in</Eyebrow>
      <p className="font-tm-disp text-2xl leading-[1.15] tracking-tight">{quiet.heading}</p>
      <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-tm-amber-ink">{quiet.body}</p>
      <div className="mt-2.5 flex gap-2">
        <TmButton className="flex-1" onClick={ack}>
          {"I'm ok"}
        </TmButton>
        <button
          onClick={() => setSupportOpen((open) => !open)}
          aria-expanded={supportOpen}
          className="min-h-11 flex-1 cursor-pointer rounded-[14px] border border-tm-amber bg-tm-panel px-4 font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-amber uppercase transition-transform duration-150 active:scale-[0.98]"
        >
          Support options
        </button>
      </div>
      {supportOpen && (
        <div className="mt-2.5 border-t border-tm-amber pt-2.5">
          <p className="text-[14px] text-tm-amber-ink">{quiet.support}</p>
          <div className="mt-2.5 flex gap-2">
            <a
              href="tel:116123"
              className="flex min-h-11 flex-1 items-center justify-center rounded-[14px] border border-tm-amber bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-amber uppercase"
            >
              Samaritans 116 123
            </a>
            <a
              href="tel:112"
              className="flex min-h-11 flex-1 items-center justify-center rounded-[14px] border border-tm-amber bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-amber uppercase"
            >
              Emergency 112
            </a>
          </div>
        </div>
      )}
    </Card>
  );
}

function SafetyCard({ text }: { text: string }) {
  return (
    <Card tone="amber">
      <Eyebrow color="bg-tm-amber">Support</Eyebrow>
      <p className="text-[14px] text-tm-amber-ink">{text}</p>
      <div className="mt-2.5 flex gap-2">
        <a
          href="tel:116123"
          className="flex min-h-11 flex-1 items-center justify-center rounded-[14px] border border-tm-amber bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-amber uppercase"
        >
          Samaritans 116 123
        </a>
        <a
          href="tel:112"
          className="flex min-h-11 flex-1 items-center justify-center rounded-[14px] border border-tm-amber bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-amber uppercase"
        >
          Emergency 112
        </a>
      </div>
    </Card>
  );
}

function EncouragementCard({
  encouragement,
  survival,
}: {
  encouragement: MindData["encouragement"];
  survival: boolean;
}) {
  return (
    <Card tone={survival ? "amber" : "default"}>
      <Eyebrow color={survival ? "bg-tm-amber" : TONE_BAR[encouragement.tone]}>Today</Eyebrow>
      <p className="font-tm-disp text-2xl leading-[1.15] tracking-tight">{encouragement.headline}</p>
      <p className={cn("mt-2 max-w-[65ch] text-[14px] leading-relaxed", survival ? "text-tm-amber-ink" : "text-tm-ink")}>
        {encouragement.body}
      </p>
    </Card>
  );
}

function DueCard({
  due,
  instruments,
  survival,
}: {
  due: DueItem[];
  instruments: InstrumentView[];
  survival: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const active = open ? (instruments.find((i) => i.key === open) ?? null) : null;

  return (
    <Card tone={survival ? "amber" : "default"}>
      <div className="flex items-center justify-between">
        <Eyebrow color={survival ? "bg-tm-amber" : "bg-tm-purple"} className="mb-0">
          {survival ? "Floor check-ins" : "Check-ins due"}
        </Eyebrow>
        <span className="font-tm-mono text-[11.5px] text-tm-dim">{due.length} due</span>
      </div>

      {active ? (
        <div className="mt-2">
          <Questionnaire instrument={active} onClose={() => setOpen(null)} />
        </div>
      ) : due.length === 0 ? (
        <p className="mt-2 text-[13px] text-tm-dim">
          Nothing due. Re-taking inside the cadence measures noise, not change.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {due.map((d) => (
            <button
              key={d.key}
              onClick={() => setOpen(d.key)}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3.5 py-2.5 text-left transition-transform duration-150 active:scale-[0.98]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{d.name}</span>
                <span className="block font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">
                  {dueLabel(d)}
                </span>
              </span>
              <span className="shrink-0 font-tm-mono text-[11.5px] text-tm-dim">open</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function Questionnaire({ instrument, onClose }: { instrument: InstrumentView; onClose: () => void }) {
  const { actions } = useTimento();
  const [answers, setAnswers] = useState<(number | null)[]>(() => instrument.items.map(() => null));
  const answered = answers.filter((a) => a !== null).length;
  const complete = answered === instrument.items.length;

  const submit = () => {
    if (!complete) return;
    const values: number[] = [];
    for (const a of answers) {
      if (a === null) return;
      values.push(a);
    }
    actions.submitAssessment(instrument.key, values);
    onClose();
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-tm-disp text-[17px]">{instrument.name}</span>
        <span className="font-tm-mono text-[11.5px] text-tm-dim">
          {answered}/{instrument.items.length} answered
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-tm-grid">
        <div
          className="h-full bg-tm-purple transition-all"
          style={{ width: `${(answered / instrument.items.length) * 100}%` }}
        />
      </div>
      <p className="mt-2 font-tm-mono text-[11.5px] tracking-[0.08em] text-tm-dim uppercase">
        {instrument.source}
      </p>

      <ol className="mt-2 flex flex-col gap-3">
        {instrument.items.map((item, i) => {
          const anchors = instrument.itemScaleLabels?.[i] ?? instrument.scaleLabels;
          const chosen = answers[i];
          return (
            <li key={item} className="border-t border-tm-rule pt-2.5">
              <p className="text-[13px] leading-snug">
                <span className="font-tm-mono text-[11.5px] text-tm-dim">{i + 1}. </span>
                {item}
              </p>
              <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label={`Item ${i + 1}: ${item}`}>
                {anchors.map((anchor, value) => (
                  <button
                    key={anchor}
                    role="radio"
                    aria-checked={chosen === value}
                    aria-label={`${value} — ${anchor}`}
                    onClick={() =>
                      setAnswers((prev) => prev.map((a, n) => (n === i ? value : a)))
                    }
                    className={cn(
                      "h-11 flex-1 cursor-pointer rounded-[14px] border font-tm-mono text-[11.5px] transition-transform duration-150 active:scale-[0.98]",
                      chosen === value
                        ? "border-tm-stamp bg-tm-stamp text-tm-onstamp"
                        : "border-tm-rule bg-tm-panel text-tm-dim",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">
                {chosen === null ? "not answered" : anchors[chosen].toLowerCase()}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[11.5px] text-tm-dim">{instrument.note}</p>

      <div className="mt-2.5 flex gap-2">
        <button
          onClick={submit}
          disabled={!complete}
          className={cn(
            "min-h-11 flex-1 cursor-pointer rounded-[14px] px-4 font-tm-mono text-[11.5px] tracking-[0.12em] uppercase transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100",
            complete ? "bg-tm-stamp text-tm-onstamp" : "bg-tm-soft text-tm-dim2",
          )}
        >
          {complete ? "Submit" : `${instrument.items.length - answered} left`}
        </button>
        <button
          onClick={onClose}
          className="min-h-11 cursor-pointer rounded-[14px] border border-tm-rule px-4 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase transition-transform duration-150 active:scale-[0.98]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function HistoryCard({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <Card>
        <Eyebrow color="bg-tm-blue">History</Eyebrow>
        <p className="text-[13px] text-tm-dim">
          No check-ins recorded yet. The first one is a reading; the second one is a line.
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">History</Eyebrow>
      <div className="flex flex-col gap-3">
        {history.map((h) => (
          <div key={h.key} className="border-t border-tm-rule pt-2.5 first:border-0 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium">{h.name}</span>
              {h.latest && (
                <span
                  className={cn(
                    "rounded-[18px] border px-2.5 py-[3px] font-tm-mono text-[11.5px] tracking-[0.08em] uppercase",
                    TONE_BORDER[h.latest.tone],
                    TONE_TEXT[h.latest.tone],
                  )}
                >
                  {h.latest.band}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div className="font-tm-disp text-2xl leading-none">
                {h.latest ? h.latest.score : "—"}
                <span className="ml-1 font-tm-mono text-[11.5px] text-tm-dim">/ {h.maxScore}</span>
              </div>
              <Sparkline points={h.points} maxScore={h.maxScore} tone={h.latest?.tone ?? "blue"} />
            </div>
            <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">{h.trend.framing}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Sparkline({
  points,
  maxScore,
  tone,
}: {
  points: { date: string; score: number }[];
  maxScore: number;
  tone: BandTone;
}) {
  const W = 120;
  const H = 30;
  if (points.length === 0) return null;
  const mark = TONE_MARK[tone];
  const x = (i: number) => (points.length === 1 ? W / 2 : 2 + (i / (points.length - 1)) * (W - 4));
  const y = (v: number) => H - 3 - (Math.min(Math.max(v, 0), maxScore) / Math.max(1, maxScore)) * (H - 6);
  const label = points.map((p) => `${p.date}: ${p.score}`).join(", ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[30px] w-[120px]" role="img" aria-label={`Score history — ${label}`}>
      <line x1={0} x2={W} y1={H - 3} y2={H - 3} className="stroke-tm-grid" strokeWidth="1" />
      {points.length > 1 && (
        <path
          d={points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ")}
          className={cn(mark, "fill-none")}
          strokeWidth="1.5"
        />
      )}
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.score)} r={i === points.length - 1 ? 3 : 2} className={mark} />
      ))}
    </svg>
  );
}

function IntentionsCard({
  intentions,
  suggestions,
}: {
  intentions: IntentionView[];
  suggestions: Suggestion[];
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow color="bg-tm-green" className="mb-0">
          If — then plans
        </Eyebrow>
        <span className="font-tm-mono text-[11.5px] text-tm-dim">
          {intentions.reduce((s, i) => s + i.wins, 0)} wins
        </span>
      </div>
      <p className="mt-1 mb-2 text-[11.5px] text-tm-dim">
        Pre-deciding the response beats deciding in the moment. Moderate-to-strong evidence, and the
        moment is exactly when the deciding machinery is worst.
      </p>
      {intentions.length === 0 ? (
        <p className="text-[13px] text-tm-dim">No plans yet. One is enough to start.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {intentions.map((i) => (
            <IntentionRow key={i.id} intention={i} />
          ))}
        </div>
      )}
      <IntentionBuilder suggestions={suggestions} />
    </Card>
  );
}

function IntentionRow({ intention }: { intention: IntentionView }) {
  const { actions } = useTimento();
  return (
    <div className="rounded-[14px] border border-tm-rule bg-tm-panel px-3 py-2.5">
      <p className="text-[13px] leading-snug">
        <span className="font-tm-mono text-[11.5px] text-tm-dim">IF </span>
        {intention.trigger}
        <span className="font-tm-mono text-[11.5px] text-tm-dim"> THEN </span>
        {intention.action}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-tm-mono text-[11.5px] text-tm-dim">
          {intention.wins} win{intention.wins === 1 ? "" : "s"} logged
        </span>
        <button
          onClick={() => actions.markIntentionWin(intention.id)}
          aria-label={`Log a win for: if ${intention.trigger} then ${intention.action}`}
          className="min-h-11 cursor-pointer rounded-[14px] border border-tm-green px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-green uppercase transition-transform duration-150 active:scale-[0.98]"
        >
          Ran it
        </button>
      </div>
    </div>
  );
}

/** Survival: the top plan, read-only apart from the win. No builder, no new obligations. */
function IntentionCard({ intention, survival }: { intention: IntentionView; survival: boolean }) {
  return (
    <Card tone={survival ? "amber" : "default"}>
      <Eyebrow color={survival ? "bg-tm-amber" : "bg-tm-green"}>Your plan</Eyebrow>
      <IntentionRow intention={intention} />
    </Card>
  );
}

function IntentionBuilder({ suggestions }: { suggestions: Suggestion[] }) {
  const { actions } = useTimento();
  const [trigger, setTrigger] = useState("");
  const [action, setAction] = useState("");
  const ready = trigger.trim().length > 0 && action.trim().length > 0;

  return (
    <form
      className="mt-3 border-t border-tm-rule pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        actions.addIntention(trigger.trim(), action.trim());
        setTrigger("");
        setAction("");
      }}
    >
      <p className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">Write a plan</p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        <label className="flex items-center gap-2">
          <span className="w-9 font-tm-mono text-[11.5px] text-tm-dim">IF</span>
          <input
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="it's 21:00 and I'm tired"
            aria-label="If — the situation"
            className="min-h-11 flex-1 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 text-[14px] focus:border-tm-ink"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-9 font-tm-mono text-[11.5px] text-tm-dim">THEN</span>
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="run the close-out ritual, then go up"
            aria-label="Then — the pre-decided action"
            className="min-h-11 flex-1 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 text-[14px] focus:border-tm-ink"
          />
        </label>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-2">
          <p className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">
            From your own trigger map
          </p>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <button
                key={`${s.signal}-${s.action}`}
                type="button"
                onClick={() => {
                  setTrigger(s.trigger);
                  setAction(s.action);
                }}
                aria-label={`Use suggestion: if ${s.trigger} then ${s.action}`}
                className="min-h-11 cursor-pointer rounded-[14px] bg-tm-soft px-3 py-2 text-left text-[13px] leading-snug transition-transform duration-150 active:scale-[0.98]"
              >
                <span className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">
                  {s.signal}{" "}
                </span>
                if {s.trigger} → {s.action}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!ready}
        className={cn(
          "mt-2.5 min-h-11 w-full cursor-pointer rounded-[14px] px-4 font-tm-mono text-[11.5px] tracking-[0.12em] uppercase transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100",
          ready ? "bg-tm-stamp text-tm-onstamp" : "bg-tm-soft text-tm-dim2",
        )}
      >
        Save plan
      </button>
    </form>
  );
}

function ReflectionCard({
  prompt,
  reflections,
}: {
  prompt: string;
  reflections: MindData["reflections"];
}) {
  const { actions, date } = useTimento();
  const todays = reflections.find((r) => r.date === date) ?? null;
  const [asked, setAsked] = useState(prompt);
  const [response, setResponse] = useState("");
  const [win, setWin] = useState("");
  const ready = response.trim().length > 0;

  // Another angle on the same day — the mindset set, entered at today's index.
  const swap = () => {
    const start = MINDSET_PROMPTS.indexOf(asked);
    const next =
      start === -1
        ? mindsetPromptForDate(date)
        : MINDSET_PROMPTS[(start + 1) % MINDSET_PROMPTS.length];
    setAsked(next);
  };

  return (
    <Card>
      <Eyebrow color="bg-tm-yellow">Reflection</Eyebrow>
      <p className="text-[13px] font-medium">{todays ? todays.prompt : asked}</p>
      {!todays && (
        <button
          onClick={swap}
          className="mt-1.5 min-h-11 cursor-pointer font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase underline"
        >
          Another angle
        </button>
      )}

      {todays ? (
        <div className="mt-2 rounded-[14px] bg-tm-soft px-3 py-2.5">
          <p className="text-[14px]">{todays.response}</p>
          {todays.win && (
            <p className="mt-1 font-tm-mono text-[11.5px] text-tm-green">win · {todays.win}</p>
          )}
          <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">logged today</p>
        </div>
      ) : (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            actions.saveReflection(asked, response.trim(), win.trim() || undefined);
            setResponse("");
            setWin("");
          }}
        >
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={3}
            aria-label="Reflection response"
            placeholder="Two lines is plenty."
            className="w-full rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 py-2 text-[14px] focus:border-tm-ink"
          />
          <input
            value={win}
            onChange={(e) => setWin(e.target.value)}
            placeholder="one win today (optional)"
            aria-label="One win today, optional"
            className="mt-1.5 min-h-11 w-full rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 text-[14px] focus:border-tm-ink"
          />
          <button
            type="submit"
            disabled={!ready}
            className={cn(
              "mt-2 min-h-11 w-full cursor-pointer rounded-[14px] px-4 font-tm-mono text-[11.5px] tracking-[0.12em] uppercase transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100",
              ready ? "bg-tm-stamp text-tm-onstamp" : "bg-tm-soft text-tm-dim2",
            )}
          >
            Save reflection
          </button>
        </form>
      )}

      {reflections.length > 0 && (
        <div className="mt-3 border-t border-tm-rule pt-2.5">
          <p className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">Recent</p>
          <div className="mt-1.5 flex flex-col gap-2">
            {reflections.slice(0, 4).map((r) => (
              <div key={r.date}>
                <p className="font-tm-mono text-[11.5px] text-tm-dim">{r.date}</p>
                <p className="text-[13px] leading-snug">{r.response}</p>
                {r.win && <p className="font-tm-mono text-[11.5px] text-tm-green">win · {r.win}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
