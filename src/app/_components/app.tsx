"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { plain } from "@convex/tm/logicEasy";
import { cn } from "@/lib/utils";
import { TimentoProvider, clearStoredSession, useTimento } from "../_lib/backend";
import { Login } from "./login";
import { Scoreboard } from "./scoreboard";
import { TodayTab } from "./today-tab";
import { FileNavProvider } from "./file-nav";
import { Onboarding } from "./onboarding";
import { Walkthrough, type TourDestination } from "./walkthrough";
import { Eyebrow, fileWidth } from "./ui";

function TabBusy() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true">
      <p role="status" className="sr-only">
        Loading section…
      </p>
      <div className="h-24 rounded-[10px] border border-tm-rule bg-tm-panel" />
    </div>
  );
}

const CrewTab = dynamic(() => import("./crew-tab").then((m) => m.CrewTab), { loading: TabBusy });
const ProgressTab = dynamic(() => import("./progress-tab").then((m) => m.ProgressTab), { loading: TabBusy });
const ResearchTab = dynamic(() => import("./research-tab").then((m) => m.ResearchTab), { loading: TabBusy });
const FuelTab = dynamic(() => import("./fuel-tab").then((m) => m.FuelTab), { loading: TabBusy });
const TrainTab = dynamic(() => import("./train-tab").then((m) => m.TrainTab), { loading: TabBusy });
const StackTab = dynamic(() => import("./stack-tab").then((m) => m.StackTab), { loading: TabBusy });
const SupplyPanel = dynamic(() => import("./supply-tab").then((m) => m.SupplyPanel), { loading: TabBusy });
const LabsTab = dynamic(() => import("./labs-tab").then((m) => m.LabsTab), { loading: TabBusy });
const MindTab = dynamic(() => import("./mind-tab").then((m) => m.MindTab), { loading: TabBusy });
const SettingsTab = dynamic(() => import("./settings-tab").then((m) => m.SettingsTab), { loading: TabBusy });
const HandsFreePanel = dynamic(() => import("./handsfree-tab").then((m) => m.HandsFreePanel), { loading: TabBusy });
const ShopPanel = dynamic(() => import("./shop-tab").then((m) => m.ShopPanel), { loading: TabBusy });
const RemindPanel = dynamic(() => import("./remind-tab").then((m) => m.RemindPanel), { loading: TabBusy });
const CapturePanel = dynamic(() => import("./capture-tab").then((m) => m.CapturePanel), { loading: TabBusy });

/*
  Bottom nav — the same four stamps in both profiles.

  The story, left to right: execute the day, open the protocol, see the other
  holder, then the appendix. Easy mode used to hide Crew and the work inside a
  thirteen-row More list. That was a second IA, not a simpler one. Easy still
  shows fewer cards on Today; the bar tells the same story.
*/
type TabId =
  | "today"
  | "protocol"
  | "fuel"
  | "train"
  | "body"
  | "mind"
  | "crew"
  | "more"
  | "settings"
  | "handsfree"
  | "shop"
  | "remind"
  | "capture";

const NAV: readonly { id: TabId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "protocol", label: "Protocol" },
  { id: "crew", label: "Crew" },
  { id: "more", label: "More" },
];

const PROTOCOL_TABS: ReadonlySet<TabId> = new Set(["fuel", "train", "body", "mind"]);
const MORE_TABS: ReadonlySet<TabId> = new Set(["settings", "handsfree", "shop", "remind", "capture"]);

type Destination = { key: string; label: string; tab: TabId; sub?: string; group: string };

