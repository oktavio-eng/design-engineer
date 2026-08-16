import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const axeScriptPath = path.resolve(repositoryRoot, "node_modules/axe-core/axe.min.js");

async function scanAxe(page, state) {
  const violations = await page.evaluate(async () => {
    // Same carve-out as prompts-page.test.mjs: axe 4.13 misparses Chrome's
    // OKLCH serialization for color-contrast on a full-page walk; every
    // semantic rule stays on.
    const result = await window.axe.run(document, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    return result.violations.flatMap((rule) => rule.nodes.map((node) => `${rule.id}:${node.target.join(" ")}`));
  });
  assert.deepEqual(violations, [], `${state} must be axe-clean`);
}

async function activeInfo(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    return {
      id: active?.id || "",
      className: active?.className || "",
      hidden: Boolean(active?.closest?.('[aria-hidden="true"], [inert]')),
    };
  });
}

// / (the portfolio home): rows open the ⌘K detail card directly (no back button), the
// gallery opens the lightbox, the graph renders from data/contributions.json,
// drafts stay off the published page, and ⌘K finds portfolio entries.
test("/ (portfolio home) renders its collections, opens rows and photos in modals, and stays axe-clean", { timeout: 40_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });
  const data = JSON.parse(await readFile(path.join(repositoryRoot, "data/contributions.json"), "utf8"));

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
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

  // 127.0.0.1 counts as localhost, so drafts render here — assert both modes.
  await page.goto(`${server.origin}/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll(".row-btn").length > 0);
  await page.addScriptTag({ path: axeScriptPath });

  const sections = await page.evaluate(() =>
    [...document.querySelectorAll("main > section[id]")].map((s) => `${s.id}${s.hidden ? ":hidden" : ""}`),
  );
  assert.deepEqual(sections, ["positioning", "contributions", "writing", "clients", "personal", "life", "gallery"]);
  assert.equal(await page.locator('[data-list="clients"] .row--draft').count(), 3, "drafts show on localhost");

  // Contribution graph: real data file, one cell per day plus the Sunday pad,
  // and the total in the footer matches the file.
  await page.waitForFunction(() => document.querySelectorAll(".contrib__grid .contrib__cell").length > 0);
  const cells = await page.locator(".contrib__grid .contrib__cell").count();
  assert.ok(cells >= data.days.length && cells <= data.days.length + 6, `grid has a cell per day (${cells})`);
  assert.equal(
    await page.locator("[data-contrib-total]").textContent(),
    `${data.total.toLocaleString("en-US")} contribution${data.total === 1 ? "" : "s"} in the last year`,
  );

  // Hover readout on the graph: the first tooltip waits, then shows the day's
  // count; sweeping to the next cell is instant; leaving hides it.
  const cellA = page.locator(".contrib__grid .contrib__cell[data-date]").nth(200);
  const cellB = page.locator(".contrib__grid .contrib__cell[data-date]").nth(201);
  const tipLocator = page.locator(".contrib__tip");
  await cellA.hover();
  await page.waitForFunction(() => document.querySelector(".contrib__tip")?.dataset.open === "true");
  const [dateA, countA] = await cellA.evaluate((c) => [c.dataset.date, Number(c.dataset.count)]);
  assert.match(await tipLocator.textContent(), new RegExp(`^${countA === 0 ? "No" : countA} contributions? on `), `tip reads ${dateA}`);
  assert.equal(await tipLocator.getAttribute("aria-hidden"), "true", "tip is decorative; the total is the summary");
  await cellB.hover();
  assert.equal(await tipLocator.evaluate((t) => t.classList.contains("contrib__tip--instant")), true, "second cell is instant");
  assert.equal(await cellB.evaluate((c) => c.classList.contains("is-hover")), true);
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelector(".contrib__tip")?.dataset.open === "false");

  // Writing rows are buttons with the doc icon (icon decorative) that open
  // the shared modal in place — never a navigation.
  assert.equal(await page.locator(".doc-list .doc-item").count(), 3);
  assert.equal(await page.locator(".doc-list .doc-icon").first().getAttribute("aria-hidden"), "true");
  await page.locator('[data-open="writing:changelog"]').click();
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  assert.equal(new URL(page.url()).pathname, "/", "writing opens in a modal, not another page");
  assert.equal(await page.locator("#cmdModal h3").textContent(), "Changelog, as a habit");
  assert.equal(await page.locator('#cmdModal a[href="/changelog"]').count(), 1, "the modal carries the link to read it");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));

  await scanAxe(page, "portfolio, resting");

  // A personal row opens the ⌘K detail card directly: no back button, focus
  // on ×, Escape dismisses and returns focus to the row.
  const row = page.locator('[data-open="personal:design-engineer"]');
  await row.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  assert.equal(await page.locator("#cmdModal h3").textContent(), "design-engineer");
  assert.equal(await page.locator("#cmdModal").evaluate((m) => m.classList.contains("cmd-modal--direct")), true);
  assert.equal(await page.locator("#cmdModalBack").evaluate((b) => getComputedStyle(b).display), "none");
  assert.deepEqual(await activeInfo(page).then((a) => [a.id, a.hidden]), ["cmdModalClose", false]);
  await scanAxe(page, "portfolio, detail open");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-open")), "personal:design-engineer");
  assert.equal(await page.locator("#cmd").getAttribute("aria-hidden"), "true", "Escape from a direct detail does not reopen the list");

  // Gallery → lightbox: opens on the clicked photo, × has focus, Escape
  // closes and focus goes back to the thumbnail; ⌘K on top of it swaps.
  const first = page.locator(".gallery__item").first();
  await first.scrollIntoViewIfNeeded();
  await first.click();
  await page.waitForFunction(() => document.querySelector("[data-lightbox]").getAttribute("aria-hidden") === "false");
  assert.equal(await page.locator("[data-lightbox-img]").getAttribute("src"), await first.getAttribute("data-lightbox-src"));
  assert.equal(await page.locator("[data-lightbox-text]").textContent(), await first.getAttribute("data-lightbox-caption"));
  assert.equal(await page.locator(".gallery__item .gallery__img").count(), 3, "opening the lightbox leaves every thumbnail intact");
  assert.deepEqual(await activeInfo(page).then((a) => [a.className.includes("lightbox__close"), a.hidden]), [true, false]);
  await scanAxe(page, "portfolio, lightbox open");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("[data-lightbox]").getAttribute("aria-hidden") === "true");
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("gallery__item")), true);
  await first.click();
  await page.waitForFunction(() => document.querySelector("[data-lightbox]").getAttribute("aria-hidden") === "false");
  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  assert.equal(await page.locator("[data-lightbox]").getAttribute("aria-hidden"), "true", "⌘K folds the lightbox");

  // ⌘K indexes the portfolio collections (and drafts, since localhost).
  await page.locator("#cmdInput").fill("gow");
  assert.equal(await page.locator('.cmd__item:has-text("GOW Studio")').count(), 1);
  await page.locator("#cmdInput").fill("template A");
  assert.equal(await page.locator(".cmd__item").count(), 1, "drafts are searchable on localhost");
  await page.keyboard.press("Escape");

  // Narrow viewport: no horizontal overflow, gallery drops to two columns.
  await page.setViewportSize({ width: 320, height: 800 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth),
    true,
    "320px viewport has no horizontal overflow",
  );
  assert.equal(
    await page.locator(".gallery").evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length),
    2,
  );

  assert.deepEqual(pageErrors, []);
});

// The published page hides drafts. The module keys on location.hostname, so
// serve the same files under a non-loopback host name: every request to
// portfolio.test is answered from the local server.
test("portfolio drafts are hidden unless on localhost or ?draft", { timeout: 20_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });
  const page = await browser.newPage();
  await page.route(/^https?:\/\/portfolio\.test\//, async (route) => {
    const url = new URL(route.request().url());
    const upstream = await fetch(server.origin + url.pathname + url.search);
    route.fulfill({
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/octet-stream" },
      body: Buffer.from(await upstream.arrayBuffer()),
    });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|portfolio\.test)/, (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("http://portfolio.test/", { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll('[data-list="personal"] .row-btn').length > 0);
  assert.equal(await page.locator('[data-list="clients"] .row-btn').count(), 0, "no draft rows in production");
  assert.equal(await page.locator("#clients").evaluate((s) => s.hidden), true, "clients section hidden when it has nothing to show");
  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  await page.locator("#cmdInput").fill("template");
  assert.equal(await page.locator(".cmd__item").count(), 0, "drafts are not indexed by ⌘K in production");
  // And ?draft turns them back on, for reviewing the placeholders in place.
  await page.goto("http://portfolio.test/?draft", { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll('[data-list="clients"] .row-btn').length > 0);
  assert.equal(await page.locator('[data-list="clients"] .row--draft').count(), 3);
});
