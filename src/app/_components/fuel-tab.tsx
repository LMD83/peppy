"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  ALLERGEN_LABELS,
  EQUIPMENT_LABELS,
  SHELF_LABELS,
  type FoodEquipment,
} from "@convex/tm/data/foods";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import type { FuelData, MealSlot } from "../_lib/types";
import { Card, Eyebrow, Stat } from "./ui";
import { axisFontSize } from "./charts";

type FoodOption = FuelData["foods"][number];
type SlotView = FuelData["slots"][number];

const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

/**
 * Hand portions are the default reading of a plan; grams are one tap away.
 * Kitchen scales are a barrier, not a standard — but somebody weighing their
 * food should not have to do arithmetic to keep doing it.
 */
const PortionMode = createContext<"hands" | "grams">("hands");

function usePortionMode(): "hands" | "grams" {
  return useContext(PortionMode);
}

/** What one item costs to make, in the same grammar as a whole plan. */
function costOf(item: {
  equipment: FoodEquipment;
  hands: number;
  standingMinutes: number;
}): string {
  const time = item.standingMinutes > 0 ? `${item.standingMinutes} min` : "no prep";
  return `${time} · ${EQUIPMENT_LABELS[item.equipment]} · ${item.hands === 1 ? "one-handed" : "two hands"}`;
}

function PortionToggle({
  mode,
  onChange,
}: {
  mode: "hands" | "grams";
  onChange: (mode: "hands" | "grams") => void;
}) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Show portions as">
      {(["hands", "grams"] as const).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => onChange(m)}
          className={cn(
            "min-h-11 min-w-11 flex-1 cursor-pointer rounded-lg border px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
            mode === m
              ? "border-tm-ink bg-tm-ink text-white"
              : "border-tm-rule bg-tm-panel text-tm-dim",
          )}
        >
          {mode === m ? `✓ ${m}` : m}
        </button>
      ))}
    </div>
  );
}

/* ===== the tab ===== */

export function FuelTab() {
  const [portions, setPortions] = useState<"hands" | "grams">("hands");
  return (
    <PortionMode.Provider value={portions}>
      <FuelTabBody portions={portions} onPortions={setPortions} />
    </PortionMode.Provider>
  );
}

