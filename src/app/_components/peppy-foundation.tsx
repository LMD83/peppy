"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, Camera, Check, ChevronLeft, CircleHelp, Clock3, HeartHandshake, Home, ListChecks, Mic, MoonStar, ShieldCheck, Smartphone, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SupportLevel = "guided" | "plan" | "low";
type FocusArea = "routine" | "appointments" | "food" | "home";
type Tab = "today" | "plan" | "capture" | "support";
type Stage = "welcome" | "support" | "focus" | "app";
type Task = { id: string; title: string; detail: string; area: FocusArea; done: boolean; deferred: boolean };
type PeppyState = { setup: boolean; support: SupportLevel; focus: FocusArea; lowEnergy: boolean; tasks: Task[]; helper: boolean; reminders: boolean; history: string[] };

const initialTasks: Task[] = [
  { id: "morning", title: "Start your first morning step", detail: "A small start is enough. Peppy will keep the rest for later.", area: "routine", done: false, deferred: false },
  { id: "drink", title: "Have a drink", detail: "Choose water, tea, or anything that feels manageable.", area: "food", done: false, deferred: false },
  { id: "appointment", title: "Check your next appointment", detail: "No appointment is booked yet. You can add one when it is useful.", area: "appointments", done: false, deferred: false },
];
const supportCopy: Record<SupportLevel, { label: string; detail: string }> = {
  guided: { label: "Guide me", detail: "Show one thing at a time and explain each step." },
  plan: { label: "Show my plan", detail: "Let me see a short, ordered day." },
  low: { label: "Keep today small", detail: "Show only the essentials I choose." },
};
const focusCopy: Record<FocusArea, { label: string; detail: string; icon: typeof ListChecks }> = {
  routine: { label: "Daily routine", detail: "Personal care, breaks, and things I do often.", icon: ListChecks },
  appointments: { label: "Appointments", detail: "Prepare, remember, and know what comes next.", icon: CalendarDays },
  food: { label: "Food and drink", detail: "Simple choices and gentle reminders.", icon: Home },
  home: { label: "Home tasks", detail: "Break jobs into small, manageable steps.", icon: Home },
};
const fresh = (): PeppyState => ({ setup: false, support: "guided", focus: "routine", lowEnergy: false, tasks: initialTasks, helper: false, reminders: false, history: [] });

