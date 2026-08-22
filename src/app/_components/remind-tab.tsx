"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { cleanEmail } from "@convex/tm/logicEmail";
import { actionsFor } from "@convex/tm/logicPush";
import { useTimento } from "../_lib/backend";
import { postDeliver } from "../_lib/deliver-client";
import type { RemindData } from "../_lib/types";
import { Card, Eyebrow } from "./ui";

/**
 * Reminders — the promise the app has been making since Wave 1.
 *
 * The rule this screen is built around: **say what is actually true.** A switch
 * that reads "on" while nothing can possibly arrive is worse than no switch,
 * because the person stops watching for the thing that never comes. So every
 * blocker is named in plain words — no deployment keys, permission denied, not
 * installed to the Home Screen, demo copy with no server — and the switch is
 * only ever offered when turning it on would mean something.
 *
 * The iOS constraint is stated up front rather than discovered: Apple allows
 * web push only from an app added to the Home Screen, and gives a web app no
 * background timer of any kind. That is why the schedule runs on the server and
 * why this tab is a settings screen rather than a scheduler.
 *
 * The preview is the honest centre of the screen. It is not a mock-up: it is
 * the same `planReminders` output the server sweep sends, rendered with the
 * same words, so "what would have fired today" is answerable before anyone
 * agrees to be interrupted.
 */

/* ===== what this browser can actually do ===== */

type Capability = {
  /** Feature detection has run. Before that, claim nothing. */
  checked: boolean;
  serviceWorker: boolean;
  push: boolean;
  notifications: boolean;
  permission: NotificationPermission | "unsupported";
  /** iOS grants push only to a Home Screen install. */
  installed: boolean;
  ios: boolean;
};

const UNKNOWN: Capability = {
  checked: false,
  serviceWorker: false,
  push: false,
  notifications: false,
  permission: "unsupported",
  installed: false,
  ios: false,
};

function detect(): Capability {
  if (typeof window === "undefined" || typeof navigator === "undefined") return UNKNOWN;
  const nav = navigator as Navigator & { standalone?: boolean; maxTouchPoints?: number };
  const ios =
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
  const installed =
    nav.standalone === true ||
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches);
  const notifications = "Notification" in window;
  return {
    checked: true,
    serviceWorker: "serviceWorker" in navigator,
    push: "PushManager" in window,
    notifications,
    permission: notifications ? Notification.permission : "unsupported",
    installed,
    ios,
  };
}

/* What the browser can do is external, mutable state — the person can change
   the permission from the address bar while this tab is open. Bind it the way
   backend.tsx binds the session: a stable server snapshot plus a client read,
   rather than a setState in an effect that mismatches on hydration. */
let capCache: Capability | null = null;
const capListeners = new Set<() => void>();

function readCap(): Capability {
  if (capCache === null) capCache = detect();
  return capCache;
}

function subscribeCap(cb: () => void) {
  capListeners.add(cb);
  return () => {
    capListeners.delete(cb);
  };
}

/** Re-read after anything that can move the permission. */
function refreshCap() {
  capCache = detect();
  capListeners.forEach((fn) => fn());
}

/** The VAPID public key arrives base64url; PushManager wants bytes. */
function decodeKey(base64Url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return buffer;
}

function encodeKey(buffer: ArrayBuffer | null): string {
  if (buffer === null) return "";
  const bytes = new Uint8Array(buffer);
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  return window.btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A name a person will recognise on a list of their own devices. */
function deviceLabel(cap: Capability): string {
  if (cap.ios) return cap.installed ? "iPhone (Home Screen)" : "iPhone";
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) return "Android phone";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "This device";
}

/* ===== small pieces ===== */

/** State is a word and a shape, never a hue. */
function Toggle({
  label,
  detail,
  on,
  disabled,
  onChange,
}: {
  label: string;
  detail?: string;
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "flex min-h-14 w-full items-center justify-between gap-3 rounded-[14px] border px-4 py-3 text-left transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100",
        on ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule-strong bg-tm-panel text-tm-ink",
        disabled && "opacity-60",
      )}
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {detail && (
          <span className={cn("mt-0.5 block text-[14px]", on ? "text-white" : "text-tm-dim")}>{detail}</span>
        )}
      </span>
      <span aria-hidden className="shrink-0 font-tm-mono text-[14px]">
        {on ? "On ✓" : "Off ✕"}
      </span>
    </button>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true" aria-label="Loading reminders">
      {[0, 1].map((i) => (
        <Card key={i}>
          <div className="h-3 w-24 rounded bg-tm-soft" />
          <div className="mt-3 h-14 w-full rounded bg-tm-soft" />
          <div className="mt-2 h-11 w-2/3 rounded bg-tm-soft" />
        </Card>
      ))}
    </div>
  );
}

