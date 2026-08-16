/*
 * Timento service worker — reminders, and deliberately nothing else.
 *
 * This file exists so a reminder can arrive when the tab is closed. That is the
 * whole job in this pass. It does NOT cache the app: a half-cached health file
 * is worse than none, because the one thing more dangerous than an app that is
 * offline is an app that is confidently showing you yesterday's doses. Offline
 * is a separate piece of work with its own correctness rules, and it is not
 * being smuggled in behind a notification feature.
 *
 * The schedule lives on the server. iOS gives a web app no Background Sync and
 * no Periodic Sync at all, and a timer in a page is not a reminder system — it
 * is a tab that happens to be open. So this worker only ever reacts: something
 * arrives, it is shown; it is tapped, the right screen opens.
 */

/* Bump on every behavioural change. The version is visible on the Reminders tab
   so "which worker is actually running" is answerable without DevTools. */
const SW_VERSION = "timento-sw-2";

const DEFAULT_TITLE = "Timento";
const DEFAULT_BODY = "A reminder from your file.";

/* A new worker is useless sitting in "waiting" — a person who has just tapped
   "turn reminders on" expects this build, not the one from last week. There is
   no cache to invalidate and no in-flight app state to corrupt, so taking over
   immediately is safe here in a way it would not be if this file cached. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/*
 * Fetch: present, and deliberately inert.
 *
 * A service worker with no fetch handler at all cannot be a PWA install target
 * in some browsers, so the handler exists — but it does nothing beyond letting
 * the network answer. No cache reads, no cache writes, no offline fallback.
 * When offline support is built properly, it starts here.
 */
self.addEventListener("fetch", () => {
  /* Intentionally empty: every request falls through to the network. */
});

function parsePayload(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch (_jsonErr) {
    /* A push that is not JSON still deserves to be shown rather than swallowed. */
    try {
      return { body: event.data.text() };
    } catch (_err) {
      return null;
    }
  }
}

/* Buttons, where the platform draws them. Chromium caps a notification at
   Notification.maxActions (two on Android); iOS Safari draws none and maxActions
   is 0, so the slice leaves nothing — which is correct, because on iOS the tap
   itself is the whole interface and the deep link below carries it. */
function cleanActions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const a of raw) {
    if (a && typeof a.action === "string" && typeof a.title === "string") {
      out.push({ action: a.action, title: a.title });
    }
  }
  const max =
    typeof Notification !== "undefined" && typeof Notification.maxActions === "number"
      ? Notification.maxActions
      : 2;
  return out.slice(0, Math.min(2, max));
}

/* The "Taken" hand-off: only a fully-formed one is kept. A half-formed one is
   dropped so the button degrades to opening the app, never to a wrong write. */
function cleanTaken(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.url !== "string" || typeof raw.token !== "string" || typeof raw.date !== "string") {
    return null;
  }
  if (!Array.isArray(raw.doses) || raw.doses.length === 0) return null;
  const doses = [];
  for (const d of raw.doses) {
    if (d && typeof d.itemId === "string" && typeof d.timing === "string") {
      doses.push({ itemId: d.itemId, timing: d.timing });
    }
  }
  if (doses.length === 0) return null;
  return { url: raw.url, token: raw.token, date: raw.date, doses };
}

self.addEventListener("push", (event) => {
  const payload = parsePayload(event) || {};

  const title = typeof payload.title === "string" && payload.title !== "" ? payload.title : DEFAULT_TITLE;
  const body = typeof payload.body === "string" && payload.body !== "" ? payload.body : DEFAULT_BODY;
  const tab = typeof payload.tab === "string" ? payload.tab : "today";

  /* One tag per subject means a second reminder about the same thing REPLACES
     the first rather than stacking beside it. The pile is the failure mode this
     whole slice is trying to avoid; the server throttles, and so does this. */
  const tag = typeof payload.tag === "string" && payload.tag !== "" ? payload.tag : `timento-${tab}`;

  const taken = cleanTaken(payload.taken);
  /* Nothing clinical, nothing identifying — the payload is already the person's
     own words back at them. This carries the route, and for a dose the revocable
     token and exact subject the "Taken" button posts. The OS stores it; no lock
     screen shows it. */
  const data = taken
    ? { tab, url: `/?tab=${encodeURIComponent(tab)}`, version: SW_VERSION, taken }
    : { tab, url: `/?tab=${encodeURIComponent(tab)}`, version: SW_VERSION };

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      /* Replace quietly. A repeat should not buzz a second time. */
      renotify: false,
      /* Never demand a dismissal. A notification you cannot swipe away is a
         notification a tired person turns off at the OS level, permanently. */
      requireInteraction: false,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      actions: cleanActions(payload.actions),
      data,
    }),
  );
});

/*
 * A tap should land on the thing the reminder was about, in a window that is
 * already open if there is one. Opening a second copy of the app loses whatever
 * was half-typed in the first.
 */
function focusOrOpen(data) {
  const url = typeof data.url === "string" ? data.url : "/";
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          /* Tell the page where to go, then bring it forward. If the page is
             not listening the focus still happened, which is the important half. */
          if ("postMessage" in client) {
            client.postMessage({ type: "timento-navigate", tab: data.tab, url });
          }
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
    })
    .catch(() => undefined);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  /* "Taken" logs the exact doses the notification named, without opening the
     app: one POST, authorised by the same revocable token the phone Shortcut
     carries. Anything short of a confirmed write falls back to opening the
     right screen — a tap must never be silently lost. */
  if (event.action === "taken" && data.taken) {
    event.waitUntil(
      fetch(data.taken.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.taken.token,
          date: data.taken.date,
          doses: data.taken.doses,
        }),
      })
        .then((res) => (res.ok ? undefined : focusOrOpen(data)))
        .catch(() => focusOrOpen(data)),
    );
    return;
  }

  /* Everything else — the plain tap, "open", and "taken" on a payload that
     carried no way to post (iOS never even shows the button) — lands on the
     screen the reminder was about. */
  event.waitUntil(focusOrOpen(data));
});

/* Chrome and Firefox rotate a subscription's endpoint from time to time. The
   page re-subscribes and re-saves on every load, so the recovery path already
   exists; this tells any open tab to do it now rather than on next launch. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("postMessage" in client) client.postMessage({ type: "timento-resubscribe" });
      }
    }),
  );
});
