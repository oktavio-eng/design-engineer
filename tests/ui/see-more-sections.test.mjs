import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const axeScriptPath = path.resolve(repositoryRoot, "node_modules/axe-core/axe.min.js");

// The exact list script.js wires: ["people", "courses", "references"].forEach(wireSeeMore).
// Every id here is derived the same way production derives it — section id,
// section id + "SeeMore" — so a rename on either side breaks this immediately.
const SECTIONS = [
  { id: "people", label: "People" },
  { id: "courses", label: "Courses & materials" },
  { id: "references", label: "Craft references" },
];

// Playwright's waitForFunction defaults to requestAnimationFrame polling, which
// stops observing CSS updates once axe-core's window.axe.run() has executed on
// the page (bisected in tests/ui/people-persistent-selection.test.mjs — see the
// long comment there). Interval polling sidesteps it; used for every wait in
// this file for consistency, not only after the first scan.
function waitFor(page, expression, argument) {
  return page.waitForFunction(expression, argument, { polling: 100 });
}

// Resolves a custom property through a throwaway element so the assertions
// compare against whatever the tokens currently say, never a color literal.
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

function sectionState(page, id) {
  return page.evaluate((sectionId) => {
    const section = document.getElementById(sectionId);
    const button = document.getElementById(`${sectionId}SeeMore`);
    const controls = button.getAttribute("aria-controls");
    // aria-controls is only worth anything if it resolves. Look the id up the
    // way an assistive technology would instead of comparing two strings, and
    // check it lands on this section's own .extras, not just on something.
    const controlled = document.getElementById(controls);
    return {
      expanded: section.classList.contains("expanded"),
      label: button.textContent,
      ariaExpanded: button.getAttribute("aria-expanded"),
      ariaControls: controls,
      controlsResolves: Boolean(controlled),
      controlsIsOwnExtras: controlled === section.querySelector(".extras"),
      extrasVisibility: getComputedStyle(controlled).visibility,
      extrasHeight: controlled.getBoundingClientRect().height,
      extraRowCount: controlled.querySelectorAll(".row.extra").length,
    };
  }, id);
}

// Standard page setup shared by both tests below: skip the intro, keep every
// external request (Google Fonts, per-domain favicon services) off the network
// so real offline failures cannot pollute the console assertions, and collect
// page/console errors.
async function openSite(browser, server, contextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 }, ...contextOptions });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // axe-core re-resolves this page's @import'd tokens against the wrong base
    // URL while walking the CSSOM and logs a 404 per file; scanner noise, not a
    // page defect (documented in tests/ui/people-persistent-selection.test.mjs).
    if (/Failed to load resource.*404/.test(message.text()) && /\/tokens\/.+\.css/.test(message.location().url)) {
      return;
    }
    consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => sessionStorage.setItem("intro-shown-v1", "true"));
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
  // The favicons are lazy-loaded from an external service and their
  // load/error/remove cascade (see AGENTS.md) reflows rows on its own schedule
  // — including right as show more reveals a batch of them. Unrelated to this
  // feature and a real source of races against height assertions; drop them,
  // same precedent as tests/ui/people-persistent-selection.test.mjs.
  await page.evaluate(() => document.querySelectorAll("img.fav").forEach((img) => img.remove()));
  return { page, consoleErrors, pageErrors };
}

async function expand(page, id) {
  await page.locator(`#${id}SeeMore`).click();
  await waitFor(page, (sectionId) => document.getElementById(sectionId).classList.contains("expanded"), id);
  // The extras open over a 320ms grid-template-rows transition and the revealed
  // rows land through the 400ms `enter` animation; wait for both to settle
  // instead of sleeping.
  await waitFor(page, (sectionId) => document.getElementById(`${sectionId}Extras`).getBoundingClientRect().height > 0, id);
  await waitFor(
    page,
    (sectionId) =>
      Array.from(document.querySelectorAll(`#${sectionId}Extras .row.extra`)).every(
        (row) => getComputedStyle(row).opacity === "1",
      ),
    id,
  );
}

