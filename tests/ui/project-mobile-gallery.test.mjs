import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './helpers/browser.mjs';
import { serveDirectory } from './helpers/static-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('mobile project galleries remain compact, preserve source order and support keyboard enlargement', { timeout: 60_000 }, async context => {
  const server = await serveDirectory(root);
  const browser = await launchChromium();
  context.after(async () => { await browser.close(); await server.close(); });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({ status: 204, body: '' }));
  await page.addInitScript(() => sessionStorage.setItem('intro-shown-v1', 'true'));
  await page.goto(server.origin, { waitUntil: 'load' });
  const mark = page.locator('[data-proto-open="bullster"] .fav');
  await mark.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-proto-open="bullster"] .fav')?.naturalWidth === 500);
  assert.equal(await mark.getAttribute('src'), '/assets/projects/bullster/favicon.webp');

  for (const key of ['cloudfaster-academy', 'finq-edu']) {
    await page.locator(`[data-proto-open="${key}"]`).click();
    await page.locator('.pdrawer[aria-hidden="false"]').waitFor();
    assert.equal(await page.locator('.pdrawer__head > .pdrawer__role + .pdrawer__links + .pdrawer__bio').count(), 1,
      'project links appear after the role and before the description');
    assert.equal(await page.locator('.pdrawer__body > .pdrawer__section > .pdrawer__links').count(), 0,
      'project links are no longer placed at the bottom');
    assert.deepEqual(await page.locator('.pdrawer__head .pdrawer__link').evaluateAll(links => links.map(link => [link.textContent.trim(), link.getAttribute('href')])),
      await page.evaluate(key => window.PORTFOLIO_CONTENT.projects[key].links, key));
    assert.equal(await page.locator('.pdrawer__decision').count(), 2);
    assert.equal(await page.locator('.pdrawer__decision h3').last().textContent(), 'Design decisions');
    assert.equal(await page.locator('.pgal__item').evaluateAll(items => items.map(el => el.dataset.lightboxSrc).join('|')),
      await page.evaluate(key => window.PORTFOLIO_CONTENT.projects[key].gallery.map(photo => photo.src).join('|'), key), 'grouping must preserve the source order');

    for (const width of [1440, 700, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const row = page.locator('.pgal__mobile-row').first();
      const first = row.locator('.pgal__img').first();
      await first.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.pgal__mobile-row img')?.naturalWidth > 0);
      const geometry = await row.evaluate(el => {
        const style = getComputedStyle(el);
        const img = el.querySelector('img');
        const bounds = img.getBoundingClientRect();
        return { columns: style.gridTemplateColumns.split(' ').length, rowGap: style.rowGap, columnGap: style.columnGap,
          height: bounds.height, fit: getComputedStyle(img).objectFit, ratio: bounds.width / bounds.height, naturalRatio: img.naturalWidth / img.naturalHeight };
      });
      assert.equal(geometry.columns, width > 700 ? 3 : 2);
      assert.equal(geometry.columnGap, '16px');
      assert.equal(geometry.rowGap, width > 700 ? '32px' : '24px');
      assert.ok(geometry.height <= (width > 700 ? 480 : 420) + 1);
      assert.ok(Math.abs(geometry.ratio - 9 / 19.5) < .01, 'mobile previews use a uniform frame');
      assert.equal(geometry.fit, 'cover', 'uniform previews crop rather than stretch');
      const sizes = await row.locator('.pgal__img').evaluateAll(images => images.slice(0, 3).map(img => { const box = img.getBoundingClientRect(); return [box.width, box.height]; }));
      for (const size of sizes) { assert.ok(Math.abs(size[0] - sizes[0][0]) < 1); assert.ok(Math.abs(size[1] - sizes[0][1]) < 1); }
      const visibleGap = await row.locator('.pgal__img').evaluateAll(images => images[1].getBoundingClientRect().left - images[0].getBoundingClientRect().right);
      assert.ok(Math.abs(visibleGap - 16) < 1, 'the visible image gap must match the grid gap');
      const borders = await page.locator('.pdrawer__shot, .pgal__img').evaluateAll(images => images.map(img => {
        const style = getComputedStyle(img);
        return [style.borderTopWidth, style.borderTopStyle, style.borderTopColor];
      }));
      for (const border of borders) assert.deepEqual(border, ['1px', 'solid', 'oklch(0 0 0 / 0.08)']);

      await page.waitForFunction(() => {
        const group = document.querySelector('.pgal__mobile-row');
        const notes = group?.querySelector('.pgal__mobile-captions');
        return notes && Math.abs(notes.getBoundingClientRect().width - group.getBoundingClientRect().width) < 1;
      });
      const captionLayout = await row.evaluate(grid => {
        const notes = grid.querySelector('.pgal__mobile-captions');
        return { left: Math.abs(notes.getBoundingClientRect().left - grid.getBoundingClientRect().left), align: getComputedStyle(notes).textAlign };
      });
      assert.ok(captionLayout.left < 1, 'captions align to the start of the full image group');
      assert.equal(captionLayout.align, 'start');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true);
    }

    const last = page.locator('.pgal__item').last();
    await last.focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-lightbox][aria-hidden="false"]').waitFor();
    assert.equal(await page.locator('[data-lightbox-img]').getAttribute('src'), await last.getAttribute('data-lightbox-src'));
    await page.keyboard.press('Escape');
    assert.equal(await last.evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    await page.locator('.pdrawer[aria-hidden="true"]').waitFor();
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-proto-open="bullster"]').click();
  assert.equal(await page.locator('.pgal__mobile-row').count(), 0, 'the tall landing page is not classified as a phone screen');
  assert.equal(await page.locator('.pgal__item').last().getAttribute('data-lightbox-src'), '/assets/projects/bullster/landing-page.webp');
  assert.ok(await page.locator('.pgal__caption').count() >= 6, 'selected screens have visible design context');
  for (const width of [1440, 700, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const shots = page.locator('.pgal__img');
    await shots.nth(3).scrollIntoViewIfNeeded();
    const sizes = await shots.evaluateAll(images => images.slice(3, 5).map(img => {
      const box = img.getBoundingClientRect();
      return { width: box.width, height: box.height, radius: getComputedStyle(img).borderRadius };
    }));
    assert.ok(Math.abs(sizes[0].height - sizes[1].height) < 1, 'adjacent desktop previews must have equal heights');
    for (const size of sizes) { assert.ok(Math.abs(size.width / size.height - 16 / 10) < .01); assert.equal(size.radius, '16px'); }
  }
  const landing = page.locator('.pgal__item').last();
  await landing.locator('img').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('.pgal__img')].at(-1)?.naturalWidth > 0);
  assert.equal(await landing.locator('img').evaluate(img => {
    const box = img.getBoundingClientRect();
    return Math.abs(box.width / box.height - img.naturalWidth / img.naturalHeight) < .01;
  }), true, 'the final Bullster landing page is complete in the drawer itself');

  await landing.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const img = document.querySelector('[data-lightbox-img]');
    return img?.complete && img.naturalWidth > 0 && img.currentSrc === img.src;
  });
  assert.equal(await page.locator('[data-lightbox-img]').evaluate(img => {
    const box = img.getBoundingClientRect();
    return Math.abs(box.width / box.height - img.naturalWidth / img.naturalHeight) < .01 && getComputedStyle(img).borderRadius === '16px';
  }), true, 'the complete tall landing page remains available without cropping in the lightbox');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Escape');
  await page.route('**/assets/projects/bullster/favicon.webp', route => route.fulfill({ status: 404, body: '' }));
  await page.reload({ waitUntil: 'load' });
  await page.locator('[data-proto-open="bullster"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('[data-proto-open="bullster"] .fav'));
  assert.deepEqual(errors, []);
});

test('Bullster local card mark works without the favicon helper or a saved icon field', { timeout: 20_000 }, async context => {
  const server = await serveDirectory(root);
  const browser = await launchChromium();
  context.after(async () => { await browser.close(); await server.close(); });
  const page = await browser.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({ status: 204, body: '' }));
  await page.route('**/favicons.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.favicon = () => ""; window.favFallback = img => img.remove();' }));
  await page.route('**/portfolio-content.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('faviconFrom: "/assets/projects/bullster/favicon.webp",', '');
    await route.fulfill({ response, body });
  });
  await page.addInitScript(() => sessionStorage.setItem('intro-shown-v1', 'true'));
  await page.goto(server.origin, { waitUntil: 'load' });
  const mark = page.locator('[data-proto-open="bullster"] .fav');
  await mark.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-proto-open="bullster"] .fav')?.naturalWidth === 500);
  assert.equal(await mark.getAttribute('src'), '/assets/projects/bullster/favicon.webp');
});
