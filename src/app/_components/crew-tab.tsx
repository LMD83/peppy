"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CARER_NEVER,
  NEVER_SHARED,
  SCOPE_DESCRIPTIONS,
  SCOPE_LABELS,
  allowedScopesFor,
  carerSeatSentence,
  carerSentence,
  grantSentence,
  type CarerView,
  type Relationship,
  type Scope,
} from "@convex/tm/logicConsent";
import { useTimento } from "../_lib/backend";
import type { CrewData } from "../_lib/types";
import { Card, Eyebrow, ModeBadge, Stat } from "./ui";

/**
 * Crew — and, from Wave 3, the carer seat beside it.
 *
 * The tab answers one question before any other: who can currently see what.
 * Every card carries its own sentence about that, in the second person, and the
 * button that ends it sits on the same card — one tap, no confirmation, from
 * either side of the grant.
 *
 * Carers are listed apart from crew because they *are* apart: a narrower grant,
 * a different set of questions, and a view that can only ever narrow what the
 * projection already allowed (convex/tm/logicConsent.ts).
 */

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

/** Every carer state says itself in words — never a colour on its own. */
const STEP_COPY: Record<CarerView["step"], string> = {
  "reorder-due": "Something needs reordering.",
  "checks-outstanding": "Today's checks aren't done yet.",
  "nothing-needed": "Nothing needs doing.",
  "nothing-shared": "Nothing is shared with you yet.",
};

const SUPPLY_ANSWER: Record<CarerView["supply"], string> = {
  "order-due": "Yes. Something needs reordering",
  ok: "No. Nothing is running out",
  none: "Not shared with you",
};