test("every see-more section toggles, announces its state, and controls an element that exists", { timeout: 60_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });
  const { page, consoleErrors, pageErrors } = await openSite(browser, server);

  // The toggle used to be hardcoded to People; the wiring is now a list. Pin
  // the list itself so a fourth section cannot appear (or one of these three
  // silently lose its button) without this test noticing. #readings has extras
  // markup nowhere and no see-more, and stays out on purpose.
  assert.deepEqual(
    await page.evaluate(() => Array.from(document.querySelectorAll(".see-more"), (button) => button.id)),
    SECTIONS.map(({ id }) => `${id}SeeMore`),
  );

  for (const { id, label } of SECTIONS) {
    const collapsed = await sectionState(page, id);
    assert.equal(collapsed.expanded, false, `${label}: starts collapsed`);
    assert.equal(collapsed.label, "show more", `${label}: starts labelled show more`);
    assert.equal(collapsed.ariaExpanded, "false", `${label}: starts announced as collapsed`);
    assert.equal(collapsed.ariaControls, `${id}Extras`, `${label}: names its extras container`);
    assert.equal(collapsed.controlsResolves, true, `${label}: aria-controls resolves to a real element`);
    assert.equal(collapsed.controlsIsOwnExtras, true, `${label}: aria-controls points at its own .extras`);
    assert.equal(collapsed.extrasVisibility, "hidden", `${label}: collapsed extras are out of the a11y tree`);
    assert.equal(collapsed.extrasHeight, 0, `${label}: collapsed extras take no space`);
    assert.ok(collapsed.extraRowCount > 0, `${label}: there is something to reveal`);

    await expand(page, id);

    const expanded = await sectionState(page, id);
    assert.equal(expanded.expanded, true, `${label}: expands`);
    assert.equal(expanded.label, "show less", `${label}: relabels to show less`);
    assert.equal(expanded.ariaExpanded, "true", `${label}: announces itself as expanded`);
    assert.equal(expanded.extrasVisibility, "visible", `${label}: revealed extras are visible`);
    assert.ok(expanded.extrasHeight > 0, `${label}: revealed extras take space`);
    // The stagger is what the `.expanded .row.extra` rules exist for; if the
    // selector ever stops matching a non-.people section the rows stay at the
    // base opacity: 0 and this reads 0 while the container is already open.
    assert.equal(
      await page.locator(`#${id}Extras .row.extra`).first().evaluate((row) => getComputedStyle(row).animationName),
      "enter",
      `${label}: revealed rows run the enter stagger (control for the reduced-motion test below)`,
    );

    await page.locator(`#${id}SeeMore`).click();
    await waitFor(page, (sectionId) => !document.getElementById(sectionId).classList.contains("expanded"), id);
    await waitFor(
      page,
      (sectionId) => getComputedStyle(document.getElementById(`${sectionId}Extras`)).visibility === "hidden",
      id,
    );

    const recollapsed = await sectionState(page, id);
    assert.equal(recollapsed.label, "show more", `${label}: relabels back to show more`);
    assert.equal(recollapsed.ariaExpanded, "false", `${label}: announces itself as collapsed again`);
    assert.equal(recollapsed.extrasHeight, 0, `${label}: closes all the way back to zero height`);
  }

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
});

