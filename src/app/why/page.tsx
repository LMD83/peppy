import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Why this design" };

const STEPS = [
  {
    title: "Short sleep",
    body: "A newborn, a late shift, a bad week. Sleep debt raises ghrelin and blunts leptin — hunger signalling shifts before any willpower is spent.",
  },
  {
    title: "Ghrelin up, reward system louder",
    body: "Tired brains discount the future harder and price sweet fat higher. The 21:00 craving is chemistry keeping an appointment, not a character flaw.",
  },
  {
    title: "The evening window",
    body: "Cravings cluster where depletion peaks — after the day is done and the kitchen is near. That's why the map keeps pointing at 21:00–22:00.",
  },
  {
    title: "The AVE spiral",
    body: "Abstinence violation effect: one lapse reads as proof the whole plan failed, so the night goes. The fix is pre-written: a lapse is logged; the loop continues.",
  },
];

const DESIGN = [
  ["Kitchen close 20:30", "shrinks the window where the spiral starts. Identity fence, not a diet rule with an end date."],
  ["20:15 ritual", "same cue, same reward, swapped routine — skyr, two squares of dark, decaf."],
  ["Craving taps", "two seconds of logging turns urges into a trigger map. You fight a schedule, not yourself."],
  ["Modes", "cut, maintain, survival. The circuit breaker is pre-committed, so a bad season is executed, never improvised."],
  ["Crew board", "streaks and checks are shared; weights, BP and labs never leave your own file — enforced in the queries."],
  ["Experiments", "disputed genetics get functional tests, not vibes. n=1, run twice, verdict recorded."],
] as const;

export default function WhyPage() {
  return (
    <div className="mx-auto max-w-md px-4 pb-16">
      <header className="pt-8 pb-4">
        <div className="font-tm-mono text-[10px] tracking-[0.2em] text-tm-dim uppercase">Performance file</div>
        <h1 className="mt-1 font-tm-disp text-2xl uppercase">Why this design</h1>
        <p className="mt-2 text-[13.5px]">
          One screen on the machine you&apos;re operating. Both of you should know it cold.
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-[10px] border border-tm-rule bg-tm-panel p-4">
            <div className="flex items-center gap-2">
              <span className="font-tm-disp text-lg text-tm-red">{i + 1}</span>
              <h2 className="text-[14px] font-semibold">{s.title}</h2>
            </div>
            <p className="mt-1 text-[12.5px] text-tm-ink">{s.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-6 mb-2 font-tm-mono text-[10.5px] tracking-[0.15em] text-tm-dim uppercase">
        So the app is built like this
      </h2>
      <ul className="flex flex-col gap-1.5">
        {DESIGN.map(([name, body]) => (
          <li key={name} className="rounded-lg bg-tm-soft px-3 py-2.5 text-[12.5px]">
            <b>{name}</b> — {body}
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center">
        <Link href="/" className="font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim underline uppercase">
          ← Back to the file
        </Link>
      </p>
    </div>
  );
}
