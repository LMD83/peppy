"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import type { LabResultInput, LabsData } from "../_lib/types";
import { Card, Eyebrow, Stat } from "./ui";

type LabResult = LabsData["latestByMarker"][number];
type LabTrend = LabsData["trends"][number];
type LabPanel = LabsData["panels"][number];
type LabTemplate = LabsData["templates"][number];
type LabRecheck = LabsData["dueRechecks"][number];
type LabFlag = LabResult["flag"];

const FLAG_LABEL: Record<LabFlag, string> = {
  low: "below range",
  "borderline-low": "near low",
  "in-range": "in range",
  optimal: "optimal",
  "borderline-high": "near high",
  high: "above range",
};

const FLAG_CHIP: Record<LabFlag, string> = {
  low: "border-tm-red text-tm-red",
  "borderline-low": "border-tm-amber text-tm-amber",
  "in-range": "border-tm-rule text-tm-dim",
  optimal: "border-tm-green text-tm-green",
  "borderline-high": "border-tm-amber text-tm-amber",
  high: "border-tm-red text-tm-red",
};

const FLAG_MARK: Record<LabFlag, string> = {
  low: "fill-tm-red",
  "borderline-low": "fill-tm-amber",
  "in-range": "fill-tm-ink",
  optimal: "fill-tm-green",
  "borderline-high": "fill-tm-amber",
  high: "fill-tm-red",
};

const DIRECTION_MARK = { up: "▲", down: "▼", flat: "—" } as const;

