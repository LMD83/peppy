"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Narrow on a phone, a real file on a desk. Not a dashboard. */
export const fileWidth = "mx-auto w-full max-w-md lg:max-w-3xl";

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

export type BigChoiceOption = {
  id: string;
  /** The whole answer, in plain words. This is the accessible name. */
  label: string;
  /** One short line under the label. Optional — silence beats filler here. */
  detail?: string;
  selected?: boolean;
  onSelect: () => void;
};

/**
 * One decision, two or three huge targets, no dead ends.
 *
 * The unit easy screens are built from, after Apple's Assistive Access: a
 * question in plain words, then a small number of answers big enough to hit
 * without aiming. We cannot use Apple's API — it is a native SwiftUI scene and
 * this is a web app — so this is the design contract rebuilt for the browser.
 *
 * Rules it keeps so callers do not have to:
 *  - Selection is a tick AND a fill AND aria-pressed, never colour alone (1.4.1).
 *  - Every row is at least 64px tall, comfortably past the 44px floor (2.5.8).
 *  - It never renders nothing. An empty option list gets a sentence, because a
 *    screen with no way forward is the one failure mode this component exists
 *    to prevent.
 *  - The `detail` line is 14px, not small print — there is no small print here.
 *
 * Keep the list to three. Four answers is a menu, and a menu is the thing easy
 * mode is supposed to have removed.
 */
export function BigChoice({
  question,
  hint,
  options,
  className,
}: {
  question: string;
  hint?: string;
  options: BigChoiceOption[];
  className?: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={`${id}-q`} className={cn("flex flex-col gap-2", className)}>
      <p id={`${id}-q`} className="text-[15px] font-medium text-tm-ink">
        {question}
      </p>
      {hint && <p className="text-[14px] text-tm-dim">{hint}</p>}
      {options.length === 0 ? (
        <p className="text-[14px] text-tm-dim">Nothing to choose here right now.</p>
      ) : (
        options.map((o) => (
          <button
            key={o.id}
            onClick={o.onSelect}
            aria-pressed={o.selected ?? false}
            className={cn(
              "flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left",
              // white on tm-ink is 16.4:1; the unselected boundary is
              // rule-strong (3.45:1 on panel), so both states carry a 3:1 edge.
              o.selected
                ? "border-tm-ink bg-tm-ink text-white"
                : "border-tm-rule-strong bg-tm-panel text-tm-ink",
            )}
          >
            <span className="min-w-0">
              <span className="block text-[17px] font-medium">{o.label}</span>
              {o.detail && (
                <span className={cn("mt-0.5 block text-[14px]", o.selected ? "text-white" : "text-tm-dim")}>
                  {o.detail}
                </span>
              )}
            </span>
            {/* Shape, not hue: a tick means chosen, an arrow means "this goes somewhere". */}
            <span aria-hidden className="shrink-0 font-tm-mono text-[17px]">
              {o.selected ? "✓" : "→"}
            </span>
          </button>
        ))
      )}
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

type TmButtonVariant = "primary" | "ghost" | "danger" | "soft";

export function TmButton({
  children,
  className,
  variant = "primary",
  disabled,
  type = "button",
  onClick,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: TmButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  "aria-label"?: string;
}) {
  const variants: Record<TmButtonVariant, string> = {
    primary: "bg-tm-ink text-white",
    ghost: "border border-tm-rule bg-tm-panel text-tm-ink",
    danger: "bg-tm-red text-white",
    soft: "bg-tm-soft text-tm-ink",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] px-4 font-tm-mono text-[11.5px] tracking-[0.15em] uppercase transition-[transform,opacity] duration-150 active:scale-[0.98] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TmChip({
  children,
  className,
  active,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
  tone?: "default" | "green";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 cursor-pointer rounded-[20px] border px-3.5 py-2 font-tm-mono text-[11.5px] transition-[transform,opacity] duration-150 active:scale-[0.98] active:opacity-80",
        tone === "green"
          ? active
            ? "border-tm-green bg-tm-green text-white"
            : "border-tm-green text-tm-green"
          : active
            ? "border-tm-ink bg-tm-ink text-white"
            : "border-tm-rule bg-tm-soft text-tm-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TmSheet({
  open,
  onClose,
  title,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  label: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 cursor-pointer bg-tm-ink/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={label}
        aria-modal="true"
        className="relative z-10 mx-4 mb-4 w-full max-w-md rounded-[14px] border border-tm-rule bg-tm-panel p-4 shadow-[0_8px_32px_rgba(21,23,28,0.18)] sm:mb-0"
      >
        {title && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-tm-mono text-[11px] tracking-[0.15em] text-tm-dim uppercase">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 cursor-pointer px-1 font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase"
            >
              Close
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
