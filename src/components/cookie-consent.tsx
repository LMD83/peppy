"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "peppy-consent-v1"

type Consent = "granted" | "denied"

function updateConsent(value: Consent) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: value,
    })
  }
}

export function CookieConsent() {
  // Start hidden so SSR and first client render match; the effect reveals the
  // banner only when no choice has been stored yet.
  const [decided, setDecided] = useState(true)

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch {
      // storage unavailable; treat as undecided
    }
    if (stored === "granted") updateConsent("granted")
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing UI to a stored consent choice on mount
    setDecided(stored !== null)
  }, [])

  function choose(value: Consent) {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // ignore storage failures
    }
    updateConsent(value)
    setDecided(true)
  }

  if (decided) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use essential cookies to run the site and, with your consent,
          analytics cookies to improve it. See our{" "}
          <Link
            href="/pages/cookie-policy"
            className="font-medium text-foreground underline underline-offset-2"
          >
            cookie policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("denied")}>
            Reject non-essential
          </Button>
          <Button size="sm" onClick={() => choose("granted")}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  )
}
