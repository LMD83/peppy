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

const TABS = [
  { id: "today", label: "Today" },
  { id: "crew", label: "Crew" },
  { id: "progress", label: "Progress" },
  { id: "research", label: "Research" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Shell() {
  const { session, authReady, today, actions } = useTimento();
  const [tab, setTab] = useState<TabId>("today");

  if (!authReady) return <div className="min-h-screen bg-tm-paper" aria-busy="true" />;
  if (!session) return <Login />;
  if (!today)
    return (
      <div className="flex min-h-screen items-center justify-center bg-tm-paper font-tm-mono text-[11px] tracking-[0.15em] text-tm-dim uppercase" aria-busy="true">
        Loading file…
      </div>
    );

  const survival = today.user.mode === "survival";
  const accent = survival ? "bg-tm-amber" : "bg-tm-green";

  return (
    <div className="min-h-screen pb-[84px]">
      <Scoreboard />
      <main className="mx-auto max-w-md px-4">
        {tab === "today" && <TodayTab />}
        {tab === "crew" && <CrewTab />}
        {tab === "progress" && <ProgressTab />}
        {tab === "research" && <ResearchTab />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-tm-rule bg-tm-panel" aria-label="Sections">
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex-1 cursor-pointer pt-3.5 pb-4 font-tm-mono text-[10px] tracking-[0.12em] uppercase",
                tab === t.id ? "text-tm-ink" : "text-tm-dim",
              )}
            >
              <span className={cn("mx-auto mb-1.5 block h-[3px] w-8 rounded-full", tab === t.id ? accent : "bg-transparent")} />
              {t.label}
            </button>
          ))}
          <button
            onClick={() => actions.logout()}
            className="cursor-pointer px-3 pt-3.5 pb-4 font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase"
            aria-label="Sign out"
          >
            <span className="mx-auto mb-1.5 block h-[3px] w-8" />
            Out
          </button>
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
          <p className="font-tm-mono text-[11px] tracking-[0.15em] text-tm-dim uppercase">
            Session expired — signed out
          </p>
          <button
            onClick={() => this.setState({ failed: false })}
            className="cursor-pointer rounded-[10px] bg-tm-ink px-5 py-2.5 font-tm-mono text-[11px] tracking-[0.15em] text-white uppercase"
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
