"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MESO_DELOAD_WEEK,
  exerciseName,
  type AgeBand,
  type Constraint,
  type Experience,
  type Kit,
  type MesoGoal,
  type Setting,
  type TrainingProfile,
} from "@convex/tm/data/exercises";
import { useTimento } from "../_lib/backend";
import type { TrainData } from "../_lib/types";
import { useFileNav } from "./file-nav";
import { Card, Eyebrow, Stat } from "./ui";
import { axisFontSize } from "./charts";

type Block = TrainData["today"]["blocks"][number];
type VolumeRow = TrainData["weeklyVolume"][number];

const VERDICT_FILL: Record<string, string> = {
  "below MEV": "fill-tm-dim2",
  productive: "fill-tm-green",
  "at MRV": "fill-tm-yellow",
  "over MRV": "fill-tm-red",
};

export function TrainTab() {
  const { train } = useTimento();
  if (!train) return <TrainSkeleton />;

  if (train.survival) {
    return (
      <div className="flex flex-col gap-4 pt-5">
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">Train, floor</Eyebrow>
          <p className="font-tm-disp text-2xl leading-[1.15] tracking-tight">Movement only</p>
          <p className="mt-2 text-[14px] text-tm-amber-ink">
            Survival is the floor, not a lite programme: no block, no volume targets, no session to
            make up. Walk, stretch, keep the joint moving. The mesocycle waits.
          </p>
          {train.survivalMove && (
            <p className="mt-2 text-[13px] text-tm-amber-ink">
              {train.survivalMove.minutes} min · {train.survivalMove.name}. {train.survivalMove.cue}
            </p>
          )}
        </Card>
        {train.loggedSets.length > 0 && <LoggedTodayCard sets={train.loggedSets} hideE1rm={train.voice === "easy"} />}
        <DetailsShelf train={train} />
      </div>
    );
  }

  const blocks = train.today.blocks;
  const planned = plannedSets(blocks);
  return <SessionRunner blocks={blocks} planned={planned} train={train} />;
}

/**
 * The session, one exercise at a time. "Next exercise" is a real button, not
 * an implication: the rack is taken, the shoulder says no, you move on. A
 * deferred block goes to the back of the queue, never off it — the day's work
 * does not shrink because it was reordered.
 */
function SessionRunner({
  blocks,
  planned,
  train,
}: {
  blocks: Block[];
  planned: number;
  train: TrainData;
}) {
  const [deferred, setDeferred] = useState<string[]>([]);

  const queue = useMemo(() => {
    const back = deferred
      .map((key) => blocks.find((b) => b.exercise === key))
      .filter((b): b is Block => b !== undefined);
    return [...blocks.filter((b) => !deferred.includes(b.exercise)), ...back];
  }, [blocks, deferred]);

  const unfinished = (b: Block) =>
    train.loggedSets.filter((s) => s.exercise === b.exercise).length < b.sets;
  const focusIndex = queue.findIndex(unfinished);
  const focus = focusIndex >= 0 ? queue[focusIndex] : undefined;
  const upcoming = focus ? queue.slice(focusIndex + 1).find(unfinished) : undefined;

  return (
    <div className="flex flex-col gap-4 pt-5">
      {!train.mesocycle && <StartMesoCard />}

      {blocks.length > 0 ? (
        <>
          <div>
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">
                {train.today.dayName}
              </h2>
              <span className="font-tm-mono text-[11.5px] text-tm-dim">
                {train.loggedSets.length}/{planned} sets
              </span>
            </div>
            {train.mesocycle && (
              <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">{train.mesocycle.name}</p>
            )}
            {focus && (
              <p className="mt-1 text-[14px]">
                {focusIndex + 1} of {blocks.length} · {exerciseName(focus.exercise)}
              </p>
            )}
          </div>
          {focus ? (
            <BlockCard key={focus.exercise} block={focus} logged={train.loggedSets} voice={train.voice} />
          ) : (
            <SessionDoneCard logged={train.loggedSets.length} planned={planned} />
          )}
          {focus && upcoming && (
            <button
              type="button"
              onClick={() =>
                setDeferred((prev) => [
                  ...prev.filter((key) => key !== focus.exercise),
                  focus.exercise,
                ])
              }
              className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 py-2 text-left transition-transform duration-150 active:scale-[0.98]"
            >
              <span className="min-w-0">
                <span className="block font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-dim uppercase">
                  Next exercise
                </span>
                <span className="block text-[14px]">
                  {exerciseName(upcoming.exercise)} — switch now, this one goes to the back
                </span>
              </span>
              <span aria-hidden className="shrink-0 font-tm-mono text-[15px]">
                →
              </span>
            </button>
          )}
        </>
      ) : (
        train.mesocycle && (
          <Card>
            <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">
              {train.today.dayName}
            </h2>
            <p className="mt-2 text-[14px]">
              Nothing programmed today. Recovery is where the adaptation lands. An extra session
              here costs more than it buys.
            </p>
          </Card>
        )
      )}

      {train.weeklyVolume.length > 0 && <VolumeCard rows={train.weeklyVolume} voice={train.voice} />}
      <DetailsShelf train={train} />
    </div>
  );
}

