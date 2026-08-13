"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import type { FuelData, MealSlot } from "../_lib/types";
import { Card, Eyebrow, Stat } from "./ui";

type FoodOption = FuelData["foods"][number];
type SlotView = FuelData["slots"][number];

const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

/* ===== the tab ===== */

export function FuelTab() {
  const { fuel, today, actions } = useTimento();
  if (!fuel || !today) return <FuelSkeleton />;

  if (fuel.survival) {
    const proteinLeft = Math.max(0, fuel.remaining.proteinG);
    return (
      <div className="flex flex-col gap-3 pt-4">
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">Fuel — floor</Eyebrow>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="font-tm-disp text-[34px] leading-none">{fmt(proteinLeft)} g</div>
              <div className="mt-1 font-tm-mono text-[9px] tracking-[0.16em] text-tm-dim uppercase">
                protein left · target {fmt(fuel.targets.proteinG)} g
              </div>
            </div>
            <div className="text-right">
              <div className="font-tm-disp text-[22px] leading-none">{today.user.kitchenClose}</div>
              <div className="mt-1 font-tm-mono text-[9px] tracking-[0.16em] text-tm-dim uppercase">
                kitchen closes
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Bar
              label="Protein"
              value={fuel.totals.proteinG}
              target={fuel.targets.proteinG}
              unit="g"
              tone="fill-tm-amber"
            />
          </div>
          <p className="mt-2.5 text-[12.5px] text-tm-amber-ink">
            Protein and a closed kitchen. No macro tracking, no plan, no shopping list — the floor
            adds nothing, it only stops the drift.
          </p>
        </Card>
      </div>
    );
  }

  const kcalLeft = fuel.remaining.kcal;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <Card>
        <Eyebrow color="bg-tm-green">Today — energy</Eyebrow>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className={cn("font-tm-disp text-[34px] leading-none", kcalLeft < 0 && "text-tm-red")}>
              {fmt(Math.abs(kcalLeft))}
            </div>
            <div className="mt-1 font-tm-mono text-[9px] tracking-[0.16em] text-tm-dim uppercase">
              kcal {kcalLeft < 0 ? "over target" : "left"}
            </div>
          </div>
          <div className="text-right">
            <Stat value={`${fuel.totals.kcal}`} label={`of ${fuel.targets.kcal} eaten`} />
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          <Bar label="Energy" value={fuel.totals.kcal} target={fuel.targets.kcal} unit="kcal" tone="fill-tm-green" ceiling />
          <Bar label="Protein" value={fuel.totals.proteinG} target={fuel.targets.proteinG} unit="g" tone="fill-tm-blue" />
          <Bar label="Carbs" value={fuel.totals.carbsG} target={fuel.targets.carbsG} unit="g" tone="fill-tm-yellow" />
          <Bar label="Fat" value={fuel.totals.fatG} target={fuel.targets.fatG} unit="g" tone="fill-tm-amber" />
          <Bar label="Fibre" value={fuel.totals.fiberG} target={fuel.targets.fiberG} unit="g" tone="fill-tm-purple" />
          <Bar label="Salt" value={fuel.sodiumUsedMg} target={fuel.targets.sodiumMgMax} unit="mg sodium" tone="fill-tm-dim2" ceiling />
        </div>
      </Card>

      <TdeeCard tdee={fuel.tdee} />

      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow color="bg-tm-green" className="mb-0">
            Plan &amp; log
          </Eyebrow>
          <button
            onClick={() => actions.generateMealPlan()}
            className="min-h-10 cursor-pointer rounded-lg bg-tm-ink px-3 font-tm-mono text-[10px] tracking-[0.12em] text-white uppercase"
          >
            Generate day
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-3">
          {fuel.slots.map((slot) => (
            <SlotBlock key={slot.slot} slot={slot} />
          ))}
        </div>
        <p className="mt-2.5 font-tm-mono text-[10px] text-tm-dim">
          Tap a row when you eat it. Generating replaces the untouched plan rows only — anything
          already eaten stays on the record.
        </p>
      </Card>

      <AddFood foods={fuel.foods} />

      <WeekStrip week={fuel.week} targetKcal={fuel.targets.kcal} />

      <Card>
        <Eyebrow color="bg-tm-purple">Shopping — planned, not yet eaten</Eyebrow>
        {fuel.shoppingList.length === 0 ? (
          <p className="text-[12.5px] text-tm-dim">
            Nothing queued. Generate a day, or keep logging as you go.
          </p>
        ) : (
          <ul>
            {fuel.shoppingList.map((item) => (
              <li
                key={item.foodKey}
                className="flex items-center justify-between border-b border-tm-grid py-2 last:border-0"
              >
                <span className="text-[13px] font-medium">{item.name}</span>
                <span className="font-tm-mono text-[10.5px] text-tm-dim">
                  {item.grams} g · {item.portionLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ===== the compact card for Today ===== */

export function FuelTodayCard() {
  const { fuel, today } = useTimento();
  if (!fuel || !today) {
    return <div className="h-24 rounded-[10px] border border-tm-rule bg-tm-panel" aria-busy="true" />;
  }

  if (fuel.survival) {
    return (
      <Card tone="amber">
        <Eyebrow color="bg-tm-amber">Fuel — floor</Eyebrow>
        <div className="flex items-end justify-between gap-3">
          <Stat value={`${fmt(Math.max(0, fuel.remaining.proteinG))} g`} label="protein left" />
          <Stat value={today.user.kitchenClose} label="kitchen closes" />
        </div>
      </Card>
    );
  }

  const next = nextSlot(fuel.slots);
  return (
    <Card>
      <Eyebrow color="bg-tm-green">Fuel</Eyebrow>
      <div className="flex items-end justify-between gap-2">
        <Stat value={`${fmt(Math.max(0, fuel.remaining.kcal))}`} label="kcal left" />
        <Stat value={`${fmt(Math.max(0, fuel.remaining.proteinG))} g`} label="protein left" />
        <Stat value={`${fuel.sodiumUsedMg}`} label={`of ${fuel.targets.sodiumMgMax} mg salt`} />
      </div>
      <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
        {next ? `next up — ${next.label.toLowerCase()}` : "every slot logged"}
      </p>
    </Card>
  );
}

function nextSlot(slots: SlotView[]): SlotView | null {
  const ordered = SLOT_ORDER.map((s) => slots.find((x) => x.slot === s)).filter(
    (s): s is SlotView => s !== undefined,
  );
  return ordered.find((s) => s.eatenCount < s.total) ?? ordered.find((s) => s.total === 0) ?? null;
}

/* ===== pieces ===== */

function FuelSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-[10px] border border-tm-rule bg-tm-panel" />
      ))}
      <p className="text-center font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase">
        Loading fuel…
      </p>
    </div>
  );
}

function Bar({
  label,
  value,
  target,
  unit,
  tone,
  ceiling = false,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  tone: string;
  /** Target is a ceiling to stay under, not a goal to reach. */
  ceiling?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  const over = target > 0 && value > target;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase">
          {label}
        </span>
        <span
          className={cn("font-tm-mono text-[10.5px]", over && ceiling ? "text-tm-red" : "text-tm-ink")}
        >
          {fmt(value)}
          <span className="text-tm-dim">
            {" "}
            / {fmt(target)} {unit}
          </span>
        </span>
      </div>
      <svg
        viewBox="0 0 100 4"
        preserveAspectRatio="none"
        className="mt-1 h-[7px] w-full"
        role="img"
        aria-label={`${label}: ${fmt(value)} of ${fmt(target)} ${unit}`}
      >
        <rect x="0" y="0" width="100" height="4" className="fill-tm-grid" />
        <rect
          x="0"
          y="0"
          width={pct}
          height="4"
          className={over && ceiling ? "fill-tm-red" : tone}
        />
      </svg>
    </div>
  );
}

function TdeeCard({ tdee }: { tdee: FuelData["tdee"] }) {
  const adaptive = tdee.basis === "adaptive";
  const line = adaptive
    ? `14-day slope vs logged intake — ${signed(tdee.weightSlopeKgPerWeek)} kg/wk across ${tdee.weighInCount} weigh-ins, ${tdee.avgIntakeKcal} kcal averaged over ${tdee.intakeDays} days.`
    : `Estimated — Mifflin-St Jeor × activity. ${tdee.intakeDays}/10 intake days and ${tdee.weighInCount}/4 weigh-ins in the last 14. Log both and this switches to your own numbers.`;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow color={adaptive ? "bg-tm-blue" : "bg-tm-dim2"} className="mb-0">
          Energy out — {adaptive ? "adaptive" : "estimated"}
        </Eyebrow>
        <span className="font-tm-mono text-[9px] tracking-[0.12em] text-tm-dim uppercase">
          confidence {tdee.confidence}
        </span>
      </div>
      <div className="mt-1.5">
        <Stat value={`${tdee.tdeeKcal}`} label="kcal per day" />
      </div>
      <p className="mt-2 text-[12.5px]">{line}</p>
      {tdee.lastWeekly && (
        <p className="mt-1 font-tm-mono text-[10px] text-tm-dim">
          last stored weekly fit {tdee.lastWeekly.tdeeKcal} kcal · week of {tdee.lastWeekly.weekStart}
        </p>
      )}
      <p className="mt-1.5 font-tm-mono text-[10px] text-tm-dim">
        Population equation while estimated (moderate evidence); your own intake-vs-mass fit once
        adaptive. Correlated, never diagnostic.
      </p>
    </Card>
  );
}

function SlotBlock({ slot }: { slot: SlotView }) {
  const { actions } = useTimento();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase">
          {slot.label}
        </span>
        <span className="font-tm-mono text-[10px] text-tm-dim">
          {slot.kcal} kcal · {fmt(slot.proteinG)} g protein
        </span>
      </div>
      {slot.entries.length === 0 ? (
        <p className="mt-1 text-[12.5px] text-tm-dim">Empty.</p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {slot.entries.map((e) => (
            <div key={e.id} className="flex items-stretch gap-1.5">
              <button
                onClick={() => actions.setFoodEaten(e.id, !e.eaten)}
                aria-pressed={e.eaten}
                className={cn(
                  "flex min-h-10 flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left",
                  e.eaten
                    ? "border-tm-green bg-tm-green-faint"
                    : "border-tm-rule bg-tm-panel",
                )}
              >
                <span className="text-[13px] font-medium">
                  {e.name}{" "}
                  <span className="font-tm-mono text-[10.5px] text-tm-dim">{e.grams} g</span>
                </span>
                <span className="shrink-0 font-tm-mono text-[10.5px] text-tm-dim">
                  {e.kcal} · {fmt(e.proteinG)}p {e.eaten ? "✓" : "—"}
                </span>
              </button>
              <button
                onClick={() => actions.removeFood(e.id)}
                aria-label={`Remove ${e.name} from ${slot.label.toLowerCase()}`}
                className="min-h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-tm-rule bg-tm-panel font-tm-mono text-[13px] text-tm-dim"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddFood({ foods }: { foods: FoodOption[] }) {
  const { actions } = useTimento();
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<MealSlot>("lunch");
  const [picked, setPicked] = useState<FoodOption | null>(null);
  const [grams, setGrams] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0)
      return foods.filter((f) => f.tags.includes("high-protein") || f.tags.includes("quick")).slice(0, 6);
    return foods
      .filter((f) => f.name.toLowerCase().includes(q) || f.tags.some((t) => t.includes(q)))
      .slice(0, 8);
  }, [foods, query]);

  const log = (g: number) => {
    if (!picked || !Number.isFinite(g) || g <= 0) return;
    actions.logFood(slot, picked.key, Math.round(g));
    setPicked(null);
    setQuery("");
    setGrams("");
  };

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Add food</Eyebrow>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Meal slot">
        {SLOT_ORDER.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={slot === s}
            onClick={() => setSlot(s)}
            className={cn(
              "min-h-10 flex-1 cursor-pointer rounded-lg border font-tm-mono text-[9.5px] tracking-[0.1em] uppercase",
              slot === s ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule bg-tm-panel text-tm-dim",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPicked(null);
        }}
        placeholder="Search the catalogue"
        aria-label="Search foods"
        className="mt-2 min-h-10 w-full rounded-lg border border-tm-rule bg-tm-panel px-3 py-2 text-sm outline-none focus:border-tm-ink"
      />

      {picked === null ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {results.length === 0 && (
            <p className="text-[12.5px] text-tm-dim">
              Nothing in the file matches. The catalogue holds staples only — no invented foods.
            </p>
          )}
          {results.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setPicked(f);
                setGrams(String(f.portionG));
              }}
              className="flex min-h-10 cursor-pointer items-center justify-between rounded-lg border border-tm-rule bg-tm-panel px-3 py-2 text-left"
            >
              <span className="text-[13px] font-medium">{f.name}</span>
              <span className="font-tm-mono text-[10.5px] text-tm-dim">
                {f.kcalPer100} kcal · {fmt(f.proteinPer100G)} p /100 g
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded-lg bg-tm-soft p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold">{picked.name}</span>
            <button
              onClick={() => setPicked(null)}
              className="cursor-pointer font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase"
            >
              Change
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => log(picked.portionG)}
              className="min-h-10 cursor-pointer rounded-lg border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[10px] tracking-[0.1em] uppercase"
            >
              {picked.portionLabel} · {picked.portionG} g
            </button>
            <button
              onClick={() => log(100)}
              className="min-h-10 cursor-pointer rounded-lg border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[10px] tracking-[0.1em] uppercase"
            >
              100 g
            </button>
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              log(Number(grams));
            }}
          >
            <input
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              inputMode="numeric"
              aria-label="Grams"
              placeholder="g"
              className="min-h-10 w-24 rounded-lg border border-tm-rule bg-tm-panel px-3 py-2 font-tm-mono text-sm outline-none focus:border-tm-ink"
            />
            <button
              type="submit"
              className="min-h-10 flex-1 cursor-pointer rounded-lg bg-tm-ink px-4 font-tm-mono text-[10px] tracking-[0.12em] text-white uppercase"
            >
              Log to {slot}
            </button>
          </form>
          <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
            Reference values per 100 g, not an analysis of your shopping. Weigh it or accept the
            estimate — both are recorded the same way.
          </p>
        </div>
      )}
    </Card>
  );
}

