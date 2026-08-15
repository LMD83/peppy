"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/* Restrained ink-on-paper SVG charts. One axis, thin marks, recessive grid. */

/**
 * The narrowest this app's content column ever gets: a 320px viewport, less the
 * page gutter and the card's own padding.
 *
 * Everything inside a viewBox is painted through the same scale factor
 * (rendered width ÷ viewBox width), text included — so a chart label with a
 * fixed `fontSize` renders *smallest on the smallest screen*, which is exactly
 * backwards. The mass chart's date axis was 9px on a desktop and 6px on a
 * 320px phone: the reader with the least room got the least legible chart.
 *
 * `axisFontSize` inverts that. Sizing a label from the narrowest column pins
 * the worst case to the type floor and lets wider screens scale up from there,
 * so the floor is a floor everywhere rather than only where there is room.
 */
// Measured, not assumed: at a 320px viewport the rendered chart box is 253.3px
// once the page gutter and the card padding are taken out. Rounded down, so the
// floor is cleared rather than met exactly and lost to a rounding step.
export const NARROWEST_COLUMN_PX = 250;
export const TYPE_FLOOR_PX = 11.5;

export function axisFontSize(viewBoxWidth: number): number {
  // Ceil, never round: rounding down loses the floor by a tenth of a pixel, and
  // a floor you can round your way under is not a floor.
  return Math.ceil(((TYPE_FLOOR_PX * viewBoxWidth) / NARROWEST_COLUMN_PX) * 10) / 10;
}

const SIGNAL_COLORS: Record<string, string> = {
  tired: "#c7373f",
  bored: "#b8860b",
  emotion: "#2b5fab",
  cue: "#2e7d4f",
  hungry: "#8a5a9e",
};
const SIGNAL_ORDER = ["tired", "emotion", "cue", "bored", "hungry"];

