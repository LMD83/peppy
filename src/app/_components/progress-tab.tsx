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
    <div className="flex flex-col gap-3 pt-4">
      {reviewDue && (
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">
            {today.user.mode === "survival" ? "Survival review due" : "Review prompt"}
          </Eyebrow>
          <p className="text-[13px] text-tm-amber-ink">
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
        <Card>
          <Eyebrow color="bg-tm-amber">Review on file</Eyebrow>
          <p className="text-[12.5px]">
            Next review prompt: <b className="font-tm-mono">{reviewDate}</b>
          </p>
        </Card>
      )}

      <Card>
        <Eyebrow color="bg-tm-blue">Mass: actual vs 0.5 kg/wk</Eyebrow>
        <MassChart series={progress.series} ceilingKg={progress.ceilingKg} />
        <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
          Amber line = survival ceiling. It never disappears. It is the floor you defend in a bad season.
        </p>
      </Card>

      <Card>
        <Eyebrow color="bg-tm-green">Consistency, 14 days</Eyebrow>
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

function nextReview(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 28);
  return d.toISOString().slice(0, 10);
}
