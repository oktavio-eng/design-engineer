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

test("/prompts lists rows, opens the detail modal, copies the exact raw prompt, and survives responsive themes", { timeout: 60_000 }, async (context) => {
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
  await page.waitForSelector(".prompt-row");
  assert.equal(new URL(page.url()).pathname, "/prompts", "clean URL stays extensionless");
  assert.equal(await page.locator("h1").textContent(), "Prompts");

  // The collection is a curated list of rows now — the full prompt only
  // exists once a row opens the detail modal. The fintech dashboard prompt
  // stays first (index 0) with the curated Emil/Jakub-inspired prompts
  // appended after it, so every title/category renders in PROMPTS order.
  assert.equal(await page.locator(".prompt-row").count(), PROMPTS.length);
  assert.deepEqual(await page.locator(".prompt-row .who").allTextContents(), PROMPTS.map((p) => p.title));
  assert.deepEqual(await page.locator(".prompt-row .what").allTextContents(), PROMPTS.map((p) => p.category));
  assert.equal(await page.locator(".prompt-modal__content").count(), 0);

  // The rest of the interaction flow below drills into one specific prompt
  // (the original Wise-inspired one) — scope to it explicitly so it stays
  // unambiguous now that the collection holds several rows.
  const fintechRow = page.locator('.prompt-row[data-prompt-slug="fintech-dashboard-wise-inspired"]');

  const search = page.getByRole("searchbox", { name: "Search prompts" });
  for (const query of ["wise", "framer", "fintech", "transactions"]) {
    await search.fill(query);
    assert.equal(await page.locator(".prompt-row:not([hidden])").count(), 1, `${query}: exactly one prompt matches`);
    assert.equal(await fintechRow.isVisible(), true, `${query}: the Wise-inspired prompt remains visible`);
    assert.equal(await page.locator(".prompt-search__status").textContent(), "1 prompt");
  }

  await page.addScriptTag({ path: axeScriptPath });
  await assertReadableContrast(page, "light");
  await scanAxe(page, "filtered results");

  await search.fill("no matching workflow");
  assert.equal(await page.locator(".prompt-row:not([hidden])").count(), 0);
  assert.equal(await page.locator("[data-prompts-empty]").isVisible(), true);
  assert.equal(
    await page.locator("[data-prompts-empty-message]").textContent(),
    "No prompts found for “no matching workflow”.",
  );
  await scanAxe(page, "empty results");

  await page.locator(".prompt-clear").click();
  assert.equal(await search.inputValue(), "");
  assert.equal(await search.evaluate((element) => element === document.activeElement), true);
  assert.equal(await page.locator(".prompt-row:not([hidden])").count(), PROMPTS.length);

  // The pill's own clear control: appears with a query, wipes it, refocuses
  // the field, and leaves the tab order once hidden again.
  await search.fill("framer");
  const fieldClear = page.locator(".prompt-search__clear");
  assert.equal(await fieldClear.evaluate((element) => element.classList.contains("visible")), true);
  await fieldClear.click();
  assert.equal(await search.inputValue(), "");
  assert.equal(await search.evaluate((element) => element === document.activeElement), true);
  assert.equal(await fieldClear.evaluate((element) => element.classList.contains("visible")), false);

  // Keyboard path into the modal: Tab lands on the first row in DOM order
  // (the hidden clear control must not be a stop) — the Wise-inspired prompt
  // stays first, so this is still the fintech row, and Enter opens the
  // cmd+k-style detail for it.
  await search.focus();
  await page.keyboard.press("Tab");
  const row = page.locator(".prompt-row").first();
  assert.equal(await row.evaluate((element) => element === document.activeElement), true);
  assert.equal(await row.getAttribute("data-prompt-slug"), "fintech-dashboard-wise-inspired");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  const modal = page.locator("[data-prompt-modal]");
  assert.equal(await modal.getAttribute("aria-hidden"), "false");
  assert.equal(await modal.getAttribute("aria-label"), PROMPTS[0].title);
  assert.equal(
    await modal.locator("[data-prompt-modal-close]").evaluate((element) => element === document.activeElement),
    true,
    "the modal's close control takes focus on open",
  );
  assert.equal(await page.locator(".prompt-modal__title").textContent(), PROMPTS[0].title);
  assert.equal(await page.locator(".prompt-modal__description").textContent(), PROMPTS[0].description);
  assert.deepEqual(await page.locator(".prompt-tag").allTextContents(), PROMPTS[0].tags);
  assert.equal(await page.locator(".prompt-modal__content").textContent(), PROMPTS[0].prompt);
  await scanAxe(page, "open detail modal");

  // The Wise-inspired prompt is the longest entry — its detail modal must
  // cap at 600px tall and scroll internally rather than grow with the text.
  const modalBox = await modal.boundingBox();
  assert.ok(modalBox.height <= 601, `modal height ${modalBox.height}px exceeds the 600px cap`);
  const modalOverflow = await modal.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  assert.ok(
    modalOverflow.scrollHeight > modalOverflow.clientHeight,
    "the long prompt overflows the capped modal, proving the scrollbar is load-bearing here",
  );

  const copyButton = page.getByRole("button", { name: "Copy prompt" });
  await copyButton.click();
  await page.getByRole("button", { name: "Copied" }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), PROMPTS[0].prompt);
  assert.equal(await page.locator(".prompt-copy__status").textContent(), "Prompt copied to clipboard.");

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));
  assert.equal(await modal.getAttribute("aria-hidden"), "true");
  assert.equal(await modal.evaluate((element) => element.inert), true);
  assert.equal(
    await row.evaluate((element) => element === document.activeElement),
    true,
    "dismissing the modal restores focus to the opening row",
  );
  await scanAxe(page, "dismissed modal");

  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-theme")), false);
  // The topbar now starts hidden (pointer-events: none) until the page
  // scrolls, matching index.html — nudge it into view before clicking into it.
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
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
  assert.equal(await search.evaluate((element) => getComputedStyle(element).fontSize), "17.28px");
  assert.equal(await page.locator(".prompt-row").first().isVisible(), true);
  await scanAxe(page, "dark theme at 320px");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(failedResponses, []);
});