/* ===== the tab ===== */

export function RemindPanel() {
  const { remind } = useTimento();
  if (!remind) return <Skeleton />;
  return <Remind data={remind} />;
}

function Remind({ data }: { data: RemindData }) {
  const { actions, today, demo } = useTimento();
  const easy = today?.a11y.profile === "easy";

  const cap = useSyncExternalStore(subscribeCap, readCap, () => UNKNOWN);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  /* Register the worker once the tab is open. Registering is not asking for
     anything — no permission prompt fires here — so it is safe to do eagerly,
     and it means the worker is already in place when someone taps the switch. */
  useEffect(() => {
    if (!cap.checked || !cap.serviceWorker) return;
    let cancelled = false;
    void navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setEndpoint(sub?.endpoint ?? null);
      })
      .catch(() => {
        if (!cancelled) setStatus("The reminder worker could not start in this browser.");
      });
    return () => {
      cancelled = true;
    };
  }, [cap.checked, cap.serviceWorker]);

  const canSubscribe =
    cap.checked &&
    cap.serviceWorker &&
    cap.push &&
    cap.notifications &&
    cap.permission !== "denied" &&
    (!cap.ios || cap.installed) &&
    data.vapidPublicKey !== "";

  const turnOn = useCallback(() => {
    if (!canSubscribe) return;
    setBusy(true);
    setStatus("Asking this device for permission…");
    void Notification.requestPermission()
      .then(async (permission) => {
        refreshCap();
        if (permission !== "granted") {
          setStatus("This device said no. Nothing was turned on, and nothing will be sent.");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeKey(data.vapidPublicKey),
          }));
        const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
        const p256dh = json.keys?.p256dh ?? encodeKey(sub.getKey("p256dh"));
        const auth = json.keys?.auth ?? encodeKey(sub.getKey("auth"));
        actions.savePushSubscription({ endpoint: sub.endpoint, p256dh, auth, label: deviceLabel(cap) });
        actions.setReminderPrefs({ enabled: true });
        setEndpoint(sub.endpoint);
        setStatus("This device is set up. Reminders will come from the server, not from this tab.");
      })
      .catch(() => setStatus("This device could not be set up. Nothing was turned on."))
      .finally(() => setBusy(false));
  }, [actions, cap, canSubscribe, data.vapidPublicKey]);

  const turnOff = useCallback(() => {
    setBusy(true);
    const done = (message: string) => {
      actions.setReminderPrefs({ enabled: false });
      setEndpoint(null);
      setStatus(message);
      setBusy(false);
    };
    if (!cap.serviceWorker) {
      done("Reminders are off.");
      return;
    }
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (sub) {
          actions.removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        done("Reminders are off, and this device has been removed.");
      })
      .catch(() => done("Reminders are off."));
  }, [actions, cap.serviceWorker]);

  /**
   * A test that is honest about what it proves. This draws a notification from
   * the worker already running in this browser — it proves the worker, the
   * icons and the permission. It does NOT prove the server can reach you when
   * the tab is shut, and it says so rather than letting a green tick imply it.
   */
  const testNotification = useCallback(() => {
    const note = {
      title: "Timento — test",
      body: "This is what a reminder looks like.",
      tab: "today",
      tag: "timento-test",
    };
    const send = async () => {
      if (demo && (data.prefs.email !== "" || endpoint !== null)) {
        let targets: { endpoint: string; p256dh: string; auth: string }[] = [];
        if (cap.serviceWorker) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
            const p256dh = json.keys?.p256dh ?? encodeKey(sub.getKey("p256dh"));
            const auth = json.keys?.auth ?? encodeKey(sub.getKey("auth"));
            targets = [{ endpoint: sub.endpoint, p256dh, auth }];
          }
        }
        const ok = await postDeliver({
          email: data.prefs.email,
          targets,
          notifications: [note],
        });
        if (ok) {
          setStatus(
            "Sent. If an email is on the file it should arrive; a push lands only if this device is subscribed.",
          );
          return;
        }
      }
      if (!cap.notifications || cap.permission !== "granted") {
        setStatus("Turn reminders on, or add an email, first — there is nothing to test yet.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(note.title, {
        body: "This is what a reminder looks like on this device.",
        tag: note.tag,
        icon: "/icon-192.png",
      });
      setStatus(
        "Sent from this browser. That proves the notification works here; it does not prove the server can reach you with the tab closed.",
      );
    };
    void send().catch(() => setStatus("This device would not show a test notification."));
  }, [cap.notifications, cap.permission, cap.serviceWorker, data.prefs.email, demo, endpoint]);

  const browserBlockers = useMemo(() => {
    if (!cap.checked) return [];
    const out: string[] = [];
    if (!cap.serviceWorker || !cap.push || !cap.notifications) {
      out.push("This browser has no support for web push, so nothing can be delivered to it.");
    }
    if (cap.ios && !cap.installed) {
      out.push(
        "On an iPhone or iPad this only works once the app is on the Home Screen: tap Share, then Add to Home Screen, and open it from there.",
      );
    }
    if (cap.permission === "denied") {
      out.push(
        "Notifications are blocked for this site in your browser settings. Only you can undo that, in the browser — the app cannot ask again.",
      );
    }
    return out;
  }, [cap]);

  const subscribedHere = endpoint !== null;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 pt-5",
        !easy && "lg:grid lg:grid-cols-12 lg:items-start lg:gap-6",
      )}
    >
      <div className="flex flex-col gap-3 lg:col-span-7">
        <p role="status" aria-live="polite" className="sr-only">
          {status}
        </p>
        <SwitchCard
          data={data}
          demo={demo}
          blockers={[...data.blockers, ...browserBlockers]}
          canSubscribe={canSubscribe}
          subscribedHere={subscribedHere}
          busy={busy}
          onTurnOn={turnOn}
          onTurnOff={turnOff}
          onTest={testNotification}
        />

        {status !== "" && (
          <Card>
            <p className="text-[14px] leading-relaxed">{status}</p>
          </Card>
        )}

        <PreviewCard data={data} easy={easy} />
        <EmailCard data={data} onChange={actions.setReminderPrefs} />
      </div>

      <div className="flex flex-col gap-3 lg:col-span-5">
        {!easy && (
          <>
            <KindsCard data={data} onChange={actions.setReminderPrefs} />
            <QuietCard data={data} onChange={actions.setReminderPrefs} />
            <DevicesCard data={data} subscribedHere={subscribedHere} />
          </>
        )}

        <Card>
          <Eyebrow color="bg-tm-rule-strong">How this works</Eyebrow>
          <p className="text-[14px] leading-relaxed">{data.iosNote}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-tm-dim">{data.note}</p>
        </Card>
      </div>
    </div>
  );
}

