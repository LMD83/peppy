"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";

export function Scoreboard() {
  const { today, actions, date } = useTimento();
  const [confirmMode, setConfirmMode] = useState(false);
  if (!today) return null;

  const { user, stats, latestKg, deltaKg, dayNumber } = today;
  const survival = user.mode === "survival";
  const title = survival ? `Floor protocol — hold < ${user.ceilingKg}` : user.protocolTitle;

  const cells: [string, string, string, string][] = [
    ["Mass", `${latestKg.toFixed(1)} kg`, survival ? `ceiling ${user.ceilingKg.toFixed(1)}` : `Δ ${deltaKg > 0 ? "+" : ""}${deltaKg.toFixed(1)} kg`, "bg-tm-blue"],
    ["Day", `${dayNumber}`, `week ${Math.ceil(dayNumber / 7)}`, "bg-tm-dim2"],
    survival
      ? ["Floor", `${stats.todayDone}/${stats.todayTotal}`, "today's checks", "bg-tm-amber"]
      : ["Adherence", `${stats.adherence7}%`, `${stats.streak}-day streak`, "bg-tm-green"],
  ];

  return (
    <header className="bg-tm-ink px-4 pt-[18px] pb-4">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-2">
          <div className="font-tm-mono text-[10px] tracking-[0.2em] text-tm-dim2 uppercase">
            Performance file · {user.name}
          </div>
          <button
            onClick={() => setConfirmMode(true)}
            className={cn(
              "cursor-pointer rounded-[20px] border px-2.5 py-[5px] font-tm-mono text-[10px] tracking-[0.1em] uppercase",
              survival ? "border-tm-amber bg-tm-amber text-[#1a1205]" : "border-tm-inkrule bg-tm-ink3 text-[#c9cdd4]",
            )}
          >
            {user.mode} mode ⇄
          </button>
        </div>
        <h1 className="mt-1.5 font-tm-disp text-2xl leading-tight text-white uppercase">{title}</h1>
        {survival && (
          <p className="mt-1 font-tm-mono text-[10.5px] text-tm-amber">
            Executing as designed.{user.reviewDate ? ` Review prompt: ${user.reviewDate}.` : ""} Zero guilt clause active.
          </p>
        )}
        <dl className="mt-4 flex overflow-hidden rounded-lg border border-tm-inkrule bg-tm-ink2">
          {cells.map(([label, value, sub, color], i) => (
            <div key={label} className={cn("flex-1 px-3 py-3", i > 0 && "border-l border-tm-inkrule")}>
              <dt className="font-tm-mono text-[9px] tracking-[0.16em] text-tm-dim2 uppercase">{label}</dt>
              <dd className="my-0.5 font-tm-disp text-[22px] text-white">{value}</dd>
              <dd className="flex items-center gap-1.5">
                <span aria-hidden className={cn("inline-block h-[3px] w-3", color)} />
                <span className="font-tm-mono text-[9px] text-tm-dim2">{sub}</span>
              </dd>
            </div>
          ))}
        </dl>
        {confirmMode && (
          <ModeSwitcher current={user.mode} date={date} onClose={() => setConfirmMode(false)} onPick={(m, review) => {
            actions.setMode(m, undefined, review);
            setConfirmMode(false);
          }} />
        )}
      </div>
    </header>
  );
}

function ModeSwitcher({
  current,
  date,
  onClose,
  onPick,
}: {
  current: "cut" | "maintain" | "survival";
  date: string;
  onClose: () => void;
  onPick: (mode: "cut" | "maintain" | "survival", reviewDate?: string) => void;
}) {
  const options = [
    { mode: "cut" as const, blurb: "Full five checks, deficit targets, weekly weigh-in." },
    { mode: "maintain" as const, blurb: "Band goal ±1.5 kg. Four checks. Tripwires pre-written." },
    { mode: "survival" as const, blurb: "Three checks only. Ceiling re-anchors. An executed decision — not a lapse." },
  ];
  const defaultReview = `${Number(date.slice(0, 4))}-${date.slice(5, 7)}-${date.slice(8, 10)}`;
  return (
    <div role="dialog" aria-label="Switch mode" className="mt-3 rounded-lg border border-tm-inkrule bg-tm-ink3 p-3">
      <p className="mb-2 font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim2 uppercase">Switch mode — takes effect now</p>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <button
            key={o.mode}
            disabled={o.mode === current}
            onClick={() => onPick(o.mode, o.mode === "survival" ? nextReview(defaultReview) : undefined)}
            className={cn(
              "cursor-pointer rounded-md border border-tm-inkrule px-3 py-2 text-left disabled:opacity-40",
              "bg-tm-ink2 text-[12.5px] text-[#e6e8ec]",
            )}
          >
            <span className="font-tm-mono text-[10px] tracking-[0.12em] uppercase">{o.mode}</span>
            <span className="block text-[11.5px] text-tm-dim2">{o.blurb}</span>
          </button>
        ))}
      </div>
      <button onClick={onClose} className="mt-2 w-full cursor-pointer rounded-md py-1.5 font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim2 uppercase">
        Keep {current}
      </button>
    </div>
  );
}

function nextReview(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 28);
  return d.toISOString().slice(0, 10);
}
