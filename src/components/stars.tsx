import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

/** Star rating display, rounded to the nearest whole star for fill. */
export function Stars({
  rating,
  className,
  size = "size-4",
}: {
  rating: number
  className?: string
  size?: string
}) {
  const filled = Math.round(rating)
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${rating} out of 5 stars`}
      role="img"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            size,
            i < filled
              ? "fill-primary text-primary"
              : "fill-muted text-muted-foreground/40"
          )}
        />
      ))}
    </span>
  )
}
