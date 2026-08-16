"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import type { SupplyData } from "../_lib/types";
import { Card, Eyebrow, Stat } from "./ui";

/**
 * Supply — never run out.
 *
 * The attention list comes first and states itself in words: "Atorvastatin ·
 * 4 days left · order by 2026-08-16". Under each one sits the only two things
 * that move it forward — a recount and a phone call — and the distinction that
 * decides which phone call: the pharmacy can repeat this, or this one needs the
 * doctor. Everything that is fine sits quietly underneath.
 */

type Row = SupplyData["items"][number];
type Contact = NonNullable<SupplyData["contacts"]["gp"]>;

const STATUS_TONE: Record<Row["status"], string> = {
  out: "border-tm-red bg-tm-panel text-tm-red",
  urgent: "border-tm-red bg-tm-panel text-tm-red",
  "order-now": "border-tm-amber bg-tm-amber-bg text-tm-amber",
  ok: "border-tm-rule bg-tm-panel text-tm-dim",
};

const STATUS_LABEL: Record<Row["status"], string> = {
  out: "out",
  urgent: "urgent",
  "order-now": "order now",
  ok: "ok",
};

const ROUTE_TONE: Record<Row["route"], string> = {
  gp: "border-tm-red text-tm-red",
  pharmacy: "border-tm-blue text-tm-blue",
  self: "border-tm-rule text-tm-dim",
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/* ===== the tab ===== */

export function SupplyPanel() {
  const { supply } = useTimento();
  if (!supply) return <SupplySkeleton />;

  if (supply.survival) {
    return (
      <div className="flex flex-col gap-4 pt-5">
        {supply.attention.length === 0 ? (
          <Card>
            <Eyebrow color="bg-tm-green">Supply</Eyebrow>
            <p className="text-[14px]">
              Nothing runs out soon. {supply.okCount} item{supply.okCount === 1 ? "" : "s"} counted
              and covered. There is nothing here for you to do.
            </p>
          </Card>
        ) : (
          <>
            <Card tone="amber">
              <Eyebrow color="bg-tm-amber">Supply, floor</Eyebrow>
              <div className="flex flex-col gap-2">
                {supply.attention.map((row) => (
                  <AttentionRow key={row.itemId} row={row} />
                ))}
              </div>
              <p className="mt-2.5 text-[13px] text-tm-amber-ink">
                The floor shows what runs out and nothing else. The rest of the shelf can wait.
              </p>
            </Card>
            <RefillCard supply={supply} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-3 lg:col-span-7">
      {supply.attention.length > 0 ? (
        <Card tone="amber">
          <div className="flex items-center justify-between">
            <Eyebrow color="bg-tm-amber" className="mb-0">
              Needs ordering
            </Eyebrow>
            <span className="font-tm-mono text-[11.5px] text-tm-dim">
              {supply.attention.length} of {supply.attention.length + supply.okCount}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {supply.attention.map((row) => (
              <AttentionRow key={row.itemId} row={row} />
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <Eyebrow color="bg-tm-green">Supply</Eyebrow>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-tm-rule bg-tm-rule">
            <div className="bg-tm-panel px-3 py-3">
              <Stat value={String(supply.okCount)} label="items covered" />
            </div>
            <div className="bg-tm-panel px-3 py-3">
              <Stat value="0" label="need ordering" />
            </div>
          </div>
          <p className="mt-3 text-[14px]">Nothing runs out soon. Recount when you open a box.</p>
        </Card>
      )}

      {supply.attention.length > 0 && <RefillCard supply={supply} />}
      </div>

      <div className="flex flex-col gap-3 lg:col-span-5">
      <StockedCard supply={supply} />

      <ContactsCard contacts={supply.contacts} />

      <Card>
        <Eyebrow color="bg-tm-dim2">How the count is worked out</Eyebrow>
        <p className="text-[14px]">{supply.note}</p>
      </Card>
      </div>
    </div>
  );
}

/* ===== the compact card for Today ===== */

export function SupplyTodayCard() {
  const { supply } = useTimento();
  // Nothing at all when everything is stocked. This card never nags.
  if (!supply || supply.attention.length === 0) return null;

  const first = supply.attention[0];
  const rest = supply.attention.length - 1;

  return (
    <Card tone="amber">
      <Eyebrow color="bg-tm-amber">Supply</Eyebrow>
      <p className="text-[13px]">
        {first.name} — {first.status === "out" ? "none left" : `${first.daysRemaining} days left`}
        {first.orderByDate !== null && first.status !== "out"
          ? `, order by ${first.orderByDate}`
          : ", order today"}
        .
      </p>
      <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">
        {first.routeNote.toLowerCase()}
        {rest > 0 ? ` · ${rest} more to order` : ""}
      </p>
    </Card>
  );
}

/* ===== pieces ===== */

function SupplySkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-[10px] border border-tm-rule bg-tm-panel" />
      ))}
      <p className="text-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
        Loading supply…
      </p>
    </div>
  );
}

function AttentionRow({ row }: { row: Row }) {
  return (
    <div className="rounded-[10px] border border-tm-rule bg-tm-panel px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate font-tm-disp text-lg leading-[1.1] tracking-tight uppercase">{row.name}</span>
          <span className="block font-tm-mono text-[11.5px] text-tm-dim">
            {fmt(row.dose)} {row.unit} · {row.scheduleLabel} · {fmt(row.unitsPerDay)}/day
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-[14px] border px-2 py-[3px] font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
            STATUS_TONE[row.status],
          )}
        >
          {STATUS_LABEL[row.status]}
        </span>
      </div>

      <p className="mt-1.5 text-[13px]">
        {row.status === "out"
          ? "Nothing left for the next dose. Order today."
          : `${row.daysRemaining} day${row.daysRemaining === 1 ? "" : "s"} left. Runs out ${row.runOutDate}. Order by ${row.orderByDate}.`}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-[14px] border bg-tm-panel px-2 py-[3px] font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
            ROUTE_TONE[row.route],
          )}
        >
          {row.route === "gp" ? "doctor" : row.route === "pharmacy" ? "pharmacy" : "no script"}
        </span>
        <span className="text-[13px]">{row.routeNote}</span>
      </div>

      {(row.gpReason !== null || row.expiringSoon) && (
        <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">
          {row.gpReason ??
            `script expires ${row.scriptExpiryDate}. ${row.daysToExpiry} days`}
          {row.repeatsRemaining !== null && row.repeatsRemaining > 0
            ? ` · ${row.repeatsRemaining} repeat${row.repeatsRemaining === 1 ? "" : "s"} left`
            : ""}
        </p>
      )}

      <CountControl
        key={`${row.itemId}:${row.onHand}:${row.lastCountedDate}`}
        row={row}
      />
    </div>
  );
}

