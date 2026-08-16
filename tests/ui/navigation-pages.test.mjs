import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("page links stay out of homepage scroll-spy and clean URLs keep sibling pages reachable", { timeout: 30_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });

  const page = await browser.newPage({ viewport: { width: 901, height: 800 } });
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
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

  const pageLinks = page.locator('.topbar__nav a[href^="/"]');
  assert.deepEqual(await pageLinks.allTextContents(), ["index", "changelog", "prompts"]);
  assert.deepEqual(await pageLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))), [
    "/",
    "/changelog",
    "/prompts",
  ]);
  // The whole navbar is page links now — no in-page anchors left for the
  // scroll-spy to claim.
  assert.equal(await page.locator(".topbar__nav a").count(), 3);

  // "portfólio" is announced but not navigable yet: a non-interactive span
  // carrying the coming-soon tag, never a link or a Tab stop.
  const soon = page.locator(".topbar__soon");
  assert.equal(await soon.count(), 1);
  assert.match(await soon.textContent(), /portfólio/);
  assert.equal(await soon.locator(".topbar__soon-tag").textContent(), "coming soon");
  assert.equal(await soon.evaluate((element) => element.tagName), "SPAN");
  assert.equal(await soon.evaluate((element) => element.hasAttribute("tabindex")), false);

  const topbarBounds = await page.locator(".topbar").boundingBox();
  assert.ok(topbarBounds, "desktop topbar is rendered");
  assert.ok(topbarBounds.x >= 0, "901px topbar stays inside the leading edge");
  assert.ok(topbarBounds.x + topbarBounds.width <= 901, "901px topbar stays inside the trailing edge");

  const sectionIds = await page.locator("main > section[id]").evaluateAll((sections) =>
    sections.map((section) => section.id),
  );
  for (const id of sectionIds) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    assert.deepEqual(
      await pageLinks.evaluateAll((links) => links.map((link) => link.classList.contains("on"))),
      [false, false, false],
      `cross-page links stay inactive while #${id} intersects`,
    );
  }

  assert.deepEqual(
    await page.locator("footer a").allTextContents(),
    ["Prompts", "Changelog"],
    "mobile fallback navigation exposes both sibling pages",
  );

  await page.goto(`${server.origin}/changelog`, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).pathname, "/changelog");
  assert.equal(await page.locator("h1").textContent(), "Changelog");
  // The topbar now carries its own "prompts" link on this page too (the fix
  // under test), so the footer's matching "Prompts" link needs scoping to
  // stay a single match.
  assert.equal(
    await page.locator("footer").getByRole("link", { name: "Prompts" }).getAttribute("href"),
    "/prompts",
  );
  const changelogTopbarLinks = page.locator(".topbar__nav a[href^=\"/\"]");
  assert.deepEqual(await changelogTopbarLinks.allTextContents(), ["index", "changelog", "prompts"]);
  assert.deepEqual(
    await changelogTopbarLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ["/", "/changelog", "/prompts"],
  );
  await page.setViewportSize({ width: 320, height: 800 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth),
    true,
    "changelog footer navigation does not introduce mobile overflow",
  );

  await page.setViewportSize({ width: 901, height: 800 });
  await page.goto(`${server.origin}/prompts`, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).pathname, "/prompts");
  assert.equal(await page.locator("h1").textContent(), "Prompts");
  const promptsTopbarLinks = page.locator(".topbar__nav a[href^=\"/\"]");
  assert.deepEqual(await promptsTopbarLinks.allTextContents(), ["index", "changelog", "prompts"]);
  assert.deepEqual(
    await promptsTopbarLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ["/", "/changelog", "/prompts"],
  );

  await page.goto(server.origin, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator("h1").textContent(), "Design Engineer");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(failedResponses, []);
});
