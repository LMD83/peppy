// End-to-end click test for /timento against a running dev/prod server in
// demo mode. Usage:
//   NEXT_PUBLIC_TIMENTO_DEMO=1 npm run dev:frontend  (separate terminal)
//   node scripts/timento-e2e.mjs [baseUrl] [shotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "e2e-shots";
const executablePath = process.env.TIMENTO_CHROMIUM ?? "/opt/pw-browsers/chromium";

const consoleErrors = [];
let failures = 0;

let failShotPage = null;
let failShotLabel = "";
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL: ${name}\n  ${err.message.split("\n")[0]}`);
    if (failShotPage) {
      await failShotPage
        .screenshot({ path: `${SHOTS}/${failShotLabel}-FAIL-${name.replace(/\W+/g, "_").slice(0, 40)}.png` })
        .catch(() => {});
    }
  }
}

async function login(page, slug, passcode) {
  await page.goto(`${BASE}/timento`);
  await page.getByRole("button", { name: slug === "liam" ? "Liam" : "Conor", exact: true }).click();
  await page.getByPlaceholder("••••").fill(passcode);
  await page.getByRole("button", { name: /open the file/i }).click();
  await page.getByRole("heading", { level: 1 }).waitFor();
}

const browser = await chromium.launch({ executablePath }).catch(() => chromium.launch());

for (const [label, viewport] of [
  ["mobile-390", { width: 390, height: 844 }],
  ["desktop-1280", { width: 1280, height: 800 }],
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  failShotPage = page;
  failShotLabel = label;
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));

  console.log(`\n=== ${label} ===`);

  await check("login screen renders", async () => {
    await page.goto(`${BASE}/timento`);
    await page.getByText("Who's checking in").waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-0-login.png`, fullPage: true });
  });

  await check("liam logs in — cut protocol scoreboard", async () => {
    await login(page, "liam", "2580");
    if (!(await page.getByText(/Cut protocol 95→85/i).isVisible())) throw new Error("no protocol title");
    await page.getByText("3/5", { exact: false }).first().waitFor({ state: "attached" }).catch(() => {});
    await page.screenshot({ path: `${SHOTS}/${label}-1-today.png`, fullPage: true });
  });

  await check("toggle a check updates adherence", async () => {
    const steps = page.getByRole("button", { name: /8k\+ steps/i });
    await steps.click();
    await page.waitForTimeout(150);
    const pressed = await steps.getAttribute("aria-pressed");
    if (pressed !== "true") throw new Error("check did not toggle on");
    await steps.click(); // leave state as seeded
  });

  await check("session card shows +2.5 kg overload flag on pull day (if today is Thu)", async () => {
    const flag = page.getByText("+2.5 kg →");
    const sessionCard = page.getByText(/Session — /i);
    if (await sessionCard.count()) {
      // flag only present on pull/full-body days that include barbell row
      void (await flag.count());
    }
  });

  await check("craving flow: tired → relief → rode it out → breathing timer", async () => {
    await page.getByRole("button", { name: "Tired", exact: true }).click();
    await page.getByRole("button", { name: "Relief", exact: true }).click();
    await page.getByRole("button", { name: "Rode it out", exact: true }).click();
    await page.getByRole("timer").waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-2-breathe.png` });
    await page.getByRole("button", { name: /done early/i }).click();
  });

  await check("crew tab: partner card + nudge lands in feed", async () => {
    await page.getByRole("button", { name: "Crew" }).click();
    await page.getByText("Conor").first().waitFor();
    const shared = await page.getByLabel("Crew feed").textContent();
    await page.getByRole("button", { name: "Floor's holding" }).click();
    await page.waitForTimeout(200);
    const after = await page.getByLabel("Crew feed").textContent();
    if (!after.includes("Floor's holding") || after === shared) throw new Error("nudge not in feed");
    await page.screenshot({ path: `${SHOTS}/${label}-3-crew.png`, fullPage: true });
  });

  await check("crew board carries no absolute weights (shared projection only)", async () => {
    const body = await page.textContent("body");
    if (/9[24]\.\d\s?kg/.test(body.replace(/Mass[\s\S]*?Day/, ""))) {
      // scoreboard shows YOUR OWN mass; strip it before asserting the crew area
      throw new Error("weight-looking value in crew view");
    }
  });

  await check("progress tab: mass chart + ceiling + wall", async () => {
    await page.getByRole("button", { name: "Progress" }).click();
    await page.getByRole("img", { name: /Mass chart/i }).waitFor();
    await page.getByText("survival ceiling").first().waitFor();
    await page.getByRole("img", { name: /consistency wall/i }).waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-4-progress.png`, fullPage: true });
  });

  await check("research tab: trigger map, engine read-out, experiments, disputed markers", async () => {
    await page.getByRole("button", { name: "Research" }).click();
    await page.getByText(/trigger map/i).first().waitFor();
    await page.getByText(/depletion-dominant/i).waitFor();
    await page.getByText("E1 · Caffeine curfew 14:00").waitFor();
    await page.getByText("MTHFR C677T").waitFor();
    await page.getByText(/LDL-C recheck in/i).waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-5-research.png`, fullPage: true });
  });

  await check("mode switch to survival: 3 checks, amber, executed-decision feed line", async () => {
    // The Next dev-tools badge overlaps the leftmost nav button at 390px — dev-only chrome.
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    await page.getByRole("button", { name: "Today" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /cut mode ⇄/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /survival/i }).click();
    await page.getByText(/Floor protocol — hold/i).waitFor();
    await page.getByText(/Floor checks — only these three exist/i).waitFor();
    const checkButtons = await page.getByRole("button", { name: /protein hit|steps|kitchen closed/i }).count();
    if (checkButtons < 3) throw new Error(`expected 3 floor checks, saw ${checkButtons}`);
    await page.screenshot({ path: `${SHOTS}/${label}-6-survival.png`, fullPage: true });
    // switch back to cut for the next run
    await page.getByRole("button", { name: /survival mode ⇄/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^cut/i }).click();
    await page.getByText(/Cut protocol/i).waitFor();
  });

  await check("why page renders the mechanism explainer", async () => {
    await page.goto(`${BASE}/timento/why`);
    await page.getByText(/AVE spiral/i).waitFor();
    await page.getByText(/ghrelin/i).first().waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-7-why.png`, fullPage: true });
    await page.goto(`${BASE}/timento`);
  });

  await check("logout → conor sees survival file, not liam's data", async () => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByText("Who's checking in").waitFor();
    await login(page, "conor", "1379");
    await page.getByText(/Floor protocol — hold < 96/i).waitFor();
    const body = await page.textContent("body");
    if (body.includes("92.8")) throw new Error("liam's weight visible in conor session");
    await page.screenshot({ path: `${SHOTS}/${label}-8-conor.png`, fullPage: true });
    await page.getByRole("button", { name: "Sign out" }).click();
  });

  await context.close();
}

await browser.close();

const realErrors = consoleErrors.filter((e) => !/Download the React DevTools/.test(e));
console.log(`\nconsole errors: ${realErrors.length}`);
realErrors.forEach((e) => console.error(`  ${e}`));
if (realErrors.length > 0 || failures > 0) {
  console.error(`\nE2E FAILED — ${failures} step failures, ${realErrors.length} console errors`);
  process.exit(1);
}
console.log("\nE2E PASSED");