/** Compact Train summary for the Today tab. */
export function TrainTodayCard() {
  const { train, today } = useTimento();
  const go = useFileNav();
  if (!train)
    return (
      <Card>
        <Eyebrow color="bg-tm-green">Train</Eyebrow>
        <div className="h-9 animate-pulse rounded bg-tm-grid" />
      </Card>
    );

  if (train.survival)
    return (
      <Card tone="amber">
        <Eyebrow color="bg-tm-amber">Train — floor</Eyebrow>
        <p className="font-tm-disp text-lg leading-tight">Movement only</p>
        <p className="mt-1 text-[13px] text-tm-amber-ink">No block, no volume target, nothing owed.</p>
      </Card>
    );

  const planned = plannedSets(train.today.blocks);
  const logged = train.loggedSets.length;
  const focus = train.today.blocks.find((b) => {
    const done = train.loggedSets.filter((s) => s.exercise === b.exercise).length;
    return done < b.sets;
  });
  const done = planned > 0 && !focus;
  const label = today?.day.sessionDone || done ? "Open session" : logged > 0 ? "Continue" : "Start session";

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow color="bg-tm-green" className="mb-0">
          Train
        </Eyebrow>
        {train.mesocycle && (
          <span className="font-tm-mono text-[11.5px] text-tm-dim">
            week {train.mesocycle.week}/{train.mesocycle.weeks}
            {train.mesocycle.isDeload ? " · deload" : ""}
          </span>
        )}
      </div>
      <p className="mt-1 font-tm-disp text-lg leading-tight">{train.today.dayName}</p>
      {planned > 0 ? (
        <dl className="mt-2 flex items-end gap-6">
          <Stat value={`${logged}/${planned}`} label="sets logged" />
          {focus && (
            <Stat
              value={focus.suggestionKg > 0 ? `${focus.suggestionKg.toFixed(1)} kg` : `${focus.repLow} reps`}
              label={exerciseName(focus.exercise)}
            />
          )}
        </dl>
      ) : (
        <p className="mt-1 text-[13px] text-tm-dim">Nothing programmed. Recovery counts.</p>
      )}
      {planned > 0 && (
        <button
          type="button"
          onClick={() => go("train")}
          className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[14px] bg-tm-stamp px-4 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-onstamp uppercase"
        >
          {label}
        </button>
      )}
    </Card>
  );
}

function plannedSets(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + b.sets, 0);
}

function TrainSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <div className="h-2.5 w-24 animate-pulse rounded bg-tm-grid" />
          <div className="mt-3 h-8 w-full animate-pulse rounded bg-tm-grid" />
        </Card>
      ))}
    </div>
  );
}

function MesoCard({
  meso,
  readiness,
}: {
  meso: NonNullable<TrainData["mesocycle"]>;
  readiness: TrainData["readiness"];
}) {
  const weeks = Array.from({ length: meso.weeks }, (_, i) => i + 1);
  // The block's own deload week when we're standing in it, otherwise the
  // configured one from the template that built it.
  const deloadWeek = meso.isDeload ? meso.week : Math.min(MESO_DELOAD_WEEK, meso.weeks);
  return (
    <Card tone={meso.isDeload ? "amber" : "default"}>
      <div className="flex items-center justify-between">
        <Eyebrow color={meso.isDeload ? "bg-tm-amber" : "bg-tm-green"} className="mb-0">
          {meso.name}
        </Eyebrow>
        <span className="font-tm-mono text-[11.5px] text-tm-dim">{meso.phase}</span>
      </div>
      <div className="mt-2.5 flex gap-1" aria-label={`Week ${meso.week} of ${meso.weeks}`}>
        {weeks.map((w) => (
          <span
            key={w}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-[4px] border font-tm-mono text-[11.5px]",
              w === meso.week
                ? meso.isDeload
                  ? "border-tm-amber bg-tm-amber text-tm-onamber"
                  : "border-tm-green bg-tm-green text-tm-ongreen"
                : w === deloadWeek
                  ? "border-tm-amber bg-tm-amber-bg text-tm-amber"
                  : "border-tm-rule bg-tm-panel text-tm-dim",
            )}
          >
            {w === deloadWeek ? "D" : w}
          </span>
        ))}
      </div>
      <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
        week {meso.week} of {meso.weeks} · D = deload · readiness ×{readiness.multiplier.toFixed(2)}.{" "}
        {readiness.note}
      </p>
    </Card>
  );
}