/** The day's work, in the order a day actually runs. */
const PROTOCOL_STORY: Destination[] = [
  { key: "fuel", label: "Fuel", tab: "fuel", group: "kitchen" },
  { key: "train", label: "Train", tab: "train", group: "kitchen" },
  { key: "stack", label: "Stack", tab: "body", sub: "stack", group: "body" },
  { key: "supply", label: "Supply", tab: "body", sub: "supply", group: "body" },
  { key: "labs", label: "Bloods", tab: "body", sub: "labs", group: "body" },
  { key: "trend", label: "Trend", tab: "body", sub: "trend", group: "body" },
  { key: "checkin", label: "Check-in", tab: "mind", sub: "checkin", group: "mind" },
  { key: "research", label: "Trigger map", tab: "mind", sub: "craving", group: "mind" },
];

const APPENDIX: Destination[] = [
  { key: "shop", label: "Shopping", tab: "shop", group: "appendix" },
  { key: "handsfree", label: "Hands-free", tab: "handsfree", group: "appendix" },
  { key: "remind", label: "Reminders", tab: "remind", group: "appendix" },
  { key: "capture", label: "Photos", tab: "capture", group: "appendix" },
];

const STORY_GROUPS = [
  { id: "kitchen", eyebrow: "Kitchen and session", color: "bg-tm-amber" },
  { id: "body", eyebrow: "The body file", color: "bg-tm-blue" },
  { id: "mind", eyebrow: "The mind file", color: "bg-tm-yellow" },
] as const;

/**
 * One big row in a story shelf. 64px tall, whole row is the target, and the
 * chevron is a shape rather than a colour so it survives forced-colours.
 */
function NavRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-tm-rule-strong bg-tm-panel px-4 py-3 text-left text-[17px] font-medium text-tm-ink transition-transform duration-150 active:scale-[0.98]"
    >
      <span className="min-w-0">{label}</span>
      <span aria-hidden className="shrink-0 font-tm-mono text-[17px] text-tm-dim">
        →
      </span>
    </button>
  );
}

