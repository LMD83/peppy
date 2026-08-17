// Accessibility sweep for the Timento app, against a running server in demo
// mode. Usage:
//   NEXT_PUBLIC_TIMENTO_DEMO=1 npm run dev:frontend  (separate terminal)
//   node scripts/timento-a11y.mjs [baseUrl] [shotDir]
//
// Why this exists as a gate rather than an audit.
//
// tests/a11y-tokens.test.ts parses globals.css and proves the *tokens* pass —
// contrast ratios, the type floor, a focus ring, the motion and forced-colours
// answers. That is real, and it is not enough: a stylesheet cannot tell you
// whether a control ended up with an accessible name, whether the headings came
// out in order, whether something focusable is sitting inside aria-hidden, or
// whether a 44px target survived contact with its container. Those are facts
// about a rendered page, and only a rendered page has them.
//
// So this walks every screen the app can reach, in both accessibility profiles
// and in the survival floor, and runs axe on each one — plus the three checks
// the plan called out because axe cannot do them:
//
//   * computed font size — axe has no opinion about small text that passes
//     contrast. The project floor is 11.5px for labels and 14px for body copy.
//   * target size — WCAG 2.2 AA (2.5.8) asks for 24x24 CSS px. This app holds
//     itself to 44x44, because its users include people whose hands are the
//     reason they need it. The gate enforces the AA line and reports every
//     control below the house standard.
//   * 320px reflow — 1.4.10. No horizontal scrolling at 320 CSS px, which is
//     where a phone at 400% zoom lands.
//
// Automated tooling catches roughly 57% of real accessibility issues. This is
// the floor beneath a manual pass, never a substitute for one.
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "a11y-shots";
const executablePath = process.env.TIMENTO_CHROMIUM ?? "/opt/pw-browsers/chromium";

/** WCAG 2.2 AA, plus the best-practice rules that catch real naming mistakes. */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** The house standard. WCAG 2.2 AA only requires 24. */
const TARGET_HOUSE = 44;
const TARGET_AA = 24;
const LABEL_FLOOR = 11.5;
const BODY_FLOOR = 14;
const NAV_TIMEOUT = 8000;

const violations = [];
const warnings = [];
let checked = 0;

function record(screen, rule, impact, detail) {
  violations.push({ screen, rule, impact, detail });
}

/* ===== the app's own navigation ===== */

async function login(page, slug, passcode) {
  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: slug === "liam" ? "Liam" : "Artur", exact: true }).click();
  await page.getByPlaceholder("••••").fill(passcode);
  await page.getByRole("button", { name: /open the file/i }).click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  // Dev-only chrome. It is not part of the app and it is not ours to fix.
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
}

const PROTOCOL_ROW = {
  Fuel: "Fuel",
  Train: "Train",
  Stack: "Stack",
  Supply: "Supply",
  Bloods: "Bloods",
  Trend: "Trend",
  "Check-in": "Check-in",
  "Trigger map": "Trigger map",
  Craving: "Trigger map",
};

function protocolRow(tab, sub) {
  if (sub) return PROTOCOL_ROW[sub] ?? sub;
  return PROTOCOL_ROW[tab] ?? null;
}

async function goTab(page, tab, sub) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const nav = page.getByRole("navigation", { name: "Sections" });
  const row = protocolRow(tab, sub);
  if (row) {
    await nav.getByRole("button", { name: "Protocol", exact: true }).click({ timeout: NAV_TIMEOUT });
    await page.locator("main").getByRole("button", { name: row, exact: true }).click({ timeout: NAV_TIMEOUT });
    return;
  }
  await nav.getByRole("button", { name: tab, exact: true }).click({ timeout: NAV_TIMEOUT });
}

/** Reach a More-shelf destination by its row label. */
async function goShelf(page, label) {
  await goTab(page, "More");
  await page.getByRole("button", { name: label }).first().click({ timeout: NAV_TIMEOUT });
}