export function PeppyFoundation() {
  const [state, setState] = useState<PeppyState>(fresh);
  const [stage, setStage] = useState<Stage>("welcome");
  const [tab, setTab] = useState<Tab>("today");
  const [status, setStatus] = useState("");
  const [online, setOnline] = useState(true);
  const taskSeq = useRef(0);

  useEffect(() => {
    // Deferred a tick: the first client render must match the prerender, and
    // react-hooks/set-state-in-effect bans the synchronous call besides.
    const load = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("peppy-state");
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<PeppyState>;
          setState({ ...fresh(), ...parsed });
          if (parsed.setup) setStage("app");
        }
      } catch { setStatus("Peppy could not read the last setup. You can continue with a fresh start."); }
      setOnline(window.navigator.onLine);
    }, 0);
    const update = () => setOnline(window.navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.clearTimeout(load); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const history = (message: string) => [...state.history, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " · " + message].slice(-12);
  const save = (next: PeppyState, message: string) => {
    setState(next); setStatus(message);
    try { window.localStorage.setItem("peppy-state", JSON.stringify(next)); }
    catch { setStatus("This choice is active for now, but could not be saved on this device."); }
  };
  const finishSetup = () => {
    save({ ...state, setup: true, history: history("Setup saved · " + supportCopy[state.support].label) }, "Setup saved. You can change it from Support.");
    setStage("app"); setTab("today");
  };
  const visible = useMemo(() => state.tasks.filter((task) => !task.done && !task.deferred && (!state.lowEnergy || task.area === state.focus)), [state.tasks, state.lowEnergy, state.focus]);
  const task = visible[0] ?? state.tasks.find((item) => !item.done) ?? state.tasks[0];
  const complete = (item: Task) => save({ ...state, tasks: state.tasks.map((entry) => entry.id === item.id ? { ...entry, done: true } : entry), history: history("Completed · " + item.title) }, "Saved as done. Nobody else was notified.");
  const defer = (item: Task) => save({ ...state, tasks: state.tasks.map((entry) => entry.id === item.id ? { ...entry, deferred: true } : entry), history: history("Not now · " + item.title) }, "Moved out of the way for now. It is not marked as failed.");
  const addTask = (area: FocusArea, title: string, detail: string) => {
    taskSeq.current += 1;
    const item: Task = { id: area + "-added-" + taskSeq.current, title, detail, area, done: false, deferred: false };
    save({ ...state, tasks: [...state.tasks, item], history: history("Added to plan · " + title) }, "Added to your plan. It will appear when useful.");
  };

  if (!state.setup && stage !== "app") return <Setup stage={stage} support={state.support} focus={state.focus} setSupport={(support) => setState((old) => ({ ...old, support }))} setFocus={(focus) => setState((old) => ({ ...old, focus }))} onNext={setStage} onFinish={finishSetup} />;

  return <Shell>
    {!online && <p role="status" className="mb-4 flex items-center gap-2 rounded-[14px] border-2 border-tm-amber bg-tm-amber-bg px-4 py-3 text-base text-tm-amber-ink"><Smartphone aria-hidden className="size-5" />Offline. New choices stay on this device and retry later.</p>}
    <header className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-tm-dim">Peppy</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-tm-ink">{tab === "today" ? "Today" : tab === "plan" ? "Your plan" : tab === "capture" ? "Tell Peppy" : "Support"}</h1></div><button type="button" onClick={() => setStatus("Peppy can read this view aloud when voice support is connected.")} className="inline-flex min-h-12 items-center gap-2 rounded-[14px] border-2 border-tm-rule-strong bg-tm-panel px-3 font-semibold text-tm-green"><Volume2 aria-hidden className="size-5" />Read aloud</button></header>
    <div className="mt-6">
      {tab === "today" && <Today state={state} task={task} complete={complete} defer={defer} setStatus={setStatus} toggleLow={() => save({ ...state, lowEnergy: !state.lowEnergy, history: history(state.lowEnergy ? "Full day restored" : "Low-energy day on") }, state.lowEnergy ? "Your full day is visible again." : "Today is smaller. Only your chosen essentials are visible.")} />}
      {tab === "plan" && <Plan state={state} addTask={addTask} />}
      {tab === "capture" && <Capture save={(message) => save({ ...state, history: history(message) }, message + ". Saved on this device.")} />}
      {tab === "support" && <Support state={state} save={save} history={history} />}
    </div>
    <p role="status" aria-live="polite" className="mt-5 min-h-14 rounded-[14px] bg-tm-green-faint px-4 py-3 text-base leading-relaxed text-tm-ink">{status || "Peppy saves each choice as you go."}</p>
    <nav aria-label="Main navigation" className="mt-8 grid grid-cols-4 gap-2 border-t-2 border-tm-rule pt-4">{([["today", "Today"], ["plan", "Plan"], ["capture", "Capture"], ["support", "Support"]] as [Tab, string][]).map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); setStatus(""); }} className={cn("min-h-14 rounded-[14px] px-2 text-sm font-semibold", tab === id ? "bg-tm-green text-tm-ongreen" : "border-2 border-tm-rule-strong bg-tm-panel text-tm-ink")}>{label}</button>)}</nav>
  </Shell>;
}

