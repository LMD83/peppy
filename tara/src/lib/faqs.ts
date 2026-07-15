// FAQ content — the July 2026 update's FAQ accordion, ported verbatim from
// the design reference (design-reference/TARA Website.dc.html, `FAQS`).

export interface Faq {
  q: string;
  a: string;
}

export const faqs: Faq[] = [
  {
    q: "How does batch verification work?",
    a: "Every vial carries a unique QR code and verification ID. Scan it or enter it in the Verify field at the top of any page to pull up that exact batch's Certificate of Analysis, purity, test method and first-scan date — no login, no PDF hunting. The invoice you receive also lists a verify ID per line, so the paperwork itself proves authenticity.",
  },
  {
    q: "Are these products for human use?",
    a: "No. All materials are supplied strictly for laboratory and in-vitro research use only, and are not for human or veterinary use. By ordering you confirm you are a qualified researcher purchasing in that capacity.",
  },
  {
    q: "How are payments handled?",
    a: "Card and wallet payments are processed securely through SumUp. Card details are encrypted and never stored on our servers. Prices shown are final and VAT-inclusive — what you see is what you pay.",
  },
  {
    q: "What are your shipping options to Ireland and the EU?",
    a: "Orders dispatch within 24 hours of batch confirmation, tracked, with cold-chain handling where a compound requires it. Shipping is a flat €9.95, and free on orders over €150.",
  },
  {
    q: "How should I store and reconstitute the peptides?",
    a: "Lyophilised vials are shipped stable at room temperature but should be refrigerated on arrival and, once reconstituted with bacteriostatic water, kept refrigerated. Use the reconstitution calculator to work out the exact draw on a U-100 syringe.",
  },
  {
    q: "How do your discounts work?",
    a: "Volume savings are automatic — 2 vials take 5% off your order and 3 or more take 10%, applied at checkout with nothing to enter. First-time researchers can instead use code TARA15 for 15% off; we apply whichever saving is larger rather than stacking them. Free shipping applies to every order over €150.",
  },
];