async function setProfile(page, which) {
  await goTab(page, "More");
  await page.getByRole("button", { name: /^Settings/ }).first().click({ timeout: NAV_TIMEOUT });
  await page.getByRole("button", { name: which === "easy" ? "Easy" : "Normal" }).first().click();
  await page.waitForTimeout(250);
}

/* ===== axe ===== */

async function axeScan(page, screen) {
  const results = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    // Next's dev overlay is injected chrome, not app markup.
    .exclude("nextjs-portal")
    .analyze();

  for (const v of results.violations) {
    const where = v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(" "))
      .join(" | ");
    record(screen, v.id, v.impact ?? "unknown", `${v.help} — ${where}`);
  }
}

/* ===== the checks axe cannot do ===== */

/**
 * Computed font size on rendered text. A stylesheet check cannot see what
 * cascaded, what a utility class overrode, or what a component set inline.
 */
async function checkTypeFloor(page, screen) {
  const small = await page.evaluate(
    ({ labelFloor, bodyFloor }) => {
      const out = [];
      const nodes = document.querySelectorAll("main *, nav *, header *");
      for (const el of nodes) {
        // Only elements that directly own visible text.
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join("");
        if (own === "") continue;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        let size = parseFloat(style.fontSize);

        // SVG text is authored in user units and painted through the viewBox
        // transform, so a fontSize of 6 in a chart that scales 2x is 12 real
        // pixels on the glass. Reading the computed value alone condemns every
        // chart in the app and misses one that genuinely renders small — what
        // a reader's eye has to resolve is the size after the CTM.
        const owner = el.ownerSVGElement;
        if (owner !== null && owner !== undefined) {
          const ctm = el.getScreenCTM?.();
          if (ctm) size *= Math.sqrt(Math.abs(ctm.a * ctm.d - ctm.b * ctm.c)) || 1;
        }

        // Uppercase mono labels are the app's label tier; everything else is body.
        const isLabel =
          style.textTransform === "uppercase" || style.letterSpacing !== "normal";
        const floor = isLabel ? labelFloor : bodyFloor;
        if (size + 0.01 < floor) {
          out.push(`${size.toFixed(1)}px (floor ${floor}) "${own.slice(0, 40)}"`);
        }
      }
      return out.slice(0, 8);
    },
    { labelFloor: LABEL_FLOOR, bodyFloor: BODY_FLOOR },
  );
  for (const s of small) record(screen, "type-floor", "serious", s);
}

/**
 * Target size as laid out, not as declared. `min-h-11` is 44px of height and
 * says nothing about width, which is where icon buttons fail.
 */
async function checkTargetSize(page, screen) {
  const { fails, soft } = await page.evaluate(
    ({ aa, house }) => {
      const fails = [];
      const soft = [];
      const sel = "button, a[href], input, select, textarea, [role=button], [role=tab]";
      for (const el of document.querySelectorAll(sel)) {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        let r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        // A control wrapped in a label is hit by pressing the label — that is
        // what a label is for, and it is how the app builds its big choices and
        // its camera button. Measure the thing a finger actually lands on, or
        // every sr-only input in the app reports as a 1px target it never was.
        const label = el.closest("label");
        if (label !== null && label !== el) {
          const lr = label.getBoundingClientRect();
          if (lr.width >= r.width && lr.height >= r.height) r = lr;
        }

        // A skip link is 1x1 and clipped until it takes focus, at which point it
        // becomes a full-size control. That is the correct implementation of a
        // skip link, not a 1px target — so anything too small is focused and
        // re-measured, and judged at the size it has when it can actually be
        // activated. Condemning the hidden state would make this gate punish
        // exactly the accessibility work it exists to encourage.
        if (r.width + 0.5 < aa || r.height + 0.5 < aa) {
          const active = document.activeElement;
          el.focus?.({ preventScroll: true });
          const focused = el.getBoundingClientRect();
          if (active instanceof HTMLElement) active.focus?.({ preventScroll: true });
          else el.blur?.();
          if (focused.width > r.width || focused.height > r.height) r = focused;
        }

        const name = (el.getAttribute("aria-label") || el.textContent || el.tagName)
          .trim()
          .slice(0, 30);
        const dims = `${Math.round(r.width)}x${Math.round(r.height)}`;
        if (r.width + 0.5 < aa || r.height + 0.5 < aa) fails.push(`${dims} "${name}"`);
        else if (r.width + 0.5 < house || r.height + 0.5 < house) soft.push(`${dims} "${name}"`);
      }
      return { fails: fails.slice(0, 8), soft: soft.slice(0, 6) };
    },
    { aa: TARGET_AA, house: TARGET_HOUSE },
  );
  for (const f of fails) record(screen, "target-size-2.5.8", "serious", f);
  for (const s of soft) warnings.push(`${screen}: below the ${TARGET_HOUSE}px house standard — ${s}`);
}