/** A recount is the one thing that makes every other number here true. */
function CountControl({ row }: { row: Row }) {
  const { actions } = useTimento();
  const [draft, setDraft] = useState(String(row.onHand));
  const [saved, setSaved] = useState(false);

  const parsed = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  const step = (by: number) => {
    const from = valid ? parsed : row.onHand;
    setDraft(String(Math.max(0, Math.round((from + by) * 100) / 100)));
    setSaved(false);
  };

  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={`One fewer ${row.name}`}
          className="size-11 shrink-0 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel font-tm-mono text-lg transition-transform duration-150 active:scale-[0.98]"
        >
          −
        </button>
        <label className="min-w-0 flex-1">
          <span className="sr-only">{row.name} counted</span>
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
            inputMode="decimal"
            className="min-h-11 w-full rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 text-center font-tm-disp text-lg focus:border-tm-ink"
          />
        </label>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`One more ${row.name}`}
          className="size-11 shrink-0 cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel font-tm-mono text-lg transition-transform duration-150 active:scale-[0.98]"
        >
          +
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            actions.setSupplyCount(row.itemId, parsed);
            setSaved(true);
          }}
          className={cn(
            "min-h-11 shrink-0 cursor-pointer rounded-[10px] border px-3 font-tm-mono text-[11.5px] tracking-[0.12em] uppercase transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100",
            valid ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule bg-tm-soft text-tm-dim",
          )}
        >
          {saved ? "counted" : "count"}
        </button>
      </div>
      <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">
        {row.countAgeDays === 0
          ? `counted today · ${fmt(row.countedOnHand)} in the box`
          : `counted ${row.countAgeDays} day${row.countAgeDays === 1 ? "" : "s"} ago. ${fmt(row.countedOnHand)} then, about ${fmt(row.onHand)} now`}
      </p>
      {/* Only when the logbook outran the schedule — that is the one case where
          the logged doses, not the schedule, set the number above. */}
      {row.logsLead && (
        <p className="mt-0.5 font-tm-mono text-[11.5px] text-tm-dim">
          {row.loggedSinceCount} logged since your count.
        </p>
      )}
    </div>
  );
}

/* ===== the refill sheet ===== */

function RefillCard({ supply }: { supply: SupplyData }) {
  const [copied, setCopied] = useState(false);
  const needsGp = supply.attention.some((r) => r.route === "gp");
  const needsPharmacy = supply.attention.some((r) => r.route === "pharmacy");

  const copy = () => {
    const text = supply.refillMessage;
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clip) return;
    void clip.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">The call</Eyebrow>
      {/* A scrollable box has to be reachable by keyboard, or its content is
          only readable by people who can use a mouse or a finger (WCAG 2.1.1).
          tabIndex makes it a stop; the label says what the stop is for. */}
      <pre
        tabIndex={0}
        role="group"
        aria-label="The message to read out to the pharmacy"
        className="max-h-56 overflow-auto rounded-[10px] border border-tm-rule bg-tm-soft px-3 py-2.5 font-tm-mono text-[11.5px] whitespace-pre-wrap"
      >
        {supply.refillMessage}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="mt-2 min-h-11 w-full cursor-pointer rounded-[10px] border border-tm-ink bg-tm-ink px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase transition-transform duration-150 active:scale-[0.98]"
      >
        {copied ? "copied" : "copy the message"}
      </button>

      <div className="mt-2 flex flex-col gap-1.5">
        {supply.contacts.pharmacy && (
          <CallButton
            contact={supply.contacts.pharmacy}
            label="Ring the pharmacy"
            hint={needsPharmacy ? "they can repeat these" : "for anything already on repeat"}
          />
        )}
        {supply.contacts.gp && (
          <CallButton
            contact={supply.contacts.gp}
            label="Ring the practice"
            hint={needsGp ? "the pharmacy cannot fix this one" : "for a new script or a review"}
            emphasis={needsGp}
          />
        )}
      </div>
      <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
        The message names only what is already on your file: the item, its dose and how long is
        left. It asks for nothing else.
      </p>
    </Card>
  );
}

