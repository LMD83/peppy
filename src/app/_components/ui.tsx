"use client";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "amber";
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] border p-4 shadow-[0_1px_2px_rgba(21,23,28,0.04)]",
        tone === "amber" ? "border-tm-amber bg-tm-amber-bg" : "border-tm-rule bg-tm-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({
  color,
  children,
  className,
}: {
  color: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-center gap-2", className)}>
      <span aria-hidden className={cn("inline-block h-1 w-[18px] rounded-[1px]", color)} />
      <span className="font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-dim uppercase">
        {children}
      </span>
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-tm-disp text-2xl leading-tight">{value}</div>
      <div className="font-tm-mono text-[11.5px] tracking-[0.14em] text-tm-dim uppercase">{label}</div>
    </div>
  );
}

/**
 * Contrast on each pairing (see globals.css for the palette rationale):
 * green on #e8f1eb 5.20:1 · blue on #e9eff8 5.46:1 · amber on amber-bg 5.23:1.
 */
export function ModeBadge({ mode }: { mode: "cut" | "maintain" | "survival" }) {
  const styles = {
    cut: "border-tm-green bg-[#e8f1eb] text-tm-green",
    maintain: "border-tm-blue bg-[#e9eff8] text-tm-blue",
    survival: "border-tm-amber bg-tm-amber-bg text-tm-amber",
  } as const;
  return (
    <span
      className={cn(
        "rounded-xl border px-2.5 py-[3px] font-tm-mono text-[11.5px] tracking-[0.1em] uppercase",
        styles[mode],
      )}
    >
      {mode}
    </span>
  );
}
