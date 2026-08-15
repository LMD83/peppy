"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { plain } from "@convex/tm/logic-easy";
import { cn } from "@/lib/utils";
import { TimentoProvider, clearStoredSession, useTimento } from "../_lib/backend";
import { Login } from "./login";
import { Scoreboard } from "./scoreboard";
import { TodayTab } from "./today-tab";
import { CrewTab } from "./crew-tab";
import { ProgressTab } from "./progress-tab";
import { ResearchTab } from "./research-tab";
import { FuelTab } from "./fuel-tab";
import { TrainTab } from "./train-tab";
import { StackTab } from "./stack-tab";
import { SupplyPanel } from "./supply-tab";
import { LabsTab } from "./labs-tab";
import { MindTab } from "./mind-tab";
import { SettingsTab } from "./settings-tab";
import { HandsFreePanel } from "./handsfree-tab";
import { ShopPanel } from "./shop-tab";

/*
  Bottom nav.

  "More" is the seventh item and it is the same idea in both profiles: the
  overflow shelf. In standard mode it holds Settings, so the six sections the
  e2e suite drives (Today/Fuel/Train/Body/Mind/Crew) keep their exact positions
  and exact accessible names. In easy mode the nav collapses to Today + More and
  the shelf holds everything else as a plain list of big rows.

  Two items is the whole point: a person who wants one decision per screen
  should not have to choose between six destinations before they have chosen
  anything at all. It is a collapse, never a second UI — the same Shell renders
  the same tab components either way.
*/
const TABS = [
  { id: "today", label: "Today" },
  { id: "fuel", label: "Fuel" },
  { id: "train", label: "Train" },
  { id: "body", label: "Body" },
  { id: "mind", label: "Mind" },
  { id: "crew", label: "Crew" },
] as const;

type TabId = (typeof TABS)[number]["id"] | "more" | "settings" | "handsfree" | "shop";

const MORE_TAB = { id: "more", label: "More" } as const;

/** Destinations the bottom nav already reaches, so the shelf need not repeat them. */
const NAV_TAB_IDS: ReadonlySet<string> = new Set(TABS.map((t) => t.id));
const NAV_STANDARD: readonly { id: TabId; label: string }[] = [...TABS, MORE_TAB];
const NAV_EASY: readonly { id: TabId; label: string }[] = [{ id: "today", label: "Today" }, MORE_TAB];

/* Second-level views, so the bottom bar stays at thumb-sized targets. */
const SUB: Partial<Record<TabId, { id: string; label: string }[]>> = {
  body: [
    { id: "stack", label: "Stack" },
    { id: "supply", label: "Supply" },
    { id: "labs", label: "Bloods" },
    { id: "trend", label: "Trend" },
  ],
  mind: [
    { id: "checkin", label: "Check-in" },
    { id: "craving", label: "Craving" },
  ],
};

/** Every destination the More shelf can send you to, as one flat list. */
type Destination = { key: string; label: string; tab: TabId; sub?: string };

const DESTINATIONS: Destination[] = [
  { key: "fuel", label: "Fuel", tab: "fuel" },
  { key: "train", label: "Train", tab: "train" },
  { key: "stack", label: "Stack", tab: "body", sub: "stack" },
  { key: "supply", label: "Supply", tab: "body", sub: "supply" },
  { key: "labs", label: "Bloods", tab: "body", sub: "labs" },
  { key: "trend", label: "Trend", tab: "body", sub: "trend" },
  { key: "checkin", label: "Check-in", tab: "mind", sub: "checkin" },
  { key: "craving", label: "Craving", tab: "mind", sub: "craving" },
  { key: "crew", label: "Crew", tab: "crew" },
  { key: "shop", label: "Shopping", tab: "shop" },
  { key: "handsfree", label: "Hands-free", tab: "handsfree" },
];

