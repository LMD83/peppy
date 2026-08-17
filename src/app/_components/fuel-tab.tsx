"use client";

import { createContext, useContext, useState } from "react";
import {
  ALLERGEN_LABELS,
  EQUIPMENT_LABELS,
  type FoodEquipment,
} from "@convex/tm/data/foods";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import type { FuelData, MealSlot } from "../_lib/types";
import { Disclosure, FuelBank } from "./fuel-bank";
import { Card, Eyebrow, Stat } from "./ui";
import { axisFontSize } from "./charts";
import { useFileNav } from "./file-nav";

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
            "min-h-11 min-w-11 flex-1 cursor-pointer rounded-[10px] border px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]",
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
      <div className="flex flex-col gap-4 pt-5">
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">Fuel, floor</Eyebrow>
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
            Protein and a closed kitchen. No macro tracking, no plan, no shopping list. The floor
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
    <div className="flex flex-col gap-4 pt-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-3 lg:col-span-7">
      <Card>
        <Eyebrow color="bg-tm-green">Energy</Eyebrow>
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
        {fuel.leftoverKcal > 0 && (
          <p className="mt-2 text-sm text-tm-dim">
            Week leftover {fuel.leftoverKcal} kcal. Unused on logged days, not spent automatically.
          </p>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-2">
          <Eyebrow color="bg-tm-green" className="mb-0">
            Plan &amp; log
          </Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => actions.generateMealPlan()}
              className="min-h-11 cursor-pointer rounded-[10px] bg-tm-ink px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase transition-transform duration-150 active:scale-[0.98]"
            >
              Generate day
            </button>
            <button
              onClick={() => actions.generateWeek()}
              className="min-h-11 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-ink uppercase transition-transform duration-150 active:scale-[0.98]"
            >
              Generate week
            </button>
            <button
              onClick={() => actions.copyYesterday()}
              className="min-h-11 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-ink uppercase transition-transform duration-150 active:scale-[0.98]"
            >
              Copy yesterday
            </button>
          </div>
        </div>
        {fuel.proposal && (
          <p className="mt-2 rounded-[10px] bg-tm-soft px-3 py-2 text-sm">
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
          replaces the untouched plan rows only. Anything already eaten stays on the record.
        </p>
      </Card>

      <FloorCard floor={fuel.floor} tone="default" />

      {/*
        Everything below is a weekly or one-time job, not today's: folded
        behind Bloods-style disclosures, same affordance as labs-tab's
        GroupCard (a real button, aria-expanded, a count in the header).
        Default collapsed, nothing remembered between visits — the daily
        job above (targets, plan, the floor) is the only thing that stays
        open on arrival.
      */}
      <FuelBank
        foods={fuel.foods}
        recentFoods={fuel.recentFoods}
        menus={fuel.menus}
        products={fuel.products}
        remaining={fuel.remaining}
        portions={portions}
      />
      </div>

      <div className="flex flex-col gap-3 lg:col-span-5">
      <Disclosure
        label="Energy out"
        color={fuel.tdee.basis === "adaptive" ? "bg-tm-blue" : "bg-tm-dim2"}
        count={`${fuel.tdee.tdeeKcal} kcal · ${fuel.tdee.basis === "adaptive" ? "adaptive" : "estimated"}`}
      >
        <TdeeCard tdee={fuel.tdee} />
      </Disclosure>

      <Disclosure label="Kitchen" color="bg-tm-blue" count={`${fuel.kitchen.reachableFoods}/${fuel.kitchen.catalogueSize}`}>
        <KitchenCard kitchen={fuel.kitchen} />
      </Disclosure>

      <Disclosure label="Week" color="bg-tm-dim2" count={`${fuel.week.daysLogged}/7`}>
        <WeekStrip week={fuel.week} targetKcal={fuel.targets.kcal} />
      </Disclosure>

      <ShoppingCard items={fuel.shoppingList} />
      </div>
    </div>
  );
}

/**
 * The shopping-list preview at the tab's foot, made live: tapping it opens
 * the Shop tab. This is the fuel→shop pipeline the preview never had a link
 * for — the list itself is built and owned by convex/tm/logicShop, this is
 * only a doorway to it.
 */
function ShoppingCard({ items }: { items: FuelData["shoppingList"] }) {
  const go = useFileNav();
  return (
    <button
      type="button"
      onClick={() => go("shop")}
      className="block w-full cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel p-4 text-left shadow-[0_1px_2px_rgba(21,23,28,0.04)] transition-transform duration-150 active:scale-[0.98]"
    >
      <Eyebrow color="bg-tm-purple">Shopping</Eyebrow>
      {items.length === 0 ? (
        <p className="text-sm text-tm-dim">
          Nothing queued. Generate a day, or keep logging as you go.
        </p>
      ) : (
        <ul>
          {items.map((item) => (
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
      <span className="mt-2 flex items-center justify-between gap-2 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-ink uppercase">
        Open the list
        <span aria-hidden>→</span>
      </span>
    </button>
  );
}

/* ===== the compact card for Today ===== */

export function FuelTodayCard() {
  const { fuel, today, actions } = useTimento();
  const go = useFileNav();
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

  const next = nextPlannedEntry(fuel.slots);
  return (
    <Card>
      {/* Same grammar as the Stack card: the body navigates, the tick names
          one row and logs it — a button cannot nest a button, so the two
          sit side by side rather than one wrapping the other. */}
      <button
        type="button"
        onClick={() => go("fuel")}
        aria-label="Open Fuel"
        className="block w-full cursor-pointer text-left"
      >
        <Eyebrow color="bg-tm-green">Fuel</Eyebrow>
        <div className="flex items-end justify-between gap-2">
          <Stat value={`${fmt(Math.max(0, fuel.remaining.kcal))}`} label="kcal left" />
          <Stat value={`${fmt(Math.max(0, fuel.remaining.proteinG))} g`} label="protein left" />
          <Stat value={`${fuel.sodiumUsedMg}`} label={`of ${fuel.targets.sodiumMgMax} mg salt`} />
        </div>
      </button>
      {next ? (
        <div className="mt-2 flex items-stretch gap-2">
          <p className="flex flex-1 items-center font-tm-mono text-[11.5px] text-tm-dim">
            next up — {next.label.toLowerCase()} · {next.name.toLowerCase()}
          </p>
          <button
            type="button"
            onClick={() => actions.setFoodEaten(next.entryId, true)}
            aria-label={`Log ${next.name} as eaten`}
            className="min-h-11 min-w-11 shrink-0 cursor-pointer rounded-[10px] bg-tm-ink px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-white uppercase transition-transform duration-150 active:scale-[0.98]"
          >
            Ate it
          </button>
        </div>
      ) : (
        <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">every slot logged</p>
      )}
    </Card>
  );
}

/**
 * The exact next planned-uneaten row, slot-ordered — what the Today card's
 * tick logs and what it names. Entries already carry their own id (see
 * FuelEntryView in convex/tm/logicFuel.ts), so no view-model change is
 * needed to find it.
 */
function nextPlannedEntry(
  slots: SlotView[],
): { entryId: string; slot: MealSlot; label: string; name: string } | null {
  const ordered = SLOT_ORDER.map((s) => slots.find((x) => x.slot === s)).filter(
    (s): s is SlotView => s !== undefined,
  );
  for (const slot of ordered) {
    const entry = slot.entries.find((e) => !e.eaten);
    if (entry) return { entryId: entry.id, slot: slot.slot, label: slot.label, name: entry.name };
  }
  return null;
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

/**
 * Bare content — the disclosure wrapping it (fuel-tab's "Energy out" section)
 * already supplies the Card and the header. Nested here, not standalone.
 */
function TdeeCard({ tdee }: { tdee: FuelData["tdee"] }) {
  const adaptive = tdee.basis === "adaptive";
  const line = adaptive
    ? `14-day slope vs logged intake. ${signed(tdee.weightSlopeKgPerWeek)} kg/wk across ${tdee.weighInCount} weigh-ins, ${tdee.avgIntakeKcal} kcal averaged over ${tdee.intakeDays} days.`
    : `Estimated. Mifflin-St Jeor × activity. ${tdee.intakeDays}/10 intake days and ${tdee.weighInCount}/4 weigh-ins in the last 14. Log both and this switches to your own numbers.`;

  return (
    <>
      {/* justify-between with no gap let "adaptive" run into "confidence
          high" at 390px — flex-wrap + an explicit gap keeps them apart even
          when both strings are at their longest. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
          {adaptive ? "Adaptive" : "Estimated"} basis
        </span>
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
    </>
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
        Bad day, three things
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
              <div className="flex flex-1 flex-col justify-center rounded-[10px] border border-tm-rule bg-tm-panel px-3 py-2">
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
                className="min-h-11 min-w-11 shrink-0 cursor-pointer rounded-[10px] bg-tm-ink px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-white uppercase transition-transform duration-150 active:scale-[0.98]"
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

/**
 * The kitchen the plan was built for — stated, so it can be argued with.
 * Bare content, nested inside the "Kitchen" disclosure in fuel-tab.
 */
function KitchenCard({ kitchen }: { kitchen: FuelData["kitchen"] }) {
  const { actions } = useTimento();
  const [minutes, setMinutes] = useState(String(kitchen.minutes));
  const [equipment, setEquipment] = useState<FoodEquipment>(kitchen.equipment);
  const [oneHanded, setOneHanded] = useState(kitchen.hands === 1);
  const [canStand, setCanStand] = useState(kitchen.canStand);

  const apply = (generate: boolean) => {
    const mins = Number(minutes);
    const patch = {
      minutes: Number.isFinite(mins) ? mins : kitchen.minutes,
      equipment,
      oneHanded,
      canStand,
    };
    actions.setKitchen(patch);
    if (generate) actions.generateMealPlan(patch);
  };

  const rows: { label: string; value: string }[] = [
    {
      label: "Pinned breakfast",
      value: kitchen.pinnedBreakfast ? kitchen.pinnedBreakfast.name : "none. Free every morning",
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
          value: kitchen.canStand ? "fine today" : "not today. Nothing that needs feet",
    },
  ];

  return (
    <>
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
        works inside that, protein first. It does not treat a short day as a compromise.
        {kitchen.safeFoodsOnly ? " Safe foods only: nothing new is being suggested." : ""}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <label className="flex items-center justify-between gap-2">
          <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
            Minutes
          </span>
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            aria-label="Hands-on minutes today"
            className="min-h-11 w-24 rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 font-tm-mono text-sm focus:border-tm-ink"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Equipment today">
          {(["none", "kettle", "microwave", "one-pan", "oven"] as const).map((eq) => (
            <button
              key={eq}
              role="radio"
              aria-checked={equipment === eq}
              onClick={() => setEquipment(eq)}
              className={cn(
                "min-h-11 cursor-pointer rounded-[10px] border px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]",
                equipment === eq
                  ? "border-tm-ink bg-tm-ink text-white"
                  : "border-tm-rule bg-tm-panel text-tm-dim",
              )}
            >
              {EQUIPMENT_LABELS[eq]}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            aria-pressed={oneHanded}
            onClick={() => setOneHanded((v) => !v)}
            className={cn(
              "min-h-11 flex-1 cursor-pointer rounded-[10px] border font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]",
              oneHanded ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule bg-tm-panel text-tm-dim",
            )}
          >
            One hand
          </button>
          <button
            aria-pressed={!canStand}
            onClick={() => setCanStand((v) => !v)}
            className={cn(
              "min-h-11 flex-1 cursor-pointer rounded-[10px] border font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]",
              !canStand ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule bg-tm-panel text-tm-dim",
            )}
          >
            Can&apos;t stand
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => apply(false)}
            className="min-h-11 flex-1 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel font-tm-mono text-[11.5px] tracking-[0.12em] uppercase transition-transform duration-150 active:scale-[0.98]"
          >
            Save kitchen
          </button>
          <button
            onClick={() => apply(true)}
            className="min-h-11 flex-1 cursor-pointer rounded-[10px] bg-tm-ink font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase transition-transform duration-150 active:scale-[0.98]"
          >
            Generate for today
          </button>
        </div>
      </div>
    </>
  );
}

function SlotBlock({ slot }: { slot: SlotView }) {
  const { actions, fuel } = useTimento();
  const mode = usePortionMode();
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const foods = fuel?.foods ?? [];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
          {slot.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-tm-mono text-[11.5px] text-tm-dim">
            {slot.kcal} kcal · {fmt(slot.proteinG)} g protein
          </span>
          {slot.entries.length > 0 && (
            <button
              onClick={() =>
                actions.saveMenu(
                  slot.label,
                  slot.slot,
                  slot.entries.map((e) => ({ foodKey: e.foodKey, grams: e.grams })),
                )
              }
              className="min-h-11 cursor-pointer px-2 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase"
            >
              Save menu
            </button>
          )}
        </div>
      </div>
      {slot.entries.length === 0 ? (
        <p className="mt-1 text-sm text-tm-dim">Empty.</p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {slot.entries.map((e) => {
            const from = foods.find((f) => f.key === e.foodKey);
            const swaps = from
              ? foods
                  .filter((f) => f.allowed && f.group === from.group && f.key !== from.key)
                  .slice(0, 4)
              : [];
            return (
              <div key={e.id} className="flex flex-col gap-1">
                <div className="flex items-stretch gap-1.5">
                  <button
                    onClick={() => actions.setFoodEaten(e.id, !e.eaten)}
                    aria-pressed={e.eaten}
                    className={cn(
                      "flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-left transition-transform duration-150 active:scale-[0.98]",
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
                    <span className="shrink-0 font-tm-mono text-[11.5px] text-tm-dim">
                      {e.kcal} · {fmt(e.proteinG)}p {e.eaten ? "✓ eaten" : "— to eat"}
                    </span>
                  </button>
                  {swaps.length > 0 && (
                    <button
                      onClick={() => setSwapFor(swapFor === e.id ? null : e.id)}
                      aria-expanded={swapFor === e.id}
                      className="min-h-11 shrink-0 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel px-2 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase transition-transform duration-150 active:scale-[0.98]"
                    >
                      Swap
                    </button>
                  )}
                  <button
                    onClick={() => actions.removeFood(e.id)}
                    aria-label={`Remove ${e.name} from ${slot.label.toLowerCase()}`}
                    className="min-h-11 w-11 shrink-0 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel font-tm-mono text-sm text-tm-dim transition-transform duration-150 active:scale-[0.98]"
                  >
                    ×
                  </button>
                </div>
                {swapFor === e.id && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {swaps.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => {
                          actions.swapFood(e.id, s.key);
                          setSwapFor(null);
                        }}
                        className="min-h-11 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] uppercase transition-transform duration-150 active:scale-[0.98]"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Bare content, nested inside the "Week" disclosure in fuel-tab — a reference strip, not a daily job. */
function WeekStrip({ week, targetKcal }: { week: FuelData["week"]; targetKcal: number }) {
  const max = Math.max(targetKcal, ...week.days.map((d) => d.kcal), 1);
  const W = 7 * 20;
  const H = 46;
  const targetY = 40 - (targetKcal / max) * 36;

  return (
    <>
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
      <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 font-tm-mono text-[11.5px] text-tm-dim">
        <span>avg {week.avgKcal} kcal</span>
        <span>avg {fmt(week.avgProteinG)} g protein</span>
        <span>{week.daysLogged}/7 logged</span>
      </div>
    </>
  );
}
