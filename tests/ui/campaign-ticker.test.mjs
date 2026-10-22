import assert from 'node:assert/strict';
import {test} from 'node:test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchChromium} from './helpers/browser.mjs';
import {serveDirectory} from './helpers/static-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
test('campaign tickers span the drawer, pause, drag, loop without clones and preserve keyboard lightboxes', {timeout: 60_000}, async context => {
  const server = await serveDirectory(root);
  const browser = await launchChromium();
  context.after(async () => {await browser.close(); await server.close();});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'no-preference'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({status: 204, body: ''}));
  await page.addInitScript(() => sessionStorage.setItem('intro-shown-v1', 'true'));
  await page.goto(server.origin);
  for (const [key, banners] of [['meta-suplementos', 5], ['assopra-store', 3]]) {
    await page.locator(`[data-proto-open="${key}"]`).click();
    const track = page.locator('[data-ticker-track]');
    const ticker = page.locator('[data-campaign-ticker]');
    await track.scrollIntoViewIfNeeded();
    await page.locator('.pdrawer').evaluate(el => Promise.allSettled(el.getAnimations().map(a => a.finished)));
    const geometry = await track.evaluate(el => {
      const rail = el.getBoundingClientRect(), sheet = el.closest('.pdrawer').getBoundingClientRect();
      const group = el.closest('.pgal__ticker');
      return {left: rail.left - sheet.left, right: sheet.right - rail.right, before: !!group.previousElementSibling, after: !!group.nextElementSibling};
    });
    assert.ok(Math.abs(geometry.left) < 1 && Math.abs(geometry.right) < 1, JSON.stringify(geometry));
    assert.ok(geometry.before && geometry.after, 'campaigns sit between catalogue and purchase screens');
    assert.equal(await page.locator('.pgal__item').count(), 23);
    if (key === 'meta-suplementos') {
      assert.equal(await page.locator('.pgal__item img[src$="home-macbook.png"]').count(), 0);
      assert.equal(await page.locator('.pgal__item img[src$="ironhair-feature-macbook.png"]').count(), 0);
      assert.equal(await page.locator('.pdrawer__shot--framed[src$="home-macbook.png"]').count(), 1);
    }
    await page.mouse.move(10, 10);
    await page.bringToFront();
    await page.waitForFunction(() => document.querySelector('[data-campaign-ticker]').dataset.running === 'true', null, {timeout: 10_000});
    const start = await track.evaluate(el => el.scrollLeft);
    await page.waitForFunction(x => document.querySelector('[data-ticker-track]').scrollLeft > x + 8, start);
    const box = await track.boundingBox();
    await page.mouse.move(box.x + 240, box.y + box.height / 2);
    await page.waitForFunction(() => document.querySelector('[data-campaign-ticker]').dataset.running === 'false');
    const paused = await track.evaluate(el => el.scrollLeft);
    await page.waitForTimeout(200);
    assert.equal(await track.evaluate(el => el.scrollLeft), paused, 'hover pauses in place');
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + box.height / 2, {steps: 10});
    await page.mouse.up();
    assert.ok(await track.evaluate(el => el.scrollLeft) > paused + 100, 'mouse drag is direct');
    assert.equal(await page.locator('[data-lightbox]').getAttribute('aria-hidden'), 'true', 'drag does not open a photo');
    const toggle = page.locator('[data-ticker-toggle]');
    await toggle.click();
    assert.equal(await toggle.textContent(), 'Play');
    await toggle.click();
    await toggle.evaluate(el => el.blur());
    await ticker.evaluate(el => el.style.setProperty('--campaign-ticker-speed', '1200'));
    const first = await track.locator('button').first().getAttribute('data-lightbox-src');
    await page.mouse.move(10, 10);
    await page.waitForFunction(src => document.querySelector('[data-ticker-track] button').dataset.lightboxSrc !== src, first);
    assert.equal(await track.locator('button').count(), banners, 'loop recycles original buttons without clones');
    const photo = track.locator('button').first();
    await photo.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await track.locator('button').nth(1).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    await page.locator('[data-lightbox][aria-hidden="false"]').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await track.locator('button').nth(1).evaluate(el => el === document.activeElement), true);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await toggle.waitFor({state: 'hidden'});
    await photo.evaluate(el => el.blur());
    await page.waitForFunction(() => document.querySelector('[data-campaign-ticker]').dataset.running === 'false');
    assert.equal(await toggle.isVisible(), false);
    const still = await track.evaluate(el => el.scrollLeft);
    await page.waitForTimeout(200);
    assert.equal(await track.evaluate(el => el.scrollLeft), still, 'reduced motion stops autoplay');
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({width, height: 1000});
      await track.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const fits = await track.evaluate(el => {
        const a = el.getBoundingClientRect(), b = el.closest('.pdrawer').getBoundingClientRect();
        return Math.abs(a.left - b.left) < 1 && Math.abs(a.right - b.right) < 1;
      });
      assert.ok(fits, `${key} full bleed at ${width}px`);
    }
    await page.keyboard.press('Escape');
    await page.setViewportSize({width: 1440, height: 1000});
    await page.emulateMedia({reducedMotion: 'no-preference'});
  }
  assert.deepEqual(errors, []);
});
