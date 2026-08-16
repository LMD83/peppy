"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import { localTime, type CravingEntry } from "../_lib/types";
import { Card, Eyebrow } from "./ui";
import { BreathingTimerInline } from "./today-tab";

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

/** 44×44 minimum (2.5.8), on every control in this card — including the three
 *  that used to be bare underlined words a few pixels tall. */
const CHIP = "inline-flex min-h-11 cursor-pointer items-center rounded-[22px] border px-4 font-tm-mono text-[12.5px]";
const QUIET = "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-3 font-tm-mono text-[12.5px] text-tm-dim underline";

export function CravingLogger() {
  const { today, actions } = useTimento();
  const [step, setStep] = useState<Step>("idle");
  const [signal, setSignal] = useState<CravingEntry["signal"] | null>(null);
  const [emotionWord, setEmotionWord] = useState("");
  const [afterState, setAfterState] = useState<CravingEntry["afterState"]>(undefined);
  if (!today) return null;

  const logs = today.cravingsToday;
  const count = logs.length;

  const undoLast = () => {
    const last = logs[logs.length - 1];
    if (last) actions.undoCraving(last.id);
  };

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
      setTimeout(() => setStep("idle"), 2000);
    }
  };

  const reset = () => {
    setStep("idle");
    setSignal(null);
    setEmotionWord("");
    setAfterState(undefined);
  };

  return (
    <Card>
      <Eyebrow color="bg-tm-red">Craving hit?</Eyebrow>

      {step === "idle" && (
        <>
          <div className="flex flex-wrap gap-2">
            {SIGNALS.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setSignal(s.key);
                  setStep("after");
                }}
                className={cn(CHIP, "border-tm-rule-strong bg-tm-soft")}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2.5 font-tm-mono text-[11.5px] leading-relaxed text-tm-dim">
            {count > 0 ? `${count} logged today · ` : ""}
            Two taps per urge. Two weeks builds your trigger map — see Research.
          </p>
          {count > 0 && (
            <div className="mt-3 border-t border-tm-grid pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
                  Today&apos;s log
                </span>
                <button
                  type="button"
                  onClick={undoLast}
                  className={cn(QUIET, "text-tm-red")}
                >
                  Undo last
                </button>
              </div>
              <ul aria-label="Today's craving log" className="flex flex-col gap-1">
                {logs.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between gap-2 font-tm-mono text-[11.5px] text-tm-ink"
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
          <p className="mb-2 text-[14px]">
            <b>{SIGNALS.find((s) => s.key === signal)?.label}.</b> And after — what would eating it get you?
          </p>
          {signal === "emotion" && (
            <input
              value={emotionWord}
              onChange={(e) => setEmotionWord(e.target.value)}
              placeholder="one word for it"
              aria-label="One word for the emotion"
              className="mb-2 min-h-11 w-full rounded-lg border border-tm-rule-strong px-3 py-2 text-base outline-none focus:border-tm-ink"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {AFTER.map((a) => (
              <button
                key={a.key}
                onClick={() => {
                  setAfterState(a.key);
                  setStep("action");
                }}
                className={cn(CHIP, "border-tm-rule-strong bg-tm-soft")}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button onClick={() => setStep("action")} className={cn(QUIET, "-ml-3 mt-1")}>
            skip
          </button>
        </div>
      )}

      {step === "action" && (
        <div>
          <p className="mb-2 text-[14px]">What happened?</p>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                onClick={() => commit(a.key)}
                className={cn(
                  CHIP,
                  a.key === "rode" ? "border-tm-green text-tm-green" : "border-tm-rule-strong bg-tm-soft",
                )}
              >
                {a.label}
              </button>
            ))}
            <button onClick={() => commit(undefined)} className={QUIET}>
              just log it
            </button>
          </div>
          <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">Riding it out opens the 2-minute breathing timer.</p>
        </div>
      )}

      {step === "breathe" && (
        <div>
          <p className="text-[14px]"><b>Urge surfing.</b> Double inhale, long exhale. The wave peaks and passes.</p>
          <BreathingTimerInline onDone={reset} />
          <button onClick={reset} className={cn(QUIET, "mt-2 w-full")}>
            done early
          </button>
        </div>
      )}

      {step === "logged" && (
        <p role="status" className="py-2 text-center font-tm-mono text-[14px] text-tm-green">
          Logged; loop continues.
        </p>
      )}
    </Card>
  );
}