function ProtocolShelf({
  easy,
  onGo,
}: {
  easy: boolean;
  onGo: (d: Destination) => void;
}) {
  return (
    <div className="flex flex-col gap-2 pt-5">
      <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">Protocol</h2>
      <p className="mb-1 text-[15px] text-tm-dim">The day&apos;s work, in order.</p>
      {STORY_GROUPS.map((g) => (
        <div key={g.id} className="flex flex-col gap-2">
          <Eyebrow color={g.color} className="mt-2 mb-0">
            {g.eyebrow}
          </Eyebrow>
          {PROTOCOL_STORY.filter((d) => d.group === g.id).map((d) => (
            <NavRow key={d.key} label={easy ? plain(d.label) : d.label} onClick={() => onGo(d)} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * More used to be seven ungrouped rows — a junk drawer next to Protocol's
 * grouped shelf. Same eyebrow treatment here: which appendix rows land under
 * which group, keyed against APPENDIX so the row order and labels those rows
 * already own (and the e2e/a11y scripts already select on) stay untouched.
 */
const MORE_GROUPS: { id: string; eyebrow: string; color: string; keys: string[] }[] = [
  { id: "week", eyebrow: "The week", color: "bg-tm-blue", keys: ["shop", "capture"] },
  { id: "ways-in", eyebrow: "Ways in", color: "bg-tm-green", keys: ["handsfree", "remind"] },
];

function MoreShelf({
  easy,
  onGo,
  onSettings,
  onTour,
  onSetup,
}: {
  easy: boolean;
  onGo: (d: Destination) => void;
  onSettings: () => void;
  onTour: () => void;
  onSetup: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 pt-5">
      <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">More</h2>
      {MORE_GROUPS.map((g) => (
        <div key={g.id} className="flex flex-col gap-2">
          <Eyebrow color={g.color} className="mt-2 mb-0">
            {g.eyebrow}
          </Eyebrow>
          {APPENDIX.filter((d) => g.keys.includes(d.key)).map((d) => (
            <NavRow key={d.key} label={easy ? plain(d.label) : d.label} onClick={() => onGo(d)} />
          ))}
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <Eyebrow color="bg-tm-dim2" className="mt-2 mb-0">
          The app
        </Eyebrow>
        <NavRow label="Set up my file" onClick={onSetup} />
        <NavRow label="Walkthrough" onClick={onTour} />
        <NavRow label="Settings" onClick={onSettings} />
      </div>
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
  const [tour, setTour] = useState(false);
  const [setup, setSetup] = useState(false);

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

  if (!authReady)
    return (
      <div className="min-h-screen bg-tm-paper" role="status" aria-busy="true">
        <p className="sr-only">Opening file…</p>
      </div>
    );
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

  // The wizard is a full-screen takeover: one question, no chrome competing
  // with it. Everything it saves is already on the file when it closes.
  if (setup) {
    return (
      <Onboarding
        onClose={(dest) => {
          setSetup(false);
          if (dest) setTab(dest);
        }}
      />
    );
  }

  const survival = today.user.mode === "survival";
  // The nav indicator is a 3px bar — a non-text UI element, so 3:1 is the bar.
  // amber-lift sits on the white nav at 1.9:1, so the light-surface amber is
  // right here; it clears 5.77:1 on panel.
  const accent = survival ? "bg-tm-amber" : "bg-tm-green";
  const navCurrent: TabId = PROTOCOL_TABS.has(tab) ? "protocol" : MORE_TABS.has(tab) ? "more" : tab;

  function goDestination(d: Destination) {
    if (d.sub) (d.tab === "body" ? setBodyView : setMindView)(d.sub);
    setTab(d.tab);
  }

  // The walkthrough's stops reuse the same navigation the shelves use.
  function goTourStop(d: TourDestination) {
    if (d.sub) (d.tab === "body" ? setBodyView : setMindView)(d.sub);
    setTab(d.tab);
  }

  return (
    <FileNavProvider
      value={(t, sub) => {
        // Same shape as goDestination: a sub always names which slice of body
        // or mind it opens, then the tab switch itself.
        if (sub) (t === "body" ? setBodyView : setMindView)(sub);
        setTab(t);
      }}
    >
    <div className={cn("min-h-screen", tour ? "pb-[300px]" : "pb-[84px]")}>
      <a
        href="#tm-main"
        className="fixed -top-24 left-3 z-[60] inline-flex min-h-11 items-center rounded-[10px] bg-tm-ink px-4 font-tm-mono text-[11.5px] tracking-[0.15em] text-white uppercase focus:top-3"
      >
        Skip to content
      </a>
      <Scoreboard />
      <main id="tm-main" className={cn(fileWidth, "px-4")}>
        {tab === "protocol" && <ProtocolShelf easy={easy} onGo={goDestination} />}
        {tab === "more" && (
          <MoreShelf
            easy={easy}
            onGo={goDestination}
            onSettings={() => setTab("settings")}
            onTour={() => setTour(true)}
            onSetup={() => setSetup(true)}
          />
        )}
        {tab === "settings" && <SettingsTab />}
        {tab === "handsfree" && <HandsFreePanel />}
        {tab === "shop" && <ShopPanel />}
        {tab === "remind" && <RemindPanel />}
        {tab === "capture" && <CapturePanel />}
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
      {tour && <Walkthrough onClose={() => setTour(false)} onNavigate={goTourStop} />}
      <nav className="fixed inset-x-0 bottom-0 border-t border-tm-rule bg-tm-panel" aria-label="Sections">
        <div className={cn(fileWidth, "flex")}>
          {NAV.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "protocol" && PROTOCOL_TABS.has(tab)) setTab("protocol");
                else if (t.id === "more" && MORE_TABS.has(tab)) setTab("more");
                else setTab(t.id);
              }}
              aria-current={navCurrent === t.id ? "page" : undefined}
              className={cn(
                "min-h-14 min-w-0 flex-1 cursor-pointer px-0.5 pt-3 pb-4 font-tm-mono text-[11.5px] leading-none tracking-[0.02em] whitespace-nowrap uppercase",
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
    </FileNavProvider>
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
            Session expired. Signed out.
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