test("a People row revealed by show more selects like any other row", { timeout: 60_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });
  const { page, consoleErrors, pageErrors } = await openSite(browser, server);

  // production's rows list is document.querySelectorAll(".people .row"), built
  // at load — the .row.extra elements are already in it, so a revealed row goes
  // through the same openAt("people", index) path as a visible one. This is the
  // half the Storybook harness cannot prove: real script.js indexes, real panel
  // render, real 25-row list.
  await expand(page, "people");

  const dim = await probeColor(page, "var(--row-dim)");
  const ink = await probeColor(page, "var(--ink)");
  const whoColorOf = (person) =>
    page.locator(`.people .row[data-person="${person}"] .who a`).evaluate((el) => getComputedStyle(el).color);
  const whatColorOf = (person) =>
    page.locator(`.people .row[data-person="${person}"] .what`).evaluate((el) => getComputedStyle(el).color);

  await page.locator('.people .row.extra[data-person="floguo"] a').click();
  // Pointer off the list: the highlight has to hold on body.panel-open plus
  // .row.active alone, exactly like a non-extra row.
  await page.mouse.move(0, 0);
  await waitFor(page, () => document.body.classList.contains("panel-open"));
  await waitFor(page, () => document.querySelector('.people .row[data-person="floguo"]').classList.contains("active"));
  await waitFor(page, (expected) => getComputedStyle(document.querySelector('.people .row[data-person="rauno"] .what')).color === expected, dim);

  assert.equal(await page.locator("#panel").getAttribute("aria-hidden"), "false", "the panel opened");
  assert.equal(await page.locator("#panel h3").first().textContent(), "Flora Guo", "the panel rendered the revealed person");
  assert.equal(await whoColorOf("floguo"), ink, "the selected extra row keeps --ink");
  assert.equal(await whatColorOf("floguo"), ink, "the selected extra row's summary keeps --ink too");
  assert.equal(await whoColorOf("rauno"), dim, "a visible row falls to --row-dim");
  assert.equal(await whatColorOf("rauno"), dim);
  assert.equal(await whoColorOf("janikb"), dim, "another revealed row falls to --row-dim as well");
  assert.equal(await whatColorOf("janikb"), dim);

  // The dim has to stay a pure color change here too. `.expanded .row.extra`
  // animates opacity with `forwards`, so the animation — not the
  // `body.panel-open .people:has(.row.active) .row > *` pin — owns the row's
  // own opacity once it lands; anything below 1 would blend the text toward
  // --bg and reopen the contrast violation --row-dim exists to avoid.
  const opacities = await page.evaluate(() =>
    ["floguo", "janikb"].map((person) => {
      const row = document.querySelector(`.people .row[data-person="${person}"]`);
      return [getComputedStyle(row).opacity, getComputedStyle(row.querySelector(".who")).opacity];
    }),
  );
  assert.deepEqual(opacities, [
    ["1", "1"],
    ["1", "1"],
  ]);

  // Selecting must not collapse the list back.
  const stillOpen = await sectionState(page, "people");
  assert.equal(stillOpen.expanded, true, "the list stays expanded while the panel is open");
  assert.equal(stillOpen.ariaExpanded, "true");
  assert.equal(stillOpen.label, "show less");
  assert.ok(stillOpen.extrasHeight > 0);

  // Real axe scan of this exact state — the selected revealed row plus the two
  // rows it dims — measured, not calculated. resultTypes includes "passes" so
  // the color-contrast ratios can be printed even on a green run.
  await page.addScriptTag({ path: axeScriptPath });
  const scan = await page.evaluate(async () => {
    const rows = ["floguo", "janikb", "rauno"].map((person) =>
      document.querySelector(`.people .row[data-person="${person}"]`),
    );
    const result = await window.axe.run(rows, { resultTypes: ["violations", "passes"] });
    const nodes = (list) => list.map((node) => ({ target: node.target.join(" "), ratio: node.any[0]?.data?.contrastRatio ?? null }));
    return {
      violations: result.violations.flatMap((rule) => rule.nodes.map((node) => `${rule.id}:${node.target.join(" ")}`)),
      contrastRatios: result.passes.filter((rule) => rule.id === "color-contrast").flatMap((rule) => nodes(rule.nodes)),
    };
  });
  assert.deepEqual(scan.violations, [], "expanded + selected extra row must be axe-clean");

  await page.locator("#panelClose").click();
  await waitFor(page, () => !document.body.classList.contains("panel-open"));
  await waitFor(page, (expected) => getComputedStyle(document.querySelector('.people .row[data-person="rauno"] .who a')).color === expected, ink);
  assert.equal(await whoColorOf("janikb"), ink, "closing restores the revealed rows too");
  assert.equal((await sectionState(page, "people")).expanded, true, "closing the panel leaves the list expanded");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  console.log("Measured color-contrast ratios (axe-core, expanded People + selected extra row):");
  for (const node of scan.contrastRatios) console.log(`  ${node.target} => ${node.ratio}:1`);
});

test("prefers-reduced-motion cancels the extras stagger in every section", { timeout: 60_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });
  // PR #19 added an explicit override inside the prefers-reduced-motion block
  // for `.expanded .row.extra`, because those rows enter through `animation`
  // (enter, 400ms, translateY + blur) and the blanket
  // `* { transition: none !important }` never touches an animation.
  const { page, consoleErrors, pageErrors } = await openSite(browser, server, { reducedMotion: "reduce" });

  assert.equal(
    await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
    true,
    "the emulation is actually on — otherwise everything below would pass for the wrong reason",
  );

  for (const { id, label } of SECTIONS) {
    await page.locator(`#${id}SeeMore`).click();
    await waitFor(page, (sectionId) => document.getElementById(sectionId).classList.contains("expanded"), id);
    await waitFor(page, (sectionId) => document.getElementById(`${sectionId}Extras`).getBoundingClientRect().height > 0, id);

    const computed = await page.evaluate(
      (sectionId) =>
        Array.from(document.querySelectorAll(`#${sectionId}Extras .row.extra`), (row) => {
          const style = getComputedStyle(row);
          return {
            animationName: style.animationName,
            opacity: style.opacity,
            transform: style.transform,
            filter: style.filter,
          };
        }),
      id,
    );

    assert.ok(computed.length > 0, `${label}: there are revealed rows to check`);
    for (const [index, row] of computed.entries()) {
      assert.equal(row.animationName, "none", `${label} row ${index}: the enter animation is cancelled`);
      // Without the override the rows would sit at the animation's start
      // values instead — opacity 0, translated 12px down, blurred 4px — i.e.
      // invisible, because nothing would ever animate them in.
      assert.equal(row.opacity, "1", `${label} row ${index}: fully visible`);
      assert.equal(row.transform, "none", `${label} row ${index}: not offset`);
      assert.equal(row.filter, "none", `${label} row ${index}: not blurred`);
    }
  }

  const runningOnExtras = await page.evaluate(
    () => document.getAnimations().filter((animation) => animation.effect?.target?.matches?.(".row.extra")).length,
  );
  assert.equal(runningOnExtras, 0, "no animation is left running on a revealed row");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
});
