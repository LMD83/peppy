import Script from "next/script"

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

/**
 * GA4 with Google Consent Mode v2. Analytics storage defaults to *denied* until
 * the visitor accepts via the cookie banner, which calls gtag('consent','update').
 * Renders nothing unless NEXT_PUBLIC_GA_ID is set, so the build works without it.
 */
export function Analytics() {
  if (!GA_ID) return null

  return (
    <>
      <Script id="ga-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  )
}