function Today({ state, task, complete, defer, setStatus, toggleLow }: { state: PeppyState; task: Task; complete: (task: Task) => void; defer: (task: Task) => void; setStatus: (message: string) => void; toggleLow: () => void }) {
  const Icon = focusCopy[task.area].icon;
  const done = state.tasks.every((item) => item.done || item.deferred);
  return <><p className="max-w-[36ch] text-lg leading-relaxed text-tm-dim">We can take today one thing at a time.</p><section aria-labelledby="next-title" className="mt-6 rounded-[18px] border-2 border-tm-green-mid bg-tm-panel p-5 shadow-[0_2px_8px_rgba(24,32,29,0.06)]"><div className="flex items-center gap-3 text-tm-green"><Icon aria-hidden className="size-6" /><p className="font-semibold">Next useful thing</p></div><h2 id="next-title" className="mt-5 text-2xl font-semibold leading-tight text-tm-ink">{done ? "You have reached a natural stopping point" : task.title}</h2><p className="mt-3 text-lg leading-relaxed text-tm-dim">{done ? "You can rest here, add something to the plan, or ask for support." : task.detail}</p>{!done && <div className="mt-6 grid gap-3"><button type="button" onClick={() => complete(task)} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[14px] bg-tm-green px-5 text-lg font-semibold text-tm-ongreen"><Check aria-hidden className="size-6" />Done</button><button type="button" onClick={() => setStatus("Go to Support to choose a trusted person or ask for a smaller step.")} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[14px] border-2 border-tm-green-mid bg-tm-green-faint px-5 text-lg font-semibold text-tm-ink"><CircleHelp aria-hidden className="size-6" />Help me with this</button><button type="button" onClick={() => defer(task)} className="min-h-12 rounded-[14px] px-5 text-lg font-semibold text-tm-dim underline underline-offset-4">Not now</button></div>}</section><section className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setStatus("Listening is off. Peppy will ask before using the microphone.")} className="flex min-h-16 items-center gap-3 rounded-[14px] border-2 border-tm-rule-strong bg-tm-panel px-4 text-left text-lg font-semibold"><Mic aria-hidden className="size-6 text-tm-green" />Tell Peppy something</button><button type="button" onClick={toggleLow} className="flex min-h-16 items-center gap-3 rounded-[14px] border-2 border-tm-rule-strong bg-tm-panel px-4 text-left text-lg font-semibold"><MoonStar aria-hidden className="size-6 text-tm-green" />{state.lowEnergy ? "Show the full day" : "Make today smaller"}</button></section></>;
}

function Plan({ state, addTask }: { state: PeppyState; addTask: (area: FocusArea, title: string, detail: string) => void }) {
  const choices: [FocusArea, string, string][] = [["routine", "Take a break", "A quiet pause when energy is low."], ["appointments", "Prepare for an appointment", "Keep questions and travel together."], ["food", "Choose an easy meal", "A low-effort option for later."], ["home", "One small home task", "A single surface or item, not the whole room."]];
  return <section aria-labelledby="plan-title"><h2 id="plan-title" className="sr-only">Plan items</h2><p className="text-lg leading-relaxed text-tm-dim">Choose a small thing to add. Peppy keeps it ready without asking you to build a full schedule.</p><div className="mt-6 grid gap-3">{choices.map(([area, title, detail]) => <button key={title} type="button" onClick={() => addTask(area, title, detail)} className="flex min-h-20 items-center gap-4 rounded-[14px] border-2 border-tm-rule-strong bg-tm-panel p-4 text-left"><ListChecks aria-hidden className="size-7 shrink-0 text-tm-green" /><span><span className="block text-lg font-semibold">{title}</span><span className="mt-1 block text-base leading-relaxed text-tm-dim">{detail}</span></span></button>)}</div><div className="mt-8 rounded-[18px] border-2 border-tm-rule bg-tm-panel p-4"><h3 className="text-lg font-semibold">Coming up</h3><ul className="mt-3 grid gap-2">{state.tasks.map((item) => <li key={item.id} className="flex items-center gap-3 text-base"><span className={cn("size-3 rounded-full", item.done ? "bg-tm-green" : item.deferred ? "bg-tm-amber" : "bg-tm-rule-strong")} aria-hidden />{item.title}<span className="text-sm text-tm-dim">{item.done ? "done" : item.deferred ? "later" : "ready"}</span></li>)}</ul></div></section>;
}