function FuelTabBody({
  portions,
  onPortions,
}: {
  portions: "hands" | "grams";
  onPortions: (mode: "hands" | "grams") => void;
}) {
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
              <div className="mt-1 font-tm-mono text-[11.5px] tracking-[0.16em] text-tm-dim uppercase">
                protein left · target {fmt(fuel.targets.proteinG)} g
              </div>
            </div>
            <div className="text-right">
              <div className="font-tm-disp text-[22px] leading-none">{today.user.kitchenClose}</div>
              <div className="mt-1 font-tm-mono text-[11.5px] tracking-[0.16em] text-tm-dim uppercase">
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
          <p className="mt-2.5 text-sm text-tm-amber-ink">
            Protein and a closed kitchen. No macro tracking, no plan, no shopping list — the floor
            adds nothing, it only stops the drift.
          </p>
        </Card>

        <FloorCard floor={fuel.floor} tone="amber" />

        <Card>
          <Eyebrow color="bg-tm-dim2">Portions</Eyebrow>
          <PortionToggle mode={portions} onChange={onPortions} />
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
            <div className="mt-1 font-tm-mono text-[11.5px] tracking-[0.16em] text-tm-dim uppercase">
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

      <KitchenCard kitchen={fuel.kitchen} />

      <Card>
        <div className="flex items-center justify-between gap-2">
          <Eyebrow color="bg-tm-green" className="mb-0">
            Plan &amp; log
          </Eyebrow>
          <button
            onClick={() => actions.generateMealPlan()}
            className="min-h-11 cursor-pointer rounded-lg bg-tm-ink px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase"
          >
            Generate day
          </button>
        </div>
        {fuel.proposal && (
          <p className="mt-2 rounded-lg bg-tm-soft px-3 py-2 text-sm">
            <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
              Generating costs
            </span>
            <br />
            <span className="font-tm-disp text-base">{fuel.proposal.effortSummary}</span>
            <span className="text-tm-dim">
              {" "}
              · {fuel.proposal.items.length} items · {fuel.proposal.kcal} kcal ·{" "}
              {fmt(fuel.proposal.proteinG)} g protein
            </span>
          </p>
        )}
        <div className="mt-3">
          <PortionToggle mode={portions} onChange={onPortions} />
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {fuel.slots.map((slot) => (
            <SlotBlock key={slot.slot} slot={slot} />
          ))}
        </div>
        <p className="mt-2.5 text-sm text-tm-dim">
          Today&apos;s rows cost {fuel.todayEffort.summary}. Tap a row when you eat it. Generating
          replaces the untouched plan rows only — anything already eaten stays on the record.
        </p>
      </Card>

      <FloorCard floor={fuel.floor} tone="default" />

      <AddFood foods={fuel.foods} />

      <WeekStrip week={fuel.week} targetKcal={fuel.targets.kcal} />

      <Card>
        <Eyebrow color="bg-tm-purple">Shopping — planned, not yet eaten</Eyebrow>
        {fuel.shoppingList.length === 0 ? (
          <p className="text-sm text-tm-dim">
            Nothing queued. Generate a day, or keep logging as you go.
          </p>
        ) : (
          <ul>
            {fuel.shoppingList.map((item) => (
              <li
                key={item.foodKey}
                className="flex items-center justify-between border-b border-tm-grid py-2 last:border-0"
              >
                <span className="text-sm font-medium">{item.name}</span>
                <span className="font-tm-mono text-[11.5px] text-tm-dim">
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
        <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
          {fuel.floor.items.length} things · {fuel.floor.effortSummary}
        </p>
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
      <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
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
      <p className="text-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
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
        <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
          {label}
        </span>
        <span
          className={cn("font-tm-mono text-[11.5px]", over && ceiling ? "text-tm-red" : "text-tm-ink")}
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
        <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
          confidence {tdee.confidence}
        </span>
      </div>
      <div className="mt-1.5">
        <Stat value={`${tdee.tdeeKcal}`} label="kcal per day" />
      </div>
      <p className="mt-2 text-sm">{line}</p>
      {tdee.lastWeekly && (
        <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">
          last stored weekly fit {tdee.lastWeekly.tdeeKcal} kcal · week of {tdee.lastWeekly.weekStart}
        </p>
      )}
      <p className="mt-1.5 font-tm-mono text-[11.5px] text-tm-dim">
        Population equation while estimated (moderate evidence); your own intake-vs-mass fit once
        adaptive. Correlated, never diagnostic.
      </p>
    </Card>
  );
}

/**
 * The bad-day plan. Three things, nothing to cook, nothing to stand for, one
 * hand — and a button per item, because on that day "log it" is the only
 * interaction anybody has left. Present in every mode: the floor is not a
 * punishment for having switched to survival.
 */
function FloorCard({ floor, tone }: { floor: FuelData["floor"]; tone: "default" | "amber" }) {
  const { actions } = useTimento();
  const mode = usePortionMode();
  const [logged, setLogged] = useState<string | null>(null);

  return (
    <Card tone={tone}>
      <Eyebrow color={tone === "amber" ? "bg-tm-amber" : "bg-tm-dim2"}>
        Bad day — three things
      </Eyebrow>
      <p className="font-tm-disp text-base">{floor.effortSummary}</p>
      {floor.items.length === 0 ? (
        <p className="mt-2 text-sm text-tm-dim">
          Your exclusions rule out everything the floor would offer. Nothing here is invented to
          fill the gap.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {floor.items.map((item) => (
            <li key={item.foodKey} className="flex items-stretch gap-1.5">
              <div className="flex flex-1 flex-col justify-center rounded-lg border border-tm-rule bg-tm-panel px-3 py-2">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="font-tm-mono text-[11.5px] text-tm-dim">
                  {item.slotLabel.toLowerCase()} ·{" "}
                  {mode === "hands" ? item.portion : `${item.grams} g`} · {fmt(item.proteinG)} g
                  protein
                </span>
              </div>
              <button
                onClick={() => {
                  actions.logFood(item.slot, item.foodKey, item.grams);
                  setLogged(item.name);
                }}
                aria-label={`Log ${item.name} as eaten`}
                className="min-h-11 min-w-11 shrink-0 cursor-pointer rounded-lg bg-tm-ink px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-white uppercase"
              >
                Ate it
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-sm text-tm-dim">
        {logged ? `${logged} logged as eaten.` : "Nothing to cook. Nothing to decide."}
      </p>
    </Card>
  );
}

/** The kitchen the plan was built for — stated, so it can be argued with. */
function KitchenCard({ kitchen }: { kitchen: FuelData["kitchen"] }) {
  const rows: { label: string; value: string }[] = [
    {
      label: "Pinned breakfast",
      value: kitchen.pinnedBreakfast ? kitchen.pinnedBreakfast.name : "none — free every morning",
    },
    {
      label: "Safe foods",
      value:
        kitchen.safeFoods.length === 0
          ? "none listed"
          : kitchen.safeFoods.map((f) => f.name).join(", "),
    },
    {
      label: "Never again",
      value:
        kitchen.neverAgain.length === 0
          ? "nothing excluded"
          : kitchen.neverAgain.map((f) => f.name).join(", "),
    },
    {
      label: "Allergens excluded",
      value:
        kitchen.excludeAllergens.length === 0
          ? "none"
          : kitchen.excludeAllergens.map((a) => ALLERGEN_LABELS[a]).join(", "),
    },
    {
      label: "Standing",
      value: kitchen.canStand ? "fine today" : "not today — nothing that needs feet",
    },
  ];

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Kitchen — what today can take</Eyebrow>
      <p className="font-tm-disp text-base">{kitchen.summary}</p>
      <dl className="mt-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-tm-grid py-1.5 last:border-0"
          >
            <dt className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
              {row.label}
            </dt>
            <dd className="text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-tm-dim">
        {kitchen.reachableFoods} of {kitchen.catalogueSize} foods are reachable today. The planner
        works inside that, protein first — it does not treat a short day as a compromise.
        {kitchen.safeFoodsOnly ? " Safe foods only: nothing new is being suggested." : ""}
      </p>
    </Card>
  );
}

function SlotBlock({ slot }: { slot: SlotView }) {
  const { actions } = useTimento();
  const mode = usePortionMode();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
          {slot.label}
        </span>
        <span className="font-tm-mono text-[11.5px] text-tm-dim">
          {slot.kcal} kcal · {fmt(slot.proteinG)} g protein
        </span>
      </div>
      {slot.entries.length === 0 ? (
        <p className="mt-1 text-sm text-tm-dim">Empty.</p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {slot.entries.map((e) => (
            <div key={e.id} className="flex items-stretch gap-1.5">
              <button
                onClick={() => actions.setFoodEaten(e.id, !e.eaten)}
                aria-pressed={e.eaten}
                className={cn(
                  "flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left",
                  e.eaten
                    ? "border-tm-green bg-tm-green-faint"
                    : "border-tm-rule bg-tm-panel",
                )}
              >
                <span className="text-sm font-medium">
                  {e.name}{" "}
                  <span className="font-tm-mono text-[11.5px] text-tm-dim">
                    {mode === "hands" ? e.portion : `${e.grams} g`}
                  </span>
                </span>
                {/* State is never colour alone: "eaten" and "to eat" are words. */}
                <span className="shrink-0 font-tm-mono text-[11.5px] text-tm-dim">
                  {e.kcal} · {fmt(e.proteinG)}p {e.eaten ? "✓ eaten" : "— to eat"}
                </span>
              </button>
              <button
                onClick={() => actions.removeFood(e.id)}
                aria-label={`Remove ${e.name} from ${slot.label.toLowerCase()}`}
                className="min-h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-tm-rule bg-tm-panel font-tm-mono text-sm text-tm-dim"
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
  const mode = usePortionMode();
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<MealSlot>("lunch");
  const [picked, setPicked] = useState<FoodOption | null>(null);
  const [grams, setGrams] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // What today can reach comes first — never hidden, just not offered first.
    const byReach = (a: FoodOption, b: FoodOption) => Number(b.allowed) - Number(a.allowed);
    if (q.length === 0)
      return foods
        .filter((f) => f.allowed && (f.effort === "none" || f.effort === "heat"))
        .filter((f) => f.tags.includes("high-protein") || f.tags.includes("quick"))
        .slice(0, 6);
    return foods
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.tags.some((t) => t.includes(q)) ||
          f.shelf.includes(q) ||
          f.effort.includes(q),
      )
      .sort(byReach)
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
              "min-h-11 flex-1 cursor-pointer rounded-lg border font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
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
        placeholder="Search — name, freezer, cupboard, none"
        aria-label="Search foods"
        className="mt-2 min-h-11 w-full rounded-lg border border-tm-rule bg-tm-panel px-3 py-2 text-sm outline-none focus:border-tm-ink"
      />

      {picked === null ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {results.length === 0 && (
            <p className="text-sm text-tm-dim">
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
              className="flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border border-tm-rule bg-tm-panel px-3 py-2 text-left"
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-sm font-medium">{f.name}</span>
                <span className="font-tm-mono text-[11.5px] text-tm-dim">
                  {f.kcalPer100} kcal · {fmt(f.proteinPer100G)} p /100 g
                </span>
              </span>
              <span className="font-tm-mono text-[11.5px] text-tm-dim">
                {costOf(f)} · {SHELF_LABELS[f.shelf]}
                {f.allowed ? "" : " · outside today's kitchen"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded-lg bg-tm-soft p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{picked.name}</span>
            <button
              onClick={() => setPicked(null)}
              className="min-h-11 cursor-pointer px-2 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase"
            >
              Change
            </button>
          </div>
          <p className="font-tm-mono text-[11.5px] text-tm-dim">
            {costOf(picked)} · {SHELF_LABELS[picked.shelf]}
            {picked.allergens.length > 0
              ? ` · contains ${picked.allergens.map((a) => ALLERGEN_LABELS[a].toLowerCase()).join(", ")}`
              : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => log(picked.portionG)}
              className="min-h-11 cursor-pointer rounded-lg border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase"
            >
              {mode === "hands"
                ? `${picked.handPortion} · ${picked.portionLabel}`
                : `${picked.portionLabel} · ${picked.portionG} g`}
            </button>
            <button
              onClick={() => log(100)}
              className="min-h-11 cursor-pointer rounded-lg border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase"
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
              className="min-h-11 w-24 rounded-lg border border-tm-rule bg-tm-panel px-3 py-2 font-tm-mono text-sm outline-none focus:border-tm-ink"
            />
            <button
              type="submit"
              className="min-h-11 flex-1 cursor-pointer rounded-lg bg-tm-ink px-4 font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase"
            >
              Log to {slot}
            </button>
          </form>
          <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
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
            fontSize={axisFontSize(W)}
            className="fill-tm-dim font-tm-mono"
          >
            {d.date.slice(8)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex justify-between font-tm-mono text-[11.5px] text-tm-dim">
        <span>avg {week.avgKcal} kcal</span>
        <span>avg {fmt(week.avgProteinG)} g protein</span>
        <span>{week.daysLogged}/7 logged</span>
      </div>
    </Card>
  );
}
