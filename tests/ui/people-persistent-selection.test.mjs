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
// observing further CSS-transition updates (page.evaluate polling on a plain
// setTimeout still sees them fine, so the page itself is not stuck — only
// Playwright's rAF poll is). Interval polling sidesteps it; used everywhere
// in this file for consistency rather than only after the first axe scan.
function waitForOpacity(page, selector, expected) {
  return page.waitForFunction(
    ({ selector, expected }) => getComputedStyle(document.querySelector(selector)).opacity === expected,
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

async function opacityOf(page, person) {
  return page.locator(`.people .row[data-person="${person}"] .who`).evaluate((el) => getComputedStyle(el).opacity);
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
// .cmd__item list on the page), which dims .what to 0.3 for *every other* row
// in the section — including ones this feature never touches. That dim is
// momentary (only while the mouse is over the list) and predates this
// change; fixing its contrast is a sitewide, unrelated refactor, not part of
// the persisted-selection feature under test here.
async function scanPeopleSection(page, persons) {
  await page.addScriptTag({ path: axeScriptPath });
  return page.evaluate(async (personKeys) => {
    const rows = personKeys.map((person) => document.querySelector(`.people .row[data-person="${person}"]`));
    const result = await window.axe.run(rows, { resultTypes: ["violations"] });
    return result.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
  }, persons);
}

// Deterministic real-browser coverage for the persisted People selection
// (body.panel-open + .row.active, driven entirely by script.js's existing
// open()/close() — see main.css above .row.active for the CSS). This exists
// specifically to exercise the one interaction the Storybook harness cannot:
// a genuine, OS-level pointer hover over a *different*, non-active row while
// the selection stays open. @testing-library/user-event's hover() (used in
// stories/patterns.stories.js) does not reliably set real CSS :hover in a
// Chromium tab; Playwright's locator.hover() does, so that specific assertion
// lives here instead, against the real production page. It also runs a real
// axe-core scan in each open/dimmed state (not just after closing), since the
// Storybook addon's own scan only ever sees whatever state play() finishes
// in.
test("the People list keeps the selected row highlighted while the sidebar is open", { timeout: 30_000 }, async (context) => {
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
    // and the same scans still correctly resolve zero contrast violations
    // from the actually-applied computed styles. Noise from the scanner
    // itself, not a defect in the page under test.
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
  await page.goto(server.origin, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("intro-playing"));
  // Favicon loading is unrelated to this feature and its async load/error/
  // remove cascade (see AGENTS.md) reflows rows independently of anything
  // under test here; drop it so it can't race the assertions below.
  await page.evaluate(() => document.querySelectorAll("img.fav").forEach((img) => img.remove()));

  const rauno = page.locator('.people .row[data-person="rauno"]');
  const emil = page.locator('.people .row[data-person="emil"]');
  const jakub = page.locator('.people .row[data-person="jakub"]');

  // Normal state: nothing selected, nothing dimmed.
  assert.equal(await opacityOf(page, "rauno"), "1");
  assert.equal(await opacityOf(page, "emil"), "1");
  assert.equal(
    await page.evaluate(() => document.body.classList.contains("panel-open")),
    false,
  );

  // Select rauno, then move the pointer off the whole list — the highlight
  // has to hold on body.panel-open/.row.active alone, not on :hover.
  await rauno.locator("a").click();
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.body.classList.contains("panel-open"), null, { polling: 100 });
  await waitForClass(page, '.people .row[data-person="rauno"]', "active", true);
  await waitForOpacity(page, '.people .row[data-person="emil"] .who', "0.6");
  assert.equal(await opacityOf(page, "rauno"), "1");
  assert.equal(await opacityOf(page, "emil"), "0.6");
  assert.equal(await opacityOf(page, "jakub"), "0.6");

  const violationsPersistedNoHover = await scanPeopleSection(page, ["rauno", "emil", "jakub"]);
  assert.deepEqual(
    violationsPersistedNoHover,
    [],
    "color-contrast (and anything else) must be clean while persisted, unhovered",
  );

  // Hover a different, non-active row with a *real* pointer move. The active
  // row and the actually-hovered row both read at full opacity; everyone
  // else stays dimmed. This is the exact scenario the Storybook harness
  // cannot exercise (see the comment in patterns.stories.js).
  await jakub.hover();
  await page.waitForFunction(
    () => document.querySelector('.people .row[data-person="jakub"]').matches(":hover"),
    null,
    { polling: 100 },
  );
  await waitForOpacity(page, '.people .row[data-person="jakub"] .who', "1");
  assert.equal(await opacityOf(page, "rauno"), "1", "active row stays full while a different row is hovered");
  assert.equal(await opacityOf(page, "jakub"), "1", "the actually-hovered row is not dimmed");
  assert.equal(await opacityOf(page, "emil"), "0.6", "rows that are neither active nor hovered stay dimmed");

  const violationsHoverCross = await scanPeopleSection(page, ["rauno", "emil", "jakub"]);
  assert.deepEqual(violationsHoverCross, [], "color-contrast (and anything else) must be clean mid-hover too");

  await page.mouse.move(0, 0);

  // Switch directly to a different person without closing first.
  await emil.locator("a").click();
  await waitForClass(page, '.people .row[data-person="emil"]', "active", true);
  await waitForOpacity(page, '.people .row[data-person="rauno"] .who', "0.6");
  assert.equal(await opacityOf(page, "emil"), "1");
  assert.equal(await opacityOf(page, "rauno"), "0.6");
  assert.equal(
    await page.evaluate(() => document.querySelector('.people .row[data-person="rauno"]').classList.contains("active")),
    false,
  );

  const violationsAfterSwitch = await scanPeopleSection(page, ["rauno", "emil", "jakub"]);
  assert.deepEqual(violationsAfterSwitch, [], "color-contrast (and anything else) must be clean after switching");

  // Close the sidebar; the list returns to the plain hover-only behavior.
  // emil was the active row (already at opacity 1, nothing to transition),
  // rauno was the dimmed one — wait for *its* 250ms transition back to 1,
  // not emil's no-op wait, before asserting either.
  await page.locator("#panelClose").click();
  await page.waitForFunction(() => !document.body.classList.contains("panel-open"), null, { polling: 100 });
  await waitForOpacity(page, '.people .row[data-person="rauno"] .who', "1");
  assert.equal(await opacityOf(page, "rauno"), "1");
  assert.equal(await opacityOf(page, "emil"), "1");
  assert.equal(
    await page.evaluate(() => document.querySelectorAll(".people .row.active").length),
    0,
  );

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
});