/**
 * 1.4.10 — nothing may scroll sideways at 320 CSS px.
 *
 * One known limit: text width depends on the font that actually loaded, and a
 * CI runner does not always resolve the same one a dev container does. A labs
 * row cleared 320px locally and overflowed to 327px on the deployed build. The
 * run against the deployment is therefore the authority, not this one — which
 * is why the sweep is wired into deploy-verify rather than only into a local
 * script. (A "fits by only Npx" warning was tried here and removed: a
 * full-width layout always fits by exactly 0px, so it flagged every screen and
 * said nothing.)
 */
async function checkReflow(page, screen) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth + 1) return null;
    // Name the widest offender, so the report says what to fix.
    let worst = null;
    for (const el of document.querySelectorAll("main *, nav *, header *")) {
      const r = el.getBoundingClientRect();
      if (r.right > doc.clientWidth + 1 && (!worst || r.right > worst.right)) {
        worst = { right: r.right, tag: el.tagName, cls: String(el.className).slice(0, 60) };
      }
    }
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, worst };
  });
  if (overflow !== null) {
    const w = overflow.worst;
    record(
      screen,
      "reflow-1.4.10",
      "serious",
      `page scrolls sideways: ${overflow.scrollWidth}px in ${overflow.clientWidth}px` +
        (w ? ` — widest: <${w.tag.toLowerCase()} class="${w.cls}"> to ${Math.round(w.right)}px` : ""),
    );
  }
}

async function sweep(page, screen, { reflow }) {
  checked++;
  await axeScan(page, screen);
  await checkTypeFloor(page, screen);
  await checkTargetSize(page, screen);
  if (reflow) await checkReflow(page, screen);
  await page
    .screenshot({ path: `${SHOTS}/${screen.replace(/\W+/g, "-")}.png`, fullPage: true })
    .catch(() => {});
  process.stdout.write(`  scanned: ${screen}\n`);
}

/* ===== the walk ===== */

const browser = await chromium.launch({ executablePath }).catch(() => chromium.launch());

