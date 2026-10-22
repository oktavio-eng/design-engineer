import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './helpers/browser.mjs';
import { serveDirectory } from './helpers/static-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Meta preserves framed images and keyboard access in responsive masonry', async context => {
  const server = await serveDirectory(root);
  context.after(() => server.close());
  const browser = await launchChromium();
  context.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('intro-shown-v1', 'true'));
  await page.goto(server.origin, { waitUntil: 'load' });
  await page.locator('[data-proto-open="meta-suplementos"]').click();
  await page.locator('.pgal__masonry').waitFor();
  assert.equal(await page.locator('.pgal__img').count(), 25);
  assert.equal(await page.locator('.pgal__item--framed').count(), 12);
  assert.equal(await page.locator('.pgal__banners > button').count(), 5);
  assert.match(await page.locator('.pgal__banner-intro').textContent(), /professional image production.*realistic scenes/);
  assert.match(await page.locator('.pgal__item--captioned .pgal__caption').textContent(), /pre-checkout/);
  for (const [width, columns] of [[1440, '3'], [768, '2'], [390, '1']]) {
    await page.setViewportSize({ width, height: 1000 });
    const metrics = await page.locator('.pgal__masonry').evaluate(grid => ({
      columns: getComputedStyle(grid).columnCount,
      images: [...grid.querySelectorAll('img')].map(image => ({
        aspect: getComputedStyle(image).aspectRatio,
        border: getComputedStyle(image).borderTopWidth,
        shadow: getComputedStyle(image).boxShadow,
      })),
    }));
    assert.equal(metrics.columns, columns);
    assert.equal(metrics.images.length, 8);
    for (const image of metrics.images) assert.deepEqual(image, { aspect: 'auto', border: '1px', shadow: 'none' });
    for (const image of await page.locator('.pgal__item--framed img').all()) {
      assert.deepEqual(await image.evaluate(img => ({ aspect: getComputedStyle(img).aspectRatio, border: getComputedStyle(img).borderTopWidth })), { aspect: 'auto', border: '0px' });
    }
  }
  const cart = page.locator('.pgal__masonry button[data-lightbox-src$="/cart.png"]');
  await cart.focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-lightbox][aria-hidden="false"]').waitFor();
  assert.match(await page.locator('[data-lightbox-img]').getAttribute('src'), /\/cart\.png$/);
  await page.keyboard.press('Escape');
  assert.equal(await cart.evaluate(button => document.activeElement === button), true);
  await cart.locator('img').evaluate(image => image.dispatchEvent(new Event('error')));
  assert.equal(await page.locator('.pgal__masonry > button').count(), 7);
});
