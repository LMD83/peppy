"use client";

import { useMemo, useState } from "react";
import { ALLERGEN_LABELS, GROUP_ORDER, SHELF_LABELS, type FoodEquipment } from "@convex/tm/data/foods";
import { remainingAfter } from "@convex/tm/logicFuel";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import type { FuelData, MealSlot } from "../_lib/types";
import { Card, Eyebrow } from "./ui";

type FoodOption = FuelData["foods"][number];
type MenuOption = FuelData["menus"][number];

const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function costOf(item: { equipment: FoodEquipment; hands: number; standingMinutes: number }): string {
  const time = item.standingMinutes > 0 ? `${item.standingMinutes} min` : "no prep";
  return `${time} · ${item.equipment} · ${item.hands === 1 ? "one-handed" : "two hands"}`;
}

export function FuelBank({
  foods,
  recentFoods,
  menus,
  remaining,
  portions,
}: {
  foods: FoodOption[];
  recentFoods: FoodOption[];
  menus: MenuOption[];
  remaining: FuelData["remaining"];
  portions: "hands" | "grams";
}) {
  const { actions } = useTimento();
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<MealSlot>("lunch");
  const [group, setGroup] = useState<(typeof GROUP_ORDER)[number] | "all" | "recent">("recent");
  const [picked, setPicked] = useState<FoodOption | null>(null);
  const [grams, setGrams] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byReach = (a: FoodOption, b: FoodOption) => Number(b.allowed) - Number(a.allowed);
    if (q.length === 0 && group === "recent") {
      return (recentFoods.length > 0 ? recentFoods : foods.filter((f) => f.allowed).slice(0, 8)).slice(0, 8);
    }
    const pool =
      group === "all" || group === "recent" ? foods : foods.filter((f) => f.group === group);
    if (q.length === 0) {
      return pool.filter((f) => f.allowed).slice(0, 10);
    }
    return pool
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.tags.some((t) => t.includes(q)) ||
          f.shelf.includes(q) ||
          f.effort.includes(q),
      )
      .sort(byReach)
      .slice(0, 10);
  }, [foods, recentFoods, query, group]);

  const adding = picked
    ? {
        kcal: Math.round((picked.kcalPer100 * Number(grams || picked.portionG)) / 100),
        proteinG: Math.round(((picked.proteinPer100G * Number(grams || picked.portionG)) / 100) * 10) / 10,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
        sodiumMg: Math.round((picked.sodiumPer100Mg * Number(grams || picked.portionG)) / 100),
      }
    : null;
  const after = adding ? remainingAfter(remaining, adding) : null;

  const log = (g: number) => {
    if (!picked || !Number.isFinite(g) || g <= 0) return;
    actions.logFood(slot, picked.key, Math.round(g));
    setPicked(null);
    setQuery("");
    setGrams("");
  };

  const slotMenus = menus.filter((m) => m.slot === slot);

  return (
    <>
      <Card>
        <Eyebrow color="bg-tm-blue">Menus</Eyebrow>
        <p className="text-sm text-tm-dim">
          A named meal, one tap. The planner uses these when it generates a day.
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {slotMenus.length === 0 && <p className="text-sm text-tm-dim">No menus for this slot.</p>}
          {slotMenus.slice(0, 8).map((menu) => {
            const preview = remainingAfter(remaining, {
              kcal: menu.kcal,
              proteinG: menu.proteinG,
              carbsG: 0,
              fatG: 0,
              fiberG: 0,
              sodiumMg: 0,
            });
            return (
              <div key={menu.key} className="flex items-stretch gap-1.5">
                <div className="flex min-h-11 flex-1 flex-col justify-center rounded-lg border border-tm-rule bg-tm-panel px-3 py-2">
                  <span className="text-sm font-medium">{menu.name}</span>
                  <span className="font-tm-mono text-[11.5px] text-tm-dim">
                    {menu.kcal} kcal · {fmt(menu.proteinG)} g protein · {menu.effortSummary}
                    {menu.allowed ? "" : " · outside today's kitchen"}
                    {menu.saved ? " · saved" : ""}
                  </span>
                  <span className="font-tm-mono text-[11.5px] text-tm-dim">
                    leaves {fmt(Math.max(0, preview.kcal))} kcal · {fmt(Math.max(0, preview.proteinG))} g
                    protein
                  </span>
                </div>
                <button
                  onClick={() => actions.logMenu(menu.slot, menu.items)}
                  className="min-h-11 shrink-0 cursor-pointer rounded-lg bg-tm-ink px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-white uppercase"
                >
                  Log
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <Eyebrow color="bg-tm-blue">Food bank</Eyebrow>
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

        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Browse foods by">
          {(["recent", "all", ...GROUP_ORDER] as const).map((g) => (
            <button
              key={g}
              role="radio"
              aria-checked={group === g}
              onClick={() => {
                setGroup(g);
                setPicked(null);
              }}
              className={cn(
                "min-h-11 cursor-pointer rounded-lg border px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
                group === g ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule bg-tm-panel text-tm-dim",
              )}
            >
              {g}
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
            {after && (
              <p className="mt-1 text-sm">
                {adding?.kcal} kcal · {fmt(adding?.proteinG ?? 0)} g protein — leaves {fmt(Math.max(0, after.kcal))}{" "}
                kcal / {fmt(Math.max(0, after.proteinG))} g protein
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => log(picked.portionG)}
                className="min-h-11 cursor-pointer rounded-lg border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase"
              >
                {portions === "hands"
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
    </>
  );
}
