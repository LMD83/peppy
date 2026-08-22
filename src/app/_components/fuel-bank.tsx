"use client";

import { useMemo, useState } from "react";
import { ALLERGEN_LABELS, SHELF_LABELS, type FoodEquipment } from "@convex/tm/data/foods";
import { RETAILER_LABELS, type ProductRetailer } from "@convex/tm/data/products";
import { remainingAfter } from "@convex/tm/logicFuel";
import { AISLE_LABELS, AISLE_ORDER, aisleFor, type Aisle } from "@convex/tm/logicShop";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import type { FuelData, MealSlot } from "../_lib/types";
import { Card, Eyebrow } from "./ui";

type FoodOption = FuelData["foods"][number];
type MenuOption = FuelData["menus"][number];
type ProductOption = FuelData["products"][number];

const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const AISLES = AISLE_ORDER.filter((a): a is Exclude<Aisle, "household"> => a !== "household");
type Browse = "recent" | "all" | Exclude<Aisle, "household">;

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function costOf(item: { equipment: FoodEquipment; hands: number; standingMinutes: number }): string {
  const time = item.standingMinutes > 0 ? `${item.standingMinutes} min` : "no prep";
  return `${time} · ${item.equipment} · ${item.hands === 1 ? "one-handed" : "two hands"}`;
}

function shopLabel(retailer: ProductRetailer): string {
  return RETAILER_LABELS[retailer];
}

/**
 * The Bloods disclosure (labs-tab's GroupCard), reused across the fuel surface
 * for its weekly and one-time jobs: a real button, aria-expanded, a count in
 * the header, and no memory — every visit starts folded. The daily job never
 * sits behind one.
 */
