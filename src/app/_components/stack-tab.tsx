"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  EVIDENCE_NOTES,
  EVIDENCE_ORDER,
  type EvidenceTier,
} from "@convex/tm/data/compounds";
import { ReconstitutionError, reconstitution } from "@convex/tm/logicStack";
import { useTimento } from "../_lib/backend";
import type { StackData } from "../_lib/types";
import { useFileNav } from "./file-nav";
import { Card, Eyebrow, Stat } from "./ui";

type ItemView = StackData["items"][number];
type DoseView = StackData["dueToday"][number];

const EVIDENCE_TONE: Record<EvidenceTier, string> = {
  strong: "border-tm-green text-tm-green",
  moderate: "border-tm-blue text-tm-blue",
  limited: "border-tm-amber text-tm-amber",
  anecdotal: "border-tm-dim2 text-tm-dim",
};

const EVIDENCE_DOT: Record<EvidenceTier, string> = {
  strong: "bg-tm-green",
  moderate: "bg-tm-blue",
  limited: "bg-tm-amber",
  anecdotal: "bg-tm-dim2",
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function doseLine(d: { dose: number; unit: string; route: string; withFood: boolean }): string {
  return `${fmt(d.dose)} ${d.unit} · ${d.route}${d.withFood ? " · with food" : ""}`;
}

/** One item can be due more than once a day, so a dose is item plus timing. */
function doseKey(d: DoseView): string {
  return `${d.itemId}-${d.timing}`;
}

/**
 * A write is not in the view model until the query round-trips, so the render
 * in between projects it locally. The projection expires the moment the row
 * moves off the value it was written against: a guess must never outrank what
 * the file actually says.
 */
type Pending = Record<string, { value: boolean; was: boolean }>;

function settled(current: boolean, held: { value: boolean; was: boolean } | undefined): boolean {
  return held !== undefined && current === held.was ? held.value : current;
}

/* ===== the tab ===== */

export function StackTab() {
  const { stack } = useTimento();
  if (!stack) return <StackSkeleton />;

  const floor = stack.dueToday.filter((d) => !d.deferred);
  const deferred = stack.dueToday.filter((d) => d.deferred);

  if (stack.survival) {
    return (
      <div className="flex flex-col gap-4 pt-5">
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">Stack, floor</Eyebrow>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-tm-amber bg-tm-amber">
            <Stat className="bg-tm-amber-bg px-3 py-3" value={`${stack.takenCount}/${stack.dueCount}`} label="doses taken today"/>
            <Stat className="bg-tm-amber-bg px-3 py-3" value={`${stack.adherence30.pct}%`} label="30-day adherence"/>
          </dl>
          <div className="mt-4">
            <DoseList doses={floor} />
          </div>
          <p className="mt-2.5 text-[14px] text-tm-amber-ink">
            Meds and anything with strong evidence stay. Optional doses are deferred, not deleted.
            The floor removes obligations, it never removes a prescription.
          </p>
        </Card>

        {deferred.length > 0 && <DeferredCard doses={deferred} />}

        <InteractionsCard interactions={stack.interactions} />

        <DisclaimerCard text={stack.disclaimer} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-3 lg:col-span-7">
        <Card>
          <div className="flex items-end justify-between gap-3">
            <Eyebrow color="bg-tm-green" className="mb-0">
              Due today
            </Eyebrow>
            <span className="font-tm-mono text-[11.5px] text-tm-dim">
              {stack.takenCount}/{stack.dueCount} taken
            </span>
          </div>
          <div className="mt-3">
            <DoseList doses={floor} />
          </div>
        </Card>

        <AdherenceCard
          adherence7={stack.adherence7}
          adherence30={stack.adherence30}
        />

        {stack.cycles.length > 0 && <CyclesCard cycles={stack.cycles} />}

        <ProtocolList stack={stack} />
      </div>

      <div className="flex flex-col gap-3 lg:col-span-5">
        <ReconCalculator items={stack.items} />
        <InteractionsCard interactions={stack.interactions} />
        <EvidenceLegend />
        <DisclaimerCard text={stack.disclaimer} />
      </div>
    </div>
  );
}

/* ===== the compact card for Today ===== */

/**
 * A tick on Today writes a medication record, so it owes three things a plain
 * button does not: it says what it wrote, it shows what it wrote, and it can
 * take it back in one tap.
 *
 * The stat block is deliberately not inside the navigate button. Wrapping it
 * renamed the whole card "Open Stack" to assistive tech and marked the day's
 * numbers ignored — the doses and the adherence simply stopped existing for a
 * screen reader. The doorway is its own row at the foot instead, the way the
 * Train card has always read.
 */
export function StackTodayCard() {
  const { stack, actions } = useTimento();
  const go = useFileNav();
  // The dose the last tick wrote, held until it is undone or handed on. No
  // timer: an undo that expires is an undo you have to race.
  const [logged, setLogged] = useState<DoseView | null>(null);
  // What this card has written and the view model has not caught up with yet.
  const [pending, setPending] = useState<Pending>({});
  const [status, setStatus] = useState("");
  // A control that vanishes under a finger has to say where focus went, and
  // the replacement names its own target — which is how the second tap stops
  // silently landing on a different medicine.
  const [focusWanted, setFocusWanted] = useState<{ to: "log" | "undo" } | null>(null);
  const logRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusWanted) return;
    (focusWanted.to === "log" ? logRef : undoRef).current?.focus();
  }, [focusWanted]);

  if (!stack) {
    return <div className="h-24 rounded-[14px] border border-tm-rule bg-tm-panel" aria-busy="true" />;
  }

  const floor = stack.dueToday.filter((d) => !d.deferred);
  const { dueCount } = stack;
  const isTaken = (d: DoseView) => settled(d.taken, pending[doseKey(d)]);
  const takenCount = floor.filter(isTaken).length;
  // The tick's target comes off the projection, so the dose just written is
  // already spent and the dose just undone is back in the queue. Reading it off
  // the view model — which the un-awaited write has not reached — offered
  // "Next" for the dose this very tap had logged, and pointed Undo's
  // replacement at the wrong medicine.
  const next = floor.find((d) => !isTaken(d)) ?? null;
  // The held dose as the file reads it now — what an undo writes against.
  const held = logged ? (floor.find((d) => doseKey(d) === doseKey(logged)) ?? logged) : null;

  function write(dose: DoseView, taken: boolean) {
    actions.logDose(dose.itemId, dose.timing, taken, dose.site ?? undefined);
    setPending((p) => ({ ...p, [doseKey(dose)]: { value: taken, was: dose.taken } }));
  }

  function logIt(dose: DoseView) {
    write(dose, true);
    setStatus(`${dose.name} logged — ${takenCount + 1} of ${dueCount} doses today.`);
    setLogged(dose);
    setFocusWanted({ to: "undo" });
  }

  function undoIt(dose: DoseView) {
    write(dose, false);
    setStatus(`${dose.name} cleared — ${takenCount - 1} of ${dueCount} doses today.`);
    setLogged(null);
    setFocusWanted({ to: "log" });
  }

  function moveOn(dose: DoseView) {
    setStatus(`Next up — ${dose.name}, ${dose.timingLabel.toLowerCase()}.`);
    setLogged(null);
    setFocusWanted({ to: "log" });
  }

  return (
    <Card tone={stack.survival ? "amber" : "default"}>
      <Eyebrow color={stack.survival ? "bg-tm-amber" : "bg-tm-green"}>
        {stack.survival ? "Stack — floor" : "Stack"}
      </Eyebrow>
      <dl className="flex items-end justify-between gap-2">
        <Stat value={`${takenCount}/${dueCount}`} label="doses today" />
        <Stat value={`${stack.adherence7.pct}%`} label="7-day adherence" />
        <Stat value={`${stack.cycles.length}`} label="cycles running" />
      </dl>
      {/* The write says itself — the tick below is silent otherwise. */}
      <p role="status" className="sr-only">
        {status}
      </p>
      {held ? (
        <div className="mt-2 flex items-stretch gap-2">
          <p className="flex min-w-0 flex-1 items-center font-tm-mono text-[11.5px] text-tm-ink">
            {/* One flex item, so the tick flows with the first line rather than
                centring itself against three wrapped ones at 320px. */}
            <span>
              <span aria-hidden>✓ </span>
              {held.name.toLowerCase()} logged · {takenCount}/{dueCount}
            </span>
          </p>
          <button
            ref={undoRef}
            type="button"
            onClick={() => undoIt(held)}
            aria-label={`Undo — put ${held.name} back as not taken`}
            className="min-h-11 min-w-11 shrink-0 cursor-pointer rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-ink uppercase transition-transform duration-150 active:scale-[0.98]"
          >
            Undo
          </button>
          {next && (
            <button
              type="button"
              onClick={() => moveOn(next)}
              aria-label={`Next dose — ${next.name}`}
              className="min-h-11 min-w-11 shrink-0 cursor-pointer rounded-[14px] bg-tm-ink px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-white uppercase transition-transform duration-150 active:scale-[0.98]"
            >
              Next
            </button>
          )}
        </div>
      ) : next ? (
        <div className="mt-2 flex items-stretch gap-2">
          <p className="flex min-w-0 flex-1 items-center font-tm-mono text-[11.5px] text-tm-dim">
            next up — {next.timingLabel.toLowerCase()} · {next.name.toLowerCase()}
          </p>
          <button
            ref={logRef}
            type="button"
            onClick={() => logIt(next)}
            aria-label={`Log ${next.name} as taken`}
            className="min-h-11 min-w-11 shrink-0 cursor-pointer rounded-[14px] bg-tm-ink px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-white uppercase transition-transform duration-150 active:scale-[0.98]"
          >
            Log it
          </button>
        </div>
      ) : (
        <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
          {dueCount === 0 ? "nothing scheduled today" : "every scheduled dose logged"}
        </p>
      )}
      <button
        type="button"
        onClick={() => go("body", "stack")}
        className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[14px] border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-ink uppercase transition-transform duration-150 active:scale-[0.98]"
      >
        Open Stack
        <span aria-hidden>→</span>
      </button>
    </Card>
  );
}

