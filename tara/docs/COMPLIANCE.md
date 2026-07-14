# Compliance framing — read before writing copy

TARA sells research peptides. Through 2026 the FDA has been explicit that a
"for research use only" label does not shield a seller once a product is
*marketed* for human use — and the FDA opened new enforcement actions against
several peptide sellers in Q1 2026 on exactly that basis. Payment processors
(Stripe, PayPal, Square) have also been de-platforming vendors in this
category. See the strategy brief from this session for full sourcing.

This isn't a reason to soften the product's functionality — the
reconstitution calculator and the (future) protocol/reminder features are the
site's most distinctive tools. The decision made for this build: **keep the
functionality, soften the vocabulary.** Two rules:

1. **Amount, not dose.** The calculator computes a solution concentration and
   a syringe draw — arithmetic, not a personal recommendation. "U-100
   syringe," "units," "draw," "mL," "mg," "concentration" are fine (they're
   neutral lab-measurement terms). Avoid "your dose," "how much to inject,"
   explicit routes of administration ("subcutaneous"), and "take X per day."

   | Spec / design-reference term | Site vocabulary |
   |---|---|
   | dose / target dose | amount / amount per draw |
   | doses per vial | draws per vial |
   | next dose | next scheduled measurement / next protocol window |
   | log dose | add to session log / log entry |
   | dose window | scheduled window |
   | injection site | (avoid — if site-rotation tracking is built, call it "sample site" or "location," not "injection site") |
   | protocol, session log, reconstitution schedule | unchanged — already neutral |

2. **No aesthetic, anti-aging, or therapeutic claims.** No "get shredded,"
   "reverse aging," "boost testosterone." Compound summaries describe what's
   being *studied*, not what a compound *does for you*.

Every product page and the site footer state plainly that products are for
laboratory and research use only, are not for human or veterinary use, and
are not drugs, dietary supplements, or cosmetics. Checkout requires an
explicit research-use declaration before payment (see `src/app/checkout/page.tsx`).

**Not yet built**, and gated on this vocabulary before they are: the
companion-app-style features from `design-reference/Roadmap & Automations.md`
— next-dose reminders, "log dose," dose-window notifications, injection-site
tracking. Build them as *scheduled research measurements* and *protocol
logs*, not a personal dosing tracker, using the table above.

Get category-specific legal review before scaling paid acquisition or before
any copy strays from these rules.
