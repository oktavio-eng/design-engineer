import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diff } from "@blazediff/core";
import { PNG } from "pngjs";
import { launchChromium } from "../ui/helpers/browser.mjs";
import { serveDirectory } from "../ui/helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const staticDirectory = path.join(repositoryRoot, "storybook-static");
const baselineDirectory = path.join(repositoryRoot, "tests/visual/baselines");
const artifactDirectory = path.join(repositoryRoot, "artifacts/visual");
const updateBaselines = process.env.UPDATE_VISUAL_BASELINES === "1";

const cases = [
  { name: "colors-light", story: "foundations--colors", theme: "light", flatType: "off", width: 1024, height: 768 },
  { name: "colors-dark", story: "foundations--colors", theme: "dark", flatType: "off", width: 1024, height: 768 },
  { name: "typography-scale", story: "foundations--typography", theme: "light", flatType: "off", width: 1024, height: 900 },
  { name: "typography-flat", story: "foundations--typography", theme: "light", flatType: "on", width: 1024, height: 900 },
  { name: "rows-narrow", story: "patterns--rows", theme: "light", flatType: "off", width: 320, height: 800 },
  { name: "people-expanded-narrow", story: "patterns--expandable-people", theme: "light", flatType: "off", width: 320, height: 800, state: "expanded" },
  { name: "command-search-dark", story: "patterns-command-menu--keyboard-flow", theme: "dark", flatType: "off", width: 1024, height: 768, state: "command-open" },
];

async function captureStable(page) {
  let previous = await page.screenshot({ fullPage: true });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.waitForTimeout(100);
    const current = await page.screenshot({ fullPage: true });
    if (Buffer.compare(previous, current) === 0) return current;
    previous = current;
  }
  throw new Error("Story did not reach a stable visual frame");
}

async function applyState(page, visualCase) {
  if (visualCase.state === "expanded") {
    const button = page.locator(".see-more");
    if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
    await page.waitForFunction(() => document.querySelector(".people")?.classList.contains("expanded"));
    await page.mouse.move(0, 0);
  }

  if (visualCase.state === "command-open") {
    await page.locator(".sb-command-trigger").focus();
    await page.keyboard.press("Control+K");
    await page.waitForFunction(() => document.activeElement?.classList.contains("cmd__input"));
  }
}

async function assertContracts(page, visualCase) {
  const contracts = await page.evaluate(() => {
    const sample = document.querySelector(".sb-type-sample");
    const animated = document.querySelector(".cmd, .extras") ?? document.body;
    return {
      dark: document.documentElement.getAttribute("data-theme") === "dark",
      flatTypeEnabled: !document.getElementById("storybook-flat-type")?.disabled,
      fontFamily: sample ? getComputedStyle(sample).fontFamily : "",
      fontWeight: sample ? getComputedStyle(sample).fontWeight : "",
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      transitionDuration: getComputedStyle(animated).transitionDuration,
    };
  });

  assert.equal(contracts.dark, visualCase.theme === "dark");
  assert.equal(contracts.flatTypeEnabled, visualCase.flatType === "on");
  assert.equal(contracts.horizontalOverflow, false);
  assert.match(contracts.transitionDuration, /^(0s)(, 0s)*$/);
  if (visualCase.story === "foundations--typography") {
    assert.match(contracts.fontFamily, /Geist/);
    if (visualCase.flatType === "on") assert.equal(contracts.fontWeight, "460");
  }
}

function blurPixels(data, width, height, radius = 2) {
  const blurred = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const channels = [0, 0, 0, 0];
      let samples = 0;
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const sampleY = Math.max(0, Math.min(height - 1, y + offsetY));
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sampleX = Math.max(0, Math.min(width - 1, x + offsetX));
          const sampleIndex = (sampleY * width + sampleX) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            channels[channel] += data[sampleIndex + channel];
          }
          samples += 1;
        }
      }
      const outputIndex = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        blurred[outputIndex + channel] = channels[channel] / samples;
      }
    }
  }
  return blurred;
}

async function compareScreenshot(visualCase, screenshot) {
  const { name } = visualCase;
  const baselinePath = path.join(baselineDirectory, `${name}.png`);
  if (updateBaselines) {
    await writeFile(baselinePath, screenshot);
    return;
  }
  if (!existsSync(baselinePath)) {
    await writeFile(baselinePath, screenshot);
    assert.fail(`Created missing baseline ${path.relative(repositoryRoot, baselinePath)}; review it and rerun`);
  }

  const expected = PNG.sync.read(await readFile(baselinePath));
  const actual = PNG.sync.read(screenshot);
  await writeFile(path.join(artifactDirectory, `${name}-actual.png`), screenshot);
  assert.equal(actual.width, expected.width, `${name}: screenshot width changed`);
  assert.equal(actual.height, expected.height, `${name}: screenshot height changed`);

  const rawMismatchedPixels = diff(
    expected.data,
    actual.data,
    undefined,
    actual.width,
    actual.height,
    { threshold: 0.12, includeAA: false, diffMask: true },
  );
  const expectedBlurred = blurPixels(expected.data, actual.width, actual.height);
  const actualBlurred = blurPixels(actual.data, actual.width, actual.height);
  const output = new PNG({ width: actual.width, height: actual.height });
  const perceptualMismatchedPixels = diff(
    expectedBlurred,
    actualBlurred,
    output.data,
    actual.width,
    actual.height,
    { threshold: 0.12, includeAA: false, diffMask: true },
  );
  const totalPixels = actual.width * actual.height;
  const rawMismatchRatio = rawMismatchedPixels / totalPixels;
  const perceptualMismatchRatio = perceptualMismatchedPixels / totalPixels;
  if (rawMismatchRatio > 0.04 || perceptualMismatchRatio > 0.008) {
    await writeFile(path.join(artifactDirectory, `${name}-diff.png`), PNG.sync.write(output));
  }
  assert.ok(
    rawMismatchRatio <= 0.04 && perceptualMismatchRatio <= 0.008,
    `${name}: raw ${(rawMismatchRatio * 100).toFixed(2)}% (limit 4.00%), perceptual ${(perceptualMismatchRatio * 100).toFixed(2)}% (limit 0.80%)`,
  );
}

test("Storybook visual matrix stays within reviewed baselines", { timeout: 60_000 }, async (context) => {
  assert.ok(existsSync(path.join(staticDirectory, "index.html")), "Run npm run build-storybook first");
  await mkdir(baselineDirectory, { recursive: true });
  await mkdir(artifactDirectory, { recursive: true });
  const server = await serveDirectory(staticDirectory);
  const browser = await launchChromium();
  const browserContext = await browser.newContext({ reducedMotion: "reduce" });
  context.after(async () => {
    await browser.close();
    await server.close();
  });

  for (const visualCase of cases) {
    const page = await browserContext.newPage();
    await page.setViewportSize({ width: visualCase.width, height: visualCase.height });
    const globals = `theme:${visualCase.theme};flatType:${visualCase.flatType}`;
    const url = `${server.origin}/iframe.html?id=${visualCase.story}&viewMode=story&globals=${globals}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#storybook-root .sb-inventory");
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "* { caret-color: transparent !important; }" });
    await page.waitForTimeout(1_200);
    await applyState(page, visualCase);
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined))),
    );
    await assertContracts(page, visualCase);
    await compareScreenshot(visualCase, await captureStable(page));
    await page.close();
  }
});
