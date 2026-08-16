/**
 * Email delivery decisions — no network in sight.
 *
 * The send itself lives in convex/tm/push.ts (Convex sweep) and
 * src/app/api/remind/route.ts (demo / open-tab path). Both call this file so
 * an address, a from-line, or a request body cannot mean two different things.
 */

export const DEFAULT_FROM = "Timento <onboarding@resend.dev>";
export const MAX_EMAIL_NOTIFICATIONS = 8;
export const MAX_EMAIL_TARGETS = 4;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Empty or unusable input becomes "". A bad address is dropped, not stored. */
export function cleanEmail(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "" || s.length > 254) return "";
  return EMAIL_RE.test(s) ? s : "";
}

export function emailFromEnv(from: string | undefined): string {
  const t = (from ?? "").trim();
  return t !== "" ? t : DEFAULT_FROM;
}

export function emailConfigured(apiKey: string | undefined): boolean {
  return (apiKey ?? "").trim() !== "";
}

export function vapidConfigured(
  publicKey: string | undefined,
  privateKey: string | undefined,
  subject: string | undefined,
): boolean {
  return (publicKey ?? "").trim() !== "" && (privateKey ?? "").trim() !== "" && (subject ?? "").trim() !== "";
}

export type EmailMessage = { to: string; subject: string; text: string };

export function emailMessage(to: string, note: { title: string; body: string }): EmailMessage {
  return { to, subject: note.title, text: note.body };
}

export type DeliverTarget = { endpoint: string; p256dh: string; auth: string };

export type DeliverNotification = { title: string; body: string; tab: string; tag: string };

export type DeliverRequest = {
  email: string;
  targets: DeliverTarget[];
  notifications: DeliverNotification[];
};

export type DeliverCapability = {
  push: boolean;
  email: boolean;
  vapidPublicKey: string;
};

export function deliverCapability(env: {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  RESEND_API_KEY?: string;
}): DeliverCapability {
  const vapidPublicKey = (env.VAPID_PUBLIC_KEY ?? "").trim();
  return {
    push: vapidConfigured(vapidPublicKey, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT),
    email: emailConfigured(env.RESEND_API_KEY),
    vapidPublicKey,
  };
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function readTarget(raw: unknown): DeliverTarget | null {
  const o = asRecord(raw);
  if (o === null) return null;
  const endpoint = typeof o.endpoint === "string" ? o.endpoint.trim() : "";
  const p256dh = typeof o.p256dh === "string" ? o.p256dh.trim() : "";
  const auth = typeof o.auth === "string" ? o.auth.trim() : "";
  if (endpoint === "" || p256dh === "" || auth === "") return null;
  return { endpoint, p256dh, auth };
}

function readNotification(raw: unknown): DeliverNotification | null {
  const o = asRecord(raw);
  if (o === null) return null;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const body = typeof o.body === "string" ? o.body.trim() : "";
  const tab = typeof o.tab === "string" ? o.tab.trim() : "";
  const tag = typeof o.tag === "string" ? o.tag.trim() : "";
  if (title === "" || body === "" || tab === "" || tag === "") return null;
  return { title, body, tab, tag };
}

/**
 * A POST body is either a deliverable request or nothing. Partial / oversized
 * payloads are rejected rather than sent in a shape the caller did not mean.
 */
export function parseDeliverBody(raw: unknown): DeliverRequest | null {
  const o = asRecord(raw);
  if (o === null) return null;

  const email = cleanEmail(typeof o.email === "string" ? o.email : "");
  const targetRaw = Array.isArray(o.targets) ? o.targets : [];
  const noteRaw = Array.isArray(o.notifications) ? o.notifications : [];
  if (targetRaw.length > MAX_EMAIL_TARGETS || noteRaw.length > MAX_EMAIL_NOTIFICATIONS) return null;

  const targets: DeliverTarget[] = [];
  for (const row of targetRaw) {
    const t = readTarget(row);
    if (t === null) return null;
    targets.push(t);
  }

  const notifications: DeliverNotification[] = [];
  for (const row of noteRaw) {
    const n = readNotification(row);
    if (n === null) return null;
    notifications.push(n);
  }

  if (notifications.length === 0) return null;
  if (email === "" && targets.length === 0) return null;
  return { email, targets, notifications };
}
