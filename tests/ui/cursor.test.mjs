import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// The iPadOS pointer (cursor.mjs) on the real pages: it only exists once a
// mouse moves, picks a mode from what's under the point, hides the OS cursor
// while it's on and gives it back over `[data-cursor="native"]`, fades out
// when idle, and never mounts under prefers-reduced-motion.
const state = (page) =>
  page.evaluate(() => {
    const c = window.__ipadCursor;
    const el = document.querySelector(".ipad-cursor");
    return {
      mounted: Boolean(c),
      element: Boolean(el),
      on: document.documentElement.classList.contains("cursor-on"),
      native: document.documentElement.classList.contains("cursor-native"),
      bodyCursor: getComputedStyle(document.body).cursor,
      target: c ? c.target : null,
      hover: c && c.hoverElement ? c.hoverElement.tagName + "." + c.hoverElement.className : null,
      ariaHidden: el ? el.getAttribute("aria-hidden") : null,
      pointerEvents: el ? getComputedStyle(el).pointerEvents : null,
    };
  });

async function ready(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.setItem("intro-shown-v1", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
}

test("cursor.mjs: mounts on mouse move, resolves modes per target, hides/restores the OS cursor, fades on idle", { timeout: 40_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await ready(page, `${server.origin}/wiki`);

  // Before any pointer movement: mounted (device is fine/hover) but inert —
  // no class on <html>, OS cursor untouched, overlay invisible.
  let s = await state(page);
  assert.equal(s.mounted, true, "module mounted on a fine-pointer device");
  assert.equal(s.on, false, "no cursor-on class before the mouse moves");
  assert.equal(s.bodyCursor, "auto", "OS cursor untouched before the mouse moves");
  assert.equal(s.ariaHidden, "true", "overlay is aria-hidden");
  assert.equal(s.pointerEvents, "none", "overlay never intercepts events");

  // Keyboard-only use never turns it on.
  await page.keyboard.press("Tab");
  s = await state(page);
  assert.equal(s.on, false, "keyboard focus does not activate the pointer");

  // Dot over empty page.
  await page.mouse.move(1000, 300);
  await page.mouse.move(1004, 302);
  await page.waitForTimeout(80);
  s = await state(page);
  assert.equal(s.on, true, "first mouse move activates the pointer");
  assert.equal(s.bodyCursor, "none", "OS cursor hidden while on");
  assert.equal(s.target.mode, "dot");
  assert.equal(s.target.o, 1);
  assert.deepEqual([s.target.x, s.target.y], [1004, 302], "dot follows the mouse 1:1");

  // I-beam over prose, locked to the line box.
  const p = await page.locator("main p").first().boundingBox();
  await page.mouse.move(p.x + 60, p.y + 10);
  await page.waitForTimeout(80);
  s = await state(page);
  assert.equal(s.target.mode, "text");
  assert.equal(s.target.w, 2, "beam is 2px wide");
  assert.ok(s.target.h > 12 && s.target.h < 32, `beam takes the line's height (${s.target.h})`);

  // Merge into a page row (the row already paints its own hover fill).
  const row = page.locator(".people .row").first();
  await row.scrollIntoViewIfNeeded();
  const rb = await row.boundingBox();
  await page.mouse.move(rb.x + 40, rb.y + rb.height / 2);
  await page.waitForTimeout(80);
  s = await state(page);
  assert.equal(s.target.mode, "merge", "rows merge instead of double-highlighting");
  assert.equal(s.target.o, 0, "merged pointer is invisible — the row's fill is the highlight");
  assert.equal(Math.round(s.target.w), Math.round(rb.width), "merge takes the row's exact width");
  assert.match(s.hover, /^DIV\.row/, "the row (not the link inside it) is the target");
  const rowStillFilled = await row.evaluate((el) => getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)");
  assert.equal(rowStillFilled, true, "the row's own :hover fill is untouched");

  // Rect around a text link (footer): the text's box, padded, not the hit box.
  const link = page.locator("footer a").first();
  await link.scrollIntoViewIfNeeded();
  const lb = await link.boundingBox();
  await page.mouse.move(lb.x + 6, lb.y + lb.height / 2);
  await page.waitForTimeout(80);
  s = await state(page);
  assert.equal(s.target.mode, "rect");
  assert.equal(s.target.o, 1);
  assert.ok(s.target.w > lb.width && s.target.w < lb.width + 24, "rect pads the link a little");

  // Ring around the avatar (image button).
  const av = page.locator("#avatarTrigger");
  await av.scrollIntoViewIfNeeded();
  const ab = await av.boundingBox();
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await page.waitForTimeout(80);
  s = await state(page);
  assert.equal(s.target.mode, "ring", "image buttons get the outline, not a fill");
  await page.waitForTimeout(250); // background-color transition (--duration-120)
  const ringStyle = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".ipad-cursor"));
    return { bg: cs.backgroundColor, shadow: cs.boxShadow };
  });
  assert.equal(ringStyle.bg, "rgba(0, 0, 0, 0)", "ring has no fill");
  assert.match(ringStyle.shadow, /inset/, "ring is drawn as an inset stroke");

  // Native escape: the sidebar resize handle keeps col-resize. Only "The
  // plan" phases open #panel as a sidebar (people open it as a modal).
  const head = page.locator(".phase-head").first();
  await head.scrollIntoViewIfNeeded();
  await head.click();
  await page.waitForTimeout(600);
  const handle = page.locator("#panelResize");
  const hb = await handle.boundingBox();
  assert.ok(hb, "resize handle is on screen with the panel open");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.waitForTimeout(80);
  s = await state(page);
  assert.equal(s.native, true, "cursor-native set over [data-cursor=native]");
  assert.equal(s.target.o, 0, "custom pointer hides over native targets");
  const handleCursor = await handle.evaluate((el) => getComputedStyle(el).cursor);
  assert.equal(handleCursor, "col-resize", "the handle's own cursor is back");
  await page.mouse.move(60, 700); // left gutter — empty even with the sidebar open
  await page.mouse.move(62, 702);
  await page.waitForTimeout(80);
  s = await state(page);
  assert.equal(s.native, false, "cursor-native clears once the mouse leaves");
  assert.equal(s.bodyCursor, "none");
  assert.equal(s.target.mode, "dot");

  // Press: the dot shrinks; release: it grows back.
  await page.mouse.down();
  await page.waitForTimeout(40);
  s = await state(page);
  assert.equal(s.target.pressed, true);
  assert.ok(s.target.w < 20, "dot shrinks on press");
  await page.mouse.up();
  await page.waitForTimeout(40);
  s = await state(page);
  assert.equal(s.target.pressed, false);
  assert.equal(s.target.w, 20);

  // Idle: fades after --cursor-idle (2000ms) without movement.
  await page.waitForTimeout(2300);
  s = await state(page);
  assert.equal(s.target.o, 0, "pointer fades after the idle window");
  await page.mouse.move(70, 705);
  await page.waitForTimeout(40);
  s = await state(page);
  assert.equal(s.target.o, 1, "any movement wakes it");

  assert.deepEqual(pageErrors, [], "no page errors");
});

test("cursor.mjs: never mounts under prefers-reduced-motion; other pages load it", { timeout: 30_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });

  const reduced = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1100, height: 800 } });
  const rp = await reduced.newPage();
  await ready(rp, `${server.origin}/`);
  await rp.mouse.move(500, 300);
  await rp.mouse.move(510, 305);
  await rp.waitForTimeout(80);
  let s = await state(rp);
  assert.equal(s.mounted, false, "reduced motion: module bails before creating anything");
  assert.equal(s.element, false);
  assert.equal(s.on, false);
  assert.equal(s.bodyCursor, "auto", "reduced motion keeps the OS cursor");
  await reduced.close();

  for (const route of ["/", "/changelog", "/prompts"]) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${server.origin}${route}`, { waitUntil: "networkidle" });
    await page.mouse.move(900, 300);
    await page.mouse.move(905, 305);
    await page.waitForTimeout(80);
    s = await state(page);
    assert.equal(s.mounted, true, `${route}: mounted`);
    assert.equal(s.on, true, `${route}: on after a mouse move`);
    assert.equal(s.target.mode, "dot", `${route}: dot over empty space`);
    assert.deepEqual(pageErrors, [], `${route}: no page errors`);
    await page.close();
  }
});