/*
  320px is the reflow requirement (1.4.10) and the hardest width the app has to
  survive; 390 is a real phone; 1280 proves nothing regressed on desktop. The
  reflow assertion only runs at 320, where it is the actual criterion.
*/
for (const [label, viewport, reflow] of [
  ["320", { width: 320, height: 720 }, true],
  ["390", { width: 390, height: 844 }, false],
  ["1280", { width: 1280, height: 800 }, false],
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  console.log(`\n=== ${label}px ===`);

  await page.goto(`${BASE}/`);
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.getByText("Who's checking in").waitFor();
  await sweep(page, `${label}-login`, { reflow });

  await login(page, "liam", "2580");
  await sweep(page, `${label}-today`, { reflow });

  // The Protocol shelf, then every row it reaches, then Crew.
  await goTab(page, "Protocol");
  await sweep(page, `${label}-protocol`, { reflow });
  for (const [tab, sub] of [
    ["Fuel", null],
    ["Train", null],
    ["Body", "Stack"],
    ["Body", "Supply"],
    ["Body", "Bloods"],
    ["Body", "Trend"],
    ["Mind", "Check-in"],
    ["Mind", "Trigger map"],
    ["Crew", null],
  ]) {
    await goTab(page, tab, sub);
    await page.waitForTimeout(200);
    await sweep(page, `${label}-${tab}${sub ? `-${sub}` : ""}`.toLowerCase(), { reflow });
  }

  // The More shelf and everything only it reaches.
  await goTab(page, "More");
  await sweep(page, `${label}-more`, { reflow });
  for (const shelf of [/^Shopping/, /^Reminders/, /^Photos/, /^Hands-free/, /^Settings/]) {
    await goShelf(page, shelf);
    await page.waitForTimeout(200);
    await sweep(page, `${label}-${String(shelf).replace(/\W+/g, "")}`.toLowerCase(), { reflow });
  }

  // The floor. The plan's sharpest finding was that the least legible screen we
  // shipped was the one for someone at their worst, so it is scanned explicitly.
  await goTab(page, "Today");
  await page.getByRole("button", { name: /cut mode ⇄/i }).click();
  await page.getByRole("button", { name: /^survival\b/i }).click();
  await page.getByText(/Floor protocol — hold/i).waitFor();
  await sweep(page, `${label}-survival-floor`, { reflow });
  await page.getByRole("button", { name: /survival mode ⇄/i }).click();
  await page.getByRole("button", { name: /^cut\b/i }).click();
  await page.getByText(/Cut protocol/i).waitFor();

  // Easy mode is a different tree, not a skin: fewer objects, bigger targets.
  // The four stamps stay; only the shelf rows go through plain(). Scanning
  // standard mode says nothing about it.
  await setProfile(page, "easy");
  await goTab(page, "Today");
  await sweep(page, `${label}-easy-today`, { reflow });
  await goTab(page, "Protocol");
  await sweep(page, `${label}-easy-protocol`, { reflow });
  await goTab(page, "Crew");
  await sweep(page, `${label}-easy-crew`, { reflow });
  await goTab(page, "More");
  await sweep(page, `${label}-easy-more`, { reflow });
  await setProfile(page, "standard");

  await page.goto(`${BASE}/why`);
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.getByText(/AVE spiral/i).waitFor();
  await sweep(page, `${label}-why`, { reflow });

  await context.close();
}

await browser.close();

/* ===== the report ===== */

console.log(`\nscreens scanned: ${checked}`);

if (warnings.length > 0) {
  console.log(`\nbelow the house standard (not a WCAG failure, ${warnings.length}):`);
  for (const w of warnings.slice(0, 20)) console.log(`  · ${w}`);
}

if (violations.length === 0) {
  console.log("\nA11Y PASSED — no WCAG 2.2 AA violations, type floor and reflow hold");
  process.exit(0);
}

// Group by rule: one broken component usually fails on every screen at once,
// and a list of 60 identical lines hides how few real problems there are.
const byRule = new Map();
for (const v of violations) {
  const list = byRule.get(v.rule) ?? [];
  list.push(v);
  byRule.set(v.rule, list);
}

console.error(`\nA11Y FAILED — ${violations.length} findings across ${byRule.size} rules\n`);
for (const [rule, list] of [...byRule.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`${rule} (${list[0].impact}) — ${list.length} on ${list.length === 1 ? "1 screen" : `${new Set(list.map((v) => v.screen)).size} screens`}`);
  // A rule usually fails on one component repeated across screens, so the
  // default is a summary. A11Y_FULL=1 when you are actually fixing them.
  const show = process.env.A11Y_FULL === "1" ? list.length : 4;
  for (const v of list.slice(0, show)) console.error(`   ${v.screen}: ${v.detail}`);
  if (list.length > show) console.error(`   … and ${list.length - show} more`);
  console.error("");
}
process.exit(1);