export function CrewTab() {
  const { crew, feed, actions, today } = useTimento();
  const [sent, setSent] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  // Held here rather than inside the composer because the tab has to know it:
  // a carer grant states the carer floor, which leaves the crew floor still
  // needing somewhere to land.
  const [inviteRelationship, setInviteRelationship] = useState<Relationship>("crew");
  const [undo, setUndo] = useState<{
    slug: string;
    name: string;
    scopes: Scope[];
    relationship: Relationship;
  } | null>(null);

  if (!crew || !today) return <CrewSkeleton />;

  const easy = today.a11y.profile === "easy";
  const you = crew.find((m) => m.isYou);
  const others = crew.filter((m) => !m.isYou);
  const survival = today.user.mode === "survival";

  const shared = others.filter((m) => m.link.youSee.length > 0 || m.link.theySee.length > 0);
  // Three lists, one person may appear on two of them: helping is not the same
  // relationship as being helped, and both deserve saying out loud.
  const helping = others.filter((m) => m.link.youAre === "carer");
  const yourCarers = others.filter((m) => m.link.theyAre === "carer");
  const crewRows = shared.filter((m) => m.link.youAre !== "carer" && m.link.theyAre !== "carer");
  const incoming = others.filter((m) => m.link.incoming);
  const outgoing = others.filter((m) => m.link.outgoing);
  const partner = shared[0] ?? others[0];
  const presets = NUDGES[partner?.mode ?? today.user.mode];

  const composerShown = !survival && !easy && !!you && you.link.candidates.length > 0;

  const stop = (m: Member) => {
    if (!m.link.yourGrantId) return;
    setUndo({
      slug: m.slug,
      name: m.name,
      scopes: m.link.theySee,
      relationship: m.link.theyAre ?? "crew",
    });
    actions.revokeCrewLink(m.link.yourGrantId);
  };

  // Easy mode shows fewer objects, not smaller ones: the seat you are sitting
  // in, or the one person, and nothing administrative.
  const helpingShown = easy ? helping.slice(0, 1) : helping;
  const crewShown = easy ? crewRows.slice(0, helpingShown.length > 0 ? 0 : 1) : crewRows;
  const carersShown = easy ? yourCarers.slice(0, 1) : yourCarers;

  /*
    Where the floor — "Not your weight, not your medicines, nothing you write
    down." — is said. A promise repeated on every card is read on none of them,
    so it is said once, as close to the decision as the screen allows. Three
    placements, in order of how load-bearing they are, and the last exists
    because the first two can both be absent:

    1. The composer, while a crew grant is being built — the moment someone is
       actually deciding how much to hand over. A carer grant states the carer
       floor instead, a different sentence about a narrower seat, so it does not
       count as having said this one.
    2. Failing that, the first card that names a grant. It has to be the first
       *granting* card: "can see nothing of yours" has no floor to append, so
       pinning this to index 0 loses the promise whenever the first person on
       the board shares nothing.
    3. Failing both, the tab says it plainly. A board where everyone listed
       currently shares nothing, in the floor or in easy mode, has no composer
       and no grant to ride along with — and a privacy promise displayed zero
       times is worse than one displayed twice.
  */
  const composerCarriesFloor = composerShown && inviteRelationship === "crew";
  const floorCarrier = composerCarriesFloor
    ? -1
    : crewShown.findIndex((m) => m.link.theySee.length > 0);
  const floorStandalone = !composerCarriesFloor && floorCarrier === -1;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 pt-5",
        !easy && "lg:grid lg:grid-cols-12 lg:items-start lg:gap-6",
      )}
    >
      <div className="flex flex-col gap-3 lg:col-span-7">
      {helpingShown.map((m) =>
        m.link.carerView ? (
          <CarerSeat key={`seat-${m.slug}`} member={m} view={m.link.carerView} />
        ) : null,
      )}

      {crewShown.map((m, i) => (
        <Card key={m.slug}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">{m.name}</h2>
            {m.mode ? <ModeBadge mode={m.mode} /> : null}
          </div>

          {m.link.youSee.length > 0 ? (
            /*
              A description list, because that is what a label/value pair is —
              Stat renders its own dt/dd inside a div, so the semantics survive
              the axe rule about what a dl may directly contain.

              flex-wrap rather than a fixed grid: grid-cols reserves a track per
              cell whether or not an item fills it, and an empty track paints
              the container's own bg-tm-rule — a dead grey cell whenever the
              count does not divide evenly. Flex items grow to close the gap, so
              there is never a cell with nothing in it.
            */
            <dl className="mt-4 flex flex-wrap gap-px overflow-hidden rounded-[10px] border border-tm-rule bg-tm-rule">
              {m.streak !== undefined && (
                <Stat className="min-w-[104px] flex-1 bg-tm-panel px-3 py-3" value={`${m.streak}`} label="Streak" />
              )}
              {m.adherence7 !== undefined && (
                <Stat className="min-w-[104px] flex-1 bg-tm-panel px-3 py-3" value={`${m.adherence7}%`} label="7-day" />
              )}
              {m.todayDone !== undefined && (
                <Stat
                  className="min-w-[104px] flex-1 bg-tm-panel px-3 py-3"
                  value={`${m.todayDone}/${m.todayTotal}`}
                  label="Today"
                />
              )}
              {m.mode === "survival" && m.daysInMode !== undefined && (
                <Stat
                  className="min-w-[104px] flex-1 bg-tm-panel px-3 py-3"
                  value={`${m.daysInMode}`}
                  label="Days on floor"
                />
              )}
              {m.supplyState && m.supplyState !== "none" && (
                <Stat
                  className="min-w-[104px] flex-1 bg-tm-panel px-3 py-3"
                  value={SUPPLY_COPY[m.supplyState]}
                  label="Supply"
                />
              )}
            </dl>
          ) : (
            <p className="mt-3 text-[14px] text-tm-dim">
              {m.name} shares nothing with you. That is their call, and it stays theirs.
            </p>
          )}

          {m.mode === "survival" && m.modeSince && (
            <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
              floor since {m.modeSince}
              {m.reviewDate ? ` · review ${m.reviewDate}` : ""}
            </p>
          )}

          <Disclosure
            member={m}
            floor={i === floorCarrier}
            onStop={() => stop(m)}
            onStopSeeing={actions.revokeCrewLink}
          />
          {undo?.slug === m.slug && <Undo undo={undo} onDone={() => setUndo(null)} />}
        </Card>
      ))}

      {carersShown.map((m) => (
        <Card key={`carer-${m.slug}`}>
          <Eyebrow color="bg-tm-blue">Carer</Eyebrow>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">{m.name}</h2>
            <span className="pt-1 font-tm-mono text-[11.5px] text-tm-dim">helping you</span>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-tm-ink">
            {carerSentence(m.name, m.link.theySee)}
          </p>
          <Disclosure
            member={m}
            hideSentence
            onStop={() => stop(m)}
            onStopSeeing={actions.revokeCrewLink}
          />
          {undo?.slug === m.slug && <Undo undo={undo} onDone={() => setUndo(null)} />}
        </Card>
      ))}

      {incoming.length > 0 &&
        (survival ? (
          <Card tone="amber">
            <Eyebrow color="bg-tm-amber">Waiting</Eyebrow>
            <p className="text-[13px] text-tm-amber-ink">
              {incoming.length === 1 ? "One sharing request is" : `${incoming.length} requests are`}{" "}
              waiting. They keep. The floor asks nothing new of you.
            </p>
          </Card>
        ) : (
          incoming.map((m) => {
            const invite = m.link.incoming;
            if (!invite) return null;
            const carer = invite.relationship === "carer";
            return (
              <Card key={`in-${m.slug}`}>
                <Eyebrow color="bg-tm-blue">
                  {carer ? "Carer request" : "Sharing request"}
                </Eyebrow>
                <p className="text-[13px] leading-snug">
                  {carer ? (
                    <>
                      <b>{m.name}</b> is asking you to help from outside the crew.
                    </>
                  ) : (
                    <>
                      <b>{m.name}</b> wants to show you {scopeList(invite.scopes)}.
                    </>
                  )}
                </p>
                {/*
                  Never the floor here, whatever else is on screen. This
                  sentence describes their file, not yours — appending "not your
                  weight" to "You would see: how often they hit their checks"
                  attaches your promise to their disclosure.
                */}
                <p className="mt-1 text-[13px] leading-snug text-tm-ink">
                  {carer
                    ? carerSeatSentence(m.name, invite.scopes)
                    : grantSentence(m.name, invite.scopes, "crew", false).replace(
                        `${m.name} can see`,
                        "You would see",
                      )}
                </p>
                <p className="mt-1 text-[13px] text-tm-dim">
                  Sent {invite.invitedDate}. Nothing is shared until you accept. Right now you can
                  see their name and this sentence, and nothing else. Either of you can stop it at
                  any time.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => actions.respondToCrewInvite(invite.linkId, true)}
                    className="min-h-11 flex-1 cursor-pointer rounded-[10px] border border-tm-green bg-tm-green px-3 font-tm-mono text-[13px] text-white transition-transform duration-150 active:scale-[0.98]"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => actions.respondToCrewInvite(invite.linkId, false)}
                    className="min-h-11 flex-1 cursor-pointer rounded-[10px] border border-tm-rule px-3 font-tm-mono text-[13px] text-tm-dim transition-transform duration-150 active:scale-[0.98]"
                  >
                    Decline
                  </button>
                </div>
              </Card>
            );
          })
        ))}

      {!survival && !easy && outgoing.length > 0 && (
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
                  <span className="text-[13px]">
                    <b>{m.name}</b> · {invite.relationship === "carer" ? "carer seat" : "crew"} ·{" "}
                    {scopeList(invite.scopes)} · sent {invite.invitedDate}
                  </span>
                  <button
                    onClick={() => actions.revokeCrewLink(invite.linkId)}
                    className="min-h-11 shrink-0 cursor-pointer rounded-[10px] border border-tm-rule px-3 font-tm-mono text-[11.5px] text-tm-dim transition-transform duration-150 active:scale-[0.98]"
                  >
                    Withdraw
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {composerShown && you && (
        <InviteForm
          candidates={you.link.candidates}
          relationship={inviteRelationship}
          onRelationship={setInviteRelationship}
          onInvite={(slug, scopes, relationship) => actions.inviteCrew(slug, scopes, relationship)}
        />
      )}

      {/* Placement 3 — where the composer would have been, saying the one thing
          it would have said. */}
      {floorStandalone && (
        <Card>
          <Eyebrow color="bg-tm-dim2">What nobody ever sees</Eyebrow>
          <p className="text-[13px] leading-snug text-tm-ink">{NEVER_SHARED}</p>
        </Card>
      )}
      </div>

      <Card className="lg:col-span-5">
        <Eyebrow color="bg-tm-green">Nudges</Eyebrow>
        <div className="mb-3 flex flex-wrap gap-2">
          {(easy ? presets.slice(0, 2) : presets).map((n) => (
            <button
              key={n}
              onClick={() => {
                actions.nudge(n);
                setSent(n);
                setTimeout(() => setSent(null), 1500);
              }}
              className={cn(
                "min-h-11 cursor-pointer rounded-[10px] border px-3.5 font-tm-mono text-[11.5px] transition-[transform,opacity] duration-150 active:scale-[0.98]",
                sent === n ? "border-tm-green bg-tm-green text-white" : "border-tm-green text-tm-green",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = custom.trim();
            if (!trimmed) return;
            actions.nudge(trimmed);
            setSent(trimmed);
            setCustom("");
            setTimeout(() => setSent(null), 1500);
          }}
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 200))}
            placeholder="Custom message"
            aria-label="Custom crew message"
            maxLength={200}
            className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 py-2 text-[15px] text-tm-ink focus:border-tm-ink"
          />
          <button
            type="submit"
            disabled={custom.trim().length === 0}
            className="min-h-11 cursor-pointer rounded-[10px] bg-tm-ink px-4 font-tm-mono text-[11.5px] tracking-[0.12em] text-white uppercase transition-transform duration-150 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          >
            Send
          </button>
        </form>
        <ul aria-label="Crew feed">
          {(feed ?? []).slice(easy ? -4 : -8).map((f, i) => (
            <li
              key={`${f.at}-${i}`}
              className="flex justify-between gap-3 border-b border-tm-grid py-2.5 font-tm-mono text-[11.5px] last:border-0"
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

/* ===== the carer seat ===== */

/**
 * Three questions, in the order a bad day asks them. No percentages, no
 * streaks, no drug names — the view is built from an already-projected member,
 * so there is nothing else in it to print.
 */
function CarerSeat({ member, view }: { member: Member; view: CarerView }) {
  const checks =
    view.checksDone !== null && view.checksTotal !== null
      ? `${view.checksDone} of ${view.checksTotal} done`
      : "Not shared with you";
  const floor =
    view.floorHeld === null ? "" : view.floorHeld ? ". Floor held" : ". Not yet held";

  return (
    <Card tone={view.step === "reorder-due" ? "amber" : undefined}>
      <Eyebrow color="bg-tm-blue">Carer seat</Eyebrow>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">{member.name}</h2>
        {view.mode ? <ModeBadge mode={view.mode} /> : null}
      </div>

      <dl className="mt-4 divide-y divide-tm-grid border-y border-tm-grid">
        <div className="py-3">
          <dt className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">
            Anything running out?
          </dt>
          <dd className="mt-1 text-[15px] leading-snug">{SUPPLY_ANSWER[view.supply]}</dd>
        </div>
        <div className="py-3">
          <dt className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">
            Today&rsquo;s checks
          </dt>
          <dd className="mt-1 text-[15px] leading-snug">
            {checks}
            {floor}
          </dd>
        </div>
        <div className="py-3">
          <dt className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">
            Anything to do?
          </dt>
          <dd className="mt-1 text-[15px] leading-snug">{STEP_COPY[view.step]}</dd>
        </div>
      </dl>

      {view.mode === "survival" && view.daysInMode !== null && (
        <p className="mt-2 text-[13px] text-tm-dim">
          {member.name} has been on the floor {view.daysInMode} days. The floor is three checks and
          nothing else. It is working as designed.
        </p>
      )}

      <div className="mt-3 border-t border-tm-grid pt-3">
        <p className="text-[13px] leading-snug text-tm-ink">
          {carerSeatSentence(member.name, member.link.youSee)}
        </p>
        {member.link.theirGrantId && (
          <HandBack linkId={member.link.theirGrantId} name={member.name} />
        )}
      </div>
    </Card>
  );
}

/* ===== who can see what, and the tap that ends it ===== */

function Disclosure({
  member,
  hideSentence,
  floor,
  onStop,
  onStopSeeing,
}: {
  member: Member;
  hideSentence?: boolean;
  /** Whether this card is the one carrying the standing promise (see CrewTab). */
  floor?: boolean;
  onStop: () => void;
  onStopSeeing: (linkId: string) => void;
}) {
  const { link } = member;
  return (
    <div className="mt-3 border-t border-tm-grid pt-3">
      {!hideSentence && (
        <p className="text-[13px] leading-snug text-tm-ink">
          {grantSentence(member.name, link.theySee, link.theyAre ?? "crew", floor ?? false)}
        </p>
      )}
      {link.youSee.length > 0 && (
        <p className="mt-1 text-[13px] leading-snug text-tm-dim">
          You can see: {scopeList(link.youSee)}.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {link.yourGrantId && (
          <button
            onClick={onStop}
            className="min-h-11 cursor-pointer rounded-[10px] border border-tm-red px-3 font-tm-mono text-[11.5px] text-tm-red transition-transform duration-150 active:scale-[0.98]"
          >
            Stop sharing with {member.name}
          </button>
        )}
        {link.theirGrantId && (
          <button
            onClick={() => link.theirGrantId && onStopSeeing(link.theirGrantId)}
            className="min-h-11 cursor-pointer rounded-[10px] border border-tm-rule px-3 font-tm-mono text-[11.5px] text-tm-dim transition-transform duration-150 active:scale-[0.98]"
          >
            Stop seeing {member.name}
          </button>
        )}
      </div>
    </div>
  );
}

/** The carer's own way out, on the carer's own card. */
function HandBack({ linkId, name }: { linkId: string; name: string }) {
  const { actions } = useTimento();
  return (
    <button
      onClick={() => actions.revokeCrewLink(linkId)}
      className="mt-2 min-h-11 cursor-pointer rounded-[10px] border border-tm-rule px-3 font-tm-mono text-[11.5px] text-tm-dim transition-transform duration-150 active:scale-[0.98]"
    >
      Hand back {name}&rsquo;s seat
    </button>
  );
}

function Undo({
  undo,
  onDone,
}: {
  undo: { slug: string; name: string; scopes: Scope[]; relationship: Relationship };
  onDone: () => void;
}) {
  const { actions } = useTimento();
  return (
    <div className="mt-2 rounded-[10px] border border-tm-rule bg-tm-soft p-2.5">
      <p className="text-[13px] text-tm-dim">
        Stopped sharing with {undo.name}. It stopped the moment you tapped. Undo sends a fresh
        invite. {undo.name} has to accept it again.
      </p>
      <button
        onClick={() => {
          actions.inviteCrew(undo.slug, undo.scopes, undo.relationship);
          onDone();
        }}
        className="mt-2 min-h-11 cursor-pointer rounded-[10px] border border-tm-green px-3 font-tm-mono text-[11.5px] text-tm-green transition-transform duration-150 active:scale-[0.98]"
      >
        Undo
      </button>
    </div>
  );
}

/* ===== invite ===== */

const RELATIONSHIP_COPY: Record<Relationship, { label: string; blurb: string }> = {
  crew: {
    label: "Crew",
    blurb: "A peer beside you. They can be offered any of the three below.",
  },
  carer: {
    label: "Carer",
    blurb:
      "Someone helping from outside. A carer can only ever be offered these three. Cravings, check-ins and anything you write down have no setting here at all.",
  },
};

function InviteForm({
  candidates,
  relationship,
  onRelationship,
  onInvite,
}: {
  candidates: { slug: string; name: string }[];
  /** Owned by the tab: which floor this card states decides where the other goes. */
  relationship: Relationship;
  onRelationship: (relationship: Relationship) => void;
  onInvite: (slug: string, scopes: Scope[], relationship: Relationship) => void;
}) {
  const [target, setTarget] = useState(candidates[0]?.slug ?? "");
  const [scopes, setScopes] = useState<Scope[]>(["adherence"]);
  const [done, setDone] = useState(false);

  const allowed = allowedScopesFor(relationship);
  const chosen = scopes.filter((s) => allowed.includes(s));
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
            aria-pressed={target === c.slug}
            onClick={() => setTarget(c.slug)}
            className={cn(
              "min-h-11 cursor-pointer rounded-[10px] border px-3 font-tm-mono text-[11.5px] transition-transform duration-150 active:scale-[0.98]",
              target === c.slug ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule text-tm-dim",
            )}
          >
            {target === c.slug ? `✓ ${c.name}` : c.name}
          </button>
        ))}
      </div>

      <p className="mt-3 font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-dim uppercase">
        What are they to you?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(RELATIONSHIP_COPY) as Relationship[]).map((r) => (
          <button
            key={r}
            aria-pressed={relationship === r}
            onClick={() => {
              onRelationship(r);
              setScopes((prev) => prev.filter((s) => allowedScopesFor(r).includes(s)));
            }}
            className={cn(
              "min-h-11 cursor-pointer rounded-[10px] border px-3 font-tm-mono text-[11.5px] transition-transform duration-150 active:scale-[0.98]",
              relationship === r ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule text-tm-dim",
            )}
          >
            {relationship === r ? `✓ ${RELATIONSHIP_COPY[r].label}` : RELATIONSHIP_COPY[r].label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[13px] leading-snug text-tm-dim">
        {RELATIONSHIP_COPY[relationship].blurb}
      </p>

      <ul className="mt-3">
        {allowed.map((s) => (
          <li key={s} className="border-b border-tm-grid py-2 last:border-0">
            <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
              <input
                type="checkbox"
                checked={chosen.includes(s)}
                onChange={() => toggle(s)}
                className="mt-1 size-4 accent-tm-green"
              />
              <span>
                <span className="font-tm-mono text-[11.5px] tracking-[0.1em] uppercase">
                  {SCOPE_LABELS[s]}
                </span>
                <span className="block text-[13px] text-tm-dim">{SCOPE_DESCRIPTIONS[s]}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {/*
        The floor is stated whatever is ticked, including nothing. Gating it on
        a scope being chosen meant unticking the last one took the promise off
        the screen entirely — and the moment someone is deciding how much to
        share is the moment it has to be readable. A carer grant states the
        carer floor, which is the promise that actually applies to it.
      */}
      <p className="mt-2 text-[13px] leading-snug text-tm-ink">
        {chosen.length === 0
          ? `${name} would see nothing yet. Tick at least one. ${
              relationship === "carer"
                ? `Whatever you tick, ${name} will not see ${CARER_NEVER}.`
                : NEVER_SHARED
            }`
          : grantSentence(name, chosen, relationship)}
      </p>

      <button
        disabled={!target || chosen.length === 0}
        onClick={() => {
          onInvite(target, chosen, relationship);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }}
        className={cn(
          "mt-3 min-h-11 w-full cursor-pointer rounded-[10px] border px-3 font-tm-mono text-[13px] transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100",
          chosen.length === 0
            ? "border-tm-rule text-tm-dim2"
            : "border-tm-green bg-tm-green text-white",
        )}
      >
        {done
          ? "Invite sent"
          : `Invite ${name}${relationship === "carer" ? " as a carer" : ""}`}
      </button>
      <p className="mt-2 text-[13px] text-tm-dim">
        {name} sees nothing until they accept. You can withdraw it, or stop sharing later, in one
        tap.
      </p>
    </Card>
  );
}

/* ===== bits ===== */

function scopeList(scopes: readonly Scope[]): string {
  const parts = scopes.map((s) => SCOPE_DESCRIPTIONS[s]);
  if (parts.length === 0) return "nothing";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function CrewSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-5 lg:grid lg:grid-cols-12 lg:gap-6">
      <Card className="lg:col-span-7">
        <div className="h-7 w-32 rounded bg-tm-soft" />
        <div className="mt-4 h-16 rounded-[10px] bg-tm-soft" />
      </Card>
      <Card className="lg:col-span-5">
        <div className="h-3 w-20 rounded bg-tm-soft" />
        <div className="mt-3 h-11 rounded-[10px] bg-tm-soft" />
      </Card>
    </div>
  );
}

function formatTime(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
