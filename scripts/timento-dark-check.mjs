// Dark-scheme spot check, against a running server in demo mode.
// The a11y sweep (timento-a11y.mjs) walks every screen in the light scheme;
// this renders the key screens with prefers-color-scheme: dark, runs the same
// axe ruleset on each, and saves screenshots for a visual pass. Usage:
//   NEXT_PUBLIC_TIMENTO_DEMO=1 npm run dev:frontend  (separate terminal)
//   node scripts/timento-dark-check.mjs [baseUrl] [shotDir]
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "dark-shots";
const executablePath = process.env.TIMENTO_CHROMIUM ?? "/opt/pw-browsers/chromium";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath }).catch(() => chromium.launch());
const context = await browser.newContext({
  colorScheme: "dark",
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
let failures = 0;

async function audit(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const real = res.violations.filter((v) => v.id !== "meta-viewport");
  if (real.length) {
    failures += real.length;
    for (const v of real) {
      console.error(`FAIL dark/${name}: ${v.id} (${v.impact}) × ${v.nodes.length}`);
      for (const n of v.nodes.slice(0, 3)) console.error(`    ${n.target.join(" ")}`);
    }
  } else {
    console.log(`  ok dark/${name}`);
  }
}

await page.goto(`${BASE}/`);
await page.getByRole("button", { name: "Liam", exact: true }).waitFor();
await audit("login");

await page.getByRole("button", { name: "Liam", exact: true }).click();
await page.getByPlaceholder("••••").fill("2580");
await page.getByRole("button", { name: /open the file/i }).click();
await page.getByRole("heading", { level: 1 }).waitFor();
await page.waitForTimeout(400);
await audit("today");

// The mode switcher lives in the board header — dark-on-dark territory.
await page.getByRole("button", { name: /mode ⇄/i }).click();
await page.waitForTimeout(200);
await audit("mode-switcher");
await page.getByRole("button", { name: /^keep /i }).click();

// A sheet, for the scrim and panel pairing.
await page.getByRole("button", { name: "File menu" }).click();
await page.waitForTimeout(200);
await audit("file-sheet");
await page.getByRole("button", { name: "Close", exact: true }).click();

// The prototype parked at /peppy shares the tokens now.
await page.goto(`${BASE}/peppy`);
await page.getByRole("heading", { level: 1 }).waitFor();
await audit("peppy-foundation");

await browser.close();
if (failures) {
  console.error(`\n${failures} dark-scheme axe violations`);
  process.exit(1);
}
console.log("\ndark scheme clean");
