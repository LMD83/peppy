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

export function CravingLogger() {
  const { today, actions } = useTimento();
  const [step, setStep] = useState<Step>("idle");
  const [signal, setSignal] = useState<CravingEntry["signal"] | null>(null);
  const [emotionWord, setEmotionWord] = useState("");
  const [afterState, setAfterState] = useState<CravingEntry["afterState"]>(undefined);
  if (!today) return null;

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
                className="cursor-pointer rounded-[20px] border border-tm-rule bg-tm-soft px-3.5 py-2 font-tm-mono text-[11px]"
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
            {today.cravingsToday > 0 ? `${today.cravingsToday} logged today · ` : ""}
            Two taps per urge. Two weeks builds your trigger map — see Research.
          </p>
        </>
      )}

      {step === "after" && signal && (
        <div>
          <p className="mb-2 text-[12.5px]">
            <b>{SIGNALS.find((s) => s.key === signal)?.label}.</b> And after — what would eating it get you?
          </p>
          {signal === "emotion" && (
            <input
              value={emotionWord}
              onChange={(e) => setEmotionWord(e.target.value)}
              placeholder="one word for it"
              className="mb-2 w-full rounded-lg border border-tm-rule px-3 py-2 text-sm outline-none focus:border-tm-ink"
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
                className="cursor-pointer rounded-[20px] border border-tm-rule bg-tm-soft px-3.5 py-2 font-tm-mono text-[11px]"
              >
                {a.label}
              </button>
            ))}
          </div>
          <button onClick={() => setStep("action")} className="mt-2 cursor-pointer font-tm-mono text-[10px] text-tm-dim underline">
            skip
          </button>
        </div>
      )}

      {step === "action" && (
        <div>
          <p className="mb-2 text-[12.5px]">What happened?</p>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                onClick={() => commit(a.key)}
                className={cn(
                  "cursor-pointer rounded-[20px] border px-3.5 py-2 font-tm-mono text-[11px]",
                  a.key === "rode" ? "border-tm-green text-tm-green" : "border-tm-rule bg-tm-soft",
                )}
              >
                {a.label}
              </button>
            ))}
            <button onClick={() => commit(undefined)} className="cursor-pointer px-2 font-tm-mono text-[10px] text-tm-dim underline">
              just log it
            </button>
          </div>
          <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">Riding it out opens the 2-minute breathing timer.</p>
        </div>
      )}

      {step === "breathe" && (
        <div>
          <p className="text-[12.5px]"><b>Urge surfing.</b> Double inhale, long exhale. The wave peaks and passes.</p>
          <BreathingTimerInline onDone={reset} />
          <button onClick={reset} className="mt-2 w-full cursor-pointer py-1 font-tm-mono text-[10px] text-tm-dim underline">
            done early
          </button>
        </div>
      )}

      {step === "logged" && (
        <p role="status" className="py-2 text-center font-tm-mono text-[11px] text-tm-green">
          Logged; loop continues.
        </p>
      )}
    </Card>
  );
}
