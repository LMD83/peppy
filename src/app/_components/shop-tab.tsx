"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { handoffLabel, retailerDriver } from "@convex/tm/data/retailers";
import { readRetailer, subscribeRetailer, writeRetailer } from "../_lib/retailer-store";
import { useTimento } from "../_lib/backend";
import type { ShopData } from "../_lib/types";
import { Card, Eyebrow, Stat } from "./ui";

/**
 * Shop — the list, aisle by aisle.
 *
 * The list comes first and nothing sits above it. Each row is a target the size
 * of a thumb: tap the row to tick it off, and the tick survives a reload,
 * because a shopping list that forgets where you were the moment the phone
 * locks is worse than paper.
 *
 * The honest bit is on the surface, not in a footnote. No Irish supermarket
 * lets an app place an order, so the retailer buttons say exactly what they do
 * — "opens Tesco's search, you complete the order" — and the print view exists
 * because for two of the five shops here, walking in with a page is the only
 * thing that was ever going to happen.
 *
 * Easy mode gets one aisle per screen with a Next button: fewer objects, not
 * smaller ones. Survival gets today's floor list and no choices at all.
 */

type Aisle = ShopData["aisles"][number];
type Item = Aisle["items"][number];
type Retailer = ShopData["retailers"][number];

const TICK_KEY = "tm.shop.ticked";

/* ===== the ticks, kept across a reload =====
 *
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than copied into state inside an effect: the
 * server renders nothing ticked, the client re-reads on hydration, and a second
 * tab ticking an item updates this one. The snapshot is memoised on the raw
 * string because getSnapshot must return the same reference until it changes.
 */

type TickState = { date: string; keys: string[] };

const NO_TICKS: string[] = [];

let tickCache: { raw: string | null; date: string; keys: string[] } = {
  raw: null,
  date: "",
  keys: NO_TICKS,
};

const tickListeners = new Set<() => void>();

function parseTicks(raw: string | null, date: string): string[] {
  if (!raw) return NO_TICKS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return NO_TICKS;
    const state = parsed as Partial<TickState>;
    // A new day is a new list. Yesterday's ticks are not evidence.
    if (state.date !== date || !Array.isArray(state.keys)) return NO_TICKS;
    return state.keys.filter((k): k is string => typeof k === "string");
  } catch {
    return NO_TICKS;
  }
}

function readTicks(date: string): string[] {
  if (typeof window === "undefined") return NO_TICKS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(TICK_KEY);
  } catch {
    return NO_TICKS;
  }
  if (tickCache.raw === raw && tickCache.date === date) return tickCache.keys;
  tickCache = { raw, date, keys: parseTicks(raw, date) };
  return tickCache.keys;
}

function writeTicks(date: string, keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TICK_KEY, JSON.stringify({ date, keys }));
  } catch {
    // A full or blocked store loses the ticks, never the list.
  }
  for (const listener of tickListeners) listener();
}

function subscribeTicks(onChange: () => void): () => void {
  tickListeners.add(onChange);
  if (typeof window !== "undefined") window.addEventListener("storage", onChange);
  return () => {
    tickListeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
  };
}

/* The chosen supermarket lives in ../_lib/retailer-store — answered once,
 * kept for good, and shared with the setup wizard. */

function useTicks(date: string) {
  const keys = useSyncExternalStore(
    subscribeTicks,
    () => readTicks(date),
    () => NO_TICKS,
  );

  const write = useCallback((next: string[]) => writeTicks(date, next), [date]);

  const toggle = useCallback(
    (key: string) => write(keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]),
    [keys, write],
  );

  return { keys, toggle, clear: () => write(NO_TICKS) };
}

/* ===== the tab ===== */

export function ShopPanel() {
  const { shop, today, date } = useTimento();
  if (!shop) return <ShopSkeleton />;
  const easy = today?.a11y.profile === "easy";
  return <ShopBody shop={shop} date={date} easy={easy} />;
}