/** Lab values carry their own precision — print what was measured, no padding. */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${fmt(n)}`;
}

/* ===== the tab ===== */

export function LabsTab() {
  const { labs } = useTimento();
  if (!labs) return <LabsSkeleton />;

  const trendByMarker = new Map(labs.trends.map((t) => [t.marker, t]));

  if (labs.survival) {
    return (
      <div className="flex flex-col gap-3 pt-4">
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">Bloods — floor</Eyebrow>
          <div className="flex items-end justify-between gap-3">
            <Stat value={String(labs.outOfRange.length)} label="outside range" />
            <Stat value={String(labs.dueRechecks.length)} label="rechecks overdue" />
          </div>
          <p className="mt-2.5 text-[12.5px] text-tm-amber-ink">
            Only what is already outside range and already owed. No panel history, no browsing, no
            new draw to book — the floor holds the line, it does not add work.
          </p>
        </Card>

        {labs.outOfRange.length > 0 && (
          <Card>
            <Eyebrow color="bg-tm-red">Outside range</Eyebrow>
            <div className="flex flex-col">
              {labs.outOfRange.map((r) => (
                <MarkerRow key={r.marker} result={r} trend={trendByMarker.get(r.marker) ?? null} />
              ))}
            </div>
          </Card>
        )}

        <RechecksCard rechecks={labs.dueRechecks} />
      </div>
    );
  }

  const latest = labs.panels[0] ?? null;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <LatestPanelCard panel={latest} results={labs.latestByMarker} />

      {labs.outOfRange.length > 0 && (
        <Card>
          <Eyebrow color="bg-tm-red">Outside range — read these first</Eyebrow>
          <div className="flex flex-col">
            {labs.outOfRange.map((r) => (
              <MarkerRow key={r.marker} result={r} trend={trendByMarker.get(r.marker) ?? null} />
            ))}
          </div>
          <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
            A reference interval holds 95% of a healthy population — sitting outside one is a prompt
            to look, not a diagnosis. Bring it to your GP, not to the internet.
          </p>
        </Card>
      )}

      <RechecksCard rechecks={labs.dueRechecks} />

      {labs.byGroup.map((group) => (
        <GroupCard
          key={group.group}
          label={group.label}
          markers={group.markers}
          trendByMarker={trendByMarker}
        />
      ))}

      <PanelHistory panels={labs.panels} />

      <AddPanel templates={labs.templates} />
    </div>
  );
}

/* ===== the compact card for Today ===== */

export function LabsTodayCard() {
  const { labs } = useTimento();
  if (!labs) {
    return <div className="h-24 rounded-[10px] border border-tm-rule bg-tm-panel" aria-busy="true" />;
  }

  const nearest = labs.dueRechecks[0] ?? null;
  const worst = labs.outOfRange[0] ?? null;
  const amber = labs.survival && (labs.outOfRange.length > 0 || labs.dueRechecks.length > 0);

  return (
    <Card tone={amber ? "amber" : "default"}>
      <Eyebrow color={amber ? "bg-tm-amber" : "bg-tm-purple"}>Bloods</Eyebrow>
      <div className="flex items-end justify-between gap-2">
        <Stat value={String(labs.outOfRange.length)} label="outside range" />
        <Stat
          value={nearest ? `${nearest.overdueDays} d` : "—"}
          label={nearest ? "recheck overdue" : "no recheck due"}
        />
      </div>
      <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
        {nearest
          ? `${nearest.name.toLowerCase()} last drawn ${nearest.lastDate}`
          : worst
            ? `${worst.name.toLowerCase()} ${FLAG_LABEL[worst.flag]} — ${fmt(worst.value)} ${worst.unit}`
            : "every marker inside its reference interval"}
      </p>
    </Card>
  );
}

/* ===== pieces ===== */

function LabsSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-[10px] border border-tm-rule bg-tm-panel" />
      ))}
      <p className="text-center font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase">
        Loading bloods…
      </p>
    </div>
  );
}

function LatestPanelCard({ panel, results }: { panel: LabPanel | null; results: LabResult[] }) {
  if (!panel) {
    return (
      <Card>
        <Eyebrow color="bg-tm-purple">Bloods</Eyebrow>
        <p className="text-[12.5px] text-tm-dim">
          No panel on file. Add one below and every later draw becomes a trend instead of a number
          on a page.
        </p>
      </Card>
    );
  }

  const counts = results.reduce(
    (acc, r) => {
      if (r.flag === "low" || r.flag === "high") acc.out += 1;
      else if (r.flag === "optimal") acc.optimal += 1;
      else if (r.flag === "in-range") acc.inRange += 1;
      else acc.borderline += 1;
      return acc;
    },
    { out: 0, borderline: 0, inRange: 0, optimal: 0 },
  );

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow color="bg-tm-purple" className="mb-0">
          Latest panel — {panel.name}
        </Eyebrow>
        <span className="font-tm-mono text-[9px] tracking-[0.12em] text-tm-dim uppercase">
          {panel.fasted === true ? "fasted" : panel.fasted === false ? "non-fasted" : "—"}
        </span>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <Stat value={String(counts.out)} label="outside range" />
        <Stat value={String(counts.borderline)} label="near a bound" />
        <Stat value={String(counts.optimal)} label="optimal band" />
        <Stat value={String(results.length)} label="markers on file" />
      </div>
      <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
        drawn {panel.date}
        {panel.lab ? ` · ${panel.lab}` : ""} · {panel.results.length} results this panel
      </p>
    </Card>
  );
}

function RechecksCard({ rechecks }: { rechecks: LabRecheck[] }) {
  if (rechecks.length === 0) return null;
  return (
    <Card tone="amber">
      <Eyebrow color="bg-tm-amber">Rechecks overdue</Eyebrow>
      <ul>
        {rechecks.map((r) => (
          <li
            key={r.marker}
            className="flex items-center justify-between border-b border-tm-rule py-2 last:border-0"
          >
            <span className="text-[13px] font-medium">{r.name}</span>
            <span className="font-tm-mono text-[10.5px] text-tm-amber-ink">
              {r.overdueDays} d over · last {r.lastDate}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-tm-mono text-[10px] text-tm-amber-ink">
        Interval suggested from the flag on your own last draw. A prompt to book, never a
        prescription — your GP sets what actually gets repeated.
      </p>
    </Card>
  );
}

function GroupCard({
  label,
  markers,
  trendByMarker,
}: {
  label: string;
  markers: LabResult[];
  trendByMarker: Map<string, LabTrend>;
}) {
  const flagged = markers.some((m) => m.flag === "low" || m.flag === "high");
  const [open, setOpen] = useState(flagged);

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-10 w-full cursor-pointer items-center justify-between text-left"
      >
        <Eyebrow color={flagged ? "bg-tm-red" : "bg-tm-dim2"} className="mb-0">
          {label}
        </Eyebrow>
        <span className="font-tm-mono text-[10px] text-tm-dim">
          {markers.length} {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="mt-1 flex flex-col">
          {markers.map((m) => (
            <MarkerRow key={m.marker} result={m} trend={trendByMarker.get(m.marker) ?? null} />
          ))}
        </div>
      )}
    </Card>
  );
}

function MarkerRow({ result, trend }: { result: LabResult; trend: LabTrend | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-tm-grid last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${result.name}: ${fmt(result.value)} ${result.unit}, ${FLAG_LABEL[result.flag]}`}
        className="flex min-h-10 w-full cursor-pointer flex-col gap-1 py-2 text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium">{result.name}</span>
          <span className="shrink-0 font-tm-mono text-[12px]">
            {fmt(result.value)} <span className="text-tm-dim">{result.unit}</span>
          </span>
        </div>
        <RangeBar result={result} />
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-xl border px-2 py-[2px] font-tm-mono text-[9px] tracking-[0.1em] uppercase",
              FLAG_CHIP[result.flag],
            )}
          >
            {FLAG_LABEL[result.flag]}
          </span>
          <span className="font-tm-mono text-[10px] text-tm-dim">
            {result.delta
              ? `${DIRECTION_MARK[result.delta.direction]} ${signed(result.delta.change)} ${result.unit} since ${result.delta.sinceDate}`
              : `first draw · ${result.date}`}
          </span>
        </div>
      </button>

      {open && (
        <div className="mb-2 rounded-lg bg-tm-soft p-3">
          {trend && trend.points.length >= 2 && <Sparkline trend={trend} />}
          <p className="text-[12.5px]">{result.blurb}</p>
          {result.movedBy.length > 0 && (
            <p className="mt-1.5 font-tm-mono text-[10px] text-tm-dim">
              moved by — {result.movedBy.join(" · ")}
            </p>
          )}
          <p className="mt-1.5 font-tm-mono text-[10px] text-tm-dim">
            reference {result.refLow === null || result.refHigh === null
              ? "not on file"
              : `${fmt(result.refLow)}–${fmt(result.refHigh)} ${result.unit}`}
            {result.optimalLow !== null && result.optimalHigh !== null
              ? ` · optimal ${fmt(result.optimalLow)}–${fmt(result.optimalHigh)} (evidence-backed band)`
              : " · no optimal band claimed"}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Where the value sits across the reference interval, with the optimal band
 * marked. The axis is padded a quarter of the interval either side so an
 * out-of-range value still lands on the bar instead of off its end.
 */
function RangeBar({ result }: { result: LabResult }) {
  if (result.refLow === null || result.refHigh === null) return null;
  const span = result.refHigh - result.refLow;
  if (span <= 0) return null;

  const pad = span * 0.25;
  const min = result.refLow - pad;
  const max = result.refHigh + pad;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

  const refX = pos(result.refLow);
  const refW = pos(result.refHigh) - refX;
  const hasOptimal = result.optimalLow !== null && result.optimalHigh !== null;
  const optX = hasOptimal ? pos(result.optimalLow as number) : 0;
  const optW = hasOptimal ? pos(result.optimalHigh as number) - optX : 0;
  const valueX = pos(result.value);

  return (
    <svg
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      className="h-[10px] w-full"
      role="img"
      aria-label={`${fmt(result.value)} ${result.unit} against a reference interval of ${fmt(result.refLow)} to ${fmt(result.refHigh)}`}
    >
      <rect x="0" y="3" width="100" height="2" className="fill-tm-grid" />
      <rect x={refX} y="2.5" width={refW} height="3" className="fill-tm-green-faint" />
      {hasOptimal && <rect x={optX} y="2.5" width={optW} height="3" className="fill-tm-green-mid" />}
      <rect x={Math.max(0, valueX - 0.6)} y="0" width="1.2" height="8" className={FLAG_MARK[result.flag]} />
    </svg>
  );
}

function Sparkline({ trend }: { trend: LabTrend }) {
  const W = 100;
  const H = 24;
  const step = trend.points.length > 1 ? W / (trend.points.length - 1) : W;
  const points = trend.points
    .map((p, i) => `${(i * step).toFixed(1)},${(H - 2 - p.y01 * (H - 4)).toFixed(1)}`)
    .join(" ");
  const first = trend.points[0];
  const last = trend.points[trend.points.length - 1];

  return (
    <div className="mb-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[34px] w-full"
        role="img"
        aria-label={`${trend.name} from ${fmt(first.value)} on ${first.date} to ${fmt(last.value)} on ${last.date}`}
      >
        <polyline points={points} className="fill-none stroke-tm-blue" strokeWidth="1.5" />
      </svg>
      <div className="flex justify-between font-tm-mono text-[9.5px] text-tm-dim">
        <span>
          {fmt(first.value)} · {first.date}
        </span>
        <span>
          {fmt(last.value)} · {last.date} · {trend.points.length} draws
        </span>
      </div>
    </div>
  );
}

function PanelHistory({ panels }: { panels: LabPanel[] }) {
  if (panels.length === 0) return null;
  return (
    <Card>
      <Eyebrow color="bg-tm-dim2">Panel history</Eyebrow>
      <ul>
        {panels.map((p) => {
          const out = p.results.filter((r) => r.flag === "low" || r.flag === "high").length;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between border-b border-tm-grid py-2 last:border-0"
            >
              <span className="text-[13px] font-medium">
                {p.name}{" "}
                <span className="font-tm-mono text-[10px] text-tm-dim">
                  {p.fasted === true ? "fasted" : p.fasted === false ? "non-fasted" : ""}
                </span>
              </span>
              <span className="shrink-0 font-tm-mono text-[10.5px] text-tm-dim">
                {p.date} · {p.results.length} markers · {out} out
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AddPanel({ templates }: { templates: LabTemplate[] }) {
  const { actions } = useTimento();
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [fasted, setFasted] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});

  const template = useMemo(
    () => templates.find((t) => t.key === templateKey) ?? null,
    [templates, templateKey],
  );

  if (templates.length === 0) return null;

  const filled: LabResultInput[] = template
    ? template.markers
        .map((m) => ({ marker: m.key, value: Number(values[m.key]), unit: m.unit }))
        .filter((r) => values[r.marker] !== undefined && values[r.marker] !== "" && Number.isFinite(r.value))
    : [];

  const save = () => {
    if (!template || filled.length === 0) return;
    actions.addLabPanel(template.name, filled, fasted);
    setTemplateKey(null);
    setValues({});
  };

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Add a panel</Eyebrow>
      {template === null ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.key}
                onClick={() => setTemplateKey(t.key)}
                className="min-h-10 cursor-pointer rounded-lg border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[9.5px] tracking-[0.1em] uppercase"
              >
                {t.name}
              </button>
            ))}
          </div>
          <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
            Pick the panel your lab ran, type the numbers off the report. Units are fixed to the SI
            values Irish labs print — no conversion guessing.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold">{template.name}</span>
            <button
              onClick={() => setTemplateKey(null)}
              className="min-h-10 cursor-pointer font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase"
            >
              Change
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {template.markers.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-2">
                <label htmlFor={`lab-${m.key}`} className="text-[12.5px]">
                  {m.name}{" "}
                  <span className="font-tm-mono text-[10px] text-tm-dim">
                    {fmt(m.refLow)}–{fmt(m.refHigh)}
                  </span>
                </label>
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    id={`lab-${m.key}`}
                    value={values[m.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))}
                    inputMode="decimal"
                    placeholder="—"
                    className="min-h-10 w-20 rounded-lg border border-tm-rule bg-tm-panel px-2 py-2 text-right font-tm-mono text-sm outline-none focus:border-tm-ink"
                  />
                  <span className="w-16 font-tm-mono text-[10px] text-tm-dim">{m.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Fasted state">
            {[
              { key: "fasted", label: "Fasted", on: true },
              { key: "non-fasted", label: "Non-fasted", on: false },
            ].map((opt) => (
              <button
                key={opt.key}
                role="radio"
                aria-checked={fasted === opt.on}
                onClick={() => setFasted(opt.on)}
                className={cn(
                  "min-h-10 flex-1 cursor-pointer rounded-lg border font-tm-mono text-[9.5px] tracking-[0.1em] uppercase",
                  fasted === opt.on
                    ? "border-tm-ink bg-tm-ink text-white"
                    : "border-tm-rule bg-tm-panel text-tm-dim",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={save}
            disabled={filled.length === 0}
            className={cn(
              "mt-2 min-h-10 w-full cursor-pointer rounded-lg px-4 font-tm-mono text-[10px] tracking-[0.12em] uppercase",
              filled.length === 0 ? "bg-tm-soft text-tm-dim" : "bg-tm-ink text-white",
            )}
          >
            Save {filled.length} {filled.length === 1 ? "result" : "results"}
          </button>
          <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
            Blank rows are skipped — a panel records what was measured, never a gap filled in.
          </p>
        </>
      )}
    </Card>
  );
}
