import { Badge } from "@/components/ui/badge"
import { ShieldCheck } from "@/components/icons"
import { cn } from "@/lib/utils"

export function InformedSportBadge({ className }: { className?: string }) {
  return (
    <Badge variant="accent" className={cn("gap-1", className)}>
      <ShieldCheck className="size-3" />
      Informed-Sport tested
    </Badge>
  )
}
