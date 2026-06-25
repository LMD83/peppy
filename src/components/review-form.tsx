"use client"

import { useState } from "react"
import { Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ReviewForm({ productName }: { productName: string }) {
  const [rating, setRating] = useState(5)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="rounded-xl border bg-muted/40 p-5 text-sm">
        Thanks for reviewing {productName}! Reviews are checked before they go
        live. (Demo form — not submitted to a server.)
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
      }}
      className="flex flex-col gap-3 rounded-xl border p-5"
    >
      <h3 className="font-semibold">Write a review</h3>

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {Array.from({ length: 5 }).map((_, i) => {
          const value = i + 1
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              onClick={() => setRating(value)}
              className="p-0.5"
            >
              <Star
                className={cn(
                  "size-6",
                  value <= rating
                    ? "fill-primary text-primary"
                    : "fill-muted text-muted-foreground/40"
                )}
              />
            </button>
          )
        })}
      </div>

      <input
        required
        placeholder="Title"
        aria-label="Review title"
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <textarea
        required
        rows={3}
        placeholder="What did you think?"
        aria-label="Review"
        className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="submit" className="self-start">
        Submit review
      </Button>
    </form>
  )
}