function Capture({ save }: { save: (message: string) => void }) {
  const choices: [typeof Mic, string, string][] = [[Mic, "Talk to Peppy", "Voice capture asks permission first."], [Camera, "Take a photo", "A photo stays evidence; it does not identify anyone."], [Clock3, "Choose something recent", "No typing needed."], [ListChecks, "Type a short note", "Typing is optional. A short note is enough."]];
  return <section aria-labelledby="capture-title"><h2 id="capture-title" className="sr-only">Capture something</h2><p className="text-lg leading-relaxed text-tm-dim">Choose the easiest way to tell Peppy. Nothing is shared without your say-so.</p><div className="mt-6 grid gap-3">{choices.map(([Icon, label, detail]) => <button key={label} type="button" onClick={() => save(label + " selected")} className="flex min-h-20 items-center gap-4 rounded-[14px] border-2 border-tm-rule-strong bg-tm-panel p-4 text-left"><Icon aria-hidden className="size-7 shrink-0 text-tm-green" /><span><span className="block text-lg font-semibold">{label}</span><span className="mt-1 block text-base leading-relaxed text-tm-dim">{detail}</span></span></button>)}</div></section>;
}

function Support({ state, save, history }: { state: PeppyState; save: (next: PeppyState, message: string) => void; history: (message: string) => string[] }) {
  return <section aria-labelledby="support-title"><h2 id="support-title" className="sr-only">Support settings</h2><p className="text-lg leading-relaxed text-tm-dim">Choose what makes Peppy easier and who may help. These settings are yours to change.</p><div className="mt-6 grid gap-3"><button type="button" aria-pressed={state.helper} onClick={() => save({ ...state, helper: !state.helper, history: history(state.helper ? "Trusted helper access off" : "Trusted helper access on") }, state.helper ? "Trusted helper access is off." : "Trusted helper access is on. Peppy will ask before sharing each item.")} className={cn("flex min-h-20 items-center gap-4 rounded-[14px] border-2 p-4 text-left", state.helper ? "border-tm-green bg-tm-green-faint" : "border-tm-rule-strong bg-tm-panel")}><HeartHandshake aria-hidden className="size-7 text-tm-green" /><span><span className="block text-lg font-semibold">Trusted helper</span><span className="mt-1 block text-base leading-relaxed text-tm-dim">{state.helper ? "On · Peppy asks before sharing." : "Off · nobody else can see your file."}</span></span></button><button type="button" aria-pressed={state.reminders} onClick={() => save({ ...state, reminders: !state.reminders, history: history(state.reminders ? "Reminders off" : "Reminders on") }, state.reminders ? "Reminders are off." : "Reminders are on inside quiet hours.")} className={cn("flex min-h-20 items-center gap-4 rounded-[14px] border-2 p-4 text-left", state.reminders ? "border-tm-green bg-tm-green-faint" : "border-tm-rule-strong bg-tm-panel")}><Bell aria-hidden className="size-7 text-tm-green" /><span><span className="block text-lg font-semibold">Reminders</span><span className="mt-1 block text-base leading-relaxed text-tm-dim">{state.reminders ? "On · quiet hours protected." : "Off · Peppy will not interrupt you."}</span></span></button><div className="rounded-[18px] border-2 border-tm-rule bg-tm-panel p-4"><div className="flex items-center gap-3"><ShieldCheck aria-hidden className="size-6 text-tm-green" /><h3 className="text-lg font-semibold">Change history</h3></div><ul className="mt-3 grid gap-2 text-sm text-tm-dim">{state.history.length ? state.history.slice().reverse().map((item) => <li key={item}>{item}</li>) : <li>No changes recorded yet.</li>}</ul></div><div className="rounded-[18px] border-2 border-tm-rule bg-tm-panel p-4"><h3 className="text-lg font-semibold">Urgent help</h3><p className="mt-2 text-base leading-relaxed text-tm-dim">Peppy is not an emergency service. If you are in immediate danger, contact local emergency services or someone you trust.</p></div></div></section>;
}

