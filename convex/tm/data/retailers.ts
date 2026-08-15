/**
 * Irish grocery retailers, and an honest account of what a hand-off can do.
 *
 * THE CEILING, STATED ONCE SO NOBODY HAS TO REDISCOVER IT
 * ------------------------------------------------------
 * No Irish supermarket publishes an ordering API. Tesco Ireland, SuperValu,
 * Dunnes, Lidl and Aldi all have no public endpoint that accepts a basket, and
 * Instacart — which does exactly this in North America — does not operate in
 * Ireland at all. There is therefore no legitimate way for this app to place a
 * grocery order on anyone's behalf. Driving a retailer's own website with a
 * headless browser would be a bot wearing a costume, it breaches their terms,
 * and it breaks the first time they move a button.
 *
 * So Timento stops at the hand-off. It does the part nobody else does — work
 * out what the plan actually needs, subtract the cupboard, round to packs you
 * can really buy, and order it the way the shop is laid out — and then opens
 * the retailer's own site with the item name in their search box. The person
 * picks the pack and completes the order. That is the whole promise, and it is
 * the same promise on the shelf-edge as on the screen.
 *
 * THE SEAM
 * --------
 * `RetailerDriver` is the swap point. The day a grocer publishes a real
 * ordering endpoint, that retailer gets `mode: "api"` and a driver that speaks
 * it, and nothing upstream of here changes: the list, the pack maths, the aisle
 * order and the substitutions are all retailer-agnostic by construction.
 *
 * `mode` says what the driver really does, never what we wish it did:
 *   search-handoff — we can prefill their own search with one item name.
 *   deep-link      — we can only open their site; their catalogue is per store
 *                    or there is no online catalogue at all.
 *   api            — a published ordering endpoint. Nobody here has one yet.
 *
 * Static config, not user data — no row here belongs to anybody.
 */

export type RetailerMode = "search-handoff" | "deep-link" | "api";

export type RetailerDriver = {
  key: string;
  name: string;
  mode: RetailerMode;
  /**
   * A public search URL with `{q}` where the query goes, or `null` when the
   * retailer has no addressable search we can honestly prefill. Never invented:
   * a `null` here is the truthful answer, not a gap waiting to be filled in.
   */
  searchUrlTemplate: string | null;
  /** Where the tap actually lands. `term` is ignored by deep-link drivers. */
  buildUrl: (term: string) => string;
  /** What the hand-off does, in the words the button should be read with. */
  note: string;
  /** True when the retailer sells groceries online in Ireland at all. */
  onlineOrdering: boolean;
};

/** The one sentence the UI must never drop. */
export const HANDOFF_NOTE =
  "No Irish supermarket lets an app place a grocery order, so Timento does not pretend to. It builds the list and opens the shop's own search — you pick the packs and complete the order yourself.";

function template(url: string, term: string): string {
  return url.replace("{q}", encodeURIComponent(term.trim()));
}

/**
 * Tesco Ireland is the only one of the five with a public, store-agnostic
 * grocery search we can address. That is why it is first, and it is the only
 * retailer here that gets `search-handoff`.
 */
const TESCO_IE_SEARCH = "https://www.tesco.ie/groceries/en-IE/search?query={q}";

export const RETAILERS: RetailerDriver[] = [
  {
    key: "tesco_ie",
    name: "Tesco Ireland",
    mode: "search-handoff",
    searchUrlTemplate: TESCO_IE_SEARCH,
    buildUrl: (term) => template(TESCO_IE_SEARCH, term),
    note: "Opens Tesco's own grocery search with the item name already typed. You choose the pack and finish the order on their site — nothing is added to a basket for you.",
    onlineOrdering: true,
  },
  {
    key: "supervalu_ie",
    name: "SuperValu",
    mode: "deep-link",
    searchUrlTemplate: null,
    buildUrl: () => "https://shop.supervalu.ie/",
    note: "Opens SuperValu's grocery site. Their catalogue is per store, so you pick your shop first — we cannot search on your behalf until you have.",
    onlineOrdering: true,
  },
  {
    key: "dunnes_ie",
    name: "Dunnes Stores",
    mode: "deep-link",
    searchUrlTemplate: null,
    buildUrl: () => "https://www.dunnesstores.com/",
    note: "Opens Dunnes' site. Grocery delivery is store-by-store here too, so the list travels with you rather than into a basket.",
    onlineOrdering: true,
  },
  {
    key: "lidl_ie",
    name: "Lidl Ireland",
    mode: "deep-link",
    searchUrlTemplate: null,
    buildUrl: () => "https://www.lidl.ie/",
    note: "Lidl does not sell groceries online in Ireland. This is a list to walk in with — which is exactly why it is ordered by aisle.",
    onlineOrdering: false,
  },
  {
    key: "aldi_ie",
    name: "Aldi Ireland",
    mode: "deep-link",
    searchUrlTemplate: null,
    buildUrl: () => "https://www.aldi.ie/",
    note: "Aldi does not sell groceries online in Ireland. Take the list in with you; the aisle order saves the laps.",
    onlineOrdering: false,
  },
];

/**
 * The serialisable half of a driver. Convex cannot return a function, so the
 * query returns these and the client resolves the driver by key.
 */
export type RetailerDescriptor = Omit<RetailerDriver, "buildUrl">;

export function retailerDescriptors(): RetailerDescriptor[] {
  return RETAILERS.map(({ buildUrl: _buildUrl, ...rest }) => rest);
}

export function retailerDriver(key: string): RetailerDriver | undefined {
  return RETAILERS.find((r) => r.key === key);
}

/** What the button should say, so no label ever over-promises. */
export function handoffLabel(r: Pick<RetailerDescriptor, "name" | "mode">): string {
  return r.mode === "search-handoff"
    ? `Opens ${r.name}'s search — you complete the order`
    : `Opens ${r.name} — you complete the order`;
}

/** The URL for one item, or null when the driver cannot address a search. */
export function searchUrlFor(key: string, term: string): string | null {
  const driver = retailerDriver(key);
  if (!driver) return null;
  return driver.buildUrl(term);
}
