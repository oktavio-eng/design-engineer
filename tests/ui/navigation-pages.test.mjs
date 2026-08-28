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

  await page.goto(`${server.origin}/wiki`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("intro-playing"));

  const pageLinks = page.locator('.topbar__nav a[href^="/"]');
  assert.deepEqual(await pageLinks.allTextContents(), ["Home", "Wiki", "Changelog", "Prompts"]);
  assert.deepEqual(await pageLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))), [
    "/",
    "/wiki",
    "/changelog",
    "/prompts",
  ]);
  // The whole navbar is page links now — no in-page anchors left for the
  // scroll-spy to claim, and no "coming soon" span since the portfolio shipped
  // (16/08/2026).
  assert.equal(await page.locator(".topbar__nav a").count(), 4);
  assert.equal(await page.locator(".topbar__soon").count(), 0);

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
      [false, false, false, false],
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
  assert.deepEqual(await changelogTopbarLinks.allTextContents(), ["Home", "Wiki", "Changelog", "Prompts"]);
  assert.deepEqual(
    await changelogTopbarLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ["/", "/wiki", "/changelog", "/prompts"],
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
  assert.deepEqual(await promptsTopbarLinks.allTextContents(), ["Home", "Wiki", "Changelog", "Prompts"]);
  assert.deepEqual(
    await promptsTopbarLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ["/", "/wiki", "/changelog", "/prompts"],
  );

  await page.goto(server.origin, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(await page.locator("h1").textContent(), "Portfolio");
  assert.deepEqual(await page.locator(".topbar__nav a[href^=\"/\"]").allTextContents(), ["Home", "Wiki", "Changelog", "Prompts"]);

  await page.goto(`${server.origin}/wiki`, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator("h1").textContent(), "Design Engineer");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(failedResponses, []);
});

async function topbarState(page) {
  return page.evaluate(() => {
    const topbar = document.querySelector(".topbar");
    return {
      visible: topbar.classList.contains("visible"),
      ariaHidden: topbar.getAttribute("aria-hidden"),
      inert: topbar.inert,
    };
  });
}

for (const routePath of ["/changelog", "/prompts", "/"]) {
  test(`${routePath}'s topbar reveals on scroll and hides on idle, matching wiki.html`, { timeout: 30_000 }, async (context) => {
    const server = await serveDirectory(repositoryRoot);
    const browser = await launchChromium();
    context.after(async () => {
      await browser.close();
      await server.close();
    });

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    // The home plays the intro too since 16/08/2026 (intro.js) — skip it the
    // same way the wiki tests do.
    await page.addInitScript(() => sessionStorage.setItem("intro-shown-v1", "true"));

    await page.goto(`${server.origin}${routePath}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.documentElement.classList.contains("intro-playing"));

    // Starts hidden — no "visible" class, aria-hidden, and inert so its real
    // links can't be Tab-reached while invisible (the aria-hidden-focus trap
    // axe caught before `inert` was added here).
    assert.deepEqual(await topbarState(page), { visible: false, ariaHidden: "true", inert: true }, "initial state");

    await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
    assert.deepEqual(
      await topbarState(page),
      { visible: true, ariaHidden: "false", inert: false },
      "revealed on scroll",
    );
    await page.locator(".topbar__logo").waitFor({ state: "visible" });

    await page.waitForTimeout(1500);
    assert.deepEqual(await topbarState(page), { visible: false, ariaHidden: "true", inert: true }, "hidden after idle");

    // Hovering the bar itself holds it open past the idle window…
    await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
    await page.hover(".topbar__logo");
    await page.waitForTimeout(1500);
    assert.deepEqual(
      await topbarState(page),
      { visible: true, ariaHidden: "false", inert: false },
      "stays visible while hovered, even past the idle window",
    );

    // …and releasing it lets the idle timer hide it again.
    await page.mouse.move(640, 700);
    await page.waitForTimeout(1500);
    assert.deepEqual(
      await topbarState(page),
      { visible: false, ariaHidden: "true", inert: true },
      "hides again after the pointer leaves and the idle window elapses",
    );

    assert.deepEqual(pageErrors, []);
  });
}
