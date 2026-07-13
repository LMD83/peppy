import { BadgeCheck } from "lucide-react"
import { fetchQuery } from "convex/nextjs"

import { api } from "@convex/_generated/api"
import { Stars } from "@/components/stars"
import { ReviewForm } from "@/components/review-form"

const dateFmt = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

export async function ProductReviews({
  handle,
  productName,
}: {
  handle: string
  productName: string
}) {
  const [{ rating, count }, reviews] = await Promise.all([
    fetchQuery(api.reviews.ratingSummary, { handle }),
    fetchQuery(api.reviews.byProduct, { handle }),
  ])

  return (
    <section className="mt-14" id="reviews">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Reviews</h2>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Stars rating={rating} />
          {rating.toFixed(1)} · {count} review{count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <ul className="space-y-4 lg:col-span-2">
          {reviews.map((review) => (
            <li key={review._id} className="rounded-xl border p-5">
              <div className="flex items-center justify-between gap-2">
                <Stars rating={review.rating} size="size-3.5" />
                <time className="text-xs text-muted-foreground" dateTime={review.date}>
                  {dateFmt.format(new Date(review.date))}
                </time>
              </div>
              <h3 className="mt-2 font-semibold">{review.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{review.body}</p>
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium">
                {review.author} · {review.location}
                {review.verified && (
                  <span className="inline-flex items-center gap-0.5 text-primary">
                    <BadgeCheck className="size-3.5" /> Verified
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>

        <ReviewForm productName={productName} />
      </div>
    </section>
  )
}
