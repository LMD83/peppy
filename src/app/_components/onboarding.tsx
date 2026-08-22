"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { addDays } from "@convex/tm/lib";
import { RETAILERS, handoffLabel } from "@convex/tm/data/retailers";
import type { AgeBand, Kit, Setting } from "@convex/tm/data/exercises";
import { readRetailer, writeRetailer } from "../_lib/retailer-store";
import { useTimento } from "../_lib/backend";
import { BigChoice, TmButton, fileWidth } from "./ui";

/**
 * The setup wizard — capture once, then the day runs on answers.
 *
 * One question per screen, a skip on every one of them that says exactly what
 * it keeps, and every answer commits immediately through the same mutation the
 * tab it belongs to would use. The wizard owns no state of record: close it at
 * any step and everything answered so far is already on the file, everything
 * skipped is exactly as it was.
 *
 * Two rules carried in from the rest of the app:
 *  - Nothing is inferred. A default is stated in words on the skip line, never
 *    read off someone's data (see the settings screen for why that line
 *    exists).
 *  - The last screen is a payoff, not a summary form: the week can be planned
 *    and the shopping list written before the wizard closes.
 */

type StepId =
  | "size"
  | "mode"
  | "minutes"
  | "equipment"
  | "place"
  | "age"
  | "goal"
  | "shop"
  | "quiet"
  | "contacts";

const STEP_TITLES: Record<StepId, string> = {
  size: "How big should the type be?",
  mode: "What is the protocol right now?",
  minutes: "How long does cooking really get?",
  equipment: "What does the kitchen have?",
  place: "Where do you train?",
  age: "Which age band writes the programme?",
  goal: "What is the training block for?",
  shop: "Where do you shop?",
  quiet: "When should the app never speak?",
  contacts: "Who refills the prescriptions?",
};

/** Sensible kit for a setting, stated on the skip line, editable in Train. */
const KIT_DEFAULTS: Record<Setting, Kit[]> = {
  home: ["dumbbell", "band"],
  gym: ["barbell", "dumbbell", "cable", "machine", "bench", "pull-up-bar"],
  box: ["barbell", "kettlebell", "box", "rower", "rings", "jump-rope", "wall-ball"],
};

const SURVIVAL_REVIEW_DAYS = 14;

