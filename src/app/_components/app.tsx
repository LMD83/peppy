"use client";

import { Component, useState, type ReactNode } from "react";
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

const TABS = [
  { id: "today", label: "Today" },
  { id: "fuel", label: "Fuel" },
  { id: "train", label: "Train" },
  { id: "body", label: "Body" },
  { id: "mind", label: "Mind" },
  { id: "crew", label: "Crew" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* Second-level views, so the bottom bar stays at six thumb-sized targets. */
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

function Shell() {
  const { session, authReady, today } = useTimento();
  const [tab, setTab] = useState<TabId>("today");
  const [bodyView, setBodyView] = useState("stack");
  const [mindView, setMindView] = useState("checkin");

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
  const subItems = SUB[tab];
  const subValue = tab === "body" ? bodyView : mindView;
  const setSub = tab === "body" ? setBodyView : setMindView;

  return (
    <div className="min-h-screen pb-[84px]">
      <Scoreboard />
      <main className="mx-auto max-w-md px-4">
        {subItems && <SubNav items={subItems} value={subValue} onChange={setSub} />}
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
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "min-h-14 flex-1 cursor-pointer pt-3 pb-4 font-tm-mono text-[11.5px] tracking-[0.04em] uppercase",
                tab === t.id ? "text-tm-ink" : "text-tm-dim",
              )}
            >
              <span className={cn("mx-auto mb-1.5 block h-[3px] w-6 rounded-full", tab === t.id ? accent : "bg-transparent")} />
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
