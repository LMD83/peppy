/* The chosen supermarket, kept for good.
 *
 * Same localStorage-through-useSyncExternalStore pattern as the shopping
 * ticks, but with no date on it: which supermarket you use is not a fact about
 * today. It lives in its own module because two screens now write it — the
 * Shopping chooser and the setup wizard — and a preference with two authors
 * cannot live inside either one.
 */

const RETAILER_KEY = "tm.shop.retailer";

const retailerListeners = new Set<() => void>();

export function readRetailer(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(RETAILER_KEY);
  } catch {
    return null;
  }
}

export function writeRetailer(key: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (key === null) window.localStorage.removeItem(RETAILER_KEY);
    else window.localStorage.setItem(RETAILER_KEY, key);
  } catch {
    // A blocked store forgets the choice, never the list.
  }
  for (const listener of retailerListeners) listener();
}

export function subscribeRetailer(onChange: () => void): () => void {
  retailerListeners.add(onChange);
  if (typeof window !== "undefined") window.addEventListener("storage", onChange);
  return () => {
    retailerListeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
  };
}
