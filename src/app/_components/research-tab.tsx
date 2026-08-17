"use client";

import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import { Card, Eyebrow } from "./ui";
import { TriggerMap } from "./charts";

const ENGINE_COPY: Record<string, string> = {
  depletion: "Engine read-out: depletion-dominant. The fix is upstream: sleep and the caffeine curfew, not willpower at 21:30.",
  emotion: "Engine read-out: emotion-dominant. The fix is naming the feeling and the substitute ritual, not a stricter plan.",
  cue: "Engine read-out: cue-dominant. The fix is environment design: remove the cue, close the kitchen.",
  mixed: "Engine read-out: mixed. Keep logging. The dominant channel usually declares itself by week three.",
  insufficient: "Not enough logs yet for a read-out. Two taps per urge; the map does the rest.",
};

const STATUS_STYLE: Record<string, string> = {
  running: "border-tm-green text-tm-green",
  supported: "border-tm-green text-tm-green",
  queued: "border-tm-dim text-tm-dim",
  refuted: "border-tm-red text-tm-red",
  unclear: "border-tm-yellow text-tm-yellow",
};

export function ResearchTab() {
  const { research } = useTimento();
  if (!research) return null;

  return (
    <div className="flex flex-col gap-4 pt-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <Card className="lg:col-span-7">
        <Eyebrow color="bg-tm-red">Trigger map</Eyebrow>
        <p className="mb-3 text-[14px] text-tm-dim">14 days of craving logs.</p>
        <TriggerMap triggerMap={research.triggerMap} />
        {research.peak && (
          <p className="mt-3 text-[14px] leading-relaxed">
            <b>Finding:</b> {research.peak.fromHour}:00-{research.peak.fromHour + 1}:00, trigger ={" "}
            {research.peak.signal} ({research.peak.share}%). The enemy has a schedule. So does the
            defence: 20:15 ritual + 20:30 close.
          </p>
        )}
        <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">{ENGINE_COPY[research.engine]}</p>
      </Card>

      <Card className="lg:col-span-5">
        <Eyebrow color="bg-tm-yellow">Experiments, n=1 ×2</Eyebrow>
        <ul>
          {research.experiments.map((e) => (
            <li key={e.code} className="border-b border-tm-grid py-2.5 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-medium">
                  {e.code} · {e.name}
                </span>
                <span className={cn("shrink-0 rounded-[10px] border px-2 py-0.5 font-tm-mono text-[11.5px] uppercase", STATUS_STYLE[e.status])}>
                  {e.status}
                </span>
              </div>
              <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">{e.note ?? e.metric}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:col-span-7">
        <Eyebrow color="bg-tm-yellow">Disputed markers</Eyebrow>
        <ul>
          {research.markers
            .filter((m) => m.status === "disputed")
            .map((m) => (
              /* No opacity here. Fading a whole row is the cheapest way to say
                 "this one is less certain" and it silently multiplies every
                 contrast ratio inside it — 75% took this text under 4.5:1. The
                 card's own heading already says these are disputed, so the
                 uncertainty is carried in words rather than in legibility. */
              <li key={m.gene} className="border-b border-tm-grid py-2 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-tm-mono text-[13px] font-medium">{m.gene}</span>
                  {/* Yellow is a surface colour in this palette, never a text
                      colour — it cannot clear 4.5:1 on panel at any size. */}
                  <span className="shrink-0 font-tm-mono text-[11.5px] text-tm-dim">resolves: {m.resolvesVia}</span>
                </div>
                <p className="font-tm-mono text-[11.5px] text-tm-dim">
                  CSV: {m.csvCall} · report: {m.reportCall}
                </p>
              </li>
            ))}
        </ul>
        {research.markers.some((m) => m.status === "confirmed") && (
          <details className="mt-2">
            <summary className="cursor-pointer font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
              Confirmed markers
            </summary>
            <ul className="mt-1">
              {research.markers
                .filter((m) => m.status === "confirmed")
                .map((m) => (
                  <li key={m.gene} className="flex justify-between py-1 font-tm-mono text-[11.5px]">
                    <span>{m.gene} {m.reportCall}</span>
                    <span className="text-tm-dim">{m.resolvesVia}</span>
                  </li>
                ))}
            </ul>
          </details>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-tm-mono text-[11.5px] text-tm-dim">
          {research.labs
            .filter((l) => l.recheckInDays !== null)
            .map((l) => (
              <span key={l.marker}>
                {l.marker} recheck in <b className="text-tm-ink">{l.recheckInDays} days</b>
                {l.note ? ` · ${l.note.split(".")[0]}` : ""}
              </span>
            ))}
          <span>PER3 winter layer arms 1 Oct</span>
        </div>
      </Card>

      <Card className="lg:col-span-5">
        <Eyebrow color="bg-tm-yellow">Labs, owner-only</Eyebrow>
        {research.labs.length === 0 ? (
          <p className="text-[13px] text-tm-dim">No labs on file. Only you can ever see this panel. The crew board never carries it.</p>
        ) : (
          <ul>
            {research.labs.map((l) => (
              <li key={`${l.marker}-${l.date}`} className="flex items-baseline justify-between border-b border-tm-grid py-2 last:border-0">
                <span className="text-[13px] font-medium">{l.marker}</span>
                <span className="font-tm-mono text-[11.5px]">
                  {l.value} <span className="text-tm-dim">{l.unit} · {l.date}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">Sat fat under 15 g stays lever #1 for the LDL line.</p>
      </Card>
    </div>
  );
}
