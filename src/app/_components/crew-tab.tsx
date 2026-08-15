"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  NEVER_SHARED,
  SCOPES,
  SCOPE_DESCRIPTIONS,
  SCOPE_LABELS,
  sharedLine,
  type Scope,
} from "@convex/tm/logic-consent";
import { useTimento } from "../_lib/backend";
import type { CrewData } from "../_lib/types";
import { Card, Eyebrow, ModeBadge, Stat } from "./ui";

type Member = CrewData[number];

const NUDGES: Record<string, string[]> = {
  cut: ["On it", "Strong week", "Kitchen closed?", "Proud of the boring days"],
  maintain: ["Band's holding", "On it", "Weigh-in logged?", "Proud of the boring days"],
  survival: ["Floor's holding", "Proud of the boring days", "Review date soon", "On it"],
};

const SUPPLY_COPY: Record<string, string> = {
  ok: "Stocked",
  "order-due": "Needs a reorder",
  none: "Nothing tracked",
};

export function CrewTab() {
  const { crew, feed, actions, today } = useTimento();
  const [sent, setSent] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ slug: string; name: string; scopes: Scope[] } | null>(null);

  if (!crew || !today) return <CrewSkeleton />;

  const you = crew.find((m) => m.isYou);
  const others = crew.filter((m) => !m.isYou);
  const survival = today.user.mode === "survival";

  const shared = others.filter((m) => m.link.youSee.length > 0 || m.link.theySee.length > 0);
  const incoming = others.filter((m) => m.link.incoming);
  const outgoing = others.filter((m) => m.link.outgoing);
  const partner = shared[0] ?? others[0];
  const presets = NUDGES[partner?.mode ?? today.user.mode];

  const stopSharing = (m: Member) => {
    if (!m.link.yourGrantId) return;
    setUndo({ slug: m.slug, name: m.name, scopes: m.link.theySee });
    actions.revokeCrewLink(m.link.yourGrantId);
  };

  return (
    <div className="flex flex-col gap-3 pt-4">
      {shared.map((m) => (
        <Card key={m.slug}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-tm-mono text-[13px] font-medium">{m.name}</span>
            {m.mode ? <ModeBadge mode={m.mode} /> : null}
          </div>

          {m.link.youSee.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              {m.streak !== undefined && <Stat value={`${m.streak}`} label="Streak" />}
              {m.adherence7 !== undefined && <Stat value={`${m.adherence7}%`} label="7-day" />}
              {m.todayDone !== undefined && (
                <Stat value={`${m.todayDone}/${m.todayTotal}`} label="Today" />
              )}
              {m.mode === "survival" && m.daysInMode !== undefined && (
                <Stat value={`${m.daysInMode}`} label="Days on floor" />
              )}
              {m.supplyState && m.supplyState !== "none" && (
                <Stat value={SUPPLY_COPY[m.supplyState]} label="Supply" />
              )}
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] text-tm-dim">
              {m.name} shares nothing with you. That is their call, and it stays theirs.
            </p>
          )}

          {m.mode === "survival" && m.modeSince && (
            <p className="mt-2 font-tm-mono text-[10px] text-tm-dim">
              floor since {m.modeSince}
              {m.reviewDate ? ` · review ${m.reviewDate}` : ""}
            </p>
          )}

          <div className="mt-3 border-t border-tm-grid pt-3">
            <p className="text-[12.5px] leading-snug text-tm-ink">
              {sharedLine(m.name, m.link.theySee)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {m.link.yourGrantId && (
                <button
                  onClick={() => stopSharing(m)}
                  className="cursor-pointer rounded-lg border border-tm-red px-3 py-2 font-tm-mono text-[11px] text-tm-red"
                >
                  Stop sharing with {m.name}
                </button>
              )}
              {m.link.theirGrantId && (
                <button
                  onClick={() => m.link.theirGrantId && actions.revokeCrewLink(m.link.theirGrantId)}
                  className="cursor-pointer rounded-lg border border-tm-rule px-3 py-2 font-tm-mono text-[11px] text-tm-dim"
                >
                  Stop seeing {m.name}
                </button>
              )}
            </div>
            {undo?.slug === m.slug && (
              <div className="mt-2 rounded-lg border border-tm-rule bg-tm-soft p-2.5">
                <p className="text-[12px] text-tm-dim">
                  Stopped sharing with {undo.name}. Undo sends a fresh invite — {undo.name} has to
                  accept it again.
                </p>
                <button
                  onClick={() => {
                    actions.inviteCrew(undo.slug, undo.scopes);
                    setUndo(null);
                  }}
                  className="mt-2 cursor-pointer rounded-lg border border-tm-green px-3 py-2 font-tm-mono text-[11px] text-tm-green"
                >
                  Undo
                </button>
              </div>
            )}
          </div>
        </Card>
      ))}

      {incoming.length > 0 &&
        (survival ? (
          <Card tone="amber">
            <Eyebrow color="bg-tm-amber">Waiting</Eyebrow>
            <p className="text-[12.5px] text-tm-amber-ink">
              {incoming.length === 1 ? "One sharing request is" : `${incoming.length} requests are`}{" "}
              waiting. They keep. The floor asks nothing new of you.
            </p>
          </Card>
        ) : (
          incoming.map((m) => {
            const invite = m.link.incoming;
            if (!invite) return null;
            return (
              <Card key={`in-${m.slug}`}>
                <Eyebrow color="bg-tm-blue">Sharing request</Eyebrow>
                <p className="text-[13px] leading-snug">
                  <b>{m.name}</b> wants to show you {scopeList(invite.scopes)}.
                </p>
                <p className="mt-1 text-[12px] text-tm-dim">
                  Sent {invite.invitedDate}. Nothing is shared until you accept, and either of you
                  can stop it at any time.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => actions.respondToCrewInvite(invite.linkId, true)}
                    className="flex-1 cursor-pointer rounded-lg border border-tm-green bg-tm-green px-3 py-3 font-tm-mono text-[12px] text-white"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => actions.respondToCrewInvite(invite.linkId, false)}
                    className="flex-1 cursor-pointer rounded-lg border border-tm-rule px-3 py-3 font-tm-mono text-[12px] text-tm-dim"
                  >
                    Decline
                  </button>
                </div>
              </Card>
            );
          })
        ))}

      {!survival && outgoing.length > 0 && (
        <Card>
          <Eyebrow color="bg-tm-dim2">Invites you have sent</Eyebrow>
          <ul>
            {outgoing.map((m) => {
              const invite = m.link.outgoing;
              if (!invite) return null;
              return (
                <li
                  key={`out-${m.slug}`}
                  className="flex items-center justify-between gap-3 border-b border-tm-grid py-2 last:border-0"
                >
                  <span className="text-[12.5px]">
                    <b>{m.name}</b> · {scopeList(invite.scopes)} · sent {invite.invitedDate}
                  </span>
                  <button
                    onClick={() => actions.revokeCrewLink(invite.linkId)}
                    className="shrink-0 cursor-pointer rounded-lg border border-tm-rule px-3 py-2 font-tm-mono text-[11px] text-tm-dim"
                  >
                    Withdraw
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {!survival && you && you.link.candidates.length > 0 && (
        <InviteForm
          candidates={you.link.candidates}
          onInvite={(slug, scopes) => actions.inviteCrew(slug, scopes)}
        />
      )}

      <Card>
        <Eyebrow color="bg-tm-green">Nudges — mode-aware</Eyebrow>
        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((n) => (
            <button
              key={n}
              onClick={() => {
                actions.nudge(n);
                setSent(n);
                setTimeout(() => setSent(null), 1500);
              }}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-2 font-tm-mono text-[11px]",
                sent === n ? "border-tm-green bg-tm-green text-white" : "border-tm-green text-tm-green",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <ul aria-label="Crew feed">
          {(feed ?? []).slice(-8).map((f, i) => (
            <li
              key={`${f.at}-${i}`}
              className="flex justify-between gap-3 border-b border-tm-grid py-1.5 font-tm-mono text-[11px] last:border-0"
            >
              <span>
                <b>{f.name}</b> · {f.message}
              </span>
              <span className="shrink-0 text-tm-dim">{formatTime(f.at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ===== invite ===== */

function InviteForm({
  candidates,
  onInvite,
}: {
  candidates: { slug: string; name: string }[];
  onInvite: (slug: string, scopes: Scope[]) => void;
}) {
  const [target, setTarget] = useState(candidates[0]?.slug ?? "");
  const [scopes, setScopes] = useState<Scope[]>(["adherence"]);
  const [done, setDone] = useState(false);

  const toggle = (s: Scope) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const name = candidates.find((c) => c.slug === target)?.name ?? "They";

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Share your file</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {candidates.map((c) => (
          <button
            key={c.slug}
            onClick={() => setTarget(c.slug)}
            className={cn(
              "cursor-pointer rounded-lg border px-3 py-2 font-tm-mono text-[11px]",
              target === c.slug ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule text-tm-dim",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <ul className="mt-3">
        {SCOPES.map((s) => (
          <li key={s} className="border-b border-tm-grid py-2 last:border-0">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={scopes.includes(s)}
                onChange={() => toggle(s)}
                className="mt-1 size-4 accent-tm-green"
              />
              <span>
                <span className="font-tm-mono text-[11px] tracking-[0.1em] uppercase">
                  {SCOPE_LABELS[s]}
                </span>
                <span className="block text-[12.5px] text-tm-dim">{SCOPE_DESCRIPTIONS[s]}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-tm-dim">{NEVER_SHARED}</p>
      <button
        disabled={!target || scopes.length === 0}
        onClick={() => {
          onInvite(target, scopes);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }}
        className={cn(
          "mt-3 w-full cursor-pointer rounded-lg border px-3 py-3 font-tm-mono text-[12px]",
          scopes.length === 0
            ? "border-tm-rule text-tm-dim2"
            : "border-tm-green bg-tm-green text-white",
        )}
      >
        {done ? "Invite sent" : `Invite ${name}`}
      </button>
      <p className="mt-2 text-[12px] text-tm-dim">
        {name} sees nothing until they accept. You can withdraw it, or stop sharing later, in one
        tap.
      </p>
    </Card>
  );
}

/* ===== bits ===== */

function scopeList(scopes: readonly string[]): string {
  const parts = scopes
    .filter((s): s is Scope => (SCOPES as readonly string[]).includes(s))
    .map((s) => SCOPE_DESCRIPTIONS[s]);
  if (parts.length === 0) return "nothing";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function CrewSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4">
      {[0, 1].map((i) => (
        <Card key={i}>
          <div className="h-3 w-24 rounded bg-tm-soft" />
          <div className="mt-3 h-8 w-40 rounded bg-tm-soft" />
        </Card>
      ))}
    </div>
  );
}

function formatTime(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
