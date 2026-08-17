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
const SW_VERSION = "timento-sw-3";

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

/* How many buttons this platform will actually draw. Chromium caps at
   Notification.maxActions (two on Android); iOS Safari draws none and reports 0.
   A platform that will not say (Firefox, older Safari) gets 0, not 2: those
   platforms draw no buttons anyway, and the safe direction for an unknown is
   to withhold the credential, never to store one nothing can spend. */
function platformMaxActions() {
  return typeof Notification !== "undefined" && typeof Notification.maxActions === "number"
    ? Notification.maxActions
    : 0;
}

/* Buttons, where the platform draws them. On iOS the slice leaves nothing —
   which is correct, because there the tap itself is the whole interface and
   the deep link below carries it. */
function cleanActions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const a of raw) {
    if (a && typeof a.action === "string" && typeof a.title === "string") {
      out.push({ action: a.action, title: a.title });
    }
  }
  return out.slice(0, Math.min(2, platformMaxActions()));
}

/* The "Taken" hand-off: a single-use grant token, and the exact ingest endpoint
   it may be posted to — nothing else. The URL must parse, be https:, with the
   path exactly /ingest/dose-taken; anything off-shape drops the WHOLE hand-off,
   atomically, so the button degrades to opening the app — never to a partial
   acceptance. The shape check is belt and braces, not the security boundary:
   forging a payload at all requires the subscription's own encryption keys,
   which never leave the server. */
function cleanTaken(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.url !== "string" || typeof raw.token !== "string" || raw.token === "") return null;
  let url;
  try {
    url = new URL(raw.url);
  } catch (_err) {
    return null;
  }
  if (url.protocol !== "https:" || url.pathname !== "/ingest/dose-taken") return null;
  return { url: url.href, token: raw.token };
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

  /* A platform that draws no buttons (iOS: maxActions is 0) gets no credential
     either — a token stored where no button can spend it is pure exposure, not
     a feature. Elsewhere, the stored data carries the route and, for a dose,
     the single-use grant the "Taken" button posts. The OS stores it; no lock
     screen shows it; one tap or one day and it is dead regardless. */
  const taken = platformMaxActions() > 0 ? cleanTaken(payload.taken) : null;
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
     app: one POST of the single-use grant, whose doses live server-side. The
     write is confirmed, not assumed — anything short of ok with wrote > 0 (a
     network error, a spent or expired grant, a dose the file no longer holds)
     falls back to opening the right screen. A tap must never be silently lost,
     and a second tap of the same notification lands in the app by design. */
  if (event.action === "taken") {
    if (!data.taken) {
      /* The button fired but the hand-off never travelled (stripped for size,
         or the payload was off-shape). The app is the honest destination. */
      event.waitUntil(focusOrOpen(data));
      return;
    }
    event.waitUntil(
      fetch(data.taken.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.taken.token }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((reply) =>
          reply && reply.ok === true && typeof reply.wrote === "number" && reply.wrote > 0
            ? undefined
            : focusOrOpen(data),
        )
        .catch(() => focusOrOpen(data)),
    );
    return;
  }

  /* Everything else — the plain tap and "open" — lands on the screen the
     reminder was about. */
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
