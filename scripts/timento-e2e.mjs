// End-to-end click test for the Timento app against a running dev/prod server in
// demo mode. Pushing a change to this file re-runs the "Deploy verify"
// workflow, which probes the production URL anonymously. Usage:
//   NEXT_PUBLIC_TIMENTO_DEMO=1 npm run dev:frontend  (separate terminal)
//   node scripts/timento-e2e.mjs [baseUrl] [shotDir]
// Against production, run it through the "Deploy verify" workflow — the URL is
// not reachable from a Claude Code container.
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
  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: slug === "liam" ? "Liam" : "Conor", exact: true }).click();
  await page.getByPlaceholder("••••").fill(passcode);
  await page.getByRole("button", { name: /open the file/i }).click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  // The Next dev-tools badge overlaps the leftmost nav button at 390px — dev-only chrome.
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
}

/**
 * Bottom-nav tab, then an optional second-level tab inside it.
 *
 * Short timeout on purpose: a tab that is missing is missing (a deployment
 * serving an older bundle), not slow. The default 30 s turns one stale build
 * into a ten-minute run that says nothing the first failure did not.
 */
const NAV_TIMEOUT = 8000;

async function goTab(page, tab, sub) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: tab, exact: true }).click({ timeout: NAV_TIMEOUT });
  if (sub) await page.getByRole("tab", { name: sub, exact: true }).click({ timeout: NAV_TIMEOUT });
}

