"use client";

import { Component, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChartNoAxesColumn, FlaskConical, Sun, Users, Wind, Utensils, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimentoProvider, clearStoredSession, useTimento } from "../_lib/backend";
import { Login } from "./login";
import { Scoreboard } from "./scoreboard";
import { TodayTab } from "./today-tab";
import { CrewTab } from "./crew-tab";
import { ProgressTab } from "./progress-tab";
import { ResearchTab } from "./research-tab";
import { CravingLogger } from "./craving";
import { BreathingTimerInline } from "./breathe";
import { TmButton, TmSheet } from "./ui";

const TABS = [
  { id: "today", label: "Today", Icon: Sun },
  { id: "crew", label: "Crew", Icon: Users },
  { id: "progress", label: "Progress", Icon: ChartNoAxesColumn },
  { id: "research", label: "Research", Icon: FlaskConical },
] as const;

type TabId = (typeof TABS)[number]["id"];
type SheetId = "craving" | "breathe" | "ritual" | "file" | null;

function Shell() {
  const { session, authReady, today, actions } = useTimento();
  const [tab, setTab] = useState<TabId>("today");
  const [sheet, setSheet] = useState<SheetId>(null);

  if (!authReady) return <div className="min-h-screen bg-tm-paper" aria-busy="true" />;
  if (!session) return <Login />;
  if (!today)
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-tm-paper font-tm-mono text-[11px] tracking-[0.15em] text-tm-dim uppercase"
        aria-busy="true"
      >
        Loading file…
      </div>
    );

  const survival = today.user.mode === "survival";
  const accent = survival ? "bg-tm-amber" : "bg-tm-green";

  return (
    <div className="min-h-screen pb-[152px]">
      <Scoreboard onOpenFile={() => setSheet("file")} />
      <main className="mx-auto max-w-md px-4">
        {tab === "today" && <TodayTab />}
        {tab === "crew" && <CrewTab />}
        {tab === "progress" && <ProgressTab />}
        {tab === "research" && <ResearchTab />}
      </main>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-tm-rule bg-tm-panel/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setSheet("craving")}
            aria-label="Quick log craving"
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-tm-rule bg-tm-soft font-tm-mono text-[10px] tracking-[0.1em] text-tm-ink uppercase transition-[transform,opacity] duration-150 active:scale-[0.98] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/25"
          >
            <Flame className="size-3.5" aria-hidden />
            Craving
          </button>
          <button
            type="button"
            onClick={() => setSheet("breathe")}
            aria-label="Quick breathe"
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-tm-rule bg-tm-soft font-tm-mono text-[10px] tracking-[0.1em] text-tm-ink uppercase transition-[transform,opacity] duration-150 active:scale-[0.98] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/25"
          >
            <Wind className="size-3.5" aria-hidden />
            Breathe
          </button>
          <button
            type="button"
            disabled={today.day.ritualDone}
            onClick={() => setSheet("ritual")}
            aria-label="Quick ritual"
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-tm-rule bg-tm-soft font-tm-mono text-[10px] tracking-[0.1em] text-tm-ink uppercase transition-[transform,opacity] duration-150 active:scale-[0.98] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/25 disabled:opacity-40 disabled:active:scale-100"
          >
            <Utensils className="size-3.5" aria-hidden />
            Ritual
          </button>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-tm-rule bg-tm-panel" aria-label="Sections">
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex flex-1 cursor-pointer flex-col items-center gap-1 pt-2.5 pb-3 font-tm-mono text-[10px] tracking-[0.12em] uppercase transition-opacity duration-150 active:opacity-70",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/20",
                tab === t.id ? "text-tm-ink" : "text-tm-dim",
              )}
            >
              <span className={cn("mb-0.5 block h-[3px] w-8 rounded-full", tab === t.id ? accent : "bg-transparent")} />
              <t.Icon className="size-4" aria-hidden strokeWidth={tab === t.id ? 2.25 : 1.75} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <TmSheet open={sheet === "file"} onClose={() => setSheet(null)} title="File" label="File menu">
        <div className="flex flex-col gap-3">
          <p className="font-tm-mono text-[12px] text-tm-ink">
            Kitchen closes <b>{today.user.kitchenClose}</b>
          </p>
          <Link
            href="/why"
            className="font-tm-mono text-[11px] tracking-[0.12em] text-tm-dim uppercase underline decoration-tm-rule underline-offset-4"
            onClick={() => setSheet(null)}
          >
            Why this design
          </Link>
          <TmButton
            variant="danger"
            aria-label="Sign out"
            onClick={() => {
              setSheet(null);
              actions.logout();
            }}
          >
            Sign out
          </TmButton>
        </div>
      </TmSheet>

      <TmSheet open={sheet === "craving"} onClose={() => setSheet(null)} title="Craving hit?" label="Log craving">
        <CravingLogger embedded onDone={() => setSheet(null)} />
      </TmSheet>

      <TmSheet open={sheet === "breathe"} onClose={() => setSheet(null)} title="2-min breathe" label="Breathing timer">
        <p className="mb-2 text-[12.5px]">Double inhale, long exhale. The wave peaks and passes.</p>
        <BreathingTimerInline onDone={() => setSheet(null)} />
        <button
          type="button"
          onClick={() => setSheet(null)}
          className="mt-2 w-full cursor-pointer py-1 font-tm-mono text-[10px] text-tm-dim underline"
        >
          done early
        </button>
      </TmSheet>

      <TmSheet open={sheet === "ritual"} onClose={() => setSheet(null)} title="Close-out ritual" label="Close-out ritual">
        <p className="text-[12.5px]">
          <b>20:15:</b> skyr · 2 squares dark · decaf. Same cue, same reward, swapped routine.
        </p>
        <TmButton
          className="mt-3 w-full"
          disabled={today.day.ritualDone}
          onClick={() => {
            actions.markRitual();
            setSheet(null);
          }}
        >
          {today.day.ritualDone ? "Already done" : "Mark ritual done"}
        </TmButton>
      </TmSheet>
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
            Session expired. Signed out.
          </p>
          <button
            type="button"
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
