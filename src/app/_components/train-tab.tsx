"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MESO_DELOAD_WEEK, exerciseName, type MesoGoal } from "@convex/tm/data/exercises";
import { useTimento } from "../_lib/backend";
import type { TrainData } from "../_lib/types";
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
      <div className="flex flex-col gap-3 pt-4">
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">Train — floor</Eyebrow>
          <p className="font-tm-disp text-xl leading-tight">Movement only</p>
          <p className="mt-2 text-[12.5px] text-tm-amber-ink">
            Survival is the floor, not a lite programme: no block, no volume targets, no session to
            make up. Walk, stretch, keep the joint moving. The mesocycle waits.
          </p>
        </Card>
        {train.loggedSets.length > 0 && <LoggedTodayCard sets={train.loggedSets} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      {train.mesocycle ? <MesoCard meso={train.mesocycle} readiness={train.readiness} /> : <StartMesoCard />}

      {train.today.blocks.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <Eyebrow color="bg-tm-green" className="mb-0">
              {train.today.dayName}
            </Eyebrow>
            <span className="font-tm-mono text-[10px] text-tm-dim">
              {train.loggedSets.length}/{plannedSets(train.today.blocks)} sets
            </span>
          </div>
          {train.today.blocks.map((block) => (
            <BlockCard key={block.exercise} block={block} logged={train.loggedSets} />
          ))}
        </>
      ) : (
        train.mesocycle && (
          <Card>
            <Eyebrow color="bg-tm-blue">{train.today.dayName}</Eyebrow>
            <p className="text-[12.5px]">
              Nothing programmed today. Recovery is where the adaptation lands — an extra session
              here costs more than it buys.
            </p>
          </Card>
        )
      )}

      {train.weeklyVolume.length > 0 && <VolumeCard rows={train.weeklyVolume} />}

      {train.prs.length > 0 && (
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
                  <span className="font-tm-mono text-[9.5px] text-tm-dim">{pr.date}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="px-1 pb-2 font-tm-mono text-[10px] leading-relaxed text-tm-dim">
        Evidence: moderate. Double progression and MEV/MAV/MRV are planning heuristics, not measured
        thresholds for you. e1RM is Epley arithmetic over your own reps and RIR — an estimate, never
        a tested max. Loads here are suggestions from the block you configured.
      </p>
    </div>
  );
}

/** Compact Train summary for the Today tab. */
export function TrainTodayCard() {
  const { train, today, actions } = useTimento();
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
        <p className="mt-1 text-[12px] text-tm-amber-ink">No block, no volume target, nothing owed.</p>
      </Card>
    );

  const planned = plannedSets(train.today.blocks);
  const first = train.today.blocks[0];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow color="bg-tm-green" className="mb-0">
          Train
        </Eyebrow>
        {train.mesocycle && (
          <span className="font-tm-mono text-[10px] text-tm-dim">
            week {train.mesocycle.week}/{train.mesocycle.weeks}
            {train.mesocycle.isDeload ? " · deload" : ""}
          </span>
        )}
      </div>
      <p className="mt-1 font-tm-disp text-lg leading-tight">{train.today.dayName}</p>
      {planned > 0 ? (
        <div className="mt-2 flex items-end gap-6">
          <Stat value={`${train.loggedSets.length}/${planned}`} label="sets logged" />
          {first && (
            <Stat
              value={first.suggestionKg > 0 ? `${first.suggestionKg.toFixed(1)} kg` : "—"}
              label={exerciseName(first.exercise)}
            />
          )}
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-tm-dim">Nothing programmed. Recovery counts.</p>
      )}
      {planned > 0 && (
        <button
          type="button"
          disabled={today?.day.sessionDone}
          onClick={() => actions.markSessionDone()}
          className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-tm-ink px-4 font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase disabled:opacity-40"
        >
          {today?.day.sessionDone ? "Session logged" : "Mark session done"}
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
        <span className="font-tm-mono text-[10px] text-tm-dim">{meso.phase}</span>
      </div>
      <div className="mt-2.5 flex gap-1" aria-label={`Week ${meso.week} of ${meso.weeks}`}>
        {weeks.map((w) => (
          <span
            key={w}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-[4px] border font-tm-mono text-[10px]",
              w === meso.week
                ? meso.isDeload
                  ? "border-tm-amber bg-tm-amber text-white"
                  : "border-tm-green bg-tm-green text-white"
                : w === deloadWeek
                  ? "border-tm-amber bg-tm-amber-bg text-tm-amber"
                  : "border-tm-rule bg-tm-panel text-tm-dim",
            )}
          >
            {w === deloadWeek ? "D" : w}
          </span>
        ))}
      </div>
      <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
        week {meso.week} of {meso.weeks} · D = deload · readiness ×{readiness.multiplier.toFixed(2)}{" "}
        — {readiness.note}
      </p>
    </Card>
  );
}

