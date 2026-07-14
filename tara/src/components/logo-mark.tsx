// Hexagon + cross-node mark, from BRAND-KIT.md §1. Provenance/molecular motif.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M24 3 L42 13.5 V34.5 L24 45 L6 34.5 V13.5 Z"
        stroke="#1B5E20"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M24 15 L24 33 M17 19.5 L31 28.5 M31 19.5 L17 28.5"
        stroke="#1B5E20"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="3" fill="#009B72" />
    </svg>
  );
}
