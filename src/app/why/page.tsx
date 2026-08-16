import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Why this design" };

const STEPS = [
  {
    title: "Short sleep",
    body: "A newborn, a late shift, a bad week. Sleep debt raises ghrelin and blunts leptin. Hunger signalling shifts before any willpower is spent.",
  },
  {
    title: "Ghrelin up, reward system louder",
    body: "Tired brains discount the future harder and price sweet fat higher. The 21:00 craving is chemistry keeping an appointment, not a character flaw.",
  },
  {
    title: "The evening window",
    body: "Cravings cluster where depletion peaks, after the day is done and the kitchen is near. That is why the map keeps pointing at 21:00-22:00.",
  },
  {
    title: "The AVE spiral",
    body: "Abstinence violation effect: one lapse reads as proof the whole plan failed, so the night goes. The fix is pre-written: a lapse is logged; the loop continues.",
  },
];

const FENCE = [
  {
    name: "Kitchen close 20:30",
    body: "Shrinks the window where the spiral starts. Identity fence, not a diet rule with an end date.",
  },
  {
    name: "20:15 ritual",
    body: "Same cue, same reward, swapped routine. Skyr, two squares of dark, decaf.",
  },
  {
    name: "Craving taps",
    body: "Two seconds of logging turns urges into a trigger map. You fight a schedule, not yourself.",
  },
] as const;

const FILE = [
  {
    name: "Modes",
    body: "Cut, maintain, survival. The circuit breaker is pre-committed, so a bad season is executed, never improvised.",
  },
  {
    name: "Crew board",
    body: "Streaks and checks are shared. Weights, BP and labs never leave your own file, enforced in the queries.",
  },
  {
    name: "Experiments",
    body: "Disputed genetics get functional tests, not vibes. n=1, run twice, verdict recorded.",
  },
] as const;

function OpenFileLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={
        className ??
        "inline-flex min-h-11 items-center justify-center rounded-[10px] bg-tm-ink px-5 text-[13px] font-medium text-tm-paper transition-transform duration-200 active:scale-[0.98] motion-safe:hover:-translate-y-px"
      }
    >
      Open the file
    </Link>
  );
}

export default function WhyPage() {
  return (
    <div className="bg-tm-paper text-tm-ink">
      <header className="sticky top-0 z-10 border-b border-tm-rule/80 bg-tm-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
          <Link href="/" className="font-tm-disp text-lg uppercase tracking-tight">
            Timento
          </Link>
          <OpenFileLink className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-tm-ink px-4 text-[13px] font-medium text-tm-paper transition-transform duration-200 active:scale-[0.98]" />
        </div>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1400px] grid-cols-1 items-center gap-8 px-4 pt-10 pb-10 md:grid-cols-2 md:gap-16 md:px-8 md:pt-12 md:pb-16">
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
            <p className="font-tm-mono text-[10px] tracking-[0.2em] text-tm-dim uppercase">
              Performance file
            </p>
            <h1 className="mt-3 font-tm-disp text-4xl leading-[1.05] tracking-tight uppercase md:text-5xl lg:text-6xl">
              Why this design
            </h1>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-tm-ink2">
              One screen on the machine you are operating. Both of you should know it cold.
            </p>
            <div className="mt-8">
              <OpenFileLink />
            </div>
          </div>
          <div className="relative h-40 overflow-hidden rounded-[10px] md:h-[min(62vh,560px)]">
            <Image
              src="/why/kitchen-close.png"
              alt="Closed kitchen at night, counters cleared"
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </section>

        <section className="border-t border-tm-rule">
          <div className="mx-auto max-w-[1400px] px-4 py-16 md:px-8 md:py-24">
            <h2 className="max-w-[16ch] font-tm-disp text-3xl leading-[1.1] tracking-tight uppercase md:text-4xl">
              The circuit
            </h2>
            <ol className="mt-10 grid grid-cols-1 gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-t border-tm-rule py-8 md:col-span-2 md:grid-cols-[4rem_minmax(0,20rem)_minmax(0,1fr)] md:gap-10"
                >
                  <span className="font-tm-disp text-2xl leading-none text-tm-red md:text-3xl">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-semibold leading-snug md:text-xl">{step.title}</h3>
                  <p className="col-start-2 max-w-[62ch] text-[15px] leading-relaxed text-tm-ink2 md:col-start-3">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-tm-rule bg-tm-soft">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 py-16 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-start md:gap-20 md:px-8 md:py-24">
            <figure className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[10px]">
                <Image
                  src="/why/evening-window.png"
                  alt="Night kitchen window at the evening craving hour"
                  fill
                  sizes="(min-width: 768px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-4 font-tm-disp text-4xl tracking-tight text-tm-ink md:text-5xl">
                21:00-22:00
              </figcaption>
              <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-tm-ink2">
                The hour the map keeps naming. The file is built around that window, not around willpower.
              </p>
            </figure>

            <div>
              <h2 className="font-tm-disp text-3xl leading-[1.1] tracking-tight uppercase md:text-4xl">
                So the app is built like this
              </h2>

              <div className="mt-10">
                <h3 className="text-base font-semibold">Evening fence</h3>
                <ul className="mt-4 flex flex-col">
                  {FENCE.map((item) => (
                    <li key={item.name} className="border-t border-tm-rule py-4 last:border-b">
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 max-w-[58ch] text-sm leading-relaxed text-tm-ink2">{item.body}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10">
                <h3 className="text-base font-semibold">The file</h3>
                <ul className="mt-4 flex flex-col">
                  {FILE.map((item) => (
                    <li key={item.name} className="border-t border-tm-rule py-4 last:border-b">
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 max-w-[58ch] text-sm leading-relaxed text-tm-ink2">{item.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-tm-rule">
          <div className="mx-auto flex max-w-[1400px] flex-col items-start gap-6 px-4 py-16 md:px-8 md:py-20">
            <p className="max-w-[36ch] text-lg leading-relaxed">
              The mechanism is the product. Open the file and run the loop.
            </p>
            <OpenFileLink />
          </div>
        </section>
      </main>
    </div>
  );
}