function StartMesoCard() {
  const { actions } = useTimento();
  const goals: { goal: MesoGoal; blurb: string }[] = [
    { goal: "hypertrophy", blurb: "6 weeks, sets near MAV, 1–2 RIR." },
    { goal: "strength", blurb: "6 weeks, heavier top sets, more rest." },
    { goal: "recomp", blurb: "6 weeks, volume held while the deficit runs." },
  ];
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">No block running</Eyebrow>
      <p className="text-[12.5px]">
        A mesocycle gives the progression something to progress against. Six weeks, week six is the
        deload.
      </p>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {goals.map((g) => (
          <button
            key={g.goal}
            onClick={() => actions.startMesocycle(g.goal)}
            className="min-h-11 cursor-pointer rounded-lg border border-tm-rule bg-tm-panel px-3 py-2 text-left"
          >
            <span className="font-tm-mono text-[10px] tracking-[0.12em] uppercase">{g.goal}</span>
            <span className="block text-[11.5px] text-tm-dim">{g.blurb}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function BlockCard({ block, logged }: { block: Block; logged: TrainData["loggedSets"] }) {
  const { actions } = useTimento();
  const sets = logged.filter((s) => s.exercise === block.exercise).sort((a, b) => a.setIndex - b.setIndex);
  const nextIndex = sets.length;
  const done = nextIndex >= block.sets;
  const [kg, setKg] = useState(block.suggestionKg > 0 ? String(block.suggestionKg) : "");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState(String(block.rirTarget));

  const submit = () => {
    const weightKg = Number(kg);
    const repCount = Number(reps);
    const rirValue = Number(rir);
    if (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 500) return;
    if (!Number.isFinite(repCount) || repCount < 1 || repCount > 100) return;
    if (!Number.isFinite(rirValue) || rirValue < 0 || rirValue > 10) return;
    actions.logSet(block.exercise, nextIndex, weightKg, repCount, rirValue);
    setReps("");
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold">{exerciseName(block.exercise)}</h3>
          <p className="font-tm-mono text-[10px] tracking-[0.1em] text-tm-dim uppercase">
            {block.muscle} · {block.sets} × {block.repLow}–{block.repHigh} @ {block.rirTarget} RIR
          </p>
        </div>
        <span className="font-tm-mono text-[10px] text-tm-dim">
          {sets.length}/{block.sets}
        </span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-3">
        <span className="font-tm-disp text-[26px] leading-none">
          {block.suggestionKg > 0 ? block.suggestionKg.toFixed(1) : "—"}
        </span>
        <span className="font-tm-mono text-[10px] text-tm-dim">
          suggested kg
          {block.lastTopSet
            ? ` · last ${block.lastTopSet.weightKg.toFixed(1)} × ${block.lastTopSet.reps} @ ${block.lastTopSet.rir}`
            : " · no history"}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-tm-ink">{block.why}</p>

      {sets.length > 0 && (
        <ul className="mt-2">
          {sets.map((s) => (
            <li
              key={s.setIndex}
              className="flex items-center justify-between border-b border-tm-grid py-1.5 last:border-0 font-tm-mono text-[11px]"
            >
              <span className="text-tm-dim">set {s.setIndex + 1}</span>
              <span>
                {s.weightKg.toFixed(1)} × {s.reps} @ {s.rir} RIR
              </span>
              <span className="text-tm-dim">e1rm {s.e1rm.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-2.5 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <NumField label={`${exerciseName(block.exercise)} weight in kilograms`} placeholder="kg" value={kg} onChange={setKg} />
        <NumField label={`${exerciseName(block.exercise)} reps`} placeholder="reps" value={reps} onChange={setReps} />
        <NumField label={`${exerciseName(block.exercise)} reps in reserve`} placeholder="rir" value={rir} onChange={setRir} />
        <button
          type="submit"
          className={cn(
            "min-h-11 flex-1 cursor-pointer rounded-lg px-2 font-tm-mono text-[10px] tracking-[0.1em] uppercase",
            done ? "bg-tm-soft text-tm-dim" : "bg-tm-ink text-white",
          )}
        >
          Log set {nextIndex + 1}
        </button>
      </form>
      {done && (
        <p className="mt-1.5 font-tm-mono text-[10px] text-tm-green">
          Target sets done. Extra sets are logged, not required.
        </p>
      )}
    </Card>
  );
}

function NumField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      className="min-h-11 w-14 rounded-lg border border-tm-rule bg-tm-panel px-2 text-center font-tm-mono text-[12px] outline-none focus:border-tm-ink"
    />
  );
}

function VolumeCard({ rows }: { rows: VolumeRow[] }) {
  const flagged = rows.filter((r) => r.verdict !== "productive");
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Weekly hard sets — last 7 days</Eyebrow>
      <VolumeBars rows={rows} />
      {flagged.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {flagged.map((r) => (
            <li key={r.muscle} className="text-[12px]">
              <span className="font-tm-mono text-[10px] tracking-[0.1em] text-tm-dim uppercase">
                {r.muscle} · {r.verdict}
              </span>
              <span className="block text-tm-ink">{r.note}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
        Ticks mark MEV · MAV · MRV. Today&apos;s session counts once you log it. A landmark is a
        starting range, not a threshold measured on you.
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

function LoggedTodayCard({ sets }: { sets: TrainData["loggedSets"] }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Logged today</Eyebrow>
      <ul>
        {sets.map((s) => (
          <li
            key={`${s.exercise}-${s.setIndex}`}
            className="flex items-center justify-between border-b border-tm-grid py-1.5 last:border-0 font-tm-mono text-[11px]"
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
