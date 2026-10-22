import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './helpers/browser.mjs';
import { serveDirectory } from './helpers/static-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
test('drawer content enters once on scroll, stays accessible and cancels on close or reduced motion', { timeout: 60_000 }, async context => {
  const server = await serveDirectory(root);
  const browser = await launchChromium();
  context.after(async () => { await browser.close(); await server.close(); });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({ status: 204, body: '' }));
  await page.addInitScript(() => {
    sessionStorage.setItem('intro-shown-v1', 'true');
    window.entrances = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.closest('[data-proto-sheet-body]')) window.entrances.push({ element: this, animation });
      return animation;
    };
  });
  await page.goto(server.origin);
  await page.bringToFront();
  const trigger = page.locator('[data-proto-open="assopra-store"]');
  await trigger.click();
  await page.waitForFunction(() => window.entrances.length > 0);
  const item = page.locator('.pgal__item').last();
  assert.equal(await item.evaluate(el => window.entrances.filter(a => a.element === el).length), 0);
  await item.scrollIntoViewIfNeeded();
  await page.waitForFunction(el => window.entrances.some(a => a.element === el), await item.elementHandle());
  const timing = await item.evaluate(el => {
    const { animation } = window.entrances.find(a => a.element === el);
    return { duration: animation.effect.getTiming().duration, frames: animation.effect.getKeyframes() };
  });
  assert.equal(timing.duration, 250);
  assert.equal(timing.frames[0].transform, 'translateY(8px)');
  await item.focus();
  assert.equal(await item.evaluate(el => el.getAnimations().length), 0, 'focused content is immediately visible');
  await page.locator('.pdrawer').evaluate(el => { el.scrollTop = 0; });
  await item.scrollIntoViewIfNeeded();
  assert.equal(await item.evaluate(el => window.entrances.filter(a => a.element === el).length), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.entrances.filter(a => a.animation.playState === 'running').length), 0);

  await page.evaluate(() => { window.entrances = []; });
  await trigger.focus(); await page.keyboard.press('Enter');
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.entrances.length), 0, 'keyboard opening stays immediate');
  await page.keyboard.press('Escape');
  await trigger.click();
  await page.waitForFunction(() => window.entrances.length > 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.entrances.every(a => a.animation.playState !== 'running'));
  await page.evaluate(() => { window.entrances = []; });
  await item.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.entrances.length), 0);
  assert.equal(await item.evaluate(el => getComputedStyle(el).opacity), '1');
});
