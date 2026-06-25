import { ShieldCheck } from "@/components/icons"
import { Truck, BadgeEuro, Star } from "lucide-react"

const signals = [
  { icon: ShieldCheck, label: "Informed-Sport tested" },
  { icon: Truck, label: "Next-day delivery in Ireland" },
  { icon: BadgeEuro, label: "No customs charges" },
  { icon: Star, label: "Rated 4.8 by Irish athletes" },
]

export function TrustBar() {
  return (
    <section className="border-y bg-muted/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-5 sm:grid-cols-4">
        {signals.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Icon className="size-5 shrink-0 text-primary" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