export function Onboarding({ onClose }: { onClose: (dest?: "today" | "shop") => void }) {
  const { today, train, supply, date, actions } = useTimento();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [chosenMode, setChosenMode] = useState<"cut" | "maintain" | "survival" | null>(null);
  const [chosenSetting, setChosenSetting] = useState<Setting | null>(null);
  const headRef = useRef<HTMLDivElement>(null);

  // The goal step only exists when there is no block to be loyal to.
  const steps = useMemo<StepId[]>(() => {
    const base: StepId[] = ["size", "mode", "minutes", "equipment", "place", "age"];
    if (!train?.mesocycle) base.push("goal");
    return [...base, "shop", "quiet", "contacts"];
    // Computed once per open — a mesocycle started mid-wizard should not
    // reshuffle the remaining steps under the person's thumb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = steps[Math.min(index, steps.length - 1)];

  useEffect(() => {
    headRef.current?.focus();
  }, [started, index, done]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!today) return null;

  const record = (line: string) => setSaved((prev) => [...prev, line]);

  const next = () => {
    if (index >= steps.length - 1) {
      try {
        window.localStorage.setItem("tm.onboarded", "1");
      } catch {
        // A blocked store forgets the flag, never the answers — those are on the file.
      }
      setDone(true);
    } else {
      setIndex(index + 1);
    }
  };

  const answer = (line: string, commit: () => void) => {
    commit();
    record(line);
    next();
  };

  /** Full profile from what is known so far — the mutation takes no partials. */
  const trainProfileWith = (patch: { setting?: Setting; ageBand?: AgeBand }) => {
    const existing = train?.profile;
    const setting = patch.setting ?? chosenSetting ?? existing?.setting ?? "home";
    const settingChanged = patch.setting !== undefined && patch.setting !== existing?.setting;
    return {
      setting,
      kit: settingChanged || !existing?.kit?.length ? KIT_DEFAULTS[setting] : existing.kit,
      experience: existing?.experience ?? "returning",
      ageBand: patch.ageBand ?? existing?.ageBand ?? "40-59",
      minutes: existing?.minutes ?? 45,
      constraints: existing?.constraints ?? [],
    };
  };

  const effectiveMode = chosenMode ?? today.user.mode;
  const total = steps.length;

  if (!started) {
    return (
      <Screen headRef={headRef} eyebrow="Setting up" heading="Set up the file">
        <p className="text-[14px]">
          Two minutes, once. Answer what you know, skip what you don&rsquo;t — every answer here
          removes a question the day would otherwise ask you. Nothing is guessed: a skipped
          question keeps exactly what the file already says.
        </p>
        <p className="text-[14px] text-tm-dim">
          Everything saves as you go. Leave any time; nothing is lost.
        </p>
        <div className="mt-2 flex gap-2">
          <TmButton onClick={() => setStarted(true)} className="flex-1">
            Start
          </TmButton>
          <TmButton variant="ghost" onClick={() => onClose()}>
            Not now
          </TmButton>
        </div>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen headRef={headRef} eyebrow="Set" heading="The file is set">
        {saved.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {saved.map((line) => (
              <li key={line} className="text-[14px]">
                ✓ {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px]">
            Everything kept as it was. The file was already answered.
          </p>
        )}
        <p className="text-[14px] text-tm-dim">
          From here the day runs on answers: reminders ask, you tap. Anything set here can be
          changed on its own screen.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {effectiveMode !== "survival" && (
            <TmButton
              onClick={() => {
                actions.generateWeek();
                onClose("shop");
              }}
            >
              Plan my week — the shopping list writes itself
            </TmButton>
          )}
          <TmButton variant={effectiveMode === "survival" ? "primary" : "ghost"} onClick={() => onClose("today")}>
            Show me Today
          </TmButton>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      headRef={headRef}
      eyebrow={`Step ${index + 1} of ${total}`}
      heading={STEP_TITLES[step]}
      onBack={index > 0 ? () => setIndex(index - 1) : undefined}
      onClose={() => onClose()}
    >
      {step === "size" && (
        <>
          <BigChoice
            question="Both work everywhere. Easy shows one thing at a time, bigger."
            options={[
              {
                id: "standard",
                label: "Normal",
                detail: "The full page.",
                selected: today.a11y.profile === "standard",
                onSelect: () => answer("Type: normal", () => actions.setA11yProfile("standard")),
              },
              {
                id: "easy",
                label: "Easy",
                detail: "One thing at a time, 48px targets.",
                selected: today.a11y.profile === "easy",
                onSelect: () => answer("Type: easy", () => actions.setA11yProfile("easy")),
              },
            ]}
          />
          <Skip onSkip={next}>
            stays {today.a11y.profile === "easy" ? "easy" : "normal"}
          </Skip>
        </>
      )}

      {step === "mode" && (
        <>
          <BigChoice
            question="The mode decides what the day asks of you. It can change any morning."
            options={[
              {
                id: "cut",
                label: "Cut",
                detail: "Deficit, full tracking, the whole protocol.",
                selected: today.user.mode === "cut",
                onSelect: () =>
                  answer("Protocol: cut", () => {
                    setChosenMode("cut");
                    actions.setMode("cut");
                  }),
              },
              {
                id: "maintain",
                label: "Maintain",
                detail: "Hold the line. Lighter touch, same file.",
                selected: today.user.mode === "maintain",
                onSelect: () =>
                  answer("Protocol: maintain", () => {
                    setChosenMode("maintain");
                    actions.setMode("maintain");
                  }),
              },
              {
                id: "survival",
                label: "Survival",
                detail: `The floor: three checks, nothing else. Review in ${SURVIVAL_REVIEW_DAYS} days.`,
                selected: today.user.mode === "survival",
                onSelect: () =>
                  answer("Protocol: survival — the floor", () => {
                    setChosenMode("survival");
                    actions.setMode("survival", undefined, addDays(date, SURVIVAL_REVIEW_DAYS));
                  }),
              },
            ]}
          />
          <Skip onSkip={next}>stays {today.user.mode}</Skip>
        </>
      )}

      {step === "minutes" && (
        <>
          <BigChoice
            question="Meal plans only ever suggest what fits inside this."
            options={[
              {
                id: "10",
                label: "Grab and go",
                detail: "10 minutes. Assembly, not cooking.",
                onSelect: () => answer("Kitchen: 10 minutes", () => actions.setKitchen({ minutes: 10 })),
              },
              {
                id: "20",
                label: "Twenty minutes",
                detail: "One pan, no ceremony.",
                onSelect: () => answer("Kitchen: 20 minutes", () => actions.setKitchen({ minutes: 20 })),
              },
              {
                id: "40",
                label: "Proper cook",
                detail: "40 minutes when the evening allows it.",
                onSelect: () => answer("Kitchen: 40 minutes", () => actions.setKitchen({ minutes: 40 })),
              },
            ]}
          />
          <Skip onSkip={next}>keeps the current kitchen time</Skip>
        </>
      )}

      {step === "equipment" && (
        <>
          <BigChoice
            question="Plans never assume a machine you don't have."
            options={(
              [
                ["none", "Nothing", "No appliances worth naming."],
                ["kettle", "A kettle", "Hot water is the whole kitchen."],
                ["microwave", "A microwave", "Heat without a hob."],
                ["one-pan", "One pan", "A hob and one pan that works."],
                ["oven", "The full kitchen", "Oven, hob, the lot."],
              ] as const
            ).map(([id, label, detail]) => ({
              id,
              label,
              detail,
              onSelect: () => answer(`Kitchen: ${label.toLowerCase()}`, () => actions.setKitchen({ equipment: id })),
            }))}
          />
          <Skip onSkip={next}>keeps the current equipment</Skip>
        </>
      )}

      {step === "place" && (
        <>
          <BigChoice
            question="Sessions are built from what the place actually has. The kit list can be edited in Train."
            options={(
              [
                ["home", "Home", "Dumbbells and bands assumed."],
                ["gym", "A gym", "Bars, machines, cables assumed."],
                ["box", "A box", "Barbell, kettlebells, rower assumed."],
              ] as const
            ).map(([id, label, detail]) => ({
              id,
              label,
              detail,
              selected: train?.profile?.setting === id,
              onSelect: () =>
                answer(`Training: ${label.toLowerCase()}`, () => {
                  setChosenSetting(id);
                  actions.saveTrainProfile(trainProfileWith({ setting: id }));
                }),
            }))}
          />
          <Skip onSkip={next}>
            keeps {train?.profile ? `training at ${train.profile.setting}` : "home, dumbbells and bands"}
          </Skip>
        </>
      )}

      {step === "age" && (
        <>
          <BigChoice
            question="Recovery and progression are programmed differently by decade. Asked, never assumed."
            options={(
              [
                ["under-40", "Under 40"],
                ["40-59", "40 to 59"],
                ["60-plus", "60 plus"],
              ] as const
            ).map(([id, label]) => ({
              id,
              label,
              selected: train?.profile?.ageBand === id,
              onSelect: () =>
                answer(`Training: ${label.toLowerCase()}`, () =>
                  actions.saveTrainProfile(trainProfileWith({ ageBand: id })),
                ),
            }))}
          />
          <Skip onSkip={next}>
            keeps {train?.profile?.ageBand ?? "40–59"} — change any time in Train
          </Skip>
        </>
      )}

      {step === "goal" && (
        <>
          <BigChoice
            question="This starts a training block today. Volume and progression follow from it."
            options={(
              [
                ["hypertrophy", "Build muscle", "Volume-led, moderate loads."],
                ["strength", "Get stronger", "Heavier, fewer, longer rests."],
                ["recomp", "Recomposition", "Both at once, patiently."],
              ] as const
            ).map(([id, label, detail]) => ({
              id,
              label,
              detail,
              onSelect: () => answer(`Training block: ${label.toLowerCase()}`, () => actions.startMesocycle(id)),
            }))}
          />
          <Skip onSkip={next}>no block yet — start one any time in Train</Skip>
        </>
      )}

      {step === "shop" && (
        <>
          <BigChoice
            question="The shopping list is written for you either way; this decides where the hand-off points."
            options={RETAILERS.map((r) => ({
              id: r.key,
              label: r.name,
              detail: handoffLabel(r),
              selected: readRetailer() === r.key,
              onSelect: () => answer(`Shop: ${r.name}`, () => writeRetailer(r.key)),
            }))}
          />
          <Skip onSkip={next}>no usual shop — the list still writes itself</Skip>
        </>
      )}

      {step === "quiet" && (
        <>
          <BigChoice
            question="Reminders hold everything inside these hours. Sleep is not the app's to interrupt."
            options={(
              [
                ["22:30", "07:00", "Standard night", "Quiet 22:30 to 07:00."],
                ["21:30", "06:30", "Early house", "Quiet 21:30 to 06:30."],
                ["23:30", "08:30", "Late house", "Quiet 23:30 to 08:30."],
              ] as const
            ).map(([from, to, label, detail]) => ({
              id: from,
              label,
              detail,
              onSelect: () =>
                answer(`Quiet hours: ${from}–${to}`, () =>
                  actions.setReminderPrefs({ quietFrom: from, quietTo: to }),
                ),
            }))}
          />
          <p className="text-[13px] text-tm-dim">
            Turning reminders on happens on the Reminders screen, where this device can actually
            be asked for permission.
          </p>
          <Skip onSkip={next}>nights stay 22:30–07:00</Skip>
        </>
      )}

      {step === "contacts" && (
        <ContactsStep
          gp={supply?.contacts.gp ?? null}
          pharmacy={supply?.contacts.pharmacy ?? null}
          onSave={(entries) => {
            for (const e of entries) actions.saveContact(e.kind, e.name, e.phone);
            if (entries.length > 0) {
              record(
                `Contacts: ${entries.map((e) => (e.kind === "gp" ? "GP" : "pharmacy")).join(" and ")} on file`,
              );
            }
            next();
          }}
          onSkip={next}
        />
      )}
    </Screen>
  );
}

/* ===== pieces ===== */

function Screen({
  headRef,
  eyebrow,
  heading,
  onBack,
  onClose,
  children,
}: {
  headRef: React.RefObject<HTMLDivElement | null>;
  eyebrow: string;
  heading: string;
  onBack?: () => void;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-tm-paper">
      <main className={cn(fileWidth, "flex flex-col gap-3 px-4 pt-6 pb-16")}>
        <div className="flex items-baseline justify-between gap-3">
          <p aria-live="polite" className="font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-dim uppercase">
            {eyebrow}
          </p>
          <div className="flex gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-11 cursor-pointer items-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim underline uppercase"
              >
                Back
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 cursor-pointer items-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim underline uppercase"
              >
                Save &amp; close
              </button>
            )}
          </div>
        </div>
        <div ref={headRef} tabIndex={-1} className="outline-none">
          <h1 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">{heading}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

/** The skip line every question carries: what skipping keeps, in words. */
function Skip({ children, onSkip }: { children: React.ReactNode; onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      className="inline-flex min-h-11 cursor-pointer items-center self-start font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim underline uppercase"
    >
      Skip — {children}
    </button>
  );
}

type ContactEntry = { kind: "gp" | "pharmacy"; name: string; phone: string };
type Contact = { name: string; phone: string } | null;

function ContactsStep({
  gp,
  pharmacy,
  onSave,
  onSkip,
}: {
  gp: Contact;
  pharmacy: Contact;
  onSave: (entries: ContactEntry[]) => void;
  onSkip: () => void;
}) {
  const [gpName, setGpName] = useState(gp?.name ?? "");
  const [gpPhone, setGpPhone] = useState(gp?.phone ?? "");
  const [phName, setPhName] = useState(pharmacy?.name ?? "");
  const [phPhone, setPhPhone] = useState(pharmacy?.phone ?? "");

  const entries: ContactEntry[] = [
    ...(gpName.trim() && gpPhone.trim() ? [{ kind: "gp" as const, name: gpName.trim(), phone: gpPhone.trim() }] : []),
    ...(phName.trim() && phPhone.trim()
      ? [{ kind: "pharmacy" as const, name: phName.trim(), phone: phPhone.trim() }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px]">
        With these on file, a script that needs the practice comes with the number to ring. Names
        and numbers stay on your file and are never shared with crew.
      </p>
      <ContactFields label="GP practice" name={gpName} phone={gpPhone} onName={setGpName} onPhone={setGpPhone} />
      <ContactFields label="Pharmacy" name={phName} phone={phPhone} onName={setPhName} onPhone={setPhPhone} />
      <div className="mt-1 flex items-center gap-3">
        <TmButton onClick={() => onSave(entries)} disabled={entries.length === 0} className="flex-none">
          Save and finish
        </TmButton>
        <Skip onSkip={onSkip}>nothing saved, add them any time in Supply</Skip>
      </div>
    </div>
  );
}

function ContactFields({
  label,
  name,
  phone,
  onName,
  onPhone,
}: {
  label: string;
  name: string;
  phone: string;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
}) {
  return (
    <fieldset className="rounded-[14px] border border-tm-rule bg-tm-panel p-3">
      <legend className="px-1 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">{label}</legend>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">Name</span>
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            className="min-h-11 w-full rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 text-[15px] focus:border-tm-ink"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">Phone</span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            className="min-h-11 w-full rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 font-tm-mono text-[15px] focus:border-tm-ink"
          />
        </label>
      </div>
    </fieldset>
  );
}
