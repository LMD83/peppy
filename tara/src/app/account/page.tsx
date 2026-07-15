"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import {
  LayoutDashboard,
  Package,
  ShieldCheck,
  Repeat,
  Gift,
  CalendarClock,
  LogOut,
} from "lucide-react";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/price";
import { cn } from "@/lib/utils";

type Section = "dashboard" | "orders" | "vault" | "subscription" | "referrals";

const SECTIONS: { key: Section; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { key: "orders", label: "Orders", Icon: Package },
  { key: "vault", label: "Verified vault", Icon: ShieldCheck },
  { key: "subscription", label: "Subscription", Icon: Repeat },
  { key: "referrals", label: "Referrals", Icon: Gift },
];

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <AuthLoading>
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      </AuthLoading>
      <Unauthenticated>
        <div className="rounded-md border border-border bg-card p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold">Your TARA account</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Sign in to see your orders, your Verified vault of purchased batches, and your
            subscription and referrals.
          </p>
          <Link href="/signin" className="mt-5 inline-block">
            <Button size="lg">Sign in</Button>
          </Link>
        </div>
      </Unauthenticated>
      <Authenticated>
        <AccountContent />
      </Authenticated>
    </div>
  );
}

function AccountContent() {
  const { signOut } = useAuthActions();
  const orders = useQuery(api.orders.listMyOrders);
  const [section, setSection] = useState<Section>("dashboard");

  const orderCount = orders?.length ?? 0;
  const batches =
    orders?.flatMap((o) =>
      o.items.map((it) => ({
        key: `${o._id}-${it.batch}-${it.variantLabel}`,
        name: it.name,
        variantLabel: it.variantLabel,
        batch: it.batch,
        verifyId: it.verifyId,
      }))
    ) ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* Sidebar */}
      <aside className="flex flex-col gap-1">
        <p className="mb-2 px-3 text-xs font-semibold tracking-[0.18em] text-[#B87333]">ACCOUNT</p>
        {SECTIONS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={cn(
              "flex items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm font-medium transition-colors",
              section === key
                ? "bg-accent text-primary"
                : "text-foreground hover:bg-muted hover:text-primary"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-2 flex items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </aside>

      {/* Content */}
      <div className="min-w-0">
        {section === "dashboard" && (
          <div className="flex flex-col gap-6">
            <h1 className="font-serif text-3xl font-semibold">Dashboard</h1>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile label="Orders placed" value={String(orderCount)} />
              <StatTile label="Verified batches" value={String(batches.length)} />
              <StatTile label="Loyalty tier" value="Researcher" accent />
            </div>
            <div className="rounded-md border border-border bg-card p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="size-4 text-secondary" />
                Research schedule
              </div>
              <p className="text-sm text-muted-foreground">
                Track recurring protocol windows per compound on the{" "}
                <Link href="/schedule" className="font-semibold text-primary hover:underline">
                  Schedule
                </Link>{" "}
                page. Reminders stay on this device — for laboratory research use only.
              </p>
            </div>
            <RecentOrders orders={orders} onViewAll={() => setSection("orders")} />
          </div>
        )}

        {section === "orders" && (
          <div className="flex flex-col gap-6">
            <h1 className="font-serif text-3xl font-semibold">Orders</h1>
            <RecentOrders orders={orders} showAll />
          </div>
        )}

        {section === "vault" && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="font-serif text-3xl font-semibold">Verified vault</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Every batch you&apos;ve purchased, each still verifiable with its Certificate of
                Analysis — your personal authentication ledger.
              </p>
            </div>
            {batches.length === 0 ? (
              <EmptyCard>No verified batches yet — they appear here after your first order.</EmptyCard>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border bg-card">
                {batches.map((b) => (
                  <li key={b.key} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {b.name} <span className="text-muted-foreground">— {b.variantLabel}</span>
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        Batch {b.batch} · {b.verifyId}
                      </p>
                    </div>
                    <Link
                      href={`/verify?id=${encodeURIComponent(b.verifyId)}`}
                      className="shrink-0 text-xs font-semibold text-primary hover:underline"
                    >
                      Verify →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {section === "subscription" && (
          <div className="flex flex-col gap-6">
            <h1 className="font-serif text-3xl font-semibold">Subscription</h1>
            <div className="rounded-md border border-[#C9A15A]/40 bg-[#C9A15A]/10 p-6">
              <p className="text-xs font-semibold tracking-[0.14em] text-[#8a6d2f]">
                SUBSCRIBE &amp; SAVE
              </p>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Set a recurring order for any compound and take 5% off every shipment on a
                six-month term. Subscription management is coming to your account — for now, reorder
                from your order history.
              </p>
            </div>
          </div>
        )}

        {section === "referrals" && (
          <div className="flex flex-col gap-6">
            <h1 className="font-serif text-3xl font-semibold">Referrals</h1>
            <div className="rounded-md border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                Give €10, get €10. Share your referral code with another researcher — they take €10
                off their first order and you receive €10 in credit once it ships.
              </p>
              <div className="mt-4 inline-flex items-center gap-3 rounded-sm border border-dashed border-input bg-muted/40 px-4 py-2 font-mono text-sm">
                TARA-REF-DEMO
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Referral tracking is a demonstration in this build.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type OrdersData =
  | { _id: string; orderNo: string; status: string; totalCents: number; items: { length: number } }[]
  | undefined;

function RecentOrders({
  orders,
  showAll = false,
  onViewAll,
}: {
  orders: OrdersData;
  showAll?: boolean;
  onViewAll?: () => void;
}) {
  if (orders === undefined) return <EmptyCard>Loading orders…</EmptyCard>;
  if (orders.length === 0)
    return (
      <EmptyCard>
        No orders yet —{" "}
        <Link href="/catalogue" className="font-semibold text-primary hover:underline">
          browse the catalogue
        </Link>
        .
      </EmptyCard>
    );

  const shown = showAll ? orders : orders.slice(0, 4);
  return (
    <section>
      {!showAll && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent orders</h2>
          {onViewAll && orders.length > shown.length && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all
            </button>
          )}
        </div>
      )}
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {shown.map((order) => (
          <li key={order._id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-semibold">{order.orderNo}</p>
              <p className="text-xs text-muted-foreground">
                {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
                <span className="capitalize">{order.status}</span>
              </p>
            </div>
            <Price cents={order.totalCents} className="font-mono text-sm font-semibold" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground">
        {label.toUpperCase()}
      </p>
      <p
        className={cn(
          "mt-1.5 font-serif text-2xl font-semibold",
          accent ? "text-[#B87333]" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
