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
      <span className="font-tm-mono text-[10.5px] tracking-[0.15em] text-tm-dim uppercase">
        {children}
      </span>
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-tm-disp text-2xl leading-tight">{value}</div>
      <div className="font-tm-mono text-[9px] tracking-[0.16em] text-tm-dim uppercase">{label}</div>
    </div>
  );
}

export function ModeBadge({ mode }: { mode: "cut" | "maintain" | "survival" }) {
  const styles = {
    cut: "border-tm-green bg-[#e8f1eb] text-tm-green",
    maintain: "border-tm-blue bg-[#e9eff8] text-tm-blue",
    survival: "border-tm-amber bg-tm-amber-bg text-tm-amber",
  } as const;
  return (
    <span
      className={cn(
        "rounded-xl border px-2.5 py-[3px] font-tm-mono text-[9px] tracking-[0.1em] uppercase",
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
        "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] px-4 font-tm-mono text-[11px] tracking-[0.15em] uppercase transition-[transform,opacity] duration-150 active:scale-[0.98] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-tm-paper",
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
        "min-h-11 cursor-pointer rounded-[20px] border px-3.5 py-2 font-tm-mono text-[11px] transition-[transform,opacity] duration-150 active:scale-[0.98] active:opacity-80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-tm-paper",
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
              className="min-h-11 cursor-pointer px-1 font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/25"
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
