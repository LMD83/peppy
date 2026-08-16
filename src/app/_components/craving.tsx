"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import { localTime, type CravingEntry } from "../_lib/types";
import { Card, Eyebrow, TmChip } from "./ui";
import { BreathingTimerInline } from "./breathe";

const SIGNALS: { key: CravingEntry["signal"]; label: string }[] = [
  { key: "tired", label: "Tired" },
  { key: "emotion", label: "Emotion" },
  { key: "cue", label: "Saw it" },
  { key: "bored", label: "Bored" },
  { key: "hungry", label: "Hungry" },
];

const AFTER: { key: NonNullable<CravingEntry["afterState"]>; label: string }[] = [
  { key: "relief", label: "Relief" },
  { key: "guilt", label: "Guilt" },
  { key: "numb", label: "Numb" },
  { key: "satisfied", label: "Satisfied" },
];

const ACTIONS: { key: NonNullable<CravingEntry["action"]>; label: string }[] = [
  { key: "rode", label: "Rode it out" },
  { key: "substitute", label: "Substitute" },
  { key: "ate", label: "Ate it" },
];

type Step = "idle" | "after" | "action" | "breathe" | "logged";

export function CravingLogger({
  embedded = false,
  onDone,
}: {
  embedded?: boolean;
  onDone?: () => void;
} = {}) {
  const { today, actions } = useTimento();
  const [step, setStep] = useState<Step>("idle");
  const [signal, setSignal] = useState<CravingEntry["signal"] | null>(null);
  const [emotionWord, setEmotionWord] = useState("");
  const [afterState, setAfterState] = useState<CravingEntry["afterState"]>(undefined);
  if (!today) return null;

  const logs = today.cravingsToday;
  const count = logs.length;

  const commit = (action?: CravingEntry["action"]) => {
    if (!signal) return;
    actions.logCraving({
      time: localTime(),
      signal,
      emotionWord: signal === "emotion" && emotionWord.trim() ? emotionWord.trim() : undefined,
      afterState,
      action,
    });
    setSignal(null);
    setEmotionWord("");
    setAfterState(undefined);
    if (action === "rode") setStep("breathe");
    else {
      setStep("logged");
      setTimeout(() => {
        setStep("idle");
        onDone?.();
      }, 1200);
    }
  };

  const reset = () => {
    setStep("idle");
    setSignal(null);
    setEmotionWord("");
    setAfterState(undefined);
    onDone?.();
  };

  const undoLast = () => {
    const last = logs[logs.length - 1];
    if (last) actions.undoCraving(last.id);
  };

  const body = (
    <>
      {step === "idle" && (
        <>
          <div className="flex flex-wrap gap-2">
            {SIGNALS.map((s) => (
              <TmChip
                key={s.key}
                onClick={() => {
                  setSignal(s.key);
                  setStep("after");
                }}
              >
                {s.label}
              </TmChip>
            ))}
          </div>
          <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
            {count > 0 ? `${count} logged today · ` : ""}
            Two taps per urge. Two weeks builds your trigger map. See Research.
          </p>
          {count > 0 && (
            <div className="mt-3 border-t border-tm-grid pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase">
                  Today&apos;s log
                </span>
                <button
                  type="button"
                  onClick={undoLast}
                  className="cursor-pointer font-tm-mono text-[10px] tracking-[0.1em] text-tm-red uppercase"
                >
                  Undo last
                </button>
              </div>
              <ul aria-label="Today's craving log" className="flex flex-col gap-1">
                {logs.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between gap-2 font-tm-mono text-[11px] text-tm-ink"
                  >
                    <span>
                      {c.time} · {c.signal}
                      {c.action ? ` · ${c.action}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {step === "after" && signal && (
        <div>
          <p className="mb-2 text-[12.5px]">
            <b>{SIGNALS.find((s) => s.key === signal)?.label}.</b> And after: what would eating it get you?
          </p>
          {signal === "emotion" && (
            <input
              value={emotionWord}
              onChange={(e) => setEmotionWord(e.target.value)}
              placeholder="one word for it"
              className="mb-2 w-full rounded-[10px] border border-tm-rule bg-tm-panel px-3 py-2 text-sm text-tm-ink outline-none focus:border-tm-ink focus-visible:ring-2 focus-visible:ring-tm-ink/25"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {AFTER.map((a) => (
              <TmChip
                key={a.key}
                onClick={() => {
                  setAfterState(a.key);
                  setStep("action");
                }}
              >
                {a.label}
              </TmChip>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep("action")}
            className="mt-2 cursor-pointer font-tm-mono text-[10px] text-tm-dim underline"
          >
            skip
          </button>
        </div>
      )}

      {step === "action" && (
        <div>
          <p className="mb-2 text-[12.5px]">What happened?</p>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <TmChip
                key={a.key}
                tone={a.key === "rode" ? "green" : "default"}
                onClick={() => commit(a.key)}
                className={cn(a.key === "rode" && "border-tm-green text-tm-green")}
              >
                {a.label}
              </TmChip>
            ))}
            <button
              type="button"
              onClick={() => commit(undefined)}
              className="cursor-pointer px-2 font-tm-mono text-[10px] text-tm-dim underline"
            >
              just log it
            </button>
          </div>
          <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
            Riding it out opens the 2-minute breathing timer.
          </p>
        </div>
      )}

      {step === "breathe" && (
        <div>
          <p className="text-[12.5px]">
            <b>Urge surfing.</b> Double inhale, long exhale. The wave peaks and passes.
          </p>
          <BreathingTimerInline onDone={reset} />
          <button
            type="button"
            onClick={reset}
            className="mt-2 w-full cursor-pointer py-1 font-tm-mono text-[10px] text-tm-dim underline"
          >
            done early
          </button>
        </div>
      )}

      {step === "logged" && (
        <p role="status" className="py-2 text-center font-tm-mono text-[11px] text-tm-green">
          Logged; loop continues.
        </p>
      )}
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <Card>
      <Eyebrow color="bg-tm-red">Craving hit?</Eyebrow>
      {body}
    </Card>
  );
}
