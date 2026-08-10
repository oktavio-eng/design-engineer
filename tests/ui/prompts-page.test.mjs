import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROMPTS } from "../../prompts.mjs";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const axeScriptPath = path.resolve(repositoryRoot, "node_modules/axe-core/axe.min.js");

async function scanAxe(page, state) {
  const violations = await page.evaluate(async () => {
    // axe-core 4.13 misparses Chrome's computed OKLCH serialization on this
    // full-page CSSOM walk. Keep every semantic rule active and verify actual
    // rendered contrast separately below through canvas-resolved RGB pixels.
    const result = await window.axe.run(document, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    return result.violations.flatMap((rule) =>
      rule.nodes.map((node) => `${rule.id}:${node.target.join(" ")}`),
    );
  });
  assert.deepEqual(violations, [], `${state} must be axe-clean`);
}

async function contrastRatios(page) {
  return page.evaluate(() => {
    const tokens = getComputedStyle(document.documentElement);
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const rgb = (cssColor) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = cssColor;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const luminance = (channels) => {
      const linear = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const ratio = (foreground, background) => {
      const first = luminance(rgb(foreground));
      const second = luminance(rgb(background));
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };
    const background = tokens.getPropertyValue("--bg");
    return {
      ink: ratio(tokens.getPropertyValue("--ink"), background),
      secondary: ratio(tokens.getPropertyValue("--muted"), background),
    };
  });
}

async function assertReadableContrast(page, theme) {
  const ratios = await contrastRatios(page);
  assert.ok(ratios.ink >= 4.5, `${theme} ink contrast is ${ratios.ink.toFixed(2)}:1`);
  assert.ok(
    ratios.secondary >= 4.5,
    `${theme} secondary contrast is ${ratios.secondary.toFixed(2)}:1`,
  );
}

test("/prompts searches, clears, copies the exact raw prompt, and survives responsive themes", { timeout: 60_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });

  const browserContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await browserContext.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // axe-core re-resolves main.css's @imports against /tokens while walking
    // the CSSOM. The same scanner-only noise is filtered by the existing
    // product tests; real page requests resolve /styles/tokens correctly.
    if (
      /Failed to load resource.*404/.test(message.text()) &&
      /\/tokens\/.+\.css/.test(message.location().url)
    ) {
      return;
    }
    consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    if (/\/tokens\/.+\.css$/.test(new URL(response.url()).pathname)) return;
    failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    if (route.request().resourceType() === "stylesheet") {
      return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    }
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto(`${server.origin}/prompts`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".prompt-entry");
  assert.equal(new URL(page.url()).pathname, "/prompts", "clean URL stays extensionless");
  assert.equal(await page.locator("h1").textContent(), "Prompts");
  assert.equal(await page.locator(".prompt-entry__content").textContent(), PROMPTS[0].prompt);
  assert.equal(await page.locator(".prompt-entry__title").textContent(), PROMPTS[0].title);
  assert.equal(await page.locator(".prompt-entry__description").textContent(), PROMPTS[0].description);
  assert.deepEqual(await page.locator(".prompt-tag").allTextContents(), PROMPTS[0].tags);

  const search = page.getByRole("searchbox", { name: "Search prompts" });
  for (const query of ["wise", "framer", "fintech", "transactions"]) {
    await search.fill(query);
    assert.equal(await page.locator(".prompt-entry").isVisible(), true, `${query}: prompt remains visible`);
    assert.equal(await page.locator(".prompt-search__status").textContent(), "1 prompt");
  }

  await page.addScriptTag({ path: axeScriptPath });
  await assertReadableContrast(page, "light");
  await scanAxe(page, "filtered results");

  await search.fill("no matching workflow");
  assert.equal(await page.locator(".prompt-entry").isVisible(), false);
  assert.equal(await page.locator("[data-prompts-empty]").isVisible(), true);
  assert.equal(
    await page.locator("[data-prompts-empty-message]").textContent(),
    "No prompts found for “no matching workflow”.",
  );
  await scanAxe(page, "empty results");

  await page.getByRole("button", { name: "Clear search" }).click();
  assert.equal(await search.inputValue(), "");
  assert.equal(await search.evaluate((element) => element === document.activeElement), true);
  assert.equal(await page.locator(".prompt-entry").isVisible(), true);

  await search.fill("framer");
  await search.focus();
  await page.keyboard.press("Tab");
  const copyButton = page.getByRole("button", { name: "Copy prompt" });
  assert.equal(await copyButton.evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Copied" }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), PROMPTS[0].prompt);
  assert.equal(await page.locator(".prompt-copy__status").textContent(), "Prompt copied to clipboard.");
  await scanAxe(page, "copied feedback");

  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-theme")), false);
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-theme")), "dark");
  await assertReadableContrast(page, "dark");
  await scanAxe(page, "dark theme");

  await page.setViewportSize({ width: 320, height: 800 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth),
    true,
    "320px viewport has no page-level horizontal overflow",
  );
  assert.equal(await search.evaluate((element) => getComputedStyle(element).fontSize), "17.92px");
  assert.equal(await page.locator(".prompt-copy").isVisible(), true);
  await scanAxe(page, "dark theme at 320px");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(failedResponses, []);
});
