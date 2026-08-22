"use client";

import { useTimento } from "../_lib/backend";
import { Card, Eyebrow, Stat, TmButton } from "./ui";
import { ConsistencyWall, MassChart } from "./charts";

export function ProgressTab() {
  const { progress, today, date, actions } = useTimento();
  if (!progress || !today) return null;

  const reviewDate = today.user.reviewDate;
  const reviewDue = reviewDate !== null && reviewDate <= date;

  return (
    <div className="flex flex-col gap-4 pt-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      {reviewDue && (
        <Card tone="amber" className="lg:col-span-12">
          <Eyebrow color="bg-tm-amber">
            {today.user.mode === "survival" ? "Survival review due" : "Review prompt"}
          </Eyebrow>
          <p className="text-[14px] text-tm-amber-ink">
            Review date <b className="font-tm-mono">{reviewDate}</b> is due. Revisit mode: keep the floor, or step
            back to cut / maintain.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <TmButton
              variant="soft"
              onClick={() => actions.setMode("survival", undefined, nextReview(date))}
            >
              Keep floor +28d
            </TmButton>
            <TmButton variant="ghost" onClick={() => actions.setMode("cut")}>
              Back to cut
            </TmButton>
            <TmButton variant="ghost" onClick={() => actions.setMode("maintain")}>
              Maintain
            </TmButton>
          </div>
        </Card>
      )}

      {!reviewDue && reviewDate && (
        <Card className="lg:col-span-12">
          <Eyebrow color="bg-tm-amber">Review on file</Eyebrow>
          <p className="text-[14px]">
            Next review prompt: <b className="font-tm-mono">{reviewDate}</b>
          </p>
        </Card>
      )}

      <Card className="lg:col-span-7">
        <Eyebrow color="bg-tm-blue">Mass: actual vs 0.5 kg/wk</Eyebrow>
        <MassChart series={progress.series} ceilingKg={progress.ceilingKg} />
        <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
          Amber line = survival ceiling. It never disappears. It is the floor you defend in a bad season.
        </p>
      </Card>

      <Card className="lg:col-span-5">
        <Eyebrow color="bg-tm-green">Consistency, 14 days</Eyebrow>
        <ConsistencyWall wall={progress.wall} />
        <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-tm-rule bg-tm-rule">
          <Stat className="bg-tm-panel px-3 py-3" value={`${progress.adherence7}%`} label="7-day"/>
          <Stat className="bg-tm-panel px-3 py-3" value={`${progress.streak}`} label="Streak"/>
          <dl className="bg-tm-panel px-3 py-3">
            <Stat
              value={`${Math.abs(progress.deltaKg).toFixed(1)}`}
              label={progress.deltaKg <= 0 ? "kg down" : "kg up"}
            />
          </dl>
        </dl>
      </Card>
    </div>
  );
}

function nextReview(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 28);
  return d.toISOString().slice(0, 10);
}