function Setup({ stage, support, focus, setSupport, setFocus, onNext, onFinish }: { stage: Stage; support: SupportLevel; focus: FocusArea; setSupport: (value: SupportLevel) => void; setFocus: (value: FocusArea) => void; onNext: (stage: Stage) => void; onFinish: () => void }) {
  return <Shell><div className="flex min-h-[calc(100dvh-3rem)] flex-col"><div className="mb-5 flex items-center justify-between"><p className="text-sm font-semibold text-tm-green">{stage === "welcome" ? "Welcome to Peppy" : stage === "support" ? "Step 1 of 2" : "Step 2 of 2"}</p>{stage !== "welcome" && <button type="button" onClick={() => onNext(stage === "focus" ? "support" : "welcome")} className="inline-flex min-h-12 items-center gap-2 rounded-[14px] px-2 font-semibold text-tm-green"><ChevronLeft aria-hidden className="size-5" />Back</button>}</div>{stage === "welcome" && <Step title="A little help with everyday life"><p className="max-w-[38ch] text-lg leading-relaxed text-tm-dim">Peppy remembers the plan, shows the next useful thing, and helps make difficult days smaller.</p><div className="mt-8 rounded-[18px] bg-tm-green-faint p-5"><HeartHandshake aria-hidden className="size-8 text-tm-green" /><p className="mt-3 text-lg font-semibold">You stay in control</p><p className="mt-1 text-base leading-relaxed text-tm-dim">Setup saves as you go. You can skip, stop, or change anything later.</p></div><Primary onClick={() => onNext("support")}>Set up Peppy</Primary><Secondary onClick={onFinish}>Show me an example first</Secondary></Step>}{stage === "support" && <Step title="How should Peppy help today?"><p className="text-lg leading-relaxed text-tm-dim">Choose what feels easiest. You can change this any time.</p><div role="radiogroup" aria-label="Assistance level" className="mt-6 grid gap-3">{(Object.keys(supportCopy) as SupportLevel[]).map((id) => <button key={id} type="button" role="radio" aria-checked={support === id} onClick={() => setSupport(id)} className={cn("flex min-h-20 items-center justify-between gap-4 rounded-[14px] border-2 p-4 text-left", support === id ? "border-tm-green bg-tm-green-faint" : "border-tm-rule-strong bg-tm-panel")}><span><span className="block text-lg font-semibold">{supportCopy[id].label}</span><span className="mt-1 block text-base leading-relaxed text-tm-dim">{supportCopy[id].detail}</span></span>{support === id && <Check aria-hidden className="size-6 text-tm-green" />}</button>)}</div><Primary onClick={() => onNext("focus")}>Continue</Primary></Step>}{stage === "focus" && <Step title="What should we make easier first?"><p className="text-lg leading-relaxed text-tm-dim">Choose one area. Peppy learns the rest only when it is useful.</p><div className="mt-6 grid gap-3">{(Object.keys(focusCopy) as FocusArea[]).map((id) => { const item = focusCopy[id]; const Icon = item.icon; return <button key={id} type="button" aria-pressed={focus === id} onClick={() => setFocus(id)} className={cn("flex min-h-20 items-center gap-4 rounded-[14px] border-2 p-4 text-left", focus === id ? "border-tm-green bg-tm-green-faint" : "border-tm-rule-strong bg-tm-panel")}><Icon aria-hidden className="size-7 shrink-0 text-tm-green" /><span className="min-w-0 flex-1"><span className="block text-lg font-semibold">{item.label}</span><span className="mt-1 block text-base leading-relaxed text-tm-dim">{item.detail}</span></span>{focus === id && <Check aria-hidden className="size-6 text-tm-green" />}</button>})}</div><Primary onClick={onFinish}>Use this first</Primary></Step>}</div></Shell>;
}
function Step({ title, children }: { title: string; children: React.ReactNode }) { return <section aria-labelledby="setup-title" className="flex flex-1 flex-col"><h1 id="setup-title" className="max-w-[18ch] text-3xl font-semibold leading-tight tracking-tight text-tm-ink">{title}</h1><div className="mt-4">{children}</div></section>; }
function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-[100dvh] bg-tm-paper px-4 py-6 text-tm-ink"><div className="mx-auto w-full max-w-xl">{children}</div></main>; }
function Primary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="mt-8 min-h-14 w-full rounded-[14px] bg-tm-green px-5 text-lg font-semibold text-tm-ongreen">{children}</button>; }
function Secondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="mt-3 min-h-12 w-full rounded-[14px] px-5 text-lg font-semibold text-tm-green underline underline-offset-4">{children}</button>; }
