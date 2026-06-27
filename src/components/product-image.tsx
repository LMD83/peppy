import { collections, type Product } from "@/lib/products"
import { cn } from "@/lib/utils"

const TAGS: Record<string, string> = Object.fromEntries(
  collections.map((c) => [c.slug, c.name.toUpperCase()])
)

/**
 * Branded SVG product illustration — a labelled tub rendered in the product's
 * accent colours. Used in place of photography until real shots are available.
 * Server-safe (no client JS). `idSeed` keeps gradient ids unique per instance.
 */
export function ProductImage({
  product,
  className,
}: {
  product: Product
  className?: string
}) {
  const [from, to] = product.accent
  const seed = product.handle
  const tag = TAGS[product.collection] ?? "SPORTS"

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${product.name} tub`}
      className={cn("h-full w-full", className)}
    >
      <defs>
        <linearGradient id={`label-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>

      {/* soft shadow */}
      <ellipse cx="100" cy="178" rx="46" ry="7" fill="rgba(0,0,0,0.12)" />

      {/* tub body */}
      <rect x="58" y="56" width="84" height="118" rx="12" fill="#f7f7f5" />
      <rect
        x="58"
        y="56"
        width="84"
        height="118"
        rx="12"
        fill="none"
        stroke="rgba(0,0,0,0.08)"
      />

      {/* lid */}
      <rect x="54" y="38" width="92" height="24" rx="9" fill={to} />
      <rect x="54" y="38" width="92" height="9" rx="4.5" fill="rgba(255,255,255,0.18)" />

      {/* label */}
      <rect
        x="64"
        y="84"
        width="72"
        height="74"
        rx="8"
        fill={`url(#label-${seed})`}
      />

      {/* lightning bolt mark */}
      <path
        d="M104 96 90 116h10l-2 14 14-19h-9l1-15z"
        fill="white"
        opacity="0.95"
      />

      {/* wordmark + category */}
      <text
        x="100"
        y="140"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="white"
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.5"
      >
        PEPPY
      </text>
      <text
        x="100"
        y="151"
        textAnchor="middle"
        fontSize="5.5"
        fontWeight="600"
        fill="rgba(255,255,255,0.85)"
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.5"
      >
        {tag}
      </text>
    </svg>
  )
}
