"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  parseDoseUtterance,
  parseFoodUtterance,
  type DoseParse,
  type FoodParse,
} from "@convex/tm/logic-ingest";
import { timingLabel } from "@convex/tm/logic-stack";
import { useTimento } from "../_lib/backend";
import type { HandsFreeData, MealSlot } from "../_lib/types";
import { Card, Eyebrow } from "./ui";

/**
 * Hands-free — logging without typing.
 *
 * Two ways in, one promise. The setup half turns a phone into a logger: seven
 * numbered steps, every field a button that copies rather than a box to retype,
 * and a "test it now" that fires the real endpoint from this browser so the
 * proof arrives before anyone picks up their phone. The talking half is the
 * push-to-talk control, for when the phone is already in your hand.
 *
 * The rule the whole screen is built around: **what you said is never thrown
 * away.** A capture is written the moment speech ends — before any parsing —
 * and it stays on the screen with its timestamp until you have said what to do
 * with it. A phrase the parser cannot resolve becomes a row of buttons, not an
 * error, and never a dose written on a guess.
 */

type Capture = {
  id: string;
  /** Wall-clock stamp of the moment speech ended, not of the parse. */
  at: number;
  text: string;
  status: "logged" | "unresolved" | "nothing-heard";
  detail: string;
  /** Tappable ways out, when the parser could not choose for you. */
  choices: Choice[];
};

type Choice = { id: string; label: string; run: () => void };

const CAPTURE_KEY = "timento.handsfree.captures";
const MAX_CAPTURES = 12;

/* Captures live in localStorage, which is external, mutable state. Bind it the
   way backend.tsx binds the session — a stable server snapshot plus a client
   read — rather than loading it in an effect, which mismatches on hydration. */
const NO_CAPTURES: Capture[] = [];
const captureListeners = new Set<() => void>();
let captureCache: Capture[] | null = null;

function parseCaptures(raw: string | null): Capture[] {
  if (raw === null) return NO_CAPTURES;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NO_CAPTURES;
    const rows: Capture[] = [];
    for (const row of parsed) {
      if (typeof row !== "object" || row === null) continue;
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.at !== "number" || typeof r.text !== "string") continue;
      rows.push({
        id: r.id,
        at: r.at,
        text: r.text,
        status: r.status === "logged" || r.status === "nothing-heard" ? r.status : "unresolved",
        detail: typeof r.detail === "string" ? r.detail : "",
        // Handlers cannot survive a reload; the words are what matter.
        choices: [],
      });
    }
    return rows.slice(0, MAX_CAPTURES);
  } catch {
    /* A broken cache is not worth an error screen. */
    return NO_CAPTURES;
  }
}

function readCaptures(): Capture[] {
  if (captureCache === null) {
    try {
      captureCache = parseCaptures(window.localStorage.getItem(CAPTURE_KEY));
    } catch {
      captureCache = NO_CAPTURES;
    }
  }
  return captureCache;
}

function subscribeCaptures(cb: () => void) {
  captureListeners.add(cb);
  return () => captureListeners.delete(cb);
}

function writeCaptures(rows: Capture[]) {
  captureCache = rows.slice(0, MAX_CAPTURES);
  try {
    window.localStorage.setItem(
      CAPTURE_KEY,
      JSON.stringify(captureCache.map(({ choices: _choices, ...rest }) => rest)),
    );
  } catch {
    /* Private browsing, a full quota — the on-screen list still holds. */
  }
  captureListeners.forEach((fn) => fn());
}


/* ===== speech recognition, feature-detected ===== */

type SpeechResultLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechResultLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ===== small pieces ===== */