function ShopBody({ shop, date, easy }: { shop: ShopData; date: string; easy: boolean }) {
  const { actions } = useTimento();
  const ticks = useTicks(date);
  const retailerKey = useSyncExternalStore(subscribeRetailer, readRetailer, () => null);
  const [step, setStep] = useState(0);

  const retailer = useMemo(
    () => shop.retailers.find((r) => r.key === retailerKey) ?? null,
    [shop.retailers, retailerKey],
  );

  const lastStep = shop.aisles.length; // the step after the last aisle
  const safeStep = Math.min(step, lastStep);

  if (shop.aisles.length === 0) {
    return (
      <div className="flex flex-col gap-3 pt-5">
        <Card>
          <Eyebrow color="bg-tm-green">Shopping list</Eyebrow>
          <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">
            Nothing to buy
          </h2>
          <p className="mt-2 text-[14px]">
            Either there is no meal plan for the days ahead, or the cupboard already covers it.
          </p>
          {shop.pantryCount > 0 && (
            <p className="mt-2 text-[14px] text-tm-dim">
              {shop.pantryCount} thing{shop.pantryCount === 1 ? "" : "s"} counted in the cupboard.
            </p>
          )}
        </Card>
        <NoteCard shop={shop} />
      </div>
    );
  }

  if (easy) {
    const aisle = shop.aisles[safeStep];
    return (
      <div className="flex flex-col gap-3 pt-5">
        <PrintList shop={shop} />
        <div className="print:hidden">
          <Card>
            <Eyebrow color="bg-tm-blue">
              {aisle ? `Aisle ${safeStep + 1} of ${shop.aisles.length}` : "Last thing"}
            </Eyebrow>
            {aisle ? (
              <>
                <h2 className="font-tm-disp text-2xl leading-tight">{aisle.label}</h2>
                <p className="mt-1 text-[14px] text-tm-dim">
                  {aisle.items.length} thing{aisle.items.length === 1 ? "" : "s"} in this aisle.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {aisle.items.map((item) => (
                    <ItemRow
                      key={item.foodKey}
                      item={item}
                      ticked={ticks.keys.includes(item.foodKey)}
                      onTick={() => ticks.toggle(item.foodKey)}
                      onHave={() => actions.setPantry(item.foodKey, item.have ? 0 : item.plannedG)}
                      retailer={retailer}
                      easy
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="font-tm-disp text-2xl leading-tight">That is the whole list.</h2>
                <p className="mt-1 text-[14px]">
                  {shop.totals.toBuy} thing{shop.totals.toBuy === 1 ? "" : "s"} ·{" "}
                  {shop.totals.weightLabel}.
                </p>
                <ShareButtons shop={shop} className="mt-3" />
              </>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStep(Math.max(0, safeStep - 1))}
                disabled={safeStep === 0}
                className={cn(
                  "min-h-16 flex-1 cursor-pointer rounded-[10px] border px-4 text-[17px] font-medium transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100",
                  safeStep === 0
                    ? "border-tm-rule bg-tm-soft text-tm-dim"
                    : "border-tm-rule-strong bg-tm-panel text-tm-ink",
                )}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(Math.min(lastStep, safeStep + 1))}
                disabled={safeStep === lastStep}
                className={cn(
                  "min-h-16 flex-1 cursor-pointer rounded-[10px] border px-4 text-[17px] font-medium transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100",
                  safeStep === lastStep
                    ? "border-tm-rule bg-tm-soft text-tm-dim"
                    : "border-tm-ink bg-tm-ink text-white",
                )}
              >
                Next →
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-5">
      <PrintList shop={shop} />

      <div className="flex flex-col gap-4 print:hidden lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3 lg:col-span-7">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <Eyebrow color="bg-tm-blue" className="mb-0">
                Shopping list
              </Eyebrow>
              <span className="font-tm-mono text-[11.5px] text-tm-dim">
                {shop.survival ? "floor · " : ""}
                {shop.days === 1 ? "today" : `${shop.days} days`}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-tm-rule bg-tm-rule">
              <div className="bg-tm-panel px-3 py-3">
                <Stat value={String(shop.totals.toBuy)} label="to buy" />
              </div>
              <div className="bg-tm-panel px-3 py-3">
                <Stat value={String(shop.totals.aisles)} label="aisles" />
              </div>
              <div className="bg-tm-panel px-3 py-3">
                <Stat value={`${shop.totals.weightKg.toFixed(1)} kg`} label="to carry" />
              </div>
            </div>
            <p className="mt-2 text-[14px] text-tm-dim">
              Walk it in this order and it is one lap. {shop.totals.packs} pack
              {shop.totals.packs === 1 ? "" : "s"} into the trolley.
            </p>
          </Card>

          {shop.aisles.map((aisle) => (
            <Card key={aisle.aisle}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">
                  {aisle.label}
                </h2>
                <span className="font-tm-mono text-[11.5px] text-tm-dim">
                  {aisle.items.filter((i) => ticks.keys.includes(i.foodKey)).length}/
                  {aisle.items.length}
                </span>
              </div>
              <div className="mt-2.5 flex flex-col gap-2">
                {aisle.items.map((item) => (
                  <ItemRow
                    key={item.foodKey}
                    item={item}
                    ticked={ticks.keys.includes(item.foodKey)}
                    onTick={() => ticks.toggle(item.foodKey)}
                    onHave={() => actions.setPantry(item.foodKey, item.have ? 0 : item.plannedG)}
                    retailer={retailer}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:col-span-5">
          {shop.retailers.length > 0 && (
            <RetailerCard
              retailers={shop.retailers}
              selected={retailerKey}
              onSelect={(key) => writeRetailer(key === retailerKey ? null : key)}
              handoff={shop.handoffNote}
            />
          )}

          <Card>
            <Eyebrow color="bg-tm-dim2">Take it with you</Eyebrow>
            <ShareButtons shop={shop} />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={ticks.clear}
                className="min-h-11 flex-1 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel px-3 text-[14px] transition-transform duration-150 active:scale-[0.98]"
              >
                Untick everything
              </button>
              {shop.pantryCount > 0 && (
                <button
                  type="button"
                  onClick={() => actions.clearPantry()}
                  className="min-h-11 flex-1 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel px-3 text-[14px] transition-transform duration-150 active:scale-[0.98]"
                >
                  Empty the cupboard ({shop.pantryCount})
                </button>
              )}
            </div>
          </Card>

          <NoteCard shop={shop} showHandoff={shop.retailers.length === 0} />
        </div>
      </div>
    </div>
  );
}

/* ===== the compact card for Today ===== */

export function ShopTodayCard() {
  const { shop } = useTimento();
  if (!shop || shop.totals.toBuy === 0) return null;
  const first = shop.aisles[0];
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Shopping</Eyebrow>
      <p className="text-[14px]">
        {shop.totals.toBuy} thing{shop.totals.toBuy === 1 ? "" : "s"} to buy across{" "}
        {shop.totals.aisles} aisle{shop.totals.aisles === 1 ? "" : "s"} · {shop.totals.weightLabel}.
      </p>
      {first && (
        <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">
          starts at {first.label.toLowerCase()}
        </p>
      )}
    </Card>
  );
}

/* ===== pieces ===== */

function ShopSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-[10px] border border-tm-rule bg-tm-panel" />
      ))}
      <p className="text-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
        Loading the list…
      </p>
    </div>
  );
}

/**
 * One row, three things you can do to it: tick it, say you already have it, or
 * ask what else would do. The tick is the whole row, so it is the easiest thing
 * on the screen to hit; state is carried by a box, a line through the name and
 * aria-checked, never by colour on its own.
 */
function ItemRow({
  item,
  ticked,
  onTick,
  onHave,
  retailer,
  easy = false,
}: {
  item: Item;
  ticked: boolean;
  onTick: () => void;
  onHave: () => void;
  retailer: Retailer | null;
  easy?: boolean;
}) {
  const [showSubs, setShowSubs] = useState(false);
  const driver = retailer ? retailerDriver(retailer.key) : undefined;
  const url = driver ? driver.buildUrl(item.name) : null;

  return (
    <div
      className={cn(
        "rounded-[10px] border px-3 py-2",
        item.have ? "border-tm-rule bg-tm-soft" : "border-tm-rule-strong bg-tm-panel",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={ticked}
        onClick={onTick}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 text-left",
          easy ? "min-h-16" : "min-h-11",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-[6px] border-2 font-tm-mono text-[14px]",
            ticked ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule-strong bg-tm-panel",
          )}
        >
          {ticked ? "✓" : ""}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[15px] font-medium",
              ticked && "text-tm-dim line-through",
              easy && "text-[17px]",
            )}
          >
            {item.name}
          </span>
          <span className="block text-[14px] text-tm-dim">
            {item.have
              ? "already in the cupboard"
              : `${item.grams} g · buy ${item.packLabel}${item.leftoverLabel ? ` · ${item.leftoverLabel}` : ""}`}
          </span>
          {!item.have && item.haveG > 0 && (
            <span className="block font-tm-mono text-[11.5px] text-tm-dim">
              plan needs {item.plannedG} g · {item.haveG} g already in
            </span>
          )}
        </span>
      </button>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={item.have}
          onClick={onHave}
          className={cn(
            "min-h-11 cursor-pointer rounded-[10px] border px-3 text-[14px] transition-transform duration-150 active:scale-[0.98]",
            item.have
              ? "border-tm-ink bg-tm-ink text-white"
              : "border-tm-rule-strong bg-tm-panel text-tm-ink",
          )}
        >
          {item.have ? "✓ Have it" : "I have it"}
        </button>

        {item.substitutions.length > 0 && (
          <button
            type="button"
            aria-expanded={showSubs}
            onClick={() => setShowSubs(!showSubs)}
            className="min-h-11 cursor-pointer rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 text-[14px] transition-transform duration-150 active:scale-[0.98]"
          >
            {showSubs ? "Hide swaps" : `Out of stock? (${item.substitutions.length})`}
          </button>
        )}

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-h-11 items-center rounded-[10px] border border-tm-blue bg-tm-panel px-3 text-[14px] text-tm-blue transition-transform duration-150 active:scale-[0.98]"
          >
            Find it on {retailer?.name} ↗
          </a>
        )}
      </div>

      {showSubs && (
        <ul className="mt-2 border-t border-tm-grid pt-2">
          {item.substitutions.map((sub) => (
            <li key={sub.foodKey} className="border-b border-tm-grid py-2 last:border-0">
              <span className="block text-[15px]">
                {sub.name} · {sub.grams} g
              </span>
              <span className="block text-[14px] text-tm-dim">{sub.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The chooser, labelled with what it really does. Not one of these buttons
 * places an order, and not one of them says it does.
 */
function RetailerCard({
  retailers,
  selected,
  onSelect,
  handoff,
}: {
  retailers: Retailer[];
  selected: string | null;
  onSelect: (key: string) => void;
  handoff: string;
}) {
  return (
    <Card>
      <Eyebrow color="bg-tm-amber">Where you are shopping</Eyebrow>
      <p className="text-[14px]">{handoff}</p>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {retailers.map((r) => {
          const on = r.key === selected;
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(r.key)}
              className={cn(
                "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-left transition-transform duration-150 active:scale-[0.98]",
                on ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule-strong bg-tm-panel",
              )}
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-medium">{r.name}</span>
                <span className={cn("block text-[14px]", on ? "text-white" : "text-tm-dim")}>
                  {handoffLabel(r)}
                </span>
              </span>
              <span aria-hidden className="shrink-0 font-tm-mono text-[15px]">
                {on ? "✓" : "→"}
              </span>
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <p className="mt-2 text-[14px] text-tm-dim">
          {retailers.find((r) => r.key === selected)?.note}
        </p>
      )}
    </Card>
  );
}

function ShareButtons({ shop, className }: { shop: ShopData; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clip) return;
    void clip.writeText(shop.shareText).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  const share = () => {
    const nav: Navigator & { share?: (data: { title: string; text: string }) => Promise<void> } =
      navigator;
    if (typeof nav.share !== "function") {
      copy();
      return;
    }
    void nav.share({ title: "Shopping list", text: shop.shareText }).catch(() => undefined);
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        onClick={copy}
        className="min-h-11 flex-1 cursor-pointer rounded-[10px] border border-tm-ink bg-tm-ink px-3 text-[14px] text-white transition-transform duration-150 active:scale-[0.98]"
      >
        {copied ? "Copied" : "Copy the list"}
      </button>
      <button
        type="button"
        onClick={share}
        className="min-h-11 flex-1 cursor-pointer rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 text-[14px] transition-transform duration-150 active:scale-[0.98]"
      >
        Send it
      </button>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.print();
        }}
        className="min-h-11 flex-1 cursor-pointer rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 text-[14px] transition-transform duration-150 active:scale-[0.98]"
      >
        Print it big
      </button>
    </div>
  );
}

/**
 * The paper version. Hidden on screen (`display: none`, so not a second live
 * heading), and on paper it is the only thing left: 16–24px type (the
 * printBody/printAisle steps in DESIGN.md — paper is its own surface), one
 * line per item, aisle headings, no colour to survive a mono printer. Two of
 * the five shops here have no online ordering at all, so this is not a
 * fallback — for some people it is the product. The h1 is this print
 * document's title.
 */
function PrintList({ shop }: { shop: ShopData }) {
  return (
    <div className="hidden print:block">
      <h1 className="text-[24px] font-semibold">Shopping list</h1>
      <p className="text-[16px]">
        Plan from {shop.date}
        {shop.days > 1 ? ` · ${shop.days} days` : ""} · {shop.totals.toBuy} to buy ·{" "}
        {shop.totals.weightLabel}
      </p>
      {shop.aisles.map((aisle) => {
        const toBuy = aisle.items.filter((i) => !i.have);
        if (toBuy.length === 0) return null;
        return (
          <section key={aisle.aisle} className="mt-4 break-inside-avoid">
            <h2 className="border-b-2 border-black pb-1 text-[20px] font-semibold">
              {aisle.label}
            </h2>
            <ul>
              {toBuy.map((item) => (
                <li key={item.foodKey} className="flex items-baseline gap-3 border-b py-2">
                  <span aria-hidden className="text-[18px]">
                    ☐
                  </span>
                  <span className="text-[18px]">
                    {item.name} — {item.grams} g, buy {item.packLabel}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="mt-4 text-[16px]">{shop.handoffNote}</p>
    </div>
  );
}

/**
 * `showHandoff` defaults to true: when there is no retailer chooser on screen
 * (no retailers configured, or nothing to buy), this note is the only place
 * the hand-off sentence can live, and zero copies of it is a worse failure
 * than one repeat would ever have been. When RetailerCard is showing, that is
 * the retailer-choice commitment point and owns the sentence instead.
 */
function NoteCard({ shop, showHandoff = true }: { shop: ShopData; showHandoff?: boolean }) {
  return (
    <Card className="print:hidden">
      <Eyebrow color="bg-tm-dim2">How this list was built</Eyebrow>
      <p className="text-[14px]">{shop.note}</p>
      {showHandoff && <p className="mt-2 text-[14px] text-tm-dim">{shop.handoffNote}</p>}
    </Card>
  );
}
