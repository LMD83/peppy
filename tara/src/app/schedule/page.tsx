"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Trash2, CalendarClock } from "lucide-react";

import { useSchedule, nextWindow, type IntervalPreset } from "@/hooks/use-schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Vocabulary throughout this page: "scheduled window," "amount," "measurement."
// Never "dose" or "injection." See docs/COMPLIANCE.md.

const INTERVAL_HOURS: Record<Exclude<IntervalPreset, "custom">, number> = {
  "12h": 12,
  "24h": 24,
  "48h": 48,
  weekly: 168,
};

const dateFmt = new Intl.DateTimeFormat("en-IE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatCountdown(ms: number): string {
  if (ms <= 0) return "due now";
  const totalMin = Math.round(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days) parts.push(`${mins}m`);
  return `in ${parts.join(" ")}`;
}

export default function SchedulePage() {
  const { entries, addEntry, removeEntry, hydrated } = useSchedule();
  const [now, setNow] = useState(() => Date.now());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [notified, setNotified] = useState<Set<string>>(new Set());

  const [compound, setCompound] = useState("");
  const [amountMcg, setAmountMcg] = useState<number>(0);
  const [preset, setPreset] = useState<IntervalPreset>("24h");
  const [customHours, setCustomHours] = useState<number>(24);
  const [startAt, setStartAt] = useState(() => toLocalInputValue(new Date()));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser's Notification permission is a legitimate post-mount external-system sync
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  // Tick every 30s so countdowns and due-reminders stay live while the tab is open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const withNextWindow = useMemo(
    () =>
      entries
        .map((e) => ({ ...e, next: nextWindow(e, now) }))
        .sort((a, b) => a.next - b.next),
    [entries, now]
  );

  const soonest = withNextWindow[0];

  // Best-effort local reminder — fires only while this tab is open and
  // permission was granted. Not a substitute for a real push notification
  // system (see docs/COMPLIANCE.md and the roadmap in design-reference/).
  useEffect(() => {
    if (permission !== "granted") return;
    for (const e of withNextWindow) {
      const dueKey = `${e.id}:${e.next}`;
      if (e.next <= now && e.next > now - 30_000 && !notified.has(dueKey)) {
        new Notification("TARA — scheduled research window", {
          body: `${e.compound}: ${e.amountMcg} mcg scheduled window is due.`,
        });
        // eslint-disable-next-line react-hooks/set-state-in-effect -- marks a browser Notification we just fired as sent, so it isn't fired again on the next tick
        setNotified((prev) => new Set(prev).add(dueKey));
      }
    }
  }, [withNextWindow, now, permission, notified]);

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!compound.trim() || amountMcg <= 0) return;
    const intervalHours = preset === "custom" ? customHours : INTERVAL_HOURS[preset];
    addEntry({
      compound: compound.trim(),
      amountMcg,
      intervalHours,
      startAt: new Date(startAt).getTime(),
      notes: notes.trim(),
    });
    setCompound("");
    setAmountMcg(0);
    setNotes("");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-secondary">
        RESEARCH SCHEDULE
      </p>
      <h1 className="mb-3 max-w-2xl font-serif text-4xl font-semibold text-foreground">
        Protocol windows, tracked in the browser.
      </h1>
      <p className="mb-10 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
        Set a recurring interval per compound and TARA tracks the next scheduled window for
        you. Reminders are local to this browser tab — not a substitute for your own research
        log. A tool, not advice — for laboratory research use only.
      </p>

      <div className="mb-8 rounded-md bg-panel p-7 text-panel-foreground">
        <span className="text-xs font-semibold tracking-[0.14em] text-secondary">
          NEXT SCHEDULED WINDOW
        </span>
        {soonest ? (
          <>
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <span className="font-serif text-3xl font-semibold">{soonest.compound}</span>
              <span className="text-panel-muted">{soonest.amountMcg} mcg</span>
            </div>
            <p className="mt-2 text-panel-muted">
              {dateFmt.format(new Date(soonest.next))} · {formatCountdown(soonest.next - now)}
            </p>
          </>
        ) : (
          <p className="mt-3 text-panel-muted">
            No scheduled windows yet — add one below.
          </p>
        )}
        <div className="mt-5 border-t border-panel-border pt-4">
          {permission === "unsupported" ? (
            <p className="flex items-center gap-2 text-xs text-panel-muted">
              <BellOff className="size-3.5" /> Notifications aren&apos;t supported in this browser.
            </p>
          ) : permission === "granted" ? (
            <p className="flex items-center gap-2 text-xs text-secondary">
              <Bell className="size-3.5" /> Reminders enabled for this tab.
            </p>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={requestPermission} className="gap-1.5">
              <Bell className="size-3.5" /> Enable reminders in this browser
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleAdd} className="mb-10 grid gap-4 rounded-md border border-border bg-card p-7 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="compound" className="text-sm font-semibold">
            Compound
          </label>
          <Input id="compound" value={compound} onChange={(e) => setCompound(e.target.value)} placeholder="e.g. BPC-157" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-sm font-semibold">
            Amount per window (mcg)
          </label>
          <Input
            id="amount"
            type="number"
            min={0}
            step={25}
            className="font-mono"
            value={amountMcg || ""}
            onChange={(e) => setAmountMcg(Number(e.target.value))}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="interval" className="text-sm font-semibold">
            Interval
          </label>
          <select
            id="interval"
            value={preset}
            onChange={(e) => setPreset(e.target.value as IntervalPreset)}
            className="h-10 rounded-sm border border-input bg-card px-3 text-sm"
          >
            <option value="12h">Every 12 hours</option>
            <option value="24h">Every 24 hours</option>
            <option value="48h">Every 48 hours</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </select>
          {preset === "custom" && (
            <Input
              type="number"
              min={1}
              className="mt-1 font-mono"
              value={customHours}
              onChange={(e) => setCustomHours(Number(e.target.value))}
              placeholder="Hours between windows"
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="start" className="text-sm font-semibold">
            First window
          </label>
          <Input
            id="start"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-semibold">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. rotate location, fasted" />
        </div>
        <Button type="submit" className="sm:col-span-2">
          <CalendarClock className="size-4" /> Add to schedule
        </Button>
      </form>

      {hydrated && withNextWindow.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10.5px] tracking-[0.08em] text-muted-foreground">
                <th className="px-6 py-2.5 font-medium">COMPOUND</th>
                <th className="px-4 py-2.5 font-medium">AMOUNT</th>
                <th className="px-4 py-2.5 font-medium">INTERVAL</th>
                <th className="px-4 py-2.5 font-medium">NEXT WINDOW</th>
                <th className="px-6 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {withNextWindow.map((e) => (
                <tr key={e.id} className="border-b border-muted last:border-0">
                  <td className="px-6 py-3 font-semibold">{e.compound}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{e.amountMcg} mcg</td>
                  <td className="px-4 py-3 text-muted-foreground">every {e.intervalHours}h</td>
                  <td className="px-4 py-3">
                    {dateFmt.format(new Date(e.next))}
                    <span className="ml-2 text-xs text-muted-foreground">{formatCountdown(e.next - now)}</span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeEntry(e.id)}
                      aria-label={`Remove ${e.compound} from schedule`}
                      className="text-destructive hover:underline"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        For laboratory research use only. Not for human or veterinary use. This schedule is a
        personal organisation tool — it does not recommend an amount or interval.
      </p>
    </div>
  );
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
