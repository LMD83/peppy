"use client";

import { useState } from "react";
import { useTimento } from "../_lib/backend";
import { BigChoice, Card, Eyebrow } from "./ui";

/**
 * Settings — currently one setting, and it is a big one.
 *
 * Two things this screen is not allowed to do, written down here because they
 * are easy to add later and hard to undo:
 *
 * 1. It never turns easy mode on by itself, and nothing in the codebase looks
 *    at someone's data to decide they need it. Reading a slow week, a missed
 *    streak or a low check-in score as "this person is struggling, simplify the
 *    app for them" is patronising, and it is not our call to make. The app is
 *    the wrong thing to be making that judgement.
 * 2. It never suggests it either — no banner, no "we noticed", no nudge. It is
 *    offered plainly to everybody, in the same words, in the same place, on the
 *    first day and the hundredth.
 *
 * Plenty of people want fewer things on a screen for reasons that have nothing
 * to do with struggling: a phone in one hand, a bad migraine, a shaky morning,
 * or simply a preference. Offering it to everyone costs nothing and removes the
 * implication entirely.
 */
export function SettingsTab() {
  const { today, actions } = useTimento();
  // Announced politely: the whole screen changes shape under the reader, and a
  // rude interruption on a settings screen is its own accessibility problem.
  const [status, setStatus] = useState("");

  if (!today) return <SettingsSkeleton />;

  const profile = today.a11y.profile;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <Card>
        <Eyebrow color="bg-tm-blue">How the app looks</Eyebrow>
        <p className="mb-3 text-[15px]">
          Easy mode shows you less at once. You get one thing to do at a time, in bigger text, with
          bigger buttons. Nothing is deleted — it is all still there when you want it.
        </p>
        <BigChoice
          question="Which one do you want?"
          options={[
            {
              id: "standard",
              label: "Normal",
              detail: "Everything on one page.",
              selected: profile === "standard",
              onSelect: () => {
                actions.setA11yProfile("standard");
                setStatus("Normal mode on. The full page is back.");
              },
            },
            {
              id: "easy",
              label: "Easy",
              detail: "One thing at a time. Bigger text and buttons.",
              selected: profile === "easy",
              onSelect: () => {
                actions.setA11yProfile("easy");
                setStatus("Easy mode on. Today now shows one thing at a time.");
              },
            },
          ]}
        />
        <p className="mt-3 text-[14px] text-tm-dim">
          You can switch back here at any time. Nothing you have logged changes either way.
        </p>
      </Card>

      <Card>
        <Eyebrow color="bg-tm-green">What easy mode changes</Eyebrow>
        <ul className="flex flex-col gap-2 text-[15px]">
          {[
            "Today shows three things to do, not five.",
            "It tells you which one to do next.",
            "Your workout plan moves off the front page.",
            "Long warnings become one short sentence.",
            "Text and buttons get bigger.",
            "Everything else moves under the More button.",
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <span aria-hidden className="font-tm-mono text-tm-green">
                ✓
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[14px] text-tm-dim">
          Your streak, your adherence and your numbers are worked out exactly the same way in both.
          Easy mode changes what is on the screen, never what is true.
        </p>
      </Card>

      <Card>
        <Eyebrow color="bg-tm-purple">Our promise</Eyebrow>
        <p className="text-[15px]">
          We will never switch easy mode on for you, and we will never suggest it because of
          something in your data. It is offered to everybody, the same way. You choose.
        </p>
      </Card>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" role="status" aria-busy="true">
      <span className="sr-only">Loading settings</span>
      <Card>
        <div aria-hidden className="animate-pulse">
          <div className="h-3 w-28 rounded bg-tm-grid" />
          <div className="mt-3 h-4 w-full rounded bg-tm-grid" />
          <div className="mt-2 h-16 w-full rounded bg-tm-grid" />
          <div className="mt-2 h-16 w-full rounded bg-tm-grid" />
        </div>
      </Card>
    </div>
  );
}