export function Disclosure({
  label,
  color,
  count,
  children,
}: {
  label: string;
  color: string;
  count: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1 text-left"
      >
        <Eyebrow color={color} className="mb-0">
          {label}
        </Eyebrow>
        <span className="font-tm-mono text-[11.5px] text-tm-dim">
          {count} {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </Card>
  );
}

export function FuelBank({
  foods,
  recentFoods,
  menus,
  products,
  remaining,
  portions,
}: {
  foods: FoodOption[];
  recentFoods: FoodOption[];
  menus: MenuOption[];
  products: ProductOption[];
  remaining: FuelData["remaining"];
  portions: "hands" | "grams";
}) {
  const { actions } = useTimento();
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<MealSlot>("lunch");
  const [browse, setBrowse] = useState<Browse>("recent");
  const [picked, setPicked] = useState<ProductOption | null>(null);
  const [grams, setGrams] = useState("");

  const foodBy = useMemo(() => new Map(foods.map((f) => [f.key, f])), [foods]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const parent = (p: ProductOption) => foodBy.get(p.foodKey);
    const byReach = (a: ProductOption, b: ProductOption) => Number(b.allowed) - Number(a.allowed);

    const matches = (p: ProductOption) => {
      const food = parent(p);
      if (!food) return false;
      if (q.length === 0) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.packLabel.toLowerCase().includes(q) ||
        shopLabel(p.retailer).toLowerCase().includes(q) ||
        food.name.toLowerCase().includes(q) ||
        food.tags.some((t) => t.includes(q)) ||
        food.shelf.includes(q) ||
        food.effort.includes(q)
      );
    };

    if (q.length === 0 && browse === "recent") {
      const recentKeys = new Set(recentFoods.map((f) => f.key));
      const recents = products.filter((p) => recentKeys.has(p.foodKey) && p.allowed);
      if (recents.length > 0) return recents.slice(0, 12);
      return products.filter((p) => p.allowed).slice(0, 12);
    }

    const pool =
      browse === "all" || browse === "recent"
        ? products
        : products.filter((p) => {
            const food = parent(p);
            return food ? aisleFor(food) === browse : false;
          });

    const hit = pool.filter(matches).sort(byReach);
    if (q.length === 0) return hit.filter((p) => p.allowed).slice(0, 16);
    return hit.slice(0, 16);
  }, [foodBy, products, recentFoods, query, browse]);

  const pickedFood = picked ? foodBy.get(picked.foodKey) : undefined;
  const adding =
    picked && pickedFood
      ? {
          kcal: Math.round((pickedFood.kcalPer100 * Number(grams || picked.packG)) / 100),
          proteinG:
            Math.round(((pickedFood.proteinPer100G * Number(grams || picked.packG)) / 100) * 10) / 10,
          carbsG: 0,
          fatG: 0,
          fiberG: 0,
          sodiumMg: Math.round((pickedFood.sodiumPer100Mg * Number(grams || picked.packG)) / 100),
        }
      : null;
  const after = adding ? remainingAfter(remaining, adding) : null;

  const log = (g: number) => {
    if (!picked || !Number.isFinite(g) || g <= 0) return;
    actions.logFood(slot, picked.foodKey, Math.round(g));
    setPicked(null);
    setQuery("");
    setGrams("");
  };

  const slotMenus = menus.filter((m) => m.slot === slot);

  return (
    <>
      <Disclosure label="Menus" color="bg-tm-blue" count={String(slotMenus.length)}>
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
                <div className="flex min-h-11 flex-1 flex-col justify-center rounded-[14px] border border-tm-rule bg-tm-panel px-3 py-2">
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
                  className="min-h-11 shrink-0 cursor-pointer rounded-[14px] bg-tm-stamp px-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-onstamp uppercase transition-transform duration-150 active:scale-[0.98]"
                >
                  Log
                </button>
              </div>
            );
          })}
        </div>
      </Disclosure>

      <Disclosure label="Catalogue" color="bg-tm-blue" count={String(results.length)}>
        <p className="text-sm text-tm-dim">
          Packs from a Tesco, Aldi and Lidl trolley. Nutrients are the staple&apos;s, not a lab
          reading of the pack in your hand.
        </p>
        <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Meal slot">
          {SLOT_ORDER.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={slot === s}
              onClick={() => setSlot(s)}
              className={cn(
                "min-h-11 flex-1 cursor-pointer rounded-[14px] border font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]",
                slot === s ? "border-tm-stamp bg-tm-stamp text-tm-onstamp" : "border-tm-rule bg-tm-panel text-tm-dim",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Browse catalogue by">
          {(["recent", "all", ...AISLES] as const).map((g) => (
            <button
              key={g}
              role="radio"
              aria-checked={browse === g}
              onClick={() => {
                setBrowse(g);
                setPicked(null);
              }}
              className={cn(
                "min-h-11 cursor-pointer rounded-[14px] border px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]",
                browse === g ? "border-tm-stamp bg-tm-stamp text-tm-onstamp" : "border-tm-rule bg-tm-panel text-tm-dim",
              )}
            >
              {g === "recent" || g === "all" ? g : AISLE_LABELS[g]}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(null);
          }}
          placeholder="Search: brand, pack, Tesco, freezer"
          aria-label="Search catalogue"
          className="mt-2 min-h-11 w-full rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 py-2 text-sm focus:border-tm-ink"
        />

        {picked === null || !pickedFood ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {results.length === 0 && (
              <p className="text-sm text-tm-dim">Nothing in the catalogue matches. No invented foods.</p>
            )}
            {results.map((p) => {
              const food = foodBy.get(p.foodKey);
              if (!food) return null;
              return (
                <button
                  key={p.key}
                  onClick={() => {
                    setPicked(p);
                    setGrams(String(p.packG));
                  }}
                  className="flex min-h-11 w-full cursor-pointer flex-col justify-center rounded-[14px] border border-tm-rule bg-tm-panel px-3 py-2 text-left transition-transform duration-150 active:scale-[0.98]"
                >
                  {/* Name truncates, the kcal figure holds one stable position —
                      short and long names used to place macros differently
                      (inline vs. wrapped to line 2), so kcal never lined up. */}
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                    <span className="shrink-0 font-tm-mono text-[11.5px] text-tm-dim">
                      {food.kcalPer100} kcal · {fmt(food.proteinPer100G)} p /100 g
                    </span>
                  </span>
                  <span className="font-tm-mono text-[11.5px] text-tm-dim">
                    {p.brand} · {p.packLabel} · {shopLabel(p.retailer)} · {SHELF_LABELS[food.shelf]}
                    {p.allowed ? "" : " · outside today's kitchen"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 rounded-[14px] bg-tm-soft p-3">
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
              {picked.brand} · {picked.packLabel} · {shopLabel(picked.retailer)} · {costOf(pickedFood)} ·{" "}
              {SHELF_LABELS[pickedFood.shelf]}
              {pickedFood.allergens.length > 0
                ? ` · contains ${pickedFood.allergens.map((a) => ALLERGEN_LABELS[a].toLowerCase()).join(", ")}`
                : ""}
            </p>
            {after && (
              <p className="mt-1 text-sm">
                {adding?.kcal} kcal · {fmt(adding?.proteinG ?? 0)} g protein. Leaves {fmt(Math.max(0, after.kcal))}{" "}
                kcal / {fmt(Math.max(0, after.proteinG))} g protein
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => log(picked.packG)}
                className="min-h-11 cursor-pointer rounded-[14px] border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]"
              >
                Log pack · {picked.packLabel}
              </button>
              <button
                onClick={() => log(pickedFood.portionG)}
                className="min-h-11 cursor-pointer rounded-[14px] border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]"
              >
                {portions === "hands"
                  ? `${pickedFood.handPortion} · ${pickedFood.portionLabel}`
                  : `${pickedFood.portionLabel} · ${pickedFood.portionG} g`}
              </button>
              <button
                onClick={() => log(100)}
                className="min-h-11 cursor-pointer rounded-[14px] border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]"
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
                className="min-h-11 w-24 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 py-2 font-tm-mono text-sm focus:border-tm-ink"
              />
              <button
                type="submit"
                className="min-h-11 flex-1 cursor-pointer rounded-[14px] bg-tm-stamp px-4 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-onstamp uppercase transition-transform duration-150 active:scale-[0.98]"
              >
                Log to {slot}
              </button>
            </form>
            <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
              Reference values per 100 g of the staple, not an analysis of this pack. Weigh it or
              accept the estimate. Both are recorded the same way.
            </p>
          </div>
        )}
      </Disclosure>
    </>
  );
}
