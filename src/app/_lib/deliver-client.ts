import type { DeliverRequest } from "@convex/tm/logicEmail";

export type DeliverCapability = {
  push: boolean;
  email: boolean;
  vapidPublicKey: string;
};

export async function fetchDeliverCapability(): Promise<DeliverCapability> {
  const res = await fetch("/api/remind", { method: "GET" });
  if (!res.ok) return { push: false, email: false, vapidPublicKey: "" };
  const body: unknown = await res.json();
  if (body === null || typeof body !== "object") return { push: false, email: false, vapidPublicKey: "" };
  const o = body as Record<string, unknown>;
  return {
    push: o.push === true,
    email: o.email === true,
    vapidPublicKey: typeof o.vapidPublicKey === "string" ? o.vapidPublicKey : "",
  };
}

export async function postDeliver(payload: DeliverRequest): Promise<boolean> {
  const res = await fetch("/api/remind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}
