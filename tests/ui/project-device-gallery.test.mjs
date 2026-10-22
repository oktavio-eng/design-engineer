import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './helpers/browser.mjs';
import { serveDirectory } from './helpers/static-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('device mockups preserve original sources, exclude composed artwork and remove failed captures', { timeout: 60_000 }, async context => {
  const server = await serveDirectory(root);
  context.after(() => server.close());
  const browser = await launchChromium();
  context.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({ status: 204, body: '' }));
  await page.route('https://framerusercontent.com/images/*.png', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><rect width="1440" height="1000" fill="white"/></svg>',
  }));
  await page.addInitScript(() => sessionStorage.setItem('intro-shown-v1', 'true'));
  await page.goto(server.origin, { waitUntil: 'load' });

  // Simulate the live Studio gallery before these local additions. Applying
  // supplements twice must preserve its captions and append each asset once.
  await page.evaluate(async () => {
    const content = window.PORTFOLIO_CONTENT;
    content.projects['caderno-de-erros'].gallery = content.projects['caderno-de-erros'].gallery.slice(0, 4);
    content.projects['caderno-de-erros'].gallery[0].caption = 'Studio caption';
    const { applyProjectMedia } = await import('/project-media.mjs');
    applyProjectMedia(content); applyProjectMedia(content);
  });

  for (const [key, laptops, phones, count] of [
    ['caderno-de-erros', 4, 0, 10], ['dascia', 2, 0, 10], ['finq-edu', 0, 9, 12], ['cloudfaster-academy', 0, 6, 15],
  ]) {
    await page.locator(`[data-proto-open="${key}"]`).click();
    assert.equal(await page.locator('.pgal__item').count(), count);
    assert.equal(await page.locator('.pgal__device--macbook').count(), laptops);
    assert.equal(await page.locator('.pgal__device--iphone').count(), phones);
    if (key === 'caderno-de-erros') {
      assert.equal(await page.locator('.pgal__caption').first().textContent(), 'Studio caption');
      assert.equal(await page.locator('.pgal__mobile-row .pgal__device').count(), 0);
    }
    if (key === 'finq-edu') {
      for (let i = 0; i < 3; i++) assert.equal(await page.locator('.pgal__item').nth(i).locator('.pgal__device').count(), 0);
    }
    if (key === 'cloudfaster-academy') {
      for (const item of await page.locator('.pgal__item').all()) {
        const source = await item.getAttribute('data-lightbox-src');
        if (/app-store-screen|card-/.test(source)) assert.equal(await item.locator('.pgal__device').count(), 0);
      }
    }
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const device = page.locator('.pgal__device').first();
      await device.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.pgal__device img')?.naturalWidth > 0);
      const geometry = await device.evaluate(el => {
        const screen = el.querySelector('.pgal__screen').getBoundingClientRect();
        const img = el.querySelector('img');
        const image = img.getBoundingClientRect();
        return { ratio: image.width / image.height, widthDiff: image.width - screen.width, heightDiff: image.height - screen.height, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.ok(Math.abs(geometry.ratio - (laptops ? 16 / 10 : 9 / 19.5)) < .01);
      assert.ok(Math.abs(geometry.widthDiff) < 1 && Math.abs(geometry.heightDiff) < 1);
      assert.equal(geometry.overflow, false);
      const trigger = device.locator('..');
      await trigger.focus(); await page.keyboard.press('Enter');
      await page.locator('[data-lightbox][aria-hidden="false"]').waitFor();
      assert.equal(await page.locator('[data-lightbox-img]').getAttribute('src'), await trigger.getAttribute('data-lightbox-src'));
      await page.keyboard.press('Escape');
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    }
    await page.keyboard.press('Escape');
  }
  await page.route('**/assets/projects/finq-edu/3-1-home.webp', route => route.fulfill({ status: 404, body: '' }));
  await page.reload({ waitUntil: 'load' });
  await page.locator('[data-proto-open="finq-edu"]').click();
  const missing = page.locator('.pgal__item[data-lightbox-src$="/3-1-home.webp"]');
  await page.locator('.pgal__img').evaluateAll(images => images.forEach(img => { img.loading = 'eager'; }));
  await missing.waitFor({ state: 'detached' });
  assert.equal(await page.locator('.pgal__device--iphone').count(), 8, 'failed captures remove the entire device, leaving no empty frame');
  assert.deepEqual(errors, []);
});
