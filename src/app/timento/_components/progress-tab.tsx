"use client";

import { useTimento } from "../_lib/backend";
import { Card, Eyebrow, Stat } from "./ui";
import { ConsistencyWall, MassChart } from "./charts";

export function ProgressTab() {
  const { progress } = useTimento();
  if (!progress) return null;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <Card>
        <Eyebrow color="bg-tm-blue">Mass — actual vs 0.5 kg/wk</Eyebrow>
        <MassChart series={progress.series} ceilingKg={progress.ceilingKg} />
        <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
          Amber line = survival ceiling. It never disappears — it&apos;s the floor you defend in a bad season.
        </p>
      </Card>

      <Card>
        <Eyebrow color="bg-tm-green">Consistency — 14 days</Eyebrow>
        <ConsistencyWall wall={progress.wall} />
        <div className="mt-3 flex gap-6">
          <Stat value={`${progress.adherence7}%`} label="7-day" />
          <Stat value={`${progress.streak}`} label="Streak" />
          <Stat
            value={`${Math.abs(progress.deltaKg).toFixed(1)}`}
            label={progress.deltaKg <= 0 ? "kg down" : "kg up"}
          />
        </div>
      </Card>
    </div>
  );
}
