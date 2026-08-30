import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const axeScriptPath = path.resolve(repositoryRoot, "node_modules/axe-core/axe.min.js");

// Playwright's waitForFunction defaults to requestAnimationFrame-driven
// polling. Confirmed by bisecting this exact test: after axe-core's
// window.axe.run() executes once on the page, rAF-based polling stops
// observing further CSS updates (page.evaluate polling on a plain setTimeout
// still sees them fine, so the page itself is not stuck — only Playwright's
// rAF poll is). Interval polling sidesteps it; used everywhere in this file
// for consistency rather than only after the first axe scan.
function waitForColor(page, selector, expected) {
  return page.waitForFunction(
    ({ selector, expected }) => getComputedStyle(document.querySelector(selector)).color === expected,
    { selector, expected },
    { polling: 100 },
  );
}

function waitForClass(page, selector, className, present) {
  return page.waitForFunction(
    ({ selector, className, present }) => document.querySelector(selector).classList.contains(className) === present,
    { selector, className, present },
    { polling: 100 },
  );
}

async function whoColorOf(page, person) {
  return page.locator(`.people .row[data-person="${person}"] .who a`).evaluate((el) => getComputedStyle(el).color);
}

async function whatColorOf(page, person) {
  return page.locator(`.people .row[data-person="${person}"] .what`).evaluate((el) => getComputedStyle(el).color);
}

