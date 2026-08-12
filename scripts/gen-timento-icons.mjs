// Generates public/timento/icon-192.png and icon-512.png from an inline SVG.
// Usage: node scripts/gen-timento-icons.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const svg = (size) => `<!doctype html><meta charset="utf-8">
<body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#15171c"/>
  <rect x="12" y="40" width="8" height="12" fill="#2b5fab"/>
  <rect x="24" y="32" width="8" height="20" fill="#2e7d4f"/>
  <rect x="36" y="24" width="8" height="28" fill="#c7373f"/>
  <rect x="48" y="34" width="4" height="18" fill="#b8860b"/>
  <path d="M10 22 L26 16 L40 20 L54 12" stroke="#fafaf8" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg></body>`;

const executablePath = process.env.TIMENTO_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ executablePath }).catch(() => chromium.launch());
await mkdir("public/timento", { recursive: true });
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(svg(size));
  await page.screenshot({ path: `public/timento/icon-${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
console.log("icons written");