function WeekStrip({ week, targetKcal }: { week: FuelData["week"]; targetKcal: number }) {
  const max = Math.max(targetKcal, ...week.days.map((d) => d.kcal), 1);
  const W = 7 * 20;
  const H = 46;
  const targetY = 40 - (targetKcal / max) * 36;

  return (
    <Card>
      <Eyebrow color="bg-tm-dim2">Week — intake vs target</Eyebrow>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Seven-day intake: ${week.daysLogged} days logged, ${week.avgKcal} kcal average against a ${targetKcal} kcal target`}
      >
        <line x1="0" x2={W} y1={targetY} y2={targetY} className="stroke-tm-rule" strokeWidth="1" strokeDasharray="3 3" />
        {week.days.map((d, i) => {
          const h = (d.kcal / max) * 36;
          return (
            <rect
              key={d.date}
              x={i * 20 + 3}
              y={40 - h}
              width="14"
              height={Math.max(d.kcal > 0 ? 1 : 0, h)}
              className={d.kcal > targetKcal ? "fill-tm-amber" : "fill-tm-green-mid"}
            />
          );
        })}
        {week.days.map((d, i) => (
          <text
            key={d.date}
            x={i * 20 + 10}
            y={45}
            textAnchor="middle"
            fontSize="6"
            className="fill-tm-dim font-tm-mono"
          >
            {d.date.slice(8)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex justify-between font-tm-mono text-[9.5px] text-tm-dim">
        <span>avg {week.avgKcal} kcal</span>
        <span>avg {fmt(week.avgProteinG)} g protein</span>
        <span>{week.daysLogged}/7 logged</span>
      </div>
    </Card>
  );
}
