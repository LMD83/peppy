// The /learn content engine. This first batch implements quick-win articles
// from docs/launch-plan/04-CONTENT-STRATEGY-50-ARTICLES.md. Remaining articles
// follow the same shape — add entries to `articles` to publish them.
//
// Compliance: only authorised-style nutrition/health claims, attributed and
// hedged; no disease claims. See docs/launch-plan/06-REGULATORY-COMPLIANCE.md.

export interface ArticleSection {
  heading: string
  paragraphs: string[]
  list?: string[]
}

export interface Faq {
  q: string
  a: string
}

export interface Article {
  slug: string
  title: string
  metaTitle: string
  description: string
  cluster: string
  keyword: string
  author: { name: string; role: string }
  reviewer: { name: string; role: string }
  datePublished: string
  readingMinutes: number
  excerpt: string
  intro: string[]
  sections: ArticleSection[]
  takeaways: string[]
  faqs: Faq[]
  /** Primary internal link to a money page */
  cta: { label: string; href: string }
  /** Related article slugs */
  related: string[]
}

const REVIEWER = {
  name: "Dr. Saoirse Nolan",
  role: "Registered Dietitian (CORU)",
}

export const articles: Article[] = [
  {
    slug: "whey-vs-vegan-protein",
    title: "Whey vs Vegan Protein: Which Is Right for You?",
    metaTitle: "Whey vs Vegan Protein: Which Is Right for You? (Ireland)",
    description:
      "Whey or vegan protein? Compare protein quality, digestibility, taste and price per serving to choose the right powder for your goals.",
    cluster: "Protein",
    keyword: "whey vs vegan protein",
    author: { name: "Peppy Nutrition Team", role: "Sports Nutrition" },
    reviewer: REVIEWER,
    datePublished: "2026-05-02",
    readingMinutes: 6,
    excerpt:
      "Both build a solid protein routine. The right choice comes down to dietary needs, digestion, taste and value — here's how they compare.",
    intro: [
      "Whey and plant-based proteins are the two most popular ways to top up your daily protein. Both can support an active lifestyle — the best one for you depends on your diet, how your stomach handles them, and what you enjoy drinking every day.",
      "Here's a practical, no-hype comparison to help you decide.",
    ],
    sections: [
      {
        heading: "Protein quality",
        paragraphs: [
          "Whey is a complete protein with all nine essential amino acids and is naturally high in leucine, the amino acid most associated with the muscle-building response to training. It's also digested quickly.",
          "Modern vegan blends — typically pea and rice protein combined — are also complete and provide a strong amino acid profile. Pairing sources is the key: pea and rice together cover each other's gaps well.",
        ],
      },
      {
        heading: "Digestion and dietary needs",
        paragraphs: [
          "If you're dairy-free, lactose-intolerant or follow a plant-based diet, vegan protein is the obvious pick. Some people also find plant proteins lighter on the stomach.",
          "Whey isolate is very low in lactose and suits most people who tolerate dairy. If whey concentrate bothers you, an isolate or a plant option is worth trying.",
        ],
      },
      {
        heading: "Taste and texture",
        paragraphs: [
          "Whey tends to be smoother and mixes thinly with water. Plant proteins have improved enormously and our blends mix cleanly, though they're naturally a little thicker — many people prefer them with plant milk.",
        ],
      },
      {
        heading: "Price per serving",
        paragraphs: [
          "Rather than comparing tub prices, compare price per serving and per gram of protein. We show price per serving on every product so you can judge value at a glance.",
        ],
      },
    ],
    takeaways: [
      "Both whey and quality vegan blends are complete proteins that support an active diet.",
      "Choose vegan if you're dairy-free or prefer plant-based; choose whey for a fast-digesting, naturally high-leucine option.",
      "Compare price per serving, not tub price.",
      "The best protein is the one you'll actually enjoy and take consistently.",
    ],
    faqs: [
      {
        q: "Is whey or vegan protein better for building muscle?",
        a: "Both can support muscle maintenance and growth alongside resistance training and adequate total daily protein. Whey is naturally higher in leucine, but a good pea-rice vegan blend closes much of the gap.",
      },
      {
        q: "Does vegan protein taste chalky?",
        a: "Older plant proteins had a reputation for it, but modern blends are much smoother. Ours are formulated to mix cleanly, especially with plant milk.",
      },
    ],
    cta: { label: "Shop protein", href: "/collections/protein" },
    related: ["best-time-to-take-protein", "is-protein-powder-safe"],
  },
  {
    slug: "how-to-take-creatine",
    title: "How to Take Creatine: Loading vs Maintenance",
    metaTitle: "How to Take Creatine: Loading vs Maintenance (Simple Guide)",
    description:
      "Should you load creatine or just take 5g a day? A simple, evidence-based guide to dosing creatine monohydrate, timing and what to expect.",
    cluster: "Creatine",
    keyword: "how to take creatine",
    author: { name: "Peppy Nutrition Team", role: "Sports Nutrition" },
    reviewer: REVIEWER,
    datePublished: "2026-05-09",
    readingMinutes: 5,
    excerpt:
      "Loading isn't required. Here's how creatine dosing actually works, and the simplest routine that gets you there.",
    intro: [
      "Creatine monohydrate is one of the most researched supplements in sport. The good news: using it is simple, and you don't need a complicated protocol.",
    ],
    sections: [
      {
        heading: "The two approaches",
        paragraphs: [
          "Loading means taking around 20g per day (split into four 5g doses) for 5–7 days to fill your muscle creatine stores faster, then dropping to a maintenance dose.",
          "Maintenance only means skipping the loading phase and simply taking around 5g per day. Your stores fill up over about three to four weeks instead of one.",
        ],
      },
      {
        heading: "Which should you choose?",
        paragraphs: [
          "If you want the effects as quickly as possible, loading gets you there faster. If you'd rather keep it simple and avoid any stomach discomfort from larger doses, a steady 5g per day works just as well in the end.",
          "Either way you arrive at the same destination — full creatine stores. The only difference is how fast.",
        ],
      },
      {
        heading: "Timing and consistency",
        paragraphs: [
          "Daily consistency matters far more than timing. Take your 5g whenever it's convenient — in a shake, with water or juice. Creatine is increased physical performance in successive bursts of short-term, high-intensity exercise, so taking it every day keeps your stores topped up.",
        ],
      },
    ],
    takeaways: [
      "Loading (20g/day for a week) fills stores faster; 5g/day gets you there in 3–4 weeks.",
      "Both end up at the same place — pick based on patience and tolerance.",
      "Daily consistency beats precise timing.",
      "Creatine monohydrate is the most studied, best-value form.",
    ],
    faqs: [
      {
        q: "Do I need to cycle creatine?",
        a: "There's no established need to cycle creatine monohydrate. A consistent daily dose keeps your stores topped up.",
      },
      {
        q: "Should I take creatine on rest days?",
        a: "Yes — keep taking your daily dose on rest days to maintain your creatine stores.",
      },
    ],
    cta: { label: "Shop creatine", href: "/collections/creatine" },
    related: ["best-supplements-for-beginners", "bcaa-vs-eaa"],
  },
  {
    slug: "best-time-to-take-protein",
    title: "When Is the Best Time to Take Protein?",
    metaTitle: "When Is the Best Time to Take Protein? (What Matters Most)",
    description:
      "Is the post-workout 'anabolic window' real? Learn when to take protein and why your total daily intake matters more than timing.",
    cluster: "Protein",
    keyword: "best time to take protein",
    author: { name: "Peppy Nutrition Team", role: "Sports Nutrition" },
    reviewer: REVIEWER,
    datePublished: "2026-05-16",
    readingMinutes: 5,
    excerpt:
      "The post-workout window is wider than the old advice suggested. Here's what actually moves the needle.",
    intro: [
      "You've probably heard you need protein within 30 minutes of training or you'll 'miss the window'. The reality is more relaxed — and more forgiving.",
    ],
    sections: [
      {
        heading: "Total daily protein comes first",
        paragraphs: [
          "The single most important factor is hitting your total protein for the day, spread across your meals. Get that right and the exact minute you drink a shake matters very little.",
        ],
      },
      {
        heading: "The 'anabolic window' is wider than you think",
        paragraphs: [
          "Research suggests the window to benefit from post-training protein spans a few hours, not 30 minutes. If you ate a protein-containing meal before training, you're already covered for a while afterwards.",
        ],
      },
      {
        heading: "Practical timing that works",
        paragraphs: [
          "Aim for a protein source every few hours across the day. A shake is a convenient way to hit a target around training or to top up between meals — use it where it makes your day easier, not because of a strict deadline.",
        ],
      },
    ],
    takeaways: [
      "Total daily protein matters most — distribute it across meals.",
      "The post-workout window is hours, not minutes.",
      "Use shakes for convenience, not to beat a deadline.",
    ],
    faqs: [
      {
        q: "Should I drink protein before or after a workout?",
        a: "Either works. If you trained fasted, a shake afterwards is handy; if you ate beforehand, there's no rush. Prioritise your daily total.",
      },
      {
        q: "Can I take protein before bed?",
        a: "Yes — a slower-digesting protein before bed is a fine way to add to your daily total if it suits your schedule.",
      },
    ],
    cta: { label: "Shop protein", href: "/collections/protein" },
    related: ["whey-vs-vegan-protein", "is-protein-powder-safe"],
  },
  {
    slug: "is-protein-powder-safe",
    title: "Is Protein Powder Safe? Common Myths Debunked",
    metaTitle: "Is Protein Powder Safe? Myths Debunked (Honest Guide)",
    description:
      "Is protein powder bad for your kidneys? Does it damage your liver? We address the common myths and explain what quality testing means.",
    cluster: "Protein",
    keyword: "is protein powder safe",
    author: { name: "Peppy Nutrition Team", role: "Sports Nutrition" },
    reviewer: REVIEWER,
    datePublished: "2026-05-23",
    readingMinutes: 6,
    excerpt:
      "Protein powder is just a convenient food. Here's a calm look at the common worries — and what to check before you buy.",
    intro: [
      "Protein powder often gets treated as something exotic or risky. In reality it's a convenient, concentrated food. Let's address the worries people actually have.",
    ],
    sections: [
      {
        heading: "Myth: protein powder damages your kidneys",
        paragraphs: [
          "For healthy people, higher-protein diets have not been shown to harm kidney function. If you have an existing kidney condition, speak to your doctor about your protein intake — that's sensible advice for any food, not just powder.",
        ],
      },
      {
        heading: "Myth: it's full of 'chemicals'",
        paragraphs: [
          "A good protein powder is mostly just protein, with flavouring and a sweetener. Transparency is the thing to look for: full supplement facts and a clear ingredients list. We publish both on every product.",
        ],
      },
      {
        heading: "What actually matters: testing and quality",
        paragraphs: [
          "The real safety question for athletes is contamination with banned substances. That's why Informed-Sport testing matters — it checks each batch against a list of substances banned in sport. We also keep a Certificate of Analysis for every batch.",
        ],
      },
    ],
    takeaways: [
      "For healthy people, protein powder is a safe, convenient food.",
      "Look for transparent labels and full supplement facts.",
      "Informed-Sport testing is the meaningful quality signal for athletes.",
      "If you have a medical condition, check with your doctor — as with any food.",
    ],
    faqs: [
      {
        q: "Is it safe to have protein powder every day?",
        a: "For healthy adults, yes — it's just a protein source. Fit it into a varied, balanced diet rather than relying on it alone.",
      },
      {
        q: "How do I know a protein powder is good quality?",
        a: "Check for a transparent label, full supplement facts, and third-party testing such as Informed Sport. A Certificate of Analysis per batch is a strong sign.",
      },
    ],
    cta: { label: "See our quality testing", href: "/pages/quality" },
    related: ["whey-vs-vegan-protein", "best-time-to-take-protein"],
  },
  {
    slug: "bcaa-vs-eaa",
    title: "BCAAs vs EAAs: Do You Actually Need Them?",
    metaTitle: "BCAAs vs EAAs: Do You Actually Need Them? (Ireland)",
    description:
      "BCAAs or EAAs — or neither? Understand the difference and whether amino acid supplements are worth it if you already eat enough protein.",
    cluster: "Recovery",
    keyword: "bcaa vs eaa",
    author: { name: "Peppy Nutrition Team", role: "Sports Nutrition" },
    reviewer: REVIEWER,
    datePublished: "2026-05-30",
    readingMinutes: 5,
    excerpt:
      "EAAs are the more complete option, but if your protein intake is already high you may not need either. Here's the honest take.",
    intro: [
      "Amino acid supplements are popular, but they're also widely misunderstood. Let's clear up what BCAAs and EAAs are and whether they earn a place in your routine.",
    ],
    sections: [
      {
        heading: "The difference",
        paragraphs: [
          "BCAAs are three of the essential amino acids: leucine, isoleucine and valine. EAAs include all nine essential amino acids — the full set your body can't make on its own.",
          "Because building muscle protein requires all the essential amino acids, EAAs are the more complete choice of the two.",
        ],
      },
      {
        heading: "Do you need them?",
        paragraphs: [
          "If you already hit a good daily protein target from food and shakes, you're getting all your essential amino acids anyway — so a separate supplement adds little.",
          "Where EAAs can be handy: as a low-calorie, easy-to-sip option during long sessions, or if you struggle to eat enough protein around training.",
        ],
      },
    ],
    takeaways: [
      "EAAs contain all nine essential amino acids; BCAAs only three.",
      "If your daily protein is already high, you likely don't need either.",
      "EAAs can be a convenient intra-workout sip or a top-up when protein is hard to hit.",
    ],
    faqs: [
      {
        q: "Are BCAAs a waste of money?",
        a: "If your overall protein intake is adequate, BCAAs add little because you're already getting them. EAAs are the more complete option if you want an amino acid drink.",
      },
      {
        q: "When would I use EAAs?",
        a: "As a light, low-calorie drink during longer training sessions, or to top up essential amino acids on days when hitting your protein target is difficult.",
      },
    ],
    cta: { label: "Shop recovery", href: "/collections/recovery" },
    related: ["how-to-take-creatine", "best-supplements-for-beginners"],
  },
  {
    slug: "best-supplements-for-beginners",
    title: "Supplements for Beginners: What You Actually Need",
    metaTitle: "Supplements for Beginners: What You Actually Need (Ireland)",
    description:
      "New to the gym? Skip the hype. Here are the few supplements that are actually worth it for beginners — and what to ignore.",
    cluster: "Beginners",
    keyword: "supplements for beginners",
    author: { name: "Peppy Nutrition Team", role: "Sports Nutrition" },
    reviewer: REVIEWER,
    datePublished: "2026-06-06",
    readingMinutes: 6,
    excerpt:
      "You need far less than the supplement aisle suggests. Here's a short, honest starter list.",
    intro: [
      "The supplement world can feel overwhelming when you're starting out. The truth is that most people only need a couple of well-chosen basics — the rest is optional at best.",
    ],
    sections: [
      {
        heading: "Start with the basics that earn their place",
        paragraphs: [
          "Two supplements have the strongest evidence and the best value for most beginners: a quality protein powder to help hit your daily protein, and creatine monohydrate to support high-intensity training.",
        ],
        list: [
          "Protein powder — convenient way to reach your daily protein target.",
          "Creatine monohydrate — well-researched, inexpensive, supports short, high-intensity efforts.",
        ],
      },
      {
        heading: "Nice-to-haves, not essentials",
        paragraphs: [
          "Electrolytes can help on hot or long sessions, and an EAA drink is a convenient sip for some. These are situational rather than must-haves.",
        ],
      },
      {
        heading: "What to skip at the start",
        paragraphs: [
          "Most fat burners, exotic blends and 'proprietary formula' products aren't worth your money as a beginner. Get your training, sleep and overall diet consistent first — that's where the real progress is.",
        ],
      },
    ],
    takeaways: [
      "For most beginners, protein and creatine are the two basics worth buying.",
      "Electrolytes and EAAs are situational extras.",
      "Skip fat burners and proprietary blends early on.",
      "Consistency in training, sleep and diet beats any supplement.",
    ],
    faqs: [
      {
        q: "What supplements should a gym beginner take?",
        a: "A quality protein powder and creatine monohydrate cover most beginners' needs. Add electrolytes if you train long or in heat.",
      },
      {
        q: "Do I need pre-workout as a beginner?",
        a: "No — it's optional. A coffee or simply training when you're rested works fine. Try it later if you want a focus boost for tougher sessions.",
      },
    ],
    cta: { label: "Shop starter bundles", href: "/collections/bundles" },
    related: ["how-to-take-creatine", "bcaa-vs-eaa"],
  },
]

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug)
}

export function allArticles(): Article[] {
  return [...articles].sort((a, b) =>
    a.datePublished < b.datePublished ? 1 : -1
  )
}