/* ===== pieces ===== */

function StackSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-[14px] border border-tm-rule bg-tm-panel" />
      ))}
      <p className="text-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
        Loading stack…
      </p>
    </div>
  );
}

/** Doses grouped by timing block, in the order the day runs. */
function DoseList({ doses }: { doses: DoseView[] }) {
  const blocks = useMemo(() => {
    const out: { timing: string; label: string; doses: DoseView[] }[] = [];
    for (const d of doses) {
      const last = out[out.length - 1];
      if (last && last.timing === d.timing) last.doses.push(d);
      else out.push({ timing: d.timing, label: d.timingLabel, doses: [d] });
    }
    return out;
  }, [doses]);

  if (doses.length === 0) {
    return <p className="text-[13px] text-tm-dim">Nothing scheduled today.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => (
        <div key={block.timing}>
          <div className="flex items-baseline justify-between">
            <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
              {block.label}
            </span>
            <span className="font-tm-mono text-[11.5px] text-tm-dim">
              {block.doses.filter((d) => d.taken).length}/{block.doses.length}
            </span>
          </div>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {block.doses.map((d) => (
              <DoseRow key={doseKey(d)} dose={d} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DoseRow({ dose }: { dose: DoseView }) {
  const { actions } = useTimento();
  return (
    <button
      onClick={() => actions.logDose(dose.itemId, dose.timing, !dose.taken, dose.site ?? undefined)}
      aria-pressed={dose.taken}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[14px] border px-3 py-2 text-left transition-transform duration-150 active:scale-[0.98]",
        dose.taken ? "border-tm-green bg-tm-green-faint" : "border-tm-rule bg-tm-panel",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{dose.name}</span>
        <span className="block font-tm-mono text-[11.5px] text-tm-dim">
          {doseLine(dose)}
          {dose.site ? ` · ${dose.site}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={cn("inline-block size-1.5 rounded-full", EVIDENCE_DOT[dose.evidence])} />
        <span className="font-tm-mono text-[13px] text-tm-dim">{dose.taken ? "✓" : "—"}</span>
      </span>
    </button>
  );
}

function DeferredCard({ doses }: { doses: DoseView[] }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-dim2">Deferred while the floor is on</Eyebrow>
      <ul>
        {doses.map((d) => (
          <li
            key={doseKey(d)}
            className="flex items-center justify-between gap-2 border-b border-tm-grid py-2 last:border-0"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{d.name}</span>
              <span className="block font-tm-mono text-[11.5px] text-tm-dim">{d.deferredNote}</span>
            </span>
            <span className="shrink-0 font-tm-mono text-[11.5px] text-tm-dim">{d.timingLabel}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Ring({ pct, label, tone }: { pct: number; label: string; tone: string }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2.5">
      <svg
        viewBox="0 0 40 40"
        className="size-11 shrink-0"
        role="img"
        aria-label={`${label}: ${filled} per cent`}
      >
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="5" className="stroke-tm-grid" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="butt"
          strokeDasharray={`${(filled / 100) * c} ${c}`}
          transform="rotate(-90 20 20)"
          className={tone}
        />
      </svg>
      <div>
        <div className="font-tm-disp text-xl leading-none">{filled}%</div>
        <div className="mt-1 font-tm-mono text-[11.5px] tracking-[0.16em] text-tm-dim uppercase">
          {label}
        </div>
      </div>
    </div>
  );
}

function AdherenceCard({
  adherence7,
  adherence30,
}: {
  adherence7: StackData["adherence7"];
  adherence30: StackData["adherence30"];
}) {
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Adherence</Eyebrow>
      <div className="flex items-center justify-between gap-3">
        <Ring pct={adherence7.pct} label="7 day" tone="stroke-tm-green" />
        <Ring pct={adherence30.pct} label="30 day" tone="stroke-tm-blue" />
      </div>
      <p className="mt-2.5 font-tm-mono text-[11.5px] text-tm-dim">
        {adherence30.takenCount}/{adherence30.dueCount} over 30 days. Only days an item was actually
        scheduled count. Pausing something never dents the number.
      </p>
    </Card>
  );
}

function CyclesCard({ cycles }: { cycles: StackData["cycles"] }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-purple">Cycles</Eyebrow>
      <div className="flex flex-col gap-2">
        {cycles.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 rounded-[14px] border border-tm-rule bg-tm-panel px-3 py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{c.name}</span>
              <span className="block font-tm-mono text-[11.5px] text-tm-dim">
                week {c.weekInPhase} · switches {c.nextSwitchDate}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-[18px] border px-2.5 py-[3px] font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
                c.phase === "on"
                  ? "border-tm-green bg-tm-green-faint text-tm-green"
                  : "border-tm-rule bg-tm-soft text-tm-dim",
              )}
            >
              {c.phase}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProtocolList({ stack }: { stack: StackData }) {
  const { actions } = useTimento();
  const pctById = useMemo(
    () => new Map(stack.adherence30.perItem.map((p) => [p.itemId, p])),
    [stack.adherence30.perItem],
  );
  const groups: { key: string; label: string; items: ItemView[] }[] = [
    { key: "med", label: "Meds", items: stack.byKind.med },
    { key: "peptide", label: "Peptides", items: stack.byKind.peptide },
    { key: "supplement", label: "Supplements", items: stack.byKind.supplement },
  ];

  return (
    <Card>
      <Eyebrow color="bg-tm-ink">The protocol</Eyebrow>
      <div className="flex flex-col gap-3">
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.key}>
              <div className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
                {g.label}
              </div>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {g.items.map((item) => {
                  const stats = pctById.get(item.id);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-[14px] border px-3 py-2.5",
                        item.active ? "border-tm-rule bg-tm-panel" : "border-tm-rule bg-tm-soft",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">
                            {item.name}
                          </span>
                          <span className="block font-tm-mono text-[11.5px] text-tm-dim">
                            {doseLine(item)} · {item.timings.join(", ")}
                          </span>
                          <span className="block font-tm-mono text-[11.5px] text-tm-dim">
                            {item.scheduleLabel}
                            {stats ? ` · ${stats.pct}% · streak ${stats.streak}` : ""}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-[18px] border bg-tm-panel px-2 py-[3px] font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
                            EVIDENCE_TONE[item.evidence],
                          )}
                        >
                          {item.evidence}
                        </span>
                      </div>
                      {item.note && <p className="mt-1.5 text-[13px]">{item.note}</p>}
                      {item.cautions.length > 0 && (
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {item.cautions.map((c) => (
                            <li key={c} className="font-tm-mono text-[11.5px] text-tm-dim">
                              · {c}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => actions.setStackItemActive(item.id, !item.active)}
                        aria-pressed={!item.active}
                        className="mt-2 min-h-11 w-full cursor-pointer rounded-[14px] border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase transition-transform duration-150 active:scale-[0.98]"
                      >
                        {item.active ? "Pause this item" : "Resume this item"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </div>
      <p className="mt-2.5 font-tm-mono text-[11.5px] text-tm-dim">
        Pausing stops the schedule. It keeps every dose already logged against it.
      </p>
    </Card>
  );
}

/* ===== reconstitution ===== */

function ReconCalculator({ items }: { items: ItemView[] }) {
  const withRecon = useMemo(() => items.filter((i) => i.recon !== null), [items]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = withRecon.find((i) => i.id === pickedId) ?? withRecon[0] ?? null;

  const [vialMg, setVialMg] = useState("");
  const [bacMl, setBacMl] = useState("");
  const [doseMcg, setDoseMcg] = useState("");
  const [unitsPerMl, setUnitsPerMl] = useState("");

  if (!picked || picked.recon === null) return null;

  // The item's own configuration is the default; the fields only override it.
  const config = picked.recon;
  const values = {
    vialMg: vialMg === "" ? config.vialMg : Number(vialMg),
    bacMl: bacMl === "" ? config.bacMl : Number(bacMl),
    doseMcg: doseMcg === "" ? picked.dose : Number(doseMcg),
    syringeUnitsPerMl: unitsPerMl === "" ? config.syringeUnitsPerMl : Number(unitsPerMl),
  };

  let result: { mgPerMl: number; mlPerDose: number; syringeUnits: number } | null = null;
  let error: string | null = null;
  try {
    result = reconstitution(values);
  } catch (e) {
    error = e instanceof ReconstitutionError ? e.message : "Check those numbers.";
  }

  const select = (id: string) => {
    setPickedId(id);
    setVialMg("");
    setBacMl("");
    setDoseMcg("");
    setUnitsPerMl("");
  };

  return (
    <Card>
      <Eyebrow color="bg-tm-amber">Reconstitution</Eyebrow>
      {withRecon.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Peptide">
          {withRecon.map((i) => (
            <button
              key={i.id}
              role="radio"
              aria-checked={i.id === picked.id}
              onClick={() => select(i.id)}
              className={cn(
                "min-h-11 cursor-pointer rounded-[14px] border px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]",
                i.id === picked.id
                  ? "border-tm-ink bg-tm-ink text-white"
                  : "border-tm-rule bg-tm-panel text-tm-dim",
              )}
            >
              {i.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <NumField label="Vial (mg)" value={vialMg} placeholder={String(config.vialMg)} onChange={setVialMg} />
        <NumField label="BAC water (mL)" value={bacMl} placeholder={String(config.bacMl)} onChange={setBacMl} />
        <NumField label="Dose (mcg)" value={doseMcg} placeholder={String(picked.dose)} onChange={setDoseMcg} />
        <NumField
          label="Syringe (u/mL)"
          value={unitsPerMl}
          placeholder={String(config.syringeUnitsPerMl)}
          onChange={setUnitsPerMl}
        />
      </div>

      {result ? (
        <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-tm-rule bg-tm-rule">
          <Stat className="bg-tm-soft px-3 py-2.5" value={`${fmt(result.syringeUnits)}`} label="syringe units"/>
          <Stat className="bg-tm-soft px-3 py-2.5" value={`${fmt(result.mlPerDose)} mL`} label="per dose"/>
          <Stat className="bg-tm-soft px-3 py-2.5" value={`${fmt(result.mgPerMl)}`} label="mg per mL"/>
        </dl>
      ) : (
        <p className="mt-3 rounded-[14px] bg-tm-amber-bg px-3 py-2.5 text-[13px] text-tm-amber-ink">
          {error}
        </p>
      )}

      <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
        Arithmetic on the numbers you entered: vial strength, diluent, wanted dose. It reads no dose
        off a label and recommends none. Units are marks on a {fmt(values.syringeUnitsPerMl)} u/mL
        syringe, rounded to the nearest half mark.
      </p>
    </Card>
  );
}

function NumField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        className="min-h-11 w-full rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 py-2 font-tm-mono text-sm focus:border-tm-ink"
      />
    </label>
  );
}

/* ===== interactions, legend, disclaimer ===== */

function InteractionsCard({ interactions }: { interactions: StackData["interactions"] }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-yellow">Interactions on this file</Eyebrow>
      {interactions.length === 0 ? (
        <p className="text-[13px] text-tm-dim">
          No known pair on the file. Absence of a note here is not clearance. The list only covers
          compounds the catalogue recognises.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {interactions.map((x) => (
            <li key={`${x.a}-${x.b}`} className="border-b border-tm-grid pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">
                  {x.aName} + {x.bName}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-[18px] border px-2 py-[3px] font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
                    x.severity === "caution"
                      ? "border-tm-amber bg-tm-amber-bg text-tm-amber"
                      : "border-tm-rule bg-tm-panel text-tm-dim",
                  )}
                >
                  {x.severity}
                </span>
              </div>
              <p className="mt-1 text-[13px]">{x.note}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EvidenceLegend() {
  return (
    <Card>
      <Eyebrow color="bg-tm-dim2">Evidence tiers</Eyebrow>
      <ul className="flex flex-col gap-1.5">
        {EVIDENCE_ORDER.map((tier) => (
          <li key={tier} className="flex items-start gap-2">
            <span className={cn("mt-1.5 inline-block size-1.5 shrink-0 rounded-full", EVIDENCE_DOT[tier])} />
            <span className="text-[13px]">
              <b className="font-tm-mono text-[11.5px] tracking-[0.12em] uppercase">{tier}</b>{" "}
              {EVIDENCE_NOTES[tier]}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DisclaimerCard({ text }: { text: string }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-red">Standing note</Eyebrow>
      <p className="text-[13px]">{text}</p>
    </Card>
  );
}