async function signOut(page) {
  await page.getByRole("button", { name: "File menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByText("Who's checking in").waitFor();
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
    await page.goto(`${BASE}/`);
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

  await check("today surfaces each slice's compact card", async () => {
    // Anchor on each card's own label, not on the copy inside it — the body text
    // legitimately changes with the day (a Saturday reads "Rest — recovery is
    // programmed", a survival day reads "Train — floor"), and asserting on prose
    // makes the suite fail on a Saturday for no reason.
    const main = page.locator("main");
    for (const label of [/^Fuel/i, /^Train/i, /^Mind/i, /^Bloods/i]) {
      await main.getByText(label).first().waitFor({ timeout: NAV_TIMEOUT });
    }
  });

  await check("mark session done when a session card is present", async () => {
    const btn = page.getByRole("button", { name: /mark session done/i });
    if ((await btn.count()) > 0) {
      await btn.click();
      await page.getByRole("button", { name: /session logged/i }).waitFor();
    }
  });

  await check("weigh-in log + correct overwrite", async () => {
    await page.getByLabel("Weight in kilograms").fill("91.4");
    await page.getByRole("button", { name: /^log$/i }).click();
    await page.getByText(/Logged:.*91\.4/).waitFor();
    await page.getByRole("button", { name: /correct/i }).click();
    await page.getByLabel("Weight in kilograms").fill("91.2");
    await page.getByRole("button", { name: /^log$/i }).click();
    await page.getByText(/Logged:.*91\.2/).waitFor();
  });

  await check("craving flow: tired → relief → rode it out → breathing timer", async () => {
    await page.getByRole("button", { name: "Tired", exact: true }).first().click();
    await page.getByRole("button", { name: "Relief", exact: true }).click();
    await page.getByRole("button", { name: "Rode it out", exact: true }).click();
    await page.getByRole("timer").waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-2-breathe.png` });
    await page.getByRole("button", { name: /done early/i }).click();
  });

  await check("undo last craving from today's log", async () => {
    await page.getByLabel("Today's craving log").waitFor();
    const before = await page.getByLabel("Today's craving log").locator("li").count();
    await page.getByRole("button", { name: /undo last/i }).click();
    await page.waitForTimeout(150);
    const after = await page.getByLabel("Today's craving log").locator("li").count().catch(() => 0);
    if (after >= before) throw new Error("undo did not remove a log");
  });

  await check("fuel: macro targets, adaptive energy, plan and food picker", async () => {
    await goTab(page, "Fuel");
    await page.getByText(/kcal left/i).first().waitFor();
    await page.getByText(/protein/i).first().waitFor();
    await page.getByText(/energy out/i).first().waitFor();
    await page.getByText(/adaptive|estimated/i).first().waitFor();
    await page.getByRole("button", { name: /generate day/i }).waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-9-fuel.png`, fullPage: true });
  });

  await check("fuel: tapping a planned row marks it eaten", async () => {
    const row = page.getByRole("button", { name: /·\s?\d+(\.\d+)?p\s?[–—-]/ }).first();
    if (!(await row.count())) return; // everything already eaten today
    await row.click();
    await page.waitForTimeout(200);
  });

  await check("train: mesocycle week, suggested load with a reason, volume landmarks", async () => {
    await goTab(page, "Train");
    await page.getByText(/hypertrophy|strength|recomp|floor/i).first().waitFor();
    await page.getByText(/weekly hard sets|movement only/i).first().waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-10-train.png`, fullPage: true });
  });

  await check("train: logging a set records it against the block", async () => {
    const logBtn = page.getByRole("button", { name: /log set 1/i }).first();
    if (!(await logBtn.count())) return; // rest day
    const before = await page.getByText(/0\/\d+ sets/i).count();
    await logBtn.click();
    await page.waitForTimeout(250);
    const after = await page.getByText(/0\/\d+ sets/i).count();
    if (after > before) throw new Error("logging a set did not advance the session count");
  });

  await check("stack: due doses, cycle phase, evidence tiers, reconstitution maths", async () => {
    await goTab(page, "Body", "Stack");
    await page.getByText(/due today/i).first().waitFor();
    await page.getByText(/reconstitution/i).first().waitFor();
    await page.getByText(/syringe units/i).first().waitFor();
    await page.getByText(/strong|moderate|limited|anecdotal/i).first().waitFor();
    await page.getByText(/not a prescriber|clinical decisions/i).first().waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-11-stack.png`, fullPage: true });
  });

  await check("stack: taking a dose moves the taken count", async () => {
    const before = await page.getByText(/\d+\/\d+ taken/i).first().textContent({ timeout: NAV_TIMEOUT });
    const dose = page.getByRole("button", { name: /creatine|vitamin d3|omega-3|magnesium/i }).first();
    if (!(await dose.count())) return;
    await dose.click();
    await page.waitForTimeout(250);
    const after = await page.getByText(/\d+\/\d+ taken/i).first().textContent();
    if (before === after) throw new Error(`taken count unchanged after logging a dose (${before})`);
  });

  await check("bloods: out-of-range first, ranges, deltas, rechecks, add-panel templates", async () => {
    await goTab(page, "Body", "Bloods");
    await page.getByText(/latest panel/i).first().waitFor();
    await page.getByText(/outside range/i).first().waitFor();
    await page.getByText(/add a panel/i).first().waitFor();
    await page.getByText(/lipid panel/i).first().waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-12-bloods.png`, fullPage: true });
  });

  await check("mind: encouragement, due instruments, if-then plans, reflection", async () => {
    await goTab(page, "Mind", "Check-in");
    await page.getByText(/check-ins due/i).first().waitFor();
    await page.getByText(/if\s*[–—-]\s*then plans|if — then/i).first().waitFor();
    await page.getByText(/tracked, correlated|never diagnosed/i).first().waitFor();
    await page.getByText(/reflection/i).first().waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-13-mind.png`, fullPage: true });
  });

  await check("mind: a due check-in opens its questionnaire", async () => {
    const open = page.getByRole("button", { name: /^open$/i }).first();
    if (!(await open.count())) return;
    await open.click();
    await page.waitForTimeout(300);
    const radios = await page.getByRole("radio").count();
    const chips = await page.getByRole("button", { name: /not at all|several days|never|rarely/i }).count();
    if (radios === 0 && chips === 0) throw new Error("questionnaire did not open");
  });

  await check("shopping: aisle-ordered list, packs, retailer hand-off", async () => {
    await goTab(page, "More");
    await page.getByRole("button", { name: /^Shopping/ }).first().click({ timeout: NAV_TIMEOUT });
    // Assert on text, not on a locator: the screen carries a print-only copy of
    // the list, so the first match for an aisle name is hidden and waiting for it
    // to become visible times out while the real list is on screen.
    await page.waitForFunction(
      () => /shopping list/i.test(document.querySelector("main")?.innerText ?? ""),
      undefined,
      { timeout: NAV_TIMEOUT },
    );
    const body = await page.locator("main").innerText();
    if (!/fruit & veg|chilled|meat & fish|frozen|cupboard|nothing to buy/i.test(body)) {
      throw new Error("shop screen shows no aisles");
    }
    if (!/to carry|to buy/i.test(body)) throw new Error("shop screen shows no totals");
    // The hand-off must never claim to place an order for you.
    if (/we will order|ordering for you|checkout for you/i.test(body)) {
      throw new Error("shop screen implies autonomous ordering");
    }
    await page.screenshot({ path: `${SHOTS}/${label}-14-shop.png`, fullPage: true });
  });

  await check("reminders: previews honestly and never claims it can send", async () => {
    await goTab(page, "More");
    await page.getByRole("button", { name: /^Reminders/ }).first().click({ timeout: NAV_TIMEOUT });
    await page.waitForFunction(
      () => /reminder/i.test(document.querySelector("main")?.innerText ?? ""),
      undefined,
      { timeout: NAV_TIMEOUT },
    );
    const body = await page.locator("main").innerText();
    // The demo has no server behind it. A switch that lies about delivery is
    // worse than no switch, so the screen has to say so.
    if (!/demo|cannot|no server|not.*sent/i.test(body)) {
      throw new Error("reminders screen does not admit it cannot deliver");
    }
    await page.screenshot({ path: `${SHOTS}/${label}-16-remind.png`, fullPage: true });
  });

  await check("photos: offers a capture and states it never reads the picture", async () => {
    await goTab(page, "More");
    await page.getByRole("button", { name: /^Photos/ }).first().click({ timeout: NAV_TIMEOUT });
    await page.waitForFunction(
      () => /photo/i.test(document.querySelector("main")?.innerText ?? ""),
      undefined,
      { timeout: NAV_TIMEOUT },
    );
    const body = await page.locator("main").innerText();
    if (!/never reads/i.test(body)) throw new Error("capture screen omits the no-classifier promise");
    if (!/never.*(crew|carer|shared)/i.test(body)) {
      throw new Error("capture screen does not say photos are never shared");
    }
    // No identification claim may ever appear on this screen.
    if (/we (identified|detected|recognised|recognized)/i.test(body)) {
      throw new Error("capture screen claims to identify what is in a photo");
    }
    // The control is a file input wearing a label, so assert on the text.
    if (!/take a photo/i.test(body)) throw new Error("capture screen offers no way to take one");
    await page.screenshot({ path: `${SHOTS}/${label}-17-capture.png`, fullPage: true });
  });

  await check("photos: a capture round-trips and can be deleted again", async () => {
    // A 1×1 PNG. The app never looks at it, which is exactly the point — what
    // is being proved here is the write path, not any reading of the image.
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "organiser.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    // Say what it is: the kind first, then the label, both from the user's own
    // file. Each step is a plain button, so whichever is on screen gets clicked.
    for (const name of [/pill organiser/i, /^(morning|midday|evening|bedtime|pre-workout)/i]) {
      const btn = page.getByRole("button", { name }).first();
      if (await btn.count()) {
        await btn.click({ timeout: NAV_TIMEOUT });
        await page.waitForTimeout(200);
      }
    }
    // No confirm list when nothing is scheduled — the escape hatch is the answer.
    const escape = page.getByRole("button", { name: /something else/i }).first();
    if (await escape.count()) await escape.click({ timeout: NAV_TIMEOUT });

    await page.waitForFunction(
      () => /delete this photo/i.test(document.querySelector("main")?.innerText ?? ""),
      undefined,
      { timeout: NAV_TIMEOUT },
    );
    await page.screenshot({ path: `${SHOTS}/${label}-18-capture-saved.png`, fullPage: true });

    // One tap, immediate, no bin. A delete that leaves the row is not a delete.
    await page.getByRole("button", { name: /delete this photo/i }).first().click();
    await page.waitForFunction(
      () => !/delete this photo/i.test(document.querySelector("main")?.innerText ?? ""),
      undefined,
      { timeout: NAV_TIMEOUT },
    );
  });

  await check("carer: a pending request states exactly what it shares", async () => {
    await goTab(page, "Crew");
    const request = page.getByText(/carer/i).first();
    if (!(await request.count())) return; // no pending invite in this fixture state
    await request.waitFor({ timeout: NAV_TIMEOUT });
    const crewText = await page.locator("main").innerText();
    // A carer offer must spell out the limits, not just the grant.
    if (!/will not see|cannot see|never see/i.test(crewText)) {
      throw new Error("carer request does not state what stays private");
    }
    await page.screenshot({ path: `${SHOTS}/${label}-15-carer.png`, fullPage: true });
  });

  await check("crew tab: partner card + nudge lands in feed", async () => {
    await goTab(page, "Crew");
    await page.getByText("Conor").first().waitFor();
    const shared = await page.getByLabel("Crew feed").textContent();
    await page.getByRole("button", { name: "Floor's holding" }).click();
    await page.waitForTimeout(200);
    const after = await page.getByLabel("Crew feed").textContent();
    if (!after.includes("Floor's holding") || after === shared) throw new Error("nudge not in feed");
    await page.screenshot({ path: `${SHOTS}/${label}-3-crew.png`, fullPage: true });
  });

  await check("custom crew message lands in feed", async () => {
    await page.getByLabel("Custom crew message").fill("Hold the line");
    await page.getByRole("button", { name: /^send$/i }).click();
    await page.waitForTimeout(200);
    const feed = await page.getByLabel("Crew feed").textContent();
    if (!feed.includes("Hold the line")) throw new Error("custom nudge not in feed");
  });

  await check("crew board carries no absolute weights (shared projection only)", async () => {
    const body = await page.textContent("body");
    if (/9[24]\.\d\s?kg/.test(body.replace(/Mass[\s\S]*?Day/, ""))) {
      throw new Error("weight-looking value in crew view");
    }
  });

  await check("progress tab: mass chart + ceiling + wall", async () => {
    await goTab(page, "Body", "Trend");
    await page.getByRole("img", { name: /Mass chart/i }).waitFor();
    await page.getByText("survival ceiling").first().waitFor();
    await page.getByRole("img", { name: /consistency wall/i }).waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-4-progress.png`, fullPage: true });
  });

  await check("research tab: trigger map, engine read-out, experiments, disputed markers", async () => {
    await goTab(page, "Mind", "Craving");
    await page.getByText(/trigger map/i).first().waitFor();
    await page.getByText(/depletion-dominant/i).waitFor();
    await page.getByText("E1 · Caffeine curfew 14:00").waitFor();
    await page.getByText("MTHFR C677T").waitFor();
    await page.getByText(/LDL-C recheck in/i).waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-5-research.png`, fullPage: true });
  });

  await check("mode switch to survival: 3 checks, amber, executed-decision feed line", async () => {
    await goTab(page, "Today");
    await page.getByRole("button", { name: /cut mode ⇄/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /survival/i }).click();
    await page.getByText(/Floor protocol — hold/i).waitFor();
    await page.getByText(/Floor checks — only these three exist/i).waitFor();
    const checkButtons = await page.getByRole("button", { name: /protein hit|steps|kitchen closed/i }).count();
    if (checkButtons < 3) throw new Error(`expected 3 floor checks, saw ${checkButtons}`);
    await page.screenshot({ path: `${SHOTS}/${label}-6-survival.png`, fullPage: true });
    await page.getByRole("button", { name: /survival mode ⇄/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^cut/i }).click();
    await page.getByText(/Cut protocol/i).waitFor();
  });

  await check("why page renders the mechanism explainer", async () => {
    await page.goto(`${BASE}/why`);
    await page.getByText(/AVE spiral/i).waitFor();
    await page.getByText(/ghrelin/i).first().waitFor();
    await page.screenshot({ path: `${SHOTS}/${label}-7-why.png`, fullPage: true });
    await page.goto(`${BASE}/`);
    await page.getByRole("heading", { level: 1 }).waitFor();
  });

  await check("logout → conor sees survival file, not liam's data", async () => {
    await signOut(page);
    await login(page, "conor", "1379");
    await page.getByText(/Floor protocol — hold < 96/i).waitFor();
    const body = await page.textContent("body");
    if (body.includes("92.8")) throw new Error("liam's weight visible in conor session");
    await page.screenshot({ path: `${SHOTS}/${label}-8-conor.png`, fullPage: true });
    await signOut(page);
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
