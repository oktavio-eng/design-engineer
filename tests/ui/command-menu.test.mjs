import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function activeInfo(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    return {
      id: active?.id || "",
      hidden: Boolean(active?.closest?.('[aria-hidden="true"], [inert]')),
    };
  });
}

async function assertSafeFocus(page, expectedId) {
  const active = await activeInfo(page);
  assert.equal(active.id, expectedId);
  assert.equal(active.hidden, false, `#${active.id || "unknown"} is inside aria-hidden/inert`);
}

test("the production command palette preserves layered keyboard focus", { timeout: 30_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
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

  const opener = page.locator("#aboutTrigger");
  await opener.focus();
  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  await assertSafeFocus(page, "cmdInput");

  const firstResult = await page.locator('.cmd__item[aria-selected="true"] > span').first().textContent();
  await page.keyboard.press("ArrowDown");
  const secondResult = await page.locator('.cmd__item[aria-selected="true"] > span').first().textContent();
  assert.notEqual(secondResult, firstResult);
  await assertSafeFocus(page, "cmdInput");

  await page.locator("#cmdInput").fill("Emil");
  await page.keyboard.press("Enter");
  await assertSafeFocus(page, "cmdModalClose");
  assert.equal(await page.locator("#cmdModal h3").textContent(), "Emil Kowalski");

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  assert.equal(await page.locator("#cmdInput").inputValue(), "Emil");
  await page.keyboard.press("Escape");
  await assertSafeFocus(page, "aboutTrigger");

  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(100);
  await assertSafeFocus(page, "aboutTrigger");

  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
    document.querySelector(".cmd__item")?.click();
  });
  await page.waitForTimeout(100);
  await assertSafeFocus(page, "cmdModalClose");
  await page.locator("#cmdModalClose").click();
  await assertSafeFocus(page, "aboutTrigger");

  await page.keyboard.press("Meta+K");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  await page.keyboard.press("Meta+K");
  await assertSafeFocus(page, "aboutTrigger");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
});

// The palette is shared (cmd.mjs) and runs on every page, over the same
// content plus the prompts. This drives it on /prompts — the one page that
// has a second `.cmd-modal` (the prompt detail) — and on /changelog, which has
// no page-specific surface at all.
test("the command palette opens on every page, finds prompts, and never stacks on the prompt modal", { timeout: 30_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 204, body: "" }));

  const groups = () =>
    page.evaluate(() => [...document.querySelectorAll(".cmd__group")].map((group) => group.textContent));
  const visibleModals = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".cmd-modal")].filter((modal) => modal.getAttribute("aria-hidden") === "false").length,
    );

  // /prompts: a prompt modal is open; ⌘K swaps to the palette instead of stacking.
  await page.goto(`${server.origin}/prompts`, { waitUntil: "load" });
  await page.locator(".prompt-row").first().click();
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  await assertSafeFocus(page, "cmdInput");
  assert.equal(await page.locator("[data-prompt-modal]").getAttribute("aria-hidden"), "true");
  assert.deepEqual(await groups(), ["People", "Plan", "References", "Courses", "Reading", "Client work", "Personal projects", "Life", "Writing", "Prompts", "Pages"]);

  // Prompts match on tags too, and open with the /prompts detail sheet + copy button.
  await page.locator("#cmdInput").fill("mobbin");
  assert.equal(await page.locator(".cmd__item").count(), 1);
  await page.keyboard.press("Enter");
  await assertSafeFocus(page, "cmdModalClose");
  assert.equal(await visibleModals(), 1);
  assert.equal(await page.locator("#cmdModal.prompt-modal .prompt-copy").count(), 1);
  assert.equal(await page.locator("#cmdModal .prompt-modal__title").textContent(), "Fintech Dashboard — Wise-inspired");

  // Escape peels the palette's own layers, not the page's prompt modal.
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-open"));
  assert.equal(await visibleModals(), 0);
  // The palette handed focus back to what the prompt modal returned it to: its row.
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("prompt-row")), true);

  // Escape with only the prompt modal open still closes the prompt modal.
  await page.locator(".prompt-row").first().click();
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));

  // /changelog: no page surface at all — the palette still opens and shows a person.
  await page.goto(`${server.origin}/changelog`, { waitUntil: "load" });
  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  await page.locator("#cmdInput").fill("Rauno");
  await page.keyboard.press("Enter");
  await assertSafeFocus(page, "cmdModalClose");
  assert.equal(await page.locator("#cmdModal h3").textContent(), "Rauno Freiberg");
  await page.locator("#cmdModalClose").click();
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));

  // "Pages" navigates.
  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  await page.locator("#cmdInput").fill("prompts");
  await page.locator('.cmd__item:has(.what:text-is("prompts used in real work"))').click();
  await page.waitForURL(/\/prompts$/);

  assert.deepEqual(pageErrors, []);
});