/* ===== cards ===== */

function SwitchCard({
  data,
  demo,
  blockers,
  canSubscribe,
  subscribedHere,
  busy,
  onTurnOn,
  onTurnOff,
  onTest,
}: {
  data: RemindData;
  demo: boolean;
  blockers: string[];
  canSubscribe: boolean;
  subscribedHere: boolean;
  busy: boolean;
  onTurnOn: () => void;
  onTurnOff: () => void;
  onTest: () => void;
}) {
  const live = data.ready;
  return (
    <Card tone={live ? "default" : "amber"}>
      <Eyebrow color={live ? "bg-tm-green" : "bg-tm-amber"}>
        {live ? "Reminders are on" : "Reminders cannot fire yet"}
      </Eyebrow>

      {blockers.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {blockers.map((b) => (
            <li key={b} className="flex gap-2 text-[14px] leading-relaxed">
              {/* A shape, so the list reads the same with colour switched off. */}
              <span aria-hidden className="shrink-0 font-tm-mono">
                ✕
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] leading-relaxed">
          {demo
            ? "This tab holds the schedule while it is open. Closing it pauses demo delivery."
            : "The server holds the schedule and this device is set up to receive it. Nothing runs in this tab, so closing it changes nothing."}
        </p>
      )}

      {subscribedHere || (data.prefs.enabled && data.prefs.email !== "") ? (
        <button
          type="button"
          onClick={onTurnOff}
          disabled={busy}
          className="mt-3 min-h-14 w-full rounded-[14px] border border-tm-red bg-tm-panel px-4 text-[17px] font-medium text-tm-red transition-transform duration-150 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
          Turn reminders off on this device
        </button>
      ) : (
        <button
          type="button"
          onClick={onTurnOn}
          disabled={busy || !canSubscribe}
          className="mt-3 min-h-14 w-full rounded-[14px] border border-tm-ink bg-tm-ink px-4 text-[17px] font-medium text-white transition-transform duration-150 active:scale-[0.98] disabled:border-tm-rule-strong disabled:bg-tm-soft disabled:text-tm-dim disabled:active:scale-100"
        >
          {busy ? "Setting up…" : "Turn reminders on for this device"}
        </button>
      )}

      <button
        type="button"
        onClick={onTest}
        className="mt-2 min-h-14 w-full rounded-[14px] border border-tm-rule-strong bg-tm-panel px-4 text-[17px] font-medium text-tm-ink transition-transform duration-150 active:scale-[0.98]"
      >
        Show me what one looks like
      </button>
    </Card>
  );
}

function PreviewCard({ data, easy }: { data: RemindData; easy: boolean }) {
  const held = [
    ...data.quietHeld.map((r) => ({ card: r, why: "inside your quiet hours" })),
    ...data.survivalHeld.map((r) => ({ card: r, why: "not something survival mode interrupts you for" })),
    ...data.overCap.map((r) => ({ card: r, why: `over your limit of ${data.prefs.maxPerDay} a day` })),
  ];

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">What today would have said</Eyebrow>
      {data.preview.length === 0 ? (
        <p className="text-[14px] leading-relaxed">
          Nothing today. Either it is all logged already, or nothing was due — both are good outcomes,
          and neither is a problem to fix.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.preview.map((r) => (
              <li key={r.key} className="rounded-[14px] border border-tm-rule bg-tm-panel px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase">
                    {r.at}
                  </span>
                  <span className="font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase">
                    {r.kind}
                  </span>
                </div>
                <p className="mt-1 text-[15px] font-medium">{r.title}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-tm-dim">{r.body}</p>
                {/* The buttons this one would carry, where the platform draws
                    buttons at all: a dose gets Taken when its single-use grant
                    rides along at send time, which is the usual case. Chips,
                    not controls — this is a preview. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {actionsFor(r.kind === "dose").map((a) => (
                    <span
                      key={a.action}
                      className="rounded-full border border-tm-rule-strong bg-tm-soft px-2.5 py-0.5 font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase"
                    >
                      {a.title}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[14px] leading-relaxed text-tm-dim">
            On Android and on a desktop those arrive as buttons on the notification itself — Taken
            logs the dose without opening the app. An iPhone shows no buttons; there, tapping the
            notification opens the right screen instead.
          </p>
        </>
      )}

      {data.survival && (
        <p className="mt-3 rounded-[14px] border border-tm-amber bg-tm-amber-bg px-3 py-2 text-[14px] leading-relaxed text-tm-amber-ink">
          {data.survivalNote}
        </p>
      )}

      {!easy && held.length > 0 && (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-[14px] font-medium">
            {held.length} held back, and why
          </summary>
          <ul className="mt-1 flex flex-col gap-2">
            {held.map(({ card, why }) => (
              <li key={`${card.key}-${why}`} className="rounded-[14px] border border-tm-rule bg-tm-soft px-3 py-2">
                <p className="text-[14px] font-medium">{card.title}</p>
                <p className="mt-0.5 text-[14px] text-tm-dim">
                  {card.at} · {why}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

type PrefsChange = Parameters<ReturnType<typeof useTimento>["actions"]["setReminderPrefs"]>[0];

function EmailCard({ data, onChange }: { data: RemindData; onChange: (p: PrefsChange) => void }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Email</Eyebrow>
      <p className="text-[14px] leading-relaxed">
        Optional. The same words as a push, sent once. It stays on this file and is never shown to
        crew.
      </p>
      <label className="mt-3 flex flex-col gap-1 text-[14px] font-medium">
        Address
        <input
          type="email"
          autoComplete="email"
          defaultValue={data.prefs.email}
          onBlur={(e) => {
            const email = cleanEmail(e.target.value);
            onChange({ email, ...(email !== "" ? { enabled: true } : {}) });
          }}
          className="min-h-11 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 text-[15px]"
        />
      </label>
      {!data.emailSupported && data.prefs.email !== "" ? (
        <p className="mt-2 text-[14px] leading-relaxed text-tm-dim">
          Saved, but this copy of the app has no email key yet, so mail will not go out.
        </p>
      ) : null}
    </Card>
  );
}

function KindsCard({ data, onChange }: { data: RemindData; onChange: (p: PrefsChange) => void }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-purple">What may interrupt you</Eyebrow>
      <div className="flex flex-col gap-2">
        <Toggle
          label="Doses"
          detail="Only ones you have not already ticked off."
          on={data.prefs.doses}
          onChange={(doses) => onChange({ doses })}
        />
        <Toggle
          label="Running low"
          detail="From the counts you entered, and your own lead time."
          on={data.prefs.supply}
          onChange={(supply) => onChange({ supply })}
        />
        <Toggle
          label="Today's checks"
          detail="One evening nudge, never one per check."
          on={data.prefs.checkins}
          onChange={(checkins) => onChange({ checkins })}
        />
        <Toggle
          label="Blood rechecks"
          detail="When your own results say a marker is due another draw."
          on={data.prefs.rechecks}
          onChange={(rechecks) => onChange({ rechecks })}
        />
        <Toggle
          label="Prescriptions"
          detail="A script running out, or one with no repeats left."
          on={data.prefs.scripts}
          onChange={(scripts) => onChange({ scripts })}
        />
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-tm-dim">
        At most {data.prefs.maxPerDay} a day, whatever is due. Anything already logged is silent, and
        a missed thing is mentioned once — never repeated into a pile.
      </p>
    </Card>
  );
}

function QuietCard({ data, onChange }: { data: RemindData; onChange: (p: PrefsChange) => void }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-green">Quiet hours</Eyebrow>
      <p className="text-[14px] leading-relaxed">
        Nothing fires between these times, whatever is due. Sleep is not something the app gets to
        interrupt.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="flex min-w-32 flex-1 flex-col gap-1 text-[14px] font-medium">
          From
          <input
            type="time"
            value={data.prefs.quietFrom}
            onChange={(e) => onChange({ quietFrom: e.target.value })}
            className="min-h-11 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 text-[15px]"
          />
        </label>
        <label className="flex min-w-32 flex-1 flex-col gap-1 text-[14px] font-medium">
          Until
          <input
            type="time"
            value={data.prefs.quietTo}
            onChange={(e) => onChange({ quietTo: e.target.value })}
            className="min-h-11 rounded-[14px] border border-tm-rule-strong bg-tm-panel px-3 text-[15px]"
          />
        </label>
      </div>
    </Card>
  );
}

function DevicesCard({ data, subscribedHere }: { data: RemindData; subscribedHere: boolean }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-rule-strong">Your devices · {data.subscriptions.length}</Eyebrow>
      {data.subscriptions.length === 0 ? (
        <p className="text-[14px] leading-relaxed">
          None yet. A device is added the moment you turn reminders on there.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.subscriptions.map((s) => (
            <li key={s.id} className="rounded-[14px] border border-tm-rule bg-tm-panel px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-medium">{s.label}</span>
                <span className="font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase">
                  {s.healthy ? "ok ✓" : "stopped ✕"}
                </span>
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-tm-dim">{s.line}</p>
              <p className="mt-0.5 text-[14px] text-tm-dim">Added {s.createdDate}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[14px] leading-relaxed text-tm-dim">
        {subscribedHere
          ? "This device is one of them. A device is turned off from the device itself — the button at the top of this screen does it for this one."
          : "A device is turned off from the device itself, so nobody can silence somebody else's phone from a browser they happen to be signed in on."}
      </p>
    </Card>
  );
}
