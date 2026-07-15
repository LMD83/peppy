// Seed fixtures for the `reviews` Convex table (see convex/seed.ts). Live
// review data is read from Convex — see convex/reviews.ts.

export interface Review {
  author: string
  location: string
  rating: number
  date: string
  title: string
  body: string
  verified: boolean
}

interface ReviewSet {
  rating: number
  reviews: Review[]
}

export const REVIEW_SETS: Record<string, ReviewSet> = {
  "whey-protein": {
    rating: 4.8,
    reviews: [
      {
        author: "Conor M.",
        location: "Dublin",
        rating: 5,
        date: "2026-05-12",
        title: "Mixes perfectly",
        body: "No clumps, chocolate isn't sickly sweet. Arrived next day. The Informed-Sport tick was the reason I switched.",
        verified: true,
      },
      {
        author: "Aoife K.",
        location: "Galway",
        rating: 5,
        date: "2026-04-28",
        title: "Great value per serving",
        body: "Worked out cheaper per scoop than what I was importing from the UK, and no customs hassle.",
        verified: true,
      },
      {
        author: "Daniel R.",
        location: "Cork",
        rating: 4,
        date: "2026-04-02",
        title: "Solid everyday whey",
        body: "Does the job, vanilla is my pick. Would like a bigger tub option.",
        verified: true,
      },
    ],
  },
  "creatine-monohydrate": {
    rating: 4.9,
    reviews: [
      {
        author: "Niamh B.",
        location: "Limerick",
        rating: 5,
        date: "2026-05-20",
        title: "Does exactly what it should",
        body: "Unflavoured, dissolves grand in my shake. Simple and well priced.",
        verified: true,
      },
      {
        author: "Seán O.",
        location: "Kildare",
        rating: 5,
        date: "2026-03-15",
        title: "Best value creatine here",
        body: "50 servings for the price is hard to beat in Ireland. Repurchasing on subscription now.",
        verified: true,
      },
    ],
  },
  "vegan-protein": {
    rating: 4.7,
    reviews: [
      {
        author: "Emma D.",
        location: "Waterford",
        rating: 5,
        date: "2026-05-05",
        title: "Not chalky at all",
        body: "Best plant protein I've tried, salted caramel is lovely. No bloating.",
        verified: true,
      },
      {
        author: "Mark F.",
        location: "Sligo",
        rating: 4,
        date: "2026-04-18",
        title: "Good dairy-free option",
        body: "Mixes better with plant milk than water but taste is great either way.",
        verified: true,
      },
    ],
  },
}

export const DEFAULT_REVIEW_SET: ReviewSet = {
  rating: 4.6,
  reviews: [
    {
      author: "Rachel T.",
      location: "Meath",
      rating: 5,
      date: "2026-05-01",
      title: "Fast delivery, quality product",
      body: "Ordered in the evening and it arrived the next day. Will buy again.",
      verified: true,
    },
    {
      author: "Liam H.",
      location: "Donegal",
      rating: 4,
      date: "2026-04-10",
      title: "Happy with it",
      body: "Good ingredients and clear labelling. Exactly what I wanted.",
      verified: true,
    },
  ],
}