function SubNav({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-3 flex gap-1.5" role="tablist">
      {items.map((s) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={value === s.id}
          onClick={() => onChange(s.id)}
          className={cn(
            // min-h-11 = 44px (2.5.8 Target Size). rule-strong, not rule, so the
            // unselected chip has a 3:1 boundary rather than a 1.27:1 one.
            "inline-flex min-h-11 cursor-pointer items-center rounded-[8px] border px-3.5 font-tm-mono text-[11.5px] tracking-[0.12em] uppercase",
            value === s.id
              ? "border-tm-ink bg-tm-ink text-white"
              : "border-tm-rule-strong bg-tm-panel text-tm-dim",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/**
 * One big row in the More shelf. 64px tall, whole row is the target, and the
 * chevron is a shape rather than a colour so it survives forced-colours.
 */
function NavRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-tm-rule-strong bg-tm-panel px-4 py-3 text-left text-[17px] font-medium text-tm-ink"
    >
      <span className="min-w-0">{label}</span>
      <span aria-hidden className="shrink-0 font-tm-mono text-[17px] text-tm-dim">
        →
      </span>
    </button>
  );
}

/**
 * The More shelf.
 *
 * In easy mode it is the whole rest of the app as one flat list of plain words
 * — no sub-tabs, no nesting, one tap per destination. Flat matters more than
 * short here: a two-level menu is two decisions, and the second one is always
 * the one people get wrong.
 *
 * Easy mode relabels the rows with logic-easy's plain-language map ("Bloods" →
 * "Blood tests"). Standard mode keeps every original name exactly as it is.
 */
function MoreShelf({
  easy,
  onGo,
  onSettings,
}: {
  easy: boolean;
  onGo: (d: Destination) => void;
  onSettings: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 pt-4">
      <h2 className="font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-dim uppercase">
        {easy ? "Everything else" : "More"}
      </h2>
      {/* Easy mode flattens the whole app into this list. Standard mode already
          reaches most of it from the bottom nav, so the shelf carries exactly
          what the nav cannot — otherwise a destination has no route at all. */}
      {(easy ? DESTINATIONS : DESTINATIONS.filter((d) => !NAV_TAB_IDS.has(d.tab))).map((d) => (
        <NavRow key={d.key} label={easy ? plain(d.label) : d.label} onClick={() => onGo(d)} />
      ))}
      <NavRow label="Settings" onClick={onSettings} />
      <p className="pt-1 pb-2 text-center">
        <Link
          href="/why"
          className="inline-flex min-h-11 items-center justify-center px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim underline uppercase"
        >
          Why this design
        </Link>
      </p>
    </div>
  );
}

function Shell() {
  const { session, authReady, today } = useTimento();
  const [tab, setTab] = useState<TabId>("today");
  const [bodyView, setBodyView] = useState("stack");
  const [mindView, setMindView] = useState("checkin");

  /*
    The stylesheet's half of easy mode ([data-easy="1"] in globals.css) — type
    scale, target sizes, spacing. It goes on <html> because the lever is the
    root font-size: every rem-based utility in the app then scales with it,
    which is how density arrives through tokens instead of a forked component
    tree. The query still decides WHAT is on the screen; this only decides how
    big it is.
  */
  const easy = today?.a11y.profile === "easy";
  useEffect(() => {
    const root = document.documentElement;
    if (easy) root.setAttribute("data-easy", "1");
    else root.removeAttribute("data-easy");
    return () => root.removeAttribute("data-easy");
  }, [easy]);

  if (!authReady) return <div className="min-h-screen bg-tm-paper" aria-busy="true" />;
  if (!session) return <Login />;
  if (!today)
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-tm-paper font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-dim uppercase"
        role="status"
        aria-busy="true"
      >
        Loading file…
      </div>
    );

  const survival = today.user.mode === "survival";
  // The nav indicator is a 3px bar — a non-text UI element, so 3:1 is the bar.
  // amber-lift sits on the white nav at 1.9:1, so the light-surface amber is
  // right here; it clears 5.77:1 on panel.
  const accent = survival ? "bg-tm-amber" : "bg-tm-green";
  // Easy mode reaches a sub-view directly from the More shelf, so the row of
  // chips would be a second navigation for the same choice. It goes.
  const subItems = easy ? undefined : SUB[tab];
  const subValue = tab === "body" ? bodyView : mindView;
  const setSub = tab === "body" ? setBodyView : setMindView;
  const navItems = easy ? NAV_EASY : NAV_STANDARD;
  // Settings, and every easy-mode destination, was reached through More — so
  // More is what stays lit. A nav with nothing current is a lost user.
  const navCurrent: TabId = navItems.some((n) => n.id === tab) ? tab : "more";

  return (
    <div className="min-h-screen pb-[84px]">
      <Scoreboard />
      <main className="mx-auto max-w-md px-4">
        {subItems && <SubNav items={subItems} value={subValue} onChange={setSub} />}
        {tab === "more" && (
          <MoreShelf
            easy={easy}
            onGo={(d) => {
              if (d.sub) (d.tab === "body" ? setBodyView : setMindView)(d.sub);
              setTab(d.tab);
            }}
            onSettings={() => setTab("settings")}
          />
        )}
        {tab === "settings" && <SettingsTab />}
        {tab === "handsfree" && <HandsFreePanel />}
        {tab === "shop" && <ShopPanel />}
        {tab === "today" && <TodayTab />}
        {tab === "fuel" && <FuelTab />}
        {tab === "train" && <TrainTab />}
        {tab === "body" && bodyView === "stack" && <StackTab />}
        {tab === "body" && bodyView === "supply" && <SupplyPanel />}
        {tab === "body" && bodyView === "labs" && <LabsTab />}
        {tab === "body" && bodyView === "trend" && <ProgressTab />}
        {tab === "mind" && mindView === "checkin" && <MindTab />}
        {tab === "mind" && mindView === "craving" && <ResearchTab />}
        {tab === "crew" && <CrewTab />}
      </main>
      {/*
        Sign-out used to live here, flush against "Crew" — a 30px-wide target
        with no confirmation, one thumb-slip from ending the session. It now
        lives in the header (scoreboard.tsx), away from the navigation thumb
        zone, still named "Sign out".
      */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-tm-rule bg-tm-panel" aria-label="Sections">
        <div className="mx-auto flex max-w-md">
          {navItems.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={navCurrent === t.id ? "page" : undefined}
              className={cn(
                "min-h-14 flex-1 cursor-pointer pt-3 pb-4 font-tm-mono text-[11.5px] tracking-[0.04em] uppercase",
                navCurrent === t.id ? "text-tm-ink" : "text-tm-dim",
              )}
            >
              <span className={cn("mx-auto mb-1.5 block h-[3px] w-6 rounded-full", navCurrent === t.id ? accent : "bg-transparent")} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/**
 * A stale stored token makes every query throw (e.g. after a server-side
 * reseed wipes tm_sessions). Without this boundary the app would crash-loop
 * with the sign-out button unreachable; instead we drop the dead session and
 * land back on the login screen.
 */
class SessionRecoveryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    clearStoredSession();
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-tm-paper px-6 text-center">
          <p role="alert" className="font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-dim uppercase">
            Session expired — signed out
          </p>
          <button
            onClick={() => this.setState({ failed: false })}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] bg-tm-ink px-5 font-tm-mono text-[11.5px] tracking-[0.15em] text-white uppercase"
          >
            Back to sign-in
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function TimentoApp() {
  return (
    <SessionRecoveryBoundary>
      <TimentoProvider>
        <Shell />
      </TimentoProvider>
    </SessionRecoveryBoundary>
  );
}