function stamp(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Copying is the only way a token or a URL should ever move. Retyping a
 * 32-character secret at the end of a bad day is a design failure.
 */
function CopyButton({ value, what }: { value: string; what: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
        if (!clip) return;
        void clip.writeText(value).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
      className="min-h-11 min-w-11 shrink-0 rounded-lg border border-tm-rule-strong bg-tm-panel px-3 text-[14px] font-medium text-tm-ink"
    >
      {/* A word, not a hue — the state is readable with colour switched off. */}
      {copied ? "Copied ✓" : "Copy"}
      <span className="sr-only"> {what}</span>
    </button>
  );
}

function Field({ label, value, what }: { label: string; value: string; what: string }) {
  return (
    <div className="mt-2 flex items-start gap-2">
      <div className="min-w-0 flex-1 rounded-lg border border-tm-rule bg-tm-soft px-3 py-2">
        <div className="font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase">
          {label}
        </div>
        <div className="mt-1 font-tm-mono text-[14px] break-all whitespace-pre-wrap">{value}</div>
      </div>
      <CopyButton value={value} what={what} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true" aria-label="Loading hands-free setup">
      {[0, 1].map((i) => (
        <Card key={i}>
          <div className="h-3 w-24 rounded bg-tm-soft" />
          <div className="mt-3 h-11 w-full rounded bg-tm-soft" />
          <div className="mt-2 h-11 w-2/3 rounded bg-tm-soft" />
        </Card>
      ))}
    </div>
  );
}

/* ===== the tab ===== */

export function HandsFreePanel() {
  const { handsFree } = useTimento();
  if (!handsFree) return <Skeleton />;
  return <HandsFree data={handsFree} />;
}

function HandsFree({ data }: { data: HandsFreeData }) {
  const { stack, fuel, actions, date } = useTimento();
  const captures = useSyncExternalStore(subscribeCaptures, readCaptures, () => NO_CAPTURES);
  const [status, setStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [typed, setTyped] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(!data.survival);
  const recRef = useRef<RecognitionLike | null>(null);

  const canSpeak = useMemo(() => recognitionCtor() !== null, []);



  const pushCapture = useCallback((capture: Capture) => {
    writeCaptures([capture, ...readCaptures()].slice(0, MAX_CAPTURES));
  }, []);

  const settle = useCallback((id: string, detail: string) => {
    writeCaptures(
      readCaptures().map((c) =>
        c.id === id ? { ...c, status: "logged" as const, detail, choices: [] } : c,
      ),
    );
    setStatus(`Logged ${detail}.`);
  }, []);

  /**
   * Everything that was said lands here — a real transcript, an empty one, a
   * typed fallback. The capture row is written first and unconditionally; only
   * then is the phrase offered to the parser.
   */
  const handleUtterance = useCallback(
    (text: string) => {
      const id = `c${Date.now()}${Math.round(Math.random() * 1000)}`;
      const at = Date.now();
      const spoken = text.trim();

      if (spoken === "") {
        pushCapture({
          id,
          at,
          text: "",
          status: "nothing-heard",
          detail: "Nothing was heard. Nothing was logged.",
          choices: [],
        });
        setStatus("Nothing was heard. Nothing was logged.");
        return;
      }

      const items = stack?.items ?? [];
      const dose: DoseParse = parseDoseUtterance(spoken, items);
      const foods = fuel?.foods ?? [];
      const meal: FoodParse = parseFoodUtterance(spoken, foods);

      const logDose = (itemIds: string[], timing: string, label: string) => () => {
        for (const itemId of itemIds) actions.logDose(itemId, timing, true);
        settle(id, `${label} · ${timingLabel(timing)}`);
      };
      const logFood =
        (foodKey: string, grams: number, slot: MealSlot, label: string) => () => {
          actions.logFood(slot, foodKey, grams);
          settle(id, `${label} · ${grams} g`);
        };

      if (dose.match !== null) {
        const m = dose.match;
        pushCapture({
          id,
          at,
          text: spoken,
          status: "logged",
          detail: `${m.name} · ${timingLabel(m.timing)}`,
          choices: [],
        });
        for (const itemId of m.itemIds) actions.logDose(itemId, m.timing, true);
        setStatus(`Logged ${m.name}, ${timingLabel(m.timing)}.`);
        return;
      }

      if (meal.match !== null) {
        const m = meal.match;
        pushCapture({
          id,
          at,
          text: spoken,
          status: "logged",
          detail: `${m.name} · ${m.grams} g · ${m.slot}${m.portionAssumed ? " (one portion)" : ""}`,
          choices: [],
        });
        actions.logFood(m.slot, m.foodKey, m.grams);
        setStatus(`Logged ${m.name}, ${m.grams} grams.`);
        return;
      }

      // Nothing certain. The phrase is kept, and the near-misses become buttons
      // so a person makes the choice a parser is not entitled to make.
      const choices: Choice[] = [
        ...dose.alternatives.map((a) => ({
          id: `d${a.itemIds.join("-")}${a.timing}`,
          label: `${a.name} · ${timingLabel(a.timing)}`,
          run: logDose(a.itemIds, a.timing, a.name),
        })),
        ...meal.alternatives.map((a) => ({
          id: `f${a.foodKey}${a.slot}`,
          label: `${a.name} · ${a.grams} g · ${a.slot}`,
          run: logFood(a.foodKey, a.grams, a.slot, a.name),
        })),
      ].slice(0, 4);

      const detail =
        dose.reason === "ambiguous" || meal.reason === "ambiguous"
          ? "More than one thing matched. Nothing was logged."
          : dose.reason === "no-timing"
            ? "Which time of day? Nothing was logged."
            : "Nothing on your file matched. Nothing was logged.";

      pushCapture({ id, at, text: spoken, status: "unresolved", detail, choices });
      setStatus(`${detail} You said: ${spoken}`);
    },
    [actions, fuel, pushCapture, settle, stack],
  );

  const startListening = useCallback(() => {
    const Ctor = recognitionCtor();
    if (Ctor === null) return;
    const rec = new Ctor();
    rec.lang = "en-IE";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    // On-device where the browser can do it — a sentence about your medication
    // has no business leaving the phone if it does not have to.
    if ("processLocally" in rec) rec.processLocally = true;

    let heard = "";
    let finished = false;
    // Whichever of error and end arrives first, the attempt is recorded exactly
    // once — an error is not a reason to lose what was already transcribed.
    const finish = () => {
      if (finished) return;
      finished = true;
      setListening(false);
      recRef.current = null;
      handleUtterance(heard);
    };

    rec.onresult = (e) => {
      const first = e.results[0];
      const alt = first ? first[0] : undefined;
      heard = alt ? alt.transcript : "";
    };
    rec.onerror = finish;
    rec.onend = finish;
    recRef.current = rec;
    setListening(true);
    setStatus("Listening.");
    try {
      rec.start();
    } catch {
      setListening(false);
      recRef.current = null;
      setStatus("The microphone could not start. Type it instead.");
    }
  }, [handleUtterance]);

  const stopListening = useCallback(() => {
    const rec = recRef.current;
    if (rec) rec.stop();
    else setListening(false);
  }, []);

  useEffect(() => () => recRef.current?.abort(), []);

  const runTest = useCallback(() => {
    const secret = data.pendingSecret;
    if (!data.endpointReady || secret === null) return;
    setTesting(true);
    setTestResult(null);
    void fetch(`${data.endpoint}/ingest/dose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: secret, text: data.shortcutRecipe.phrase, date }),
    })
      .then((r) => r.json() as Promise<unknown>)
      .then((body) => {
        const spoken =
          typeof body === "object" && body !== null && typeof (body as { spoken?: unknown }).spoken === "string"
            ? (body as { spoken: string }).spoken
            : "The endpoint answered.";
        setTestResult(spoken);
        setStatus(spoken);
      })
      .catch(() => {
        const message = "The endpoint could not be reached. Nothing was logged.";
        setTestResult(message);
        setStatus(message);
      })
      .finally(() => setTesting(false));
  }, [data, date]);

  const liveTokens = data.tokens.filter((t) => !t.revoked);

  return (
    <div className="flex flex-col gap-3 pt-4">
      {/* One region, polite, for every outcome on this screen. */}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <SayItCard data={data} />

      <TalkCard
        canSpeak={canSpeak}
        listening={listening}
        onStart={startListening}
        onStop={stopListening}
        typed={typed}
        setTyped={setTyped}
        onSubmit={() => {
          handleUtterance(typed);
          setTyped("");
        }}
      />

      {captures.length > 0 && (
        <CapturesCard captures={captures} onClear={() => writeCaptures([])} />
      )}

      {data.survival ? (
        <button
          type="button"
          onClick={() => setShowSetup((s) => !s)}
          aria-expanded={showSetup}
          className="min-h-11 rounded-[10px] border border-tm-rule-strong bg-tm-panel px-4 text-[14px] font-medium text-tm-ink"
        >
          {showSetup ? "Hide the phone setup" : "Set it up on your phone"}
        </button>
      ) : null}

      {showSetup && (
        <>
          <SecretCard data={data} testing={testing} testResult={testResult} onTest={runTest} />
          <StepsCard data={data} />
        </>
      )}

      <TokensCard
        tokens={data.tokens}
        liveCount={liveTokens.length}
        onCreate={() => actions.createIngestToken(`Phone · ${date}`)}
        onRevoke={(id) => actions.revokeIngestToken(id)}
      />

      {!data.survival && data.recent.length > 0 && <RecentCard data={data} />}

      <p className="px-1 pb-2 text-[14px] leading-relaxed text-tm-dim">{data.note}</p>
    </div>
  );
}

/* ===== cards ===== */

function SayItCard({ data }: { data: HandsFreeData }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-green">Say it</Eyebrow>
      <p className="font-tm-disp text-2xl leading-tight">{data.shortcutRecipe.phrase}</p>
      <p className="mt-2 text-[14px] leading-relaxed">
        From a locked phone, or from your watch. No app to open, nothing to type.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {data.phrases.map((p) => (
          <li key={p.text} className="rounded-lg border border-tm-rule bg-tm-soft px-3 py-2">
            <div className="text-[14px] font-medium">“{p.text}”</div>
            <div className="mt-0.5 text-[14px] text-tm-dim">{p.meaning}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TalkCard({
  canSpeak,
  listening,
  onStart,
  onStop,
  typed,
  setTyped,
  onSubmit,
}: {
  canSpeak: boolean;
  listening: boolean;
  onStart: () => void;
  onStop: () => void;
  typed: string;
  setTyped: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Say it here instead</Eyebrow>
      {canSpeak ? (
        <button
          type="button"
          onClick={listening ? onStop : onStart}
          aria-pressed={listening}
          className={cn(
            "flex min-h-24 w-full items-center justify-center gap-3 rounded-[10px] border px-4 text-[17px] font-medium",
            listening
              ? "border-tm-ink bg-tm-ink text-white"
              : "border-tm-rule-strong bg-tm-panel text-tm-ink",
          )}
        >
          {/* Shape and word carry the state; the fill is corroboration, not the signal. */}
          <span
            aria-hidden
            className={cn(
              "inline-block h-3 w-3 rounded-full",
              listening ? "bg-white motion-safe:animate-pulse" : "bg-tm-rule-strong",
            )}
          />
          {listening ? "Listening — tap to stop" : "Hold the thought — tap and talk"}
        </button>
      ) : (
        <p className="text-[14px] leading-relaxed">
          This browser has no speech recognition. Type it below instead — it goes through exactly
          the same reading of the words.
        </p>
      )}

      <label className="mt-3 block text-[14px] font-medium" htmlFor="hf-typed">
        Or type what you would have said
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id="hf-typed"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder="took my morning tablets"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-tm-rule-strong bg-tm-panel px-3 text-[14px]"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={typed.trim() === ""}
          className="min-h-11 min-w-11 shrink-0 rounded-lg border border-tm-ink bg-tm-ink px-4 text-[14px] font-medium text-white disabled:border-tm-rule-strong disabled:bg-tm-soft disabled:text-tm-dim"
        >
          Log it
        </button>
      </div>
    </Card>
  );
}

function CapturesCard({ captures, onClear }: { captures: Capture[]; onClear: () => void }) {
  const open = captures.filter((c) => c.status === "unresolved").length;
  return (
    <Card tone={open > 0 ? "amber" : "default"}>
      <Eyebrow color={open > 0 ? "bg-tm-amber" : "bg-tm-rule-strong"}>
        {open > 0 ? `${open} still to sort` : "What you said"}
      </Eyebrow>
      <ul className="flex flex-col gap-2">
        {captures.map((c) => (
          <li key={c.id} className="rounded-lg border border-tm-rule bg-tm-panel px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase">
                {stamp(c.at)}
              </span>
              <span className="font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase">
                {c.status === "logged" ? "logged ✓" : c.status === "nothing-heard" ? "not heard" : "waiting"}
              </span>
            </div>
            <p className="mt-1 text-[14px] leading-relaxed">
              {c.text === "" ? <span className="text-tm-dim">(silence)</span> : `“${c.text}”`}
            </p>
            <p className="mt-1 text-[14px] text-tm-dim">{c.detail}</p>
            {c.choices.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {c.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={choice.run}
                    className="min-h-11 rounded-lg border border-tm-rule-strong bg-tm-panel px-3 text-left text-[14px] font-medium text-tm-ink"
                  >
                    Log {choice.label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 min-h-11 w-full rounded-lg border border-tm-rule-strong bg-tm-panel px-3 text-[14px] font-medium text-tm-ink"
      >
        Clear this list
      </button>
    </Card>
  );
}

function SecretCard({
  data,
  testing,
  testResult,
  onTest,
}: {
  data: HandsFreeData;
  testing: boolean;
  testResult: string | null;
  onTest: () => void;
}) {
  if (!data.endpointReady) {
    return (
      <Card>
        <Eyebrow color="bg-tm-rule-strong">Setup</Eyebrow>
        <p className="text-[14px] leading-relaxed">
          There is no live deployment behind this copy of the app, so there is no address for a
          Shortcut to call. Everything above still works — talk to it, or type.
        </p>
      </Card>
    );
  }

  if (data.pendingSecret === null) {
    return (
      <Card>
        <Eyebrow color="bg-tm-rule-strong">Your key</Eyebrow>
        <p className="text-[14px] leading-relaxed">
          Your keys are in use and are not shown again — a key is legible here only until the first
          time it is used, and never afterwards. If you have lost one, revoke it below and make a
          new one.
        </p>
      </Card>
    );
  }

  return (
    <Card tone="amber">
      <Eyebrow color="bg-tm-amber">Your key — copy it now</Eyebrow>
      <p className="text-[14px] leading-relaxed text-tm-amber-ink">
        This is the only time this key is legible. Once it has been used once it is hidden for good.
        Treat it like a password: anyone holding it can log to your file.
      </p>
      <Field label="Key" value={data.pendingSecret} what="your ingest key" />
      <button
        type="button"
        onClick={onTest}
        disabled={testing}
        className="mt-3 min-h-14 w-full rounded-[10px] border border-tm-ink bg-tm-ink px-4 text-[17px] font-medium text-white disabled:border-tm-rule-strong disabled:bg-tm-soft disabled:text-tm-dim"
      >
        {testing ? "Testing…" : "Test it now"}
      </button>
      {testResult !== null && (
        <p className="mt-2 rounded-lg border border-tm-rule bg-tm-panel px-3 py-2 text-[14px] leading-relaxed">
          {testResult}
        </p>
      )}
    </Card>
  );
}

function StepsCard({ data }: { data: HandsFreeData }) {
  const recipe = data.shortcutRecipe;
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Set it up — seven steps</Eyebrow>
      <ol className="flex flex-col gap-3">
        {recipe.steps.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-tm-ink font-tm-mono text-[14px]"
            >
              {step.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">
                <span className="sr-only">Step {step.n}. </span>
                {step.title}
              </p>
              <p className="mt-0.5 text-[14px] leading-relaxed text-tm-dim">{step.detail}</p>
              {step.copy !== null && (
                <Field label="Copy this" value={step.copy} what={`for step ${step.n}`} />
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[14px] leading-relaxed text-tm-dim">
        Method: {recipe.method}. Header:{" "}
        {recipe.headers.map((h) => `${h.name}: ${h.value}`).join(", ")}.
      </p>
    </Card>
  );
}

function TokensCard({
  tokens,
  liveCount,
  onCreate,
  onRevoke,
}: {
  tokens: HandsFreeData["tokens"];
  liveCount: number;
  onCreate: () => void;
  onRevoke: (id: string) => void;
}) {
  return (
    <Card>
      <Eyebrow color="bg-tm-purple">Keys · {liveCount} live</Eyebrow>
      {tokens.length === 0 ? (
        <p className="text-[14px] leading-relaxed">
          No keys yet. Make one and the setup steps above fill themselves in.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-tm-rule bg-tm-panel px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-medium">{t.label}</span>
                <span className="font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase">
                  {t.revoked ? "revoked ✕" : t.neverUsed ? "unused" : "in use"}
                </span>
              </div>
              <p className="mt-1 font-tm-mono text-[14px] break-all text-tm-dim">{t.masked}</p>
              <p className="mt-0.5 text-[14px] text-tm-dim">
                Made {t.createdDate}
                {t.lastUsedAt !== null ? ` · last used ${new Date(t.lastUsedAt).toISOString().slice(0, 10)}` : ""}
              </p>
              {!t.revoked && (
                <button
                  type="button"
                  onClick={() => onRevoke(t.id)}
                  className="mt-2 min-h-14 w-full rounded-lg border border-tm-red bg-tm-panel px-3 text-[17px] font-medium text-tm-red"
                >
                  Revoke this key
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onCreate}
        className="mt-3 min-h-14 w-full rounded-[10px] border border-tm-ink bg-tm-ink px-4 text-[17px] font-medium text-white"
      >
        Make a new key
      </button>
    </Card>
  );
}

function RecentCard({ data }: { data: HandsFreeData }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-green">Landed lately</Eyebrow>
      <ul className="flex flex-col gap-2">
        {data.recent.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-[14px]">
              <span className="font-medium">{r.label}</span>
              <span className="text-tm-dim"> · {r.detail}</span>
            </span>
            <span className="shrink-0 font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase">
              {r.date}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[14px] leading-relaxed text-tm-dim">{data.recentNote}</p>
    </Card>
  );
}
