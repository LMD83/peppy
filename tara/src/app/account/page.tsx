"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/price";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <AuthLoading>
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      </AuthLoading>
      <Unauthenticated>
        <p className="text-sm text-muted-foreground">
          <Link href="/signin" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>{" "}
          to view your account.
        </p>
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold">Your account</h1>
        <Button variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Order history</h2>
        {orders === undefined && <p className="text-sm text-muted-foreground">Loading orders…</p>}
        {orders?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No orders yet —{" "}
            <Link href="/catalogue" className="font-semibold text-primary hover:underline">
              browse the catalogue
            </Link>
            .
          </p>
        )}
        {orders && orders.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {orders.map((order) => (
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
        )}
      </section>
    </div>
  );
}