function StartMesoCard() {
  const { actions } = useTimento();
  const goals: { goal: MesoGoal; blurb: string }[] = [
    { goal: "hypertrophy", blurb: "6 weeks. Build muscle. Leave a couple in the tank." },
    { goal: "strength", blurb: "6 weeks. Heavier top sets, more rest." },
    { goal: "recomp", blurb: "6 weeks. Hold the work while the deficit runs." },
  ];
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">No block running</Eyebrow>
      <p className="text-[13px]">
        A mesocycle gives the progression something to progress against. Six weeks, week six is the
        deload.
      </p>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {goals.map((g) => (
          <button
            key={g.goal}
            onClick={() => actions.startMesocycle(g.goal)}
            className="min-h-11 cursor-pointer rounded-[14px] border border-tm-rule bg-tm-panel px-3 py-2 text-left transition-transform duration-150 active:scale-[0.98]"
          >
            <span className="font-tm-mono text-[11.5px] tracking-[0.12em] uppercase">{g.goal}</span>
            <span className="block text-[11.5px] text-tm-dim">{g.blurb}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function BlockCard({
  block,
  logged,
  voice,
}: {
  block: Block;
  logged: TrainData["loggedSets"];
  voice: TrainData["voice"];
}) {
  const { actions } = useTimento();
  const sets = logged.filter((s) => s.exercise === block.exercise).sort((a, b) => a.setIndex - b.setIndex);
  const nextIndex = sets.length;
  const last = block.lastTopSet;
  const [kg, setKg] = useState(
    block.suggestionKg > 0 ? String(block.suggestionKg) : last ? String(last.weightKg) : "0",
  );
  const [reps, setReps] = useState(last ? String(last.reps) : String(block.repLow));
  const [rir, setRir] = useState(String(block.rirTarget));
  const [rest, setRest] = useState(0);
  const [change, setChange] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);

  useEffect(() => {
    if (rest <= 0) return;
    const id = window.setTimeout(() => setRest((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [rest]);

  const submit = () => {
    const weightKg = Number(kg);
    const repCount = Number(reps);
    const rirValue = Number(rir);
    if (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 500) return;
    if (!Number.isFinite(repCount) || repCount < 1 || repCount > 100) return;
    if (!Number.isFinite(rirValue) || rirValue < 0 || rirValue > 10) return;
    actions.logSet(block.exercise, nextIndex, weightKg, repCount, rirValue);
    setRest(90);
    setChange(false);
    setSwapOpen(false);
  };

  const kgNum = Number(kg);
  const loadLine = kgNum > 0 ? `${kgNum.toFixed(1)} × ${reps}` : `${reps} reps`;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-tm-disp text-xl leading-[1.15] tracking-tight uppercase">{exerciseName(block.exercise)}</h3>
          <p className="font-tm-mono text-[11.5px] text-tm-dim">{block.targetLine}</p>
        </div>
        <span className="font-tm-mono text-[11.5px] text-tm-dim">
          {sets.length}/{block.sets}
        </span>
      </div>
      <p className="mt-1.5 text-[14px] text-tm-ink">{block.cue}</p>

      <p className="mt-3 font-tm-disp text-[32px] leading-none tracking-tight">{loadLine}</p>
      {last && (
        <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">
          last {last.weightKg.toFixed(1)} × {last.reps}
        </p>
      )}

      {sets.length > 0 && (
        <ul className="mt-2">
          {sets.map((s) => (
            <li
              key={s.setIndex}
              className="flex items-center justify-between border-b border-tm-grid py-1.5 last:border-0 font-tm-mono text-[11.5px]"
            >
              <span className="text-tm-dim">set {s.setIndex + 1}</span>
              <span>
                {s.weightKg.toFixed(1)} × {s.reps}
                {voice === "standard" ? ` @ ${s.rir}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {rest > 0 ? (
        <button
          type="button"
          onClick={() => setRest(0)}
          className="mt-3 min-h-11 w-full cursor-pointer rounded-[14px] bg-tm-stamp font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-onstamp uppercase transition-transform duration-150 active:scale-[0.98]"
        >
          Rest {rest}s · skip
        </button>
      ) : (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {change && (
            <div className="flex gap-1.5">
              <NumField
                label={`${exerciseName(block.exercise)} weight in kilograms`}
                microlabel="KG"
                placeholder="kg"
                value={kg}
                onChange={setKg}
              />
              <NumField
                label={`${exerciseName(block.exercise)} reps`}
                microlabel="REPS"
                placeholder="reps"
                value={reps}
                onChange={setReps}
              />
              <NumField
                label={`${exerciseName(block.exercise)} reps in reserve`}
                microlabel="RIR"
                placeholder="rir"
                value={rir}
                onChange={setRir}
              />
            </div>
          )}
          <button
            type="submit"
            className="min-h-14 w-full cursor-pointer rounded-[14px] bg-tm-stamp font-tm-mono text-[13px] tracking-[0.1em] text-tm-onstamp uppercase transition-transform duration-150 active:scale-[0.98]"
          >
            Log set {nextIndex + 1}
          </button>
        </form>
      )}

      {rest <= 0 && (
        <div className="mt-1.5 flex gap-1.5">
          <button
            type="button"
            onClick={() => setChange((v) => !v)}
            className="min-h-11 flex-1 cursor-pointer rounded-[14px] border border-tm-rule font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]"
          >
            {change ? "Hide numbers" : "Change"}
          </button>
          {block.swaps.length > 0 && (
            <button
              type="button"
              onClick={() => setSwapOpen((v) => !v)}
              className="min-h-11 flex-1 cursor-pointer rounded-[14px] border border-tm-rule font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]"
            >
              {swapOpen ? "Keep this" : "Can't do this"}
            </button>
          )}
        </div>
      )}

      {swapOpen && block.swaps.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {block.swaps.map((swap) => (
            <button
              key={swap.key}
              type="button"
              onClick={() => actions.swapTrainBlock(block.exercise, swap.key)}
              className="min-h-11 cursor-pointer rounded-[14px] border border-tm-rule bg-tm-panel px-3 text-left font-tm-mono text-[11.5px] tracking-[0.08em] uppercase transition-transform duration-150 active:scale-[0.98]"
            >
              {swap.name}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function SessionDoneCard({ logged, planned }: { logged: number; planned: number }) {
  const { today, actions } = useTimento();
  return (
    <Card>
      <p className="font-tm-disp text-2xl leading-[1.15] tracking-tight">Session done</p>
      <p className="mt-1 text-[14px] text-tm-dim">
        {logged}/{planned} sets logged.
      </p>
      <button
        type="button"
        disabled={today?.day.sessionDone}
        onClick={() => actions.markSessionDone()}
        className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[14px] bg-tm-stamp px-4 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-onstamp uppercase disabled:opacity-40"
      >
        {today?.day.sessionDone ? "Session logged" : "Mark session done"}
      </button>
    </Card>
  );
}

function DetailsShelf({ train }: { train: TrainData }) {
  return (
    <details className="rounded-[14px] border border-tm-rule bg-tm-panel">
      <summary className="min-h-11 cursor-pointer list-none px-4 py-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase [&::-webkit-details-marker]:hidden">
        Details
      </summary>
      <div className="flex flex-col gap-3 border-t border-tm-grid px-4 pt-3 pb-4">
        {train.mesocycle && <MesoCard meso={train.mesocycle} readiness={train.readiness} />}
        <ProfileCard profile={train.profile} />
        {train.voice === "standard" && train.prs.length > 0 && (
          <Card>
            <Eyebrow color="bg-tm-purple">Best estimated 1RM</Eyebrow>
            <ul>
              {train.prs.map((pr) => (
                <li
                  key={pr.exercise}
                  className="flex items-center justify-between border-b border-tm-grid py-2 last:border-0"
                >
                  <span className="text-[13px] font-medium">{exerciseName(pr.exercise)}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-tm-mono text-[13px]">{pr.e1rm.toFixed(1)} kg</span>
                    <span className="font-tm-mono text-[11.5px] text-tm-dim">{pr.date}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <p className="font-tm-mono text-[11.5px] leading-relaxed text-tm-dim">
          Evidence: moderate. The session is filtered from the block you configured: setting, kit and
          stated limits, not a diagnosis. Double progression and volume landmarks are planning
          heuristics. e1RM is Epley arithmetic over your own reps, never a tested max.
        </p>
      </div>
    </details>
  );
}

/**
 * The placeholder ("kg" / "reps" / "rir") is only visible while the field is
 * empty, and these fields open prefilled with the suggested load — so once a
 * number is in there, the placeholder is gone and the field is a bare
 * digit with no name. The microlabel above it says what it is regardless of
 * whether there is a value inside, in the same 11.5px mono-eyebrow grammar
 * every other label on this screen uses.
 */
function NumField({
  label,
  microlabel,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  microlabel: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1">
      <span aria-hidden className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">
        {microlabel}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        aria-label={label}
        placeholder={placeholder}
        className="min-h-11 w-14 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-2 text-center font-tm-mono text-[13px] focus:border-tm-ink"
      />
    </label>
  );
}

function VolumeCard({ rows, voice }: { rows: VolumeRow[]; voice: TrainData["voice"] }) {
  const flagged = rows.filter((r) => r.verdict !== "productive");
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Weekly hard sets</Eyebrow>
      <VolumeBars rows={rows} />
      {flagged.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {flagged.map((r) => (
            <li key={r.muscle} className="text-[13px]">
              <span className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">
                {r.muscle} · {voice === "easy" ? r.verdictLabel : r.verdict}
              </span>
              <span className="block text-tm-ink">{r.note}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
        {voice === "easy"
          ? "Today’s session counts once you log it. The marks are a starting range, not a threshold measured on you."
          : "Ticks mark MEV · MAV · MRV. Today’s session counts once you log it. A landmark is a starting range, not a threshold measured on you."}
      </p>
    </Card>
  );
}

function VolumeBars({ rows }: { rows: VolumeRow[] }) {
  const W = 340;
  // Every length here is derived from the label size, because the label is the
  // part with a floor. "hamstrings" in uppercase mono with tracking is ~7em
  // wide, so the gutter is sized to hold it rather than to a number that
  // happened to look right at one width.
  const ts = axisFontSize(W);
  const ROW = Math.round(ts * 1.6);
  const H = rows.length * ROW + 4;
  const barX = Math.round(ts * 7.2);
  const barW = W - barX - Math.round(ts * 1.6);
  const summary = rows.map((r) => `${r.muscle} ${r.sets} sets, ${r.verdict}`).join("; ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-1 w-full"
      role="img"
      aria-label={`Weekly hard sets per muscle. ${summary}`}
    >
      {rows.map((r, i) => {
        const y = i * ROW + 4;
        const scale = Math.max(r.mrv, r.sets, 1);
        const x = (value: number) => barX + (Math.min(value, scale) / scale) * barW;
        return (
          <g key={r.muscle}>
            <text
              x={0}
              y={y + ts * 0.75}
              fontSize={ts}
              className="fill-tm-dim font-tm-mono tracking-[0.08em] uppercase"
            >
              {r.muscle}
            </text>
            <rect x={barX} y={y + 3} width={barW} height={7} rx={3.5} className="fill-tm-grid" />
            <rect
              x={barX}
              y={y + 3}
              width={Math.max(1, x(r.sets) - barX)}
              height={7}
              rx={3.5}
              className={VERDICT_FILL[r.verdict] ?? "fill-tm-dim2"}
            />
            <rect x={x(r.mev)} y={y} width={1} height={13} className="fill-tm-dim2" />
            <rect x={x(r.mav)} y={y} width={1} height={13} className="fill-tm-dim2" />
            <rect x={x(r.mrv)} y={y} width={1} height={13} className="fill-tm-dim" />
            <text x={W} y={y + ts * 0.75} textAnchor="end" fontSize={ts} className="fill-tm-ink font-tm-mono">
              {r.sets}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LoggedTodayCard({
  sets,
}: {
  sets: TrainData["loggedSets"];
  hideE1rm?: boolean;
}) {
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Logged today</Eyebrow>
      <ul>
        {sets.map((s) => (
          <li
            key={`${s.exercise}-${s.setIndex}`}
            className="flex items-center justify-between border-b border-tm-grid py-1.5 last:border-0 font-tm-mono text-[11.5px]"
          >
            <span>{exerciseName(s.exercise)}</span>
            <span>
              {s.weightKg.toFixed(1)} × {s.reps} @ {s.rir}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const SETTINGS: { id: Setting; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "gym", label: "Gym" },
  { id: "box", label: "Box" },
];
const EXPERIENCES: { id: Experience; label: string }[] = [
  { id: "new", label: "New" },
  { id: "returning", label: "Returning" },
  { id: "trained", label: "Trained" },
];
const AGE_BANDS: { id: AgeBand; label: string }[] = [
  { id: "under-40", label: "Under 40" },
  { id: "40-59", label: "40–59" },
  { id: "60-plus", label: "60+" },
];
const KITS: { id: Kit; label: string }[] = [
  { id: "none", label: "Bodyweight" },
  { id: "dumbbell", label: "Dumbbells" },
  { id: "band", label: "Bands" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "barbell", label: "Barbell" },
  { id: "machine", label: "Machines" },
  { id: "cable", label: "Cables" },
  { id: "bench", label: "Bench" },
  { id: "pull-up-bar", label: "Pull-up bar" },
  { id: "box", label: "Box" },
  { id: "rower", label: "Rower" },
  { id: "bike", label: "Bike" },
  { id: "jump-rope", label: "Rope" },
  { id: "rings", label: "Rings" },
  { id: "wall-ball", label: "Wall ball" },
];
const LIMITS: { id: Constraint; label: string }[] = [
  { id: "knees", label: "Knees" },
  { id: "shoulders", label: "Shoulders" },
  { id: "floor", label: "No floor work" },
  { id: "impact", label: "No impact" },
  { id: "overhead", label: "No overhead" },
];

function ProfileCard({ profile }: { profile: TrainingProfile }) {
  const { actions } = useTimento();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(profile);

  const save = () => {
    actions.saveTrainProfile(draft);
    setOpen(false);
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Eyebrow color="bg-tm-blue" className="mb-0">
            This session
          </Eyebrow>
          <p className="mt-1 text-[13px]">
            {SETTINGS.find((s) => s.id === profile.setting)?.label} ·{" "}
            {EXPERIENCES.find((s) => s.id === profile.experience)?.label} · {profile.minutes} min
            {profile.constraints.length > 0 ? ` · ${profile.constraints.join(", ")}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(profile);
            setOpen((v) => !v);
          }}
          className="min-h-11 cursor-pointer rounded-[14px] border border-tm-rule px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <ChipRow
            label="Where"
            options={SETTINGS}
            value={draft.setting}
            onChange={(setting) => setDraft({ ...draft, setting })}
          />
          <ChipRow
            label="Experience"
            options={EXPERIENCES}
            value={draft.experience}
            onChange={(experience) => setDraft({ ...draft, experience })}
          />
          <ChipRow
            label="Age band"
            options={AGE_BANDS}
            value={draft.ageBand}
            onChange={(ageBand) => setDraft({ ...draft, ageBand })}
          />
          <label className="flex flex-col gap-1">
            <span className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">Minutes</span>
            <input
              type="number"
              inputMode="numeric"
              aria-label="Session minutes"
              value={draft.minutes}
              onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) || 20 })}
              className="min-h-11 w-24 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-2 font-tm-mono text-[13px] focus:border-tm-ink"
            />
          </label>
          <ChipMulti
            label="Kit"
            options={KITS}
            value={draft.kit}
            onChange={(kit) => setDraft({ ...draft, kit })}
          />
          <ChipMulti
            label="Stated limits"
            options={LIMITS}
            value={draft.constraints}
            onChange={(constraints) => setDraft({ ...draft, constraints })}
          />
          <button
            type="button"
            onClick={save}
            className="min-h-11 cursor-pointer rounded-[14px] bg-tm-stamp font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-onstamp uppercase transition-transform duration-150 active:scale-[0.98]"
          >
            Save profile
          </button>
        </div>
      )}
    </Card>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "min-h-11 cursor-pointer rounded-[14px] border px-3 font-tm-mono text-[11.5px] tracking-[0.08em] uppercase transition-transform duration-150 active:scale-[0.98]",
              value === opt.id ? "border-tm-stamp bg-tm-stamp text-tm-onstamp" : "border-tm-rule bg-tm-panel",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ChipMulti<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <fieldset>
      <legend className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(on ? value.filter((x) => x !== opt.id) : [...value, opt.id])}
              className={cn(
                "min-h-11 cursor-pointer rounded-[14px] border px-3 font-tm-mono text-[11.5px] tracking-[0.08em] uppercase transition-transform duration-150 active:scale-[0.98]",
                on ? "border-tm-stamp bg-tm-stamp text-tm-onstamp" : "border-tm-rule bg-tm-panel",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
