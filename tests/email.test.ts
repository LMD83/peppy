import { describe, expect, it } from "vitest";
import {
  DEFAULT_FROM,
  cleanEmail,
  deliverCapability,
  emailConfigured,
  emailFromEnv,
  emailMessage,
  parseDeliverBody,
  vapidConfigured,
} from "../convex/tm/logicEmail";

describe("cleanEmail", () => {
  it("returns empty for empty, blank, or missing input", () => {
    expect(cleanEmail("")).toBe("");
    expect(cleanEmail("   ")).toBe("");
    expect(cleanEmail(null)).toBe("");
    expect(cleanEmail(undefined)).toBe("");
  });

  it("lowercases a valid address", () => {
    expect(cleanEmail(" Liam@Example.COM ")).toBe("liam@example.com");
  });

  it("drops an unusable address rather than storing it", () => {
    expect(cleanEmail("not-an-email")).toBe("");
    expect(cleanEmail("a@b")).toBe("");
    expect(cleanEmail(`${"a".repeat(250)}@x.com`)).toBe("");
  });
});

describe("from-line and capability", () => {
  it("falls back to the Resend onboarding sender when none is set", () => {
    expect(emailFromEnv(undefined)).toBe(DEFAULT_FROM);
    expect(emailFromEnv("  ")).toBe(DEFAULT_FROM);
    expect(emailFromEnv("Timento <file@timento.app>")).toBe("Timento <file@timento.app>");
  });

  it("treats a blank API key as not configured", () => {
    expect(emailConfigured(undefined)).toBe(false);
    expect(emailConfigured("  ")).toBe(false);
    expect(emailConfigured("re_xxx")).toBe(true);
  });

  it("requires all three VAPID values", () => {
    expect(vapidConfigured("pub", "priv", "mailto:a@b.c")).toBe(true);
    expect(vapidConfigured("pub", "priv", "")).toBe(false);
  });

  it("reports push and email independently", () => {
    expect(
      deliverCapability({
        VAPID_PUBLIC_KEY: "pub",
        VAPID_PRIVATE_KEY: "priv",
        VAPID_SUBJECT: "mailto:a@b.c",
        RESEND_API_KEY: "re_xxx",
      }),
    ).toEqual({ push: true, email: true, vapidPublicKey: "pub" });
    expect(deliverCapability({})).toEqual({ push: false, email: false, vapidPublicKey: "" });
  });
});

describe("the words on the wire", () => {
  it("uses the reminder title and body, nothing else", () => {
    expect(emailMessage("liam@example.com", { title: "Time for your morning dose", body: "Metformin." })).toEqual({
      to: "liam@example.com",
      subject: "Time for your morning dose",
      text: "Metformin.",
    });
  });
});

describe("parseDeliverBody", () => {
  const note = { title: "Time for your morning dose", body: "Metformin.", tab: "stack", tag: "dose:stack" };

  it("accepts email-only and push-only payloads", () => {
    expect(parseDeliverBody({ email: "Liam@Example.com", notifications: [note] })).toEqual({
      email: "liam@example.com",
      targets: [],
      notifications: [note],
    });
    expect(
      parseDeliverBody({
        targets: [{ endpoint: "https://push.example/ep", p256dh: "a", auth: "b" }],
        notifications: [note],
      })?.targets,
    ).toHaveLength(1);
  });

  it("rejects an empty, oversized, or half-formed body", () => {
    expect(parseDeliverBody(null)).toBeNull();
    expect(parseDeliverBody({ notifications: [note] })).toBeNull();
    expect(parseDeliverBody({ email: "liam@example.com", notifications: [] })).toBeNull();
    expect(parseDeliverBody({ email: "liam@example.com", notifications: [{ title: "x" }] })).toBeNull();
    expect(
      parseDeliverBody({
        email: "liam@example.com",
        notifications: Array.from({ length: 9 }, () => note),
      }),
    ).toBeNull();
  });
});