export function MassChart({
  series,
  ceilingKg,
}: {
  series: { date: string; actual: number; target: number }[];
  ceilingKg: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();
  if (series.length === 0)
    return <p className="py-8 text-center text-[12.5px] text-tm-dim">No weigh-ins yet. Log one on Today.</p>;

  const W = 360;
  const H = 200;
  const ts = axisFontSize(W);
  // Axis gutters are sized from the label, not guessed: left holds a 2-digit
  // weight, bottom holds one line of date.
  const pad = { l: ts * 2.2, r: 10, t: 10, b: ts * 1.9 };
  const values = series.flatMap((s) => [s.actual, s.target]).concat([ceilingKg]);
  const yMin = Math.floor(Math.min(...values)) - 1;
  const yMax = Math.ceil(Math.max(...values)) + 1;
  const x = (i: number) =>
    pad.l + (series.length === 1 ? 0 : (i / (series.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + ((yMax - v) / (yMax - yMin)) * (H - pad.t - pad.b);
  const path = (key: "actual" | "target") =>
    series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(" ");
  const gridLines = [];
  for (let v = yMin + 1; v < yMax; v++) gridLines.push(v);
  const hovered = hover !== null ? series[hover] : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Mass chart: latest ${series[series.length - 1].actual} kg vs target ${series[series.length - 1].target} kg, ceiling ${ceilingKg} kg`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          for (let i = 1; i < series.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
          setHover(best);
        }}
      >
        <clipPath id={clipId}>
          <rect x={pad.l} y={0} width={W - pad.l - pad.r} height={H} />
        </clipPath>
        {gridLines.map((v) => (
          <line key={v} x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#eeefeb" strokeWidth="1" />
        ))}
        {gridLines
          .filter((v) => v % 2 === 0)
          .map((v) => (
            <text key={v} x={pad.l - 6} y={y(v) + ts * 0.35} textAnchor="end" fontSize={ts} fill="var(--color-tm-dim)" className="font-tm-mono">
              {v}
            </text>
          ))}
        {/* Four dates, not six. At the floor size a "08-01" is ~50 user units
            wide and six of them collide — the first two literally overlapped.
            A readable axis naming four days beats an unreadable one naming six. */}
        {series.map((s, i) =>
          i % Math.ceil(series.length / 4) === 0 ? (
            <text
              key={s.date}
              x={x(i)}
              y={H - ts * 0.4}
              textAnchor={i >= series.length - 1 ? "end" : i === 0 ? "start" : "middle"}
              fontSize={ts}
              fill="var(--color-tm-dim)"
              className="font-tm-mono"
            >
              {s.date.slice(5)}
            </text>
          ) : null,
        )}
        <g clipPath={`url(#${clipId})`}>
          <line x1={pad.l} x2={W - pad.r} y1={y(ceilingKg)} y2={y(ceilingKg)} stroke="#c77d1f" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d={path("target")} fill="none" stroke="var(--color-tm-dim)" strokeWidth="1.5" strokeDasharray="5 4" />
          <path d={path("actual")} fill="none" stroke="#2b5fab" strokeWidth="2" />
        </g>
        {series.map((s, i) => (
          <circle key={s.date} cx={x(i)} cy={y(s.actual)} r={hover === i ? 5 : 3.5} fill="#2b5fab" stroke="#ffffff" strokeWidth="1.5" />
        ))}
        {hovered !== null && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#15171c" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
            {/* The card grows with its text rather than clipping it: box and
                baselines are both derived from ts, so this cannot drift out of
                agreement with the axis it sits over. */}
            <g transform={`translate(${Math.min(x(hover) + 8, W - ts * 9.4)}, ${pad.t + 4})`}>
              <rect width={ts * 9} height={ts * 3.6} rx="6" fill="#15171c" />
              <text x={ts * 0.5} y={ts * 1.1} fontSize={ts} fill="var(--color-tm-onink)" className="font-tm-mono">{hovered.date}</text>
              <text x={ts * 0.5} y={ts * 2.2} fontSize={ts} fill="#ffffff" className="font-tm-mono">actual {hovered.actual.toFixed(1)} kg</text>
              <text x={ts * 0.5} y={ts * 3.3} fontSize={ts} fill="var(--color-tm-onink)" className="font-tm-mono">target {hovered.target.toFixed(1)} kg</text>
            </g>
          </g>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-tm-mono text-[10px] text-tm-dim">
        <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-[2px] w-4 bg-tm-blue" /> actual</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-[2px] w-4 border-t-2 border-dashed border-tm-dim" /> target 0.5 kg/wk</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-[2px] w-4 border-t-2 border-dashed border-tm-amber" /> survival ceiling</span>
      </div>
    </div>
  );
}

export function ConsistencyWall({ wall }: { wall: { date: string; done: number; total: number }[] }) {
  return (
    <div className="flex items-end gap-1.5" role="img" aria-label="14-day consistency wall">
      {wall.map((d) => {
        const ratio = d.total === 0 ? 0 : d.done / d.total;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.done}/${d.total}`}
            className={cn(
              "h-10 flex-1 rounded border border-tm-rule",
              ratio >= 0.8 ? "bg-tm-green" : ratio >= 0.4 ? "bg-tm-green-mid" : "bg-tm-green-faint",
            )}
          />
        );
      })}
    </div>
  );
}

export function TriggerMap({
  triggerMap,
}: {
  triggerMap: { hour: number; counts: Record<string, number> }[];
}) {
  if (triggerMap.length === 0)
    return <p className="py-6 text-center text-[12.5px] text-tm-dim">No craving logs yet — two weeks of taps builds the map.</p>;
  const max = Math.max(...triggerMap.map((t) => Object.values(t.counts).reduce((s, n) => s + n, 0)));
  const usedSignals = SIGNAL_ORDER.filter((s) => triggerMap.some((t) => (t.counts[s] ?? 0) > 0));
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: 96 }}>
        {triggerMap.map((t) => {
          const total = Object.values(t.counts).reduce((s, n) => s + n, 0);
          return (
            <div key={t.hour} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex w-full flex-col-reverse justify-start gap-[2px]"
                style={{ height: 72 }}
                title={`${t.hour}:00 — ${usedSignals.map((s) => `${s} ${t.counts[s] ?? 0}`).join(", ")}`}
              >
                {usedSignals.map((s) =>
                  (t.counts[s] ?? 0) > 0 ? (
                    <div
                      key={s}
                      className="w-full rounded-[2px]"
                      style={{ height: `${((t.counts[s] ?? 0) / max) * 68}px`, background: SIGNAL_COLORS[s] }}
                    />
                  ) : null,
                )}
              </div>
              <span className="font-tm-mono text-[8.5px] text-tm-dim">{t.hour}h</span>
              <span className="sr-only">{`${t.hour}:00 — ${total} logs`}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-tm-mono text-[10px] text-tm-dim">
        {usedSignals.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2 rounded-[2px]" style={{ background: SIGNAL_COLORS[s] }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
