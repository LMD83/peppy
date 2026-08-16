import { Resend } from "resend";
import webpush from "web-push";
import {
  deliverCapability,
  emailFromEnv,
  emailMessage,
  parseDeliverBody,
} from "@convex/tm/logicEmail";
import { classifyError, encodePayload } from "@convex/tm/logicPush";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, { n: number; resetAt: number }>();

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const row = hits.get(key);
  if (row === undefined || now >= row.resetAt) {
    hits.set(key, { n: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  row.n += 1;
  return row.n > MAX_PER_WINDOW;
}

export async function GET() {
  return Response.json(
    deliverCapability({
      VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: process.env.VAPID_SUBJECT,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
    }),
  );
}

export async function POST(request: Request) {
  if (rateLimited(clientKey(request))) {
    return Response.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const body = parseDeliverBody(raw);
  if (body === null) return Response.json({ ok: false, error: "bad-body" }, { status: 400 });

  const cap = deliverCapability({
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  });
  if (!cap.push && !cap.email) {
    return Response.json({ ok: false, error: "no-keys" }, { status: 503 });
  }

  let sent = 0;

  if (cap.push && body.targets.length > 0) {
    webpush.setVapidDetails(
      (process.env.VAPID_SUBJECT ?? "").trim(),
      cap.vapidPublicKey,
      (process.env.VAPID_PRIVATE_KEY ?? "").trim(),
    );
    for (const target of body.targets) {
      const subscription = {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      };
      for (const note of body.notifications) {
        try {
          await webpush.sendNotification(subscription, encodePayload({ key: note.tag, ...note }));
          sent += 1;
        } catch (error) {
          const outcome = classifyError(error);
          console.warn(`[timento reminders] demo push failed (${outcome})`);
          break;
        }
      }
    }
  }

  const mailKey = (process.env.RESEND_API_KEY ?? "").trim();
  if (mailKey !== "" && body.email !== "") {
    const mailer = new Resend(mailKey);
    const from = emailFromEnv(process.env.REMIND_EMAIL_FROM);
    for (const note of body.notifications) {
      const msg = emailMessage(body.email, note);
      const { error } = await mailer.emails.send({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
      });
      if (error) {
        console.warn(`[timento reminders] demo email failed: ${String(error)}`);
        continue;
      }
      sent += 1;
    }
  }

  return Response.json({ ok: true, sent });
}
