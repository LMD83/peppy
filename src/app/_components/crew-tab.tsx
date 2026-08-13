"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import { Card, Eyebrow, ModeBadge, Stat } from "./ui";

const NUDGES: Record<string, string[]> = {
  cut: ["On it", "Strong week", "Kitchen closed?", "Proud of the boring days"],
  maintain: ["Band's holding", "On it", "Weigh-in logged?", "Proud of the boring days"],
  survival: ["Floor's holding", "Proud of the boring days", "Review date soon", "On it"],
};

export function CrewTab() {
  const { crew, feed, actions, today } = useTimento();
  const [sent, setSent] = useState<string | null>(null);
  if (!crew || !today) return null;

  const partner = crew.find((m) => !m.isYou);
  const presets = NUDGES[partner?.mode ?? "cut"];

  return (
    <div className="flex flex-col gap-3 pt-4">
      {crew.map((m) => (
        <Card key={m.slug} className={cn(m.isYou && (m.mode === "survival" ? "border-tm-amber" : "border-tm-green"))}>
          <div className="flex items-center justify-between">
            <span className="font-tm-mono text-[13px] font-medium">
              {m.name}
              {m.isYou ? " · you" : ""}
            </span>
            <ModeBadge mode={m.mode} />
          </div>
          <div className="mt-3 flex gap-6">
            <Stat value={`${m.streak}`} label="Streak" />
            <Stat value={`${m.adherence7}%`} label="7-day" />
            <Stat value={`${m.todayDone}/${m.todayTotal}`} label="Today" />
            {m.mode === "survival" && <Stat value={`${m.daysInMode}`} label="Days on floor" />}
          </div>
          {m.mode === "survival" && (
            <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
              floor since {m.modeSince}
              {m.reviewDate ? ` · review ${m.reviewDate}` : ""}
            </p>
          )}
        </Card>
      ))}

      <Card>
        <Eyebrow color="bg-tm-green">Nudges — mode-aware</Eyebrow>
        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((n) => (
            <button
              key={n}
              onClick={() => {
                actions.nudge(n);
                setSent(n);
                setTimeout(() => setSent(null), 1500);
              }}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-2 font-tm-mono text-[11px]",
                sent === n ? "border-tm-green bg-tm-green text-white" : "border-tm-green text-tm-green",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <ul aria-label="Crew feed">
          {(feed ?? []).slice(-8).map((f, i) => (
            <li key={`${f.at}-${i}`} className="flex justify-between gap-3 border-b border-tm-grid py-1.5 font-tm-mono text-[11px] last:border-0">
              <span>
                <b>{f.name}</b> · {f.message}
              </span>
              <span className="shrink-0 text-tm-dim">{formatTime(f.at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function formatTime(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
