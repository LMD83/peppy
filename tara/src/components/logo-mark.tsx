// Hexagon + cross-node mark, from BRAND-KIT.md §1. Provenance/molecular motif.
export function LogoMark({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M24 3 L42 13.5 V34.5 L24 45 L6 34.5 V13.5 Z"
        stroke="#1B5E20"
        strokeWidth="2.4"
        strokeLinejoin="round"
        fill={filled ? "#F6FBF8" : "none"}
      />
      <path
        d="M24 15 L24 33 M17 19.5 L31 28.5 M31 19.5 L17 28.5"
        stroke="#1B5E20"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="3.2" fill="#009B72" />
    </svg>
  );
}

// Full horizontal lockup: mark + TARA wordmark + "PEPTIDES · RESEARCH GRADE".
export function LogoLockup({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className ?? ""}`}>
      <LogoMark className="h-9 w-9 shrink-0" filled />
      <span className="flex flex-col items-start leading-none">
        <span className="font-serif text-lg font-bold tracking-[0.22em] text-primary">TARA</span>
        <span className="mt-1 text-[8.5px] font-semibold tracking-[0.28em] text-muted-foreground">
          PEPTIDES · RESEARCH GRADE
        </span>
      </span>
    </span>
  );
}