// The dim is a solid color (--row-dim), not opacity — see main.css above
// .row.active for why opacity alone can't clear AA contrast here. Resolves
// a custom property through a throwaway probe element so this doesn't
// hardcode a color literal that would drift the moment a token is
// recalibrated.
function probeColor(page, cssValue) {
  return page.evaluate((value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, cssValue);
}

function dimColor(page) {
  return probeColor(page, "var(--row-dim)");
}

function inkColor(page) {
  return probeColor(page, "var(--ink)");
}

// Scoped to the three rows this scenario actually drives (rauno/emil/jakub —
// the same set the Storybook fixture uses), not the whole #people section or
// the full ~19-person list. Two things sit outside that boundary on purpose:
// #peopleSeeMore carries pre-existing, unrelated contrast debt (already
// tracked in Storybook as data-a11y-debt="see-more" on the equivalent fixture
// button); and hovering a real row on the full production page also engages
// the older, sitewide "focus by neighborhood" hover-dim
// (`section:has(.row:hover) .row:not(:hover) > *` in main.css, documented in
// AGENTS.md as an existing pattern used by every .row/.phase li/.item/
// .cmd__item list on the page), which used to reach .what with opacity: 0.3.
// Since the contrast fix, opacity is pinned at 1 for every row inside
// body.panel-open .people:has(.row.active), so that dim no longer reaches
// anything within this feature's scope; the older rule still applies
// unchanged outside that scope (panel closed), but that's a sitewide,
// unrelated concern, not part of the persisted-selection feature under test
// here. resultTypes includes "passes" so the color-contrast check's measured
// ratio is available even when nothing fails — used to report the real,
// measured numbers below instead of only asserting pass/fail.
async function scanPeopleSection(page, persons) {
  await page.addScriptTag({ path: axeScriptPath });
  return page.evaluate(async (personKeys) => {
    const rows = personKeys.map((person) => document.querySelector(`.people .row[data-person="${person}"]`));
    const result = await window.axe.run(rows, { resultTypes: ["violations", "passes"] });
    const contrastNodes = (nodes) =>
      nodes.map((node) => ({ target: node.target.join(" "), ratio: node.any[0]?.data?.contrastRatio ?? null }));
    return {
      violations: result.violations
        .filter((rule) => rule.id === "color-contrast")
        .flatMap((rule) => contrastNodes(rule.nodes)),
      contrastRatios: result.passes
        .filter((rule) => rule.id === "color-contrast")
        .flatMap((rule) => contrastNodes(rule.nodes)),
    };
  }, persons);
}

// Deterministic real-browser coverage for the persisted People selection
// (body.panel-open + .row.active, driven entirely by script.js's existing
// open()/close() — see main.css above .row.active for the CSS). Since people
// open #panel in modal mode (body.panel-modal + #panelWash; only "The plan"
// phases keep the sidebar), a genuine OS-level pointer over a *different* row
// lands on the wash, not the row: this test drives a real mouse move there
// and asserts the list ignores it, and switches person through the existing
// Shift+Arrow navigation instead of a second click. It also runs a real
// axe-core scan in each open/dimmed state (not just after closing) in both
// themes, since the Storybook addon's own scan only ever sees whatever state
// play() finishes in, and only ever in the light-mode default.
test("the People list keeps the selected row highlighted while a person's modal is open", { timeout: 30_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // axe-core's own color-contrast check re-resolves this page's @import'd
    // tokens (styles/tokens/*.css) against the wrong base URL while walking
    // the CSSOM (fetches /tokens/*.css instead of /styles/tokens/*.css) and
    // logs a 404 for each — reproduced in isolation with response logging,
    // happens once per axe.run() call regardless of any real page behavior,
    // and the same scans still correctly resolve the actually-applied
    // computed styles. Noise from the scanner itself, not a defect in the
    // page under test.
    if (/Failed to load resource.*404/.test(message.text()) && /\/tokens\/.+\.css/.test(message.location().url)) {
      return;
    }
    consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => sessionStorage.setItem("intro-shown-v1", "true"));
  // Same stub as tests/ui/command-menu.test.mjs: this test isn't about
  // favicons or webfonts, and real network errors for those (Google Fonts,
  // per-domain favicon services) would otherwise show up as unrelated
  // console noise in the final "no console errors" assertion.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    if (route.request().resourceType() === "stylesheet") {
      return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    }
    if (route.request().resourceType() === "image") {
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto(`${server.origin}/wiki`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("intro-playing"));
  // Favicon loading is unrelated to this feature and its async load/error/
  // remove cascade (see AGENTS.md) reflows rows independently of anything
  // under test here; drop it so it can't race the assertions below.
  await page.evaluate(() => document.querySelectorAll("img.fav").forEach((img) => img.remove()));

  const rauno = page.locator('.people .row[data-person="rauno"]');
  const emil = page.locator('.people .row[data-person="emil"]');
  const jakub = page.locator('.people .row[data-person="jakub"]');
  const dim = await dimColor(page);
  const measured = {};

  // Normal state: nothing selected, nothing dimmed.
  assert.notEqual(await whoColorOf(page, "rauno"), dim);
  assert.notEqual(await whatColorOf(page, "emil"), dim);
  assert.equal(
    await page.evaluate(() => document.body.classList.contains("panel-open")),
    false,
  );

  // Real-pointer hover on a page row: the instant --row-hover fill (no
  // shadow, no transition — same hover as the home's Writing rows since
  // 29/08/2026), the bleed past the column, and no neighborhood dim on the
  // other rows (main.css, `main > section .row`).
  // `hover()` scrolls the row into view and parks the pointer on it in one
  // go, but the page scrolls through Lenis (scroll.mjs) — on CI the row was
  // still gliding under the pointer when the next line measured it and came
  // back unhovered (30/08/2026, PR #87). Hover until the row really is
  // `:hover`; each retry re-aims at wherever the row has settled.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await emil.hover();
    await page.waitForTimeout(100);
    if (await emil.evaluate((row) => row.matches(":hover"))) break;
  }
  assert.equal(await emil.evaluate((row) => row.matches(":hover")), true, "the pointer rests on the row before the hover is measured");
  const hovered = await page.evaluate(() => {
    const row = document.querySelector('.people .row[data-person="emil"]');
    const other = document.querySelector('.people .row[data-person="rauno"] .who');
    const cs = getComputedStyle(row);
    const token = getComputedStyle(document.documentElement).getPropertyValue("--row-hover").trim();
    return {
      bg: cs.backgroundColor,
      token,
      shadow: cs.boxShadow,
      instant: cs.transitionDuration === "0s" || !/background|box-shadow|all/.test(cs.transitionProperty),
      marginLeft: parseFloat(cs.marginLeft),
      textLeft: row.querySelector(".who").getBoundingClientRect().left,
      sectionLeft: row.closest("section").getBoundingClientRect().left,
      otherOpacity: getComputedStyle(other).opacity,
    };
  });
  assert.equal(hovered.bg, hovered.token, "hovered row is filled with --row-hover");
  assert.equal(hovered.shadow, "none", "no lift, fill only");
  assert.equal(hovered.instant, true, "the fill is instant");
  assert.ok(hovered.marginLeft < 0, "the fill bleeds past the column");
  assert.equal(hovered.textLeft, hovered.sectionLeft, "the text column does not move");
  assert.equal(hovered.otherOpacity, "1", "no neighborhood dim on page rows");
  await page.mouse.move(0, 0);

  // Select rauno, then move the pointer off the whole list — the highlight
  // has to hold on body.panel-open/.row.active alone, not on :hover.
  await rauno.locator("a").click();
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.body.classList.contains("panel-open"), null, { polling: 100 });
  await waitForClass(page, '.people .row[data-person="rauno"]', "active", true);
  await waitForColor(page, '.people .row[data-person="emil"] .what', dim);
  // People open as a modal, not the sidebar: the wash is up and owns the
  // pointer, so nothing on the page behind it can be hovered or clicked.
  assert.equal(await page.evaluate(() => document.body.classList.contains("panel-modal")), true, "people open in modal mode");
  assert.equal(await page.locator("#panelWash").getAttribute("aria-hidden"), "false", "the wash is exposed while the modal is open");
  // Playwright's click scrolled rauno into view minimally, which can leave
  // jakub (two rows down) just below the fold — and elementFromPoint returns
  // null for a point outside the viewport. Bring the probed row on screen
  // first; the wash is fixed and full-viewport, so scrolling changes nothing
  // about what's being asserted.
  await jakub.scrollIntoViewIfNeeded();
  const jakubBox = await jakub.boundingBox();
  // Probe near the row's left edge, clear of the centered modal itself, so
  // the only thing between the pointer and the row is the wash.
  const jakubCenter = { x: jakubBox.x + 8, y: jakubBox.y + jakubBox.height / 2 };
  assert.equal(
    await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, jakubCenter),
    "panelWash",
    "the wash intercepts the pointer over the list",
  );
  assert.notEqual(await whoColorOf(page, "rauno"), dim, "active row's name is not dimmed");
  assert.equal(await whoColorOf(page, "emil"), dim, "unselected row's name is dimmed");
  assert.equal(await whatColorOf(page, "emil"), dim, "unselected row's summary is dimmed too, unlike the previous round");
  assert.equal(await whoColorOf(page, "jakub"), dim);
  assert.equal(await whatColorOf(page, "jakub"), dim);

  measured.light_noHover = await scanPeopleSection(page, ["rauno", "emil", "jakub"]);
  assert.deepEqual(
    measured.light_noHover.violations,
    [],
    "color-contrast (and anything else) must be clean while persisted, unhovered — light theme",
  );

  // Move a *real* pointer over a different, non-active row. The wash sits
  // between the mouse and the list, so the row never enters :hover and the
  // highlight stays exactly where the selection put it — the state is owned
  // by body.panel-open/.row.active, never by the pointer.
  await page.mouse.move(jakubCenter.x, jakubCenter.y);
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(() => document.querySelector('.people .row[data-person="jakub"]').matches(":hover")),
    false,
    "a row behind the wash never enters :hover",
  );
  assert.notEqual(await whoColorOf(page, "rauno"), dim, "active row stays undimmed with the pointer over the list");
  assert.equal(await whoColorOf(page, "jakub"), dim, "the row under the pointer stays dimmed behind the wash");
  assert.equal(await whoColorOf(page, "emil"), dim, "every other row stays dimmed");

  measured.light_pointerOver = await scanPeopleSection(page, ["rauno", "emil", "jakub"]);
  assert.deepEqual(
    measured.light_pointerOver.violations,
    [],
    "color-contrast (and anything else) must be clean with the pointer over the list too — light theme",
  );

  await page.mouse.move(0, 0);

  // Switch directly to the next person without closing first: the list is
  // behind the wash, so this goes through the existing Shift+ArrowDown
  // navigation (rauno → emil in DOM order).
  await page.keyboard.press("Shift+ArrowDown");
  await waitForClass(page, '.people .row[data-person="emil"]', "active", true);
  await waitForColor(page, '.people .row[data-person="rauno"] .what', dim);
  assert.notEqual(await whoColorOf(page, "emil"), dim);
  assert.equal(await whoColorOf(page, "rauno"), dim);
  assert.equal(await whatColorOf(page, "rauno"), dim);
  assert.equal(
    await page.evaluate(() => document.querySelector('.people .row[data-person="rauno"]').classList.contains("active")),
    false,
  );

  const violationsAfterSwitch = await scanPeopleSection(page, ["rauno", "emil", "jakub"]);
  assert.deepEqual(
    violationsAfterSwitch.violations,
    [],
    "color-contrast (and anything else) must be clean after switching — light theme",
  );

  // Re-select rauno (Shift+ArrowUp: emil → rauno; the list is still behind
  // the wash) and switch to dark mode in place (no reload needed — every
  // color in main.css reads through var(), see tokens/colors.css) to
  // measure the same two states there.
  await page.keyboard.press("Shift+ArrowUp");
  await waitForClass(page, '.people .row[data-person="rauno"]', "active", true);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const darkDim = await dimColor(page);
  await waitForColor(page, '.people .row[data-person="emil"] .what', darkDim);

  measured.dark_noHover = await scanPeopleSection(page, ["rauno", "emil", "jakub"]);
  assert.deepEqual(
    measured.dark_noHover.violations,
    [],
    "color-contrast (and anything else) must be clean while persisted, unhovered — dark theme",
  );

  await page.mouse.move(jakubCenter.x, jakubCenter.y);
  await page.waitForTimeout(300);
  assert.equal(await whoColorOf(page, "jakub"), darkDim, "the row under the pointer stays dimmed behind the wash — dark theme");

  measured.dark_pointerOver = await scanPeopleSection(page, ["rauno", "emil", "jakub"]);
  assert.deepEqual(
    measured.dark_pointerOver.violations,
    [],
    "color-contrast (and anything else) must be clean with the pointer over the list too — dark theme",
  );

  await page.mouse.move(0, 0);
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));

  // Close the modal; the list returns to the plain hover-only behavior.
  // emil (the last-active row before this) is undimmed already — wait on
  // rauno's actual 250ms color transition back to normal before asserting.
  await page.locator("#panelClose").click();
  await page.waitForFunction(() => !document.body.classList.contains("panel-open"), null, { polling: 100 });
  await waitForColor(page, '.people .row[data-person="rauno"] .who a', await inkColor(page));
  assert.notEqual(await whoColorOf(page, "rauno"), dim);
  assert.notEqual(await whoColorOf(page, "emil"), dim);
  assert.notEqual(await whoColorOf(page, "jakub"), dim);
  assert.notEqual(await whatColorOf(page, "rauno"), dim);
  assert.notEqual(await whatColorOf(page, "emil"), dim);
  assert.notEqual(await whatColorOf(page, "jakub"), dim);
  assert.equal(
    await page.evaluate(() => document.querySelectorAll(".people .row.active").length),
    0,
  );

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  // Print the real, measured (not calculated) contrast ratios so a human can
  // read them straight out of the test run — axe-core's color-contrast check
  // reports this even on a pass, not only on failure.
  console.log("Measured color-contrast ratios (axe-core, real browser):");
  for (const [scenario, result] of Object.entries(measured)) {
    for (const node of result.contrastRatios) {
      console.log(`  ${scenario}: ${node.target} => ${node.ratio}:1`);
    }
  }
});