function CallButton({
  contact,
  label,
  hint,
  emphasis = false,
}: {
  contact: Contact;
  label: string;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <a
      href={telHref(contact.phone)}
      className={cn(
        "flex min-h-11 items-center justify-between gap-2 rounded-[10px] border px-3 py-2",
        emphasis ? "border-tm-red bg-tm-panel" : "border-tm-rule bg-tm-panel",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{label}</span>
        <span className="block truncate font-tm-mono text-[11.5px] text-tm-dim">
          {contact.name} · {hint}
        </span>
      </span>
      <span className="shrink-0 font-tm-mono text-[11.5px]">{contact.phone}</span>
    </a>
  );
}

/* ===== everything that is fine ===== */

function StockedCard({ supply }: { supply: SupplyData }) {
  const stocked = supply.items.filter((r) => r.status === "ok");
  if (stocked.length === 0) return null;
  return (
    <Card>
      <Eyebrow color="bg-tm-green">Stocked</Eyebrow>
      <ul>
        {stocked.map((row) => (
          <li
            key={row.itemId}
            className="flex items-center justify-between gap-2 border-b border-tm-grid py-2 last:border-0"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{row.name}</span>
              <span className="block font-tm-mono text-[11.5px] text-tm-dim">
                {fmt(row.onHand)} left · {fmt(row.unitsPerDay)}/day
                {row.runOutDate === null ? "" : ` · runs out ${row.runOutDate}`}
              </span>
            </span>
            <span className="shrink-0 font-tm-mono text-[11.5px] text-tm-dim">
              {row.daysRemaining}d
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ContactsCard({ contacts }: { contacts: SupplyData["contacts"] }) {
  const { actions } = useTimento();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Eyebrow color="bg-tm-ink">Who to ring</Eyebrow>
      <div className="flex flex-col gap-1.5">
        {contacts.pharmacy && (
          <CallButton contact={contacts.pharmacy} label="Pharmacy" hint="repeats and collection" />
        )}
        {contacts.gp && (
          <CallButton contact={contacts.gp} label="GP practice" hint="new scripts and reviews" />
        )}
        {!contacts.pharmacy && !contacts.gp && (
          <p className="text-[13px] text-tm-dim">
            No numbers saved yet. Add them once and a refill is a tap.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 min-h-11 w-full cursor-pointer rounded-[10px] border border-tm-rule bg-tm-panel px-3 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase transition-transform duration-150 active:scale-[0.98]"
      >
        {open ? "close" : "add or change a number"}
      </button>
      {open && <ContactForm onSave={actions.saveContact} />}
    </Card>
  );
}

function ContactForm({
  onSave,
}: {
  onSave: (kind: "gp" | "pharmacy", name: string, phone: string) => void;
}) {
  const [kind, setKind] = useState<"gp" | "pharmacy">("pharmacy");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const valid = name.trim() !== "" && phone.trim() !== "";

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex gap-1.5" role="radiogroup" aria-label="Contact kind">
        {(["pharmacy", "gp"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "min-h-11 flex-1 cursor-pointer rounded-[10px] border px-3 font-tm-mono text-[11.5px] tracking-[0.1em] uppercase transition-transform duration-150 active:scale-[0.98]",
              kind === k
                ? "border-tm-ink bg-tm-ink text-white"
                : "border-tm-rule bg-tm-panel text-tm-dim",
            )}
          >
            {k === "gp" ? "GP practice" : "Pharmacy"}
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        aria-label="Contact name"
        className="min-h-11 w-full rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 text-sm focus:border-tm-ink"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone"
        inputMode="tel"
        aria-label="Contact phone"
        className="min-h-11 w-full rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 font-tm-mono text-sm focus:border-tm-ink"
      />
      <button
        type="button"
        disabled={!valid}
        onClick={() => {
          if (!valid) return;
          onSave(kind, name, phone);
          setName("");
          setPhone("");
        }}
        className={cn(
          "min-h-11 w-full cursor-pointer rounded-[10px] border px-3 font-tm-mono text-[11.5px] tracking-[0.12em] uppercase transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100",
          valid ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule bg-tm-soft text-tm-dim",
        )}
      >
        Save
      </button>
    </div>
  );
}
