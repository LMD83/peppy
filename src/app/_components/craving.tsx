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
const CHIP = "inline-flex min-h-11 cursor-pointer items-center rounded-[22px] border px-4 font-tm-mono text-[13px]";
const QUIET = "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-3 font-tm-mono text-[13px] text-tm-dim underline";

export function CravingLogger() {
  const { today, actions } = useTimento();
  const [step, setStep] = useState<Step>("idle");
  const [signal, setSignal] = useState<CravingEntry["signal"] | null>(null);
  const [emotionWord, setEmotionWord] = useState("");
  const [entryId, setEntryId] = useState<string | null>(null);
  const [loggedAt, setLoggedAt] = useState("");
  if (!today) return null;

  const logs = today.cravingsToday;
  const count = logs.length;

  const undoLast = () => {
    const last = logs[logs.length - 1];
    if (last) actions.undoCraving(last.id);
  };

  const reset = () => {
    setStep("idle");
    setSignal(null);
    setEmotionWord("");
    setEntryId(null);
  };

  /**
   * The whole P0: the write happens here, on the very first tap — time and
   * signal, guaranteed saved. Everything past this point only enriches a row
   * that already exists; walking away mid-flow leaves nothing missing from
   * the map.
   */
  const commitSignal = async (key: CravingEntry["signal"]) => {
    setSignal(key);
    const time = localTime();
    const id = await actions.logCraving({ time, signal: key });
    if (!id) {
      setSignal(null);
      return;
    }
    setLoggedAt(time);
    setEntryId(id);
    setStep("after");
  };

  const commitAfter = (after?: CravingEntry["afterState"]) => {
    if (entryId) {
      const trimmed = signal === "emotion" && emotionWord.trim() ? emotionWord.trim() : undefined;
      actions.enrichCraving(entryId, { afterState: after, emotionWord: trimmed });
    }
    setStep("action");
  };

  const commitAction = (action?: CravingEntry["action"]) => {
    if (entryId && action !== undefined) actions.enrichCraving(entryId, { action });
    const goBreathe = action === "rode";
    setSignal(null);
    setEmotionWord("");
    setEntryId(null);
    if (goBreathe) setStep("breathe");
    else {
      setStep("logged");
      setTimeout(() => setStep("idle"), 2000);
    }
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
                onClick={() => void commitSignal(s.key)}
                className={cn(CHIP, "border-tm-rule-strong bg-tm-soft")}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep("breathe")} className={cn(QUIET, "-ml-3 mt-1")}>
            Breathe 2 min
          </button>
          <p className="mt-1 font-tm-mono text-[11.5px] leading-relaxed text-tm-dim">
            {count > 0 ? `${count} logged today · ` : ""}
            One tap logs it. Two weeks builds the full picture — see Trigger map.
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
          <p role="status" className="mb-2 font-tm-mono text-[11.5px] text-tm-green">
            Logged {loggedAt} — the map has it.
          </p>
          <p className="mb-2 text-[14px]">
            <b>{SIGNALS.find((s) => s.key === signal)?.label}.</b> And after — what would eating it get you?
          </p>
          {signal === "emotion" && (
            <input
              value={emotionWord}
              onChange={(e) => setEmotionWord(e.target.value)}
              placeholder="one word for it"
              aria-label="One word for the emotion"
              className="mb-2 min-h-11 w-full rounded-[10px] border border-tm-rule-strong px-3 py-2 text-base outline-none focus:border-tm-ink"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {AFTER.map((a) => (
              <button
                key={a.key}
                onClick={() => commitAfter(a.key)}
                className={cn(CHIP, "border-tm-rule-strong bg-tm-soft")}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button onClick={() => commitAfter(undefined)} className={cn(QUIET, "-ml-3 mt-1")}>
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
                onClick={() => commitAction(a.key)}
                className={cn(
                  CHIP,
                  a.key === "rode" ? "border-tm-green text-tm-green" : "border-tm-rule-strong bg-tm-soft",
                )}
              >
                {a.label}
              </button>
            ))}
            <button onClick={() => commitAction(undefined)} className={QUIET}>
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
