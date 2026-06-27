// Static content for legal & informational pages, rendered by /pages/[slug].
//
// ⚠️ The legal pages (terms, privacy, cookie-policy, disclaimer, shipping-returns)
// are starting templates, NOT legal advice. Have an Irish solicitor and your
// accountant review and complete them — and replace every [bracketed] placeholder
// — before going live. See docs/launch-plan/06-REGULATORY-COMPLIANCE.md.

export interface ContentBlock {
  heading?: string
  body?: string[]
  list?: string[]
}

export interface InfoPage {
  slug: string
  title: string
  description: string
  /** Shown under the H1 */
  intro?: string
  /** True for legal templates that need professional sign-off */
  legal?: boolean
  blocks: ContentBlock[]
}

export const infoPages: InfoPage[] = [
  {
    slug: "about",
    title: "About Peppy",
    description:
      "Peppy is an Irish-owned sports nutrition brand: Informed-Sport tested products, transparent labels and next-day delivery across Ireland.",
    intro: "Honest sports nutrition, made for Ireland.",
    blocks: [
      {
        heading: "Why we started",
        body: [
          "Peppy began with a simple frustration: buying quality sports nutrition in Ireland often meant ordering from the UK, waiting days, and risking customs charges — with little clarity about what was actually in the tub.",
          "We set out to build an Irish brand that fixes that: tested products, clear labels, fair pricing and fast local delivery.",
        ],
      },
      {
        heading: "What we stand for",
        list: [
          "Transparency — full supplement facts and per-serving pricing on every product.",
          "Trust — Informed-Sport tested for banned substances, so athletes can buy with confidence.",
          "Speed — shipped from Ireland for next-day delivery, no customs friction.",
          "Honesty — we'll never make a health claim we can't stand behind.",
        ],
      },
    ],
  },
  {
    slug: "quality",
    title: "Quality & Testing",
    description:
      "How Peppy products are made and tested: GMP manufacturing, batch Certificates of Analysis, and Informed-Sport banned-substance certification.",
    intro: "Tested, certified and fully transparent.",
    blocks: [
      {
        heading: "Informed-Sport tested",
        body: [
          "Sports nutrition carries a real risk of contamination with substances banned in sport. Informed-Sport tests products against a wide list of banned substances, giving athletes — including those who are drug-tested — confidence in what they're taking.",
        ],
      },
      {
        heading: "Manufactured to GMP standards",
        body: [
          "Our products are made by EU manufacturers operating to Good Manufacturing Practice (GMP) and HACCP food-safety standards.",
        ],
      },
      {
        heading: "Certificate of Analysis (COA)",
        body: [
          "Every batch is accompanied by a Certificate of Analysis covering composition, contaminants and microbiology. COAs are available on request and, where possible, published per batch.",
        ],
      },
      {
        body: [
          "Food supplements should not be used as a substitute for a varied, balanced diet and a healthy lifestyle.",
        ],
      },
    ],
  },
  {
    slug: "shipping-returns",
    title: "Shipping & Returns",
    description:
      "Next-day delivery across Ireland, free over €50. Read our shipping timelines and returns policy.",
    legal: true,
    blocks: [
      {
        heading: "Delivery",
        list: [
          "Free next-day delivery on orders over €50 within the Republic of Ireland.",
          "Flat €4.95 next-day delivery on orders under €50.",
          "Orders placed before [cut-off time] on business days are dispatched same day.",
          "Northern Ireland, UK and EU shipping options shown at checkout where available.",
        ],
      },
      {
        heading: "Returns",
        body: [
          "Under EU consumer law you have a 14-day right to withdraw from your order. For hygiene and safety reasons, this may not apply to supplements once the seal is opened — except where the product is faulty or not as described.",
          "To start a return, contact us at [returns email] with your order number. [Confirm exact policy wording with your solicitor before launch.]",
        ],
      },
    ],
  },
  {
    slug: "faq",
    title: "Frequently Asked Questions",
    description:
      "Answers on delivery, Informed-Sport testing, subscriptions and more.",
    blocks: [
      {
        heading: "How fast is delivery?",
        body: [
          "Most orders within the Republic of Ireland arrive next day. You'll receive tracking by email once your order ships.",
        ],
      },
      {
        heading: "What does Informed-Sport tested mean?",
        body: [
          "It means each batch is tested against a list of substances banned in sport, so you can train and compete with confidence. Learn more on our Quality & Testing page.",
        ],
      },
      {
        heading: "How does Subscribe & Save work?",
        body: [
          "Choose Subscribe & Save on any product to get 15% off and delivery on your schedule. You can skip, swap or cancel any time — there's no lock-in.",
        ],
      },
      {
        heading: "Will I be charged customs?",
        body: [
          "No. We ship from within Ireland, so there are no customs charges or import delays on domestic orders.",
        ],
      },
    ],
  },
  {
    slug: "contact",
    title: "Contact Us",
    description: "Get in touch with the Peppy team.",
    intro: "We're a small Irish team and we read every message.",
    blocks: [
      {
        heading: "Customer support",
        body: [
          "Email: [support@peppy.ie]",
          "We aim to reply within one business day.",
        ],
      },
      {
        heading: "Business & wholesale",
        body: [
          "For gym, club or wholesale enquiries, email [wholesale@peppy.ie].",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    description: "The terms governing your use of the Peppy website and purchases.",
    legal: true,
    blocks: [
      {
        body: [
          "These Terms & Conditions govern your use of [peppy.ie] and any purchase you make from us. By using the site you agree to these terms.",
        ],
      },
      {
        heading: "1. About us",
        body: [
          "[Company legal name], a company registered in Ireland (company no. [CRO number]), registered address [address]. VAT no. [VAT number].",
        ],
      },
      {
        heading: "2. Orders & pricing",
        body: [
          "All prices are in euro and include VAT where applicable. We reserve the right to correct errors and to refuse or cancel orders.",
        ],
      },
      {
        heading: "3. Consumer rights",
        body: [
          "Nothing in these terms affects your statutory rights as a consumer under Irish and EU law.",
        ],
      },
      {
        body: ["[This is a template. Have a solicitor complete and review it before launch.]"],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    description: "How Peppy collects, uses and protects your personal data under GDPR.",
    legal: true,
    blocks: [
      {
        body: [
          "[Company legal name] (\"we\") is the data controller for personal data collected through [peppy.ie]. We process your data in line with the GDPR and the Irish Data Protection Acts.",
        ],
      },
      {
        heading: "What we collect",
        list: [
          "Contact and delivery details you provide at checkout.",
          "Order history and payment confirmation (we do not store full card details).",
          "Marketing preferences, where you've opted in.",
          "Site analytics data, subject to your cookie choices.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You have the right to access, correct, delete and port your data, and to object to or restrict processing. Contact [privacy@peppy.ie] to exercise these rights or to complain to the Data Protection Commission.",
        ],
      },
      {
        body: ["[Template — complete and review with a data-protection specialist before launch.]"],
      },
    ],
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    description: "How and why Peppy uses cookies, and how to manage them.",
    legal: true,
    blocks: [
      {
        body: [
          "We use cookies to make the site work, remember your cart, and — with your consent — to measure traffic and improve your experience.",
        ],
      },
      {
        heading: "Managing cookies",
        body: [
          "You can accept or reject non-essential cookies via our consent banner and change your choice any time. Essential cookies (e.g. your cart) cannot be switched off.",
        ],
      },
      {
        body: ["[Template — align with your actual cookie/consent tooling before launch.]"],
      },
    ],
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    description: "Important information about Peppy products and content.",
    legal: true,
    blocks: [
      {
        body: [
          "Food supplements are intended to supplement the diet and should not be used as a substitute for a varied, balanced diet and a healthy lifestyle.",
          "Our products and content are not intended to diagnose, treat, cure or prevent any disease. If you are pregnant, breastfeeding, taking medication or have a medical condition, consult a healthcare professional before use.",
          "Information on this site is provided for general education and is not medical advice.",
        ],
      },
    ],
  },
]

export function getInfoPage(slug: string): InfoPage | undefined {
  return infoPages.find((p) => p.slug === slug)
}
