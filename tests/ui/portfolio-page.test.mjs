import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const axeScriptPath = path.resolve(repositoryRoot, "node_modules/axe-core/axe.min.js");

async function scanAxe(page, state) {
  const violations = await page.evaluate(async () => {
    // Same carve-out as prompts-page.test.mjs: axe 4.13 misparses Chrome's
    // OKLCH serialization for color-contrast on a full-page walk; every
    // semantic rule stays on.
    const result = await window.axe.run(document, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    return result.violations.flatMap((rule) => rule.nodes.map((node) => `${rule.id}:${node.target.join(" ")}`));
  });
  assert.deepEqual(violations, [], `${state} must be axe-clean`);
}

async function activeInfo(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    return {
      id: active?.id || "",
      className: active?.className || "",
      hidden: Boolean(active?.closest?.('[aria-hidden="true"], [inert]')),
    };
  });
}

// / (the portfolio home): rows open the ⌘K detail card directly (no back button), the
// profile avatar opens the lightbox (gallery itself is paused, see
// initPortfolioPage's comment in portfolio.mjs), the graph renders from
// data/contributions.json, drafts stay off the published page, and ⌘K finds
// portfolio entries.
test("/ (portfolio home) renders its collections, opens rows and photos in modals, and stays axe-clean", { timeout: 40_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });
  const data = JSON.parse(await readFile(path.join(repositoryRoot, "data/contributions.json"), "utf8"));

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
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

  // The home plays the intro too since 16/08/2026 (intro.js) — skip it.
  await page.addInitScript(() => sessionStorage.setItem("intro-shown-v1", "true"));

  // 127.0.0.1 counts as localhost, so drafts render here — assert both modes.
  await page.goto(`${server.origin}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("intro-playing"));
  // Releasing the intro is what starts the content stagger, so it is still
  // running here (before intro.js it had finished by `load`). Let it land
  // before hovering: Playwright's scroll-into-view misjudges a cell whose
  // section is mid-`enter`, scrolls the page, and the graph's scroll→hide
  // cancels the tooltip that is being asserted below.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await page.waitForFunction(() => document.querySelectorAll(".row-btn").length > 0);
  await page.addScriptTag({ path: axeScriptPath });

  const sections = await page.evaluate(() =>
    [...document.querySelectorAll("main > section[id]")].map((s) => `${s.id}${s.hidden ? ":hidden" : ""}`),
  );
  // clients was removed 22/08/2026 (projects replaced it) and gallery is
  // paused (portfolio.mjs's initPortfolioPage no longer calls
  // renderGallery()) — the section still exists in the markup, just
  // permanently hidden until that's restored.
  assert.deepEqual(sections, ["positioning", "contributions", "writing", "projects", "personal", "life", "gallery:hidden"]);
  assert.equal(await page.locator(".profile__role").textContent(), "UI/UX & Visual Designer");

  assert.equal(await page.locator("#projects .pcard").count(), 10, "all projects render as cards");
  assert.equal(await page.locator("[data-proto-panel]").count(), 0, "no prototype controls on the public homepage");
  assert.equal(await page.locator("html").getAttribute("data-proto-carousel"), "bleed");
  assert.equal(await page.locator("html").getAttribute("data-proto-surface"), "drawer");
  assert.equal(await page.locator("html").getAttribute("data-proto-hover"), "ring");

  // Contribution graph: real data file, one cell per day plus the Sunday pad,
  // and the total in the footer matches the file.
  await page.waitForFunction(() => document.querySelectorAll(".contrib__grid .contrib__cell").length > 0);
  const cells = await page.locator(".contrib__grid .contrib__cell").count();
  assert.ok(cells >= data.days.length && cells <= data.days.length + 6, `grid has a cell per day (${cells})`);
  assert.equal(
    await page.locator("[data-contrib-total]").textContent(),
    `${data.total.toLocaleString("en-US")} contribution${data.total === 1 ? "" : "s"} in the last year`,
  );

  // Hover readout on the graph: the first tooltip waits, then shows the day's
  // count; sweeping to the next cell is instant; leaving hides it.
  const cellA = page.locator(".contrib__grid .contrib__cell[data-date]").nth(200);
  const cellB = page.locator(".contrib__grid .contrib__cell[data-date]").nth(201);
  const tipLocator = page.locator(".contrib__tip");
  await cellA.hover();
  await page.waitForFunction(() => document.querySelector(".contrib__tip")?.dataset.open === "true");
  const [dateA, countA] = await cellA.evaluate((c) => [c.dataset.date, Number(c.dataset.count)]);
  assert.match(await tipLocator.textContent(), new RegExp(`^${countA === 0 ? "No" : countA} contributions? on `), `tip reads ${dateA}`);
  assert.equal(await tipLocator.getAttribute("aria-hidden"), "true", "tip is decorative; the total is the summary");
  await cellB.hover();
  assert.equal(await tipLocator.evaluate((t) => t.classList.contains("contrib__tip--instant")), true, "second cell is instant");
  assert.equal(await cellB.evaluate((c) => c.classList.contains("is-hover")), true);
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelector(".contrib__tip")?.dataset.open === "false");

  // Writing rows are buttons with the doc icon (icon decorative) that open
  // the shared modal in place — never a navigation.
  assert.equal(await page.locator(".doc-list .doc-item").count(), 4);
  assert.equal(await page.locator(".doc-list .doc-icon").first().getAttribute("aria-hidden"), "true");
  // Real pointer over a row (Figma `Article`/`Doc icon` Status=Hover): the
  // row fills with --row-hover and the icon's page gets --shadow-doc-hover,
  // both in zero frames — nothing on either element transitions.
  const firstRow = page.locator(".doc-list .doc-item").first();
  await firstRow.hover();
  const hovered = await firstRow.evaluate((row) => {
    const rs = getComputedStyle(row);
    const ps = getComputedStyle(row.querySelector(".doc-icon__page"));
    const token = getComputedStyle(document.documentElement).getPropertyValue("--row-hover").trim();
    // No `transition` at all computes to `all 0s`, so "instant" is: zero
    // duration, or a property list that leaves fill and shadow out.
    const instant = (cs) => cs.transitionDuration === "0s" || !/background|box-shadow|all/.test(cs.transitionProperty);
    return { bg: rs.backgroundColor, token, rowShadow: rs.boxShadow, pageShadow: ps.boxShadow, instant: instant(rs) && instant(ps) };
  });
  assert.equal(hovered.bg, hovered.token, "hovered row is filled with --row-hover");
  assert.equal(hovered.rowShadow, "none", "the row itself has no lift");
  assert.notEqual(hovered.pageShadow, "none", "the icon's page gets --shadow-doc-hover");
  assert.equal(hovered.instant, true, "hover lands instantly");
  await page.mouse.move(0, 0);
  await page.locator('[data-open="writing:changelog"]').click();
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  assert.equal(new URL(page.url()).pathname, "/", "writing opens in a modal, not another page");
  assert.equal(await page.locator("#cmdModal h3").textContent(), "Changelog, as a habit");
  assert.equal(await page.locator('#cmdModal a[href="/changelog"]').count(), 1, "the modal carries the link to read it");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));

  await scanAxe(page, "portfolio, resting");

  // A personal row opens the ⌘K detail card directly: no back button, focus
  // on ×, Escape dismisses and returns focus to the row.
  const row = page.locator('[data-open="personal:design-engineer"]');
  await row.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  assert.equal(await page.locator("#cmdModal h3").textContent(), "Design Engineer");
  assert.equal(await page.locator("#cmdModal").evaluate((m) => m.classList.contains("cmd-modal--direct")), true);
  assert.equal(await page.locator("#cmdModalBack").evaluate((b) => getComputedStyle(b).display), "none");
  assert.deepEqual(await activeInfo(page).then((a) => [a.id, a.hidden]), ["cmdModalClose", false]);
  await scanAxe(page, "portfolio, detail open");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-open")), "personal:design-engineer");
  assert.equal(await page.locator("#cmd").getAttribute("aria-hidden"), "true", "Escape from a direct detail does not reopen the list");

  await page.locator('[data-proto-open="sphera-academy"]').click();
  await page.locator('.pdrawer[aria-hidden="false"]').waitFor();
  assert.equal(await page.locator(".pdrawer__shot").count(), 1);
  await scanAxe(page, "project drawer");
  await page.keyboard.press("Escape");
  await page.locator('.pdrawer[aria-hidden="true"]').waitFor();

  // Avatar → lightbox: gallery is paused (0 .gallery__item today), but the
  // profile avatar wires the same trigger/controller (initLightbox() runs
  // regardless — see initPortfolioPage). Opens on click, × has focus, Escape
  // closes and focus goes back to the avatar; ⌘K on top of it swaps.
  assert.equal(await page.locator(".gallery__item").count(), 0, "gallery is paused, no thumbnails render");
  const avatar = page.locator(".profile__avatar");
  await avatar.scrollIntoViewIfNeeded();
  await avatar.click();
  await page.waitForFunction(() => document.querySelector("[data-lightbox]").getAttribute("aria-hidden") === "false");
  assert.equal(await page.locator("[data-lightbox-img]").getAttribute("src"), await avatar.getAttribute("data-lightbox-src"));
  assert.equal(await page.locator("[data-lightbox-text]").textContent(), await avatar.getAttribute("data-lightbox-caption"));
  assert.equal(await page.locator(".profile__avatar img").count(), 1, "opening the lightbox leaves the avatar thumbnail intact");
  assert.deepEqual(await activeInfo(page).then((a) => [a.className.includes("lightbox__close"), a.hidden]), [true, false]);
  await scanAxe(page, "portfolio, lightbox open");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("[data-lightbox]").getAttribute("aria-hidden") === "true");
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("profile__avatar")), true);
  await avatar.click();
  await page.waitForFunction(() => document.querySelector("[data-lightbox]").getAttribute("aria-hidden") === "false");
  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  assert.equal(await page.locator("[data-lightbox]").getAttribute("aria-hidden"), "true", "⌘K folds the lightbox");

  // ⌘K indexes the portfolio collections, projects included (real content
  // since 22/08/2026, not draft-gated).
  await page.locator("#cmdInput").fill("gow");
  assert.equal(await page.locator('.cmd__item:has-text("GOW Design")').count(), 1);
  await page.locator("#cmdInput").fill("Sphera");
  assert.equal(await page.locator(".cmd__item").count(), 1, "project rows are searchable");
  await page.keyboard.press("Escape");

  await page.locator('[data-proto-open="escola-da-bel"]').click();
  await page.locator('.pdrawer[aria-hidden="false"]').waitFor();
  assert.equal(await page.locator(".pgal__item").count(), 5, "subproject covers populate the gallery");
  const landings = await page.locator(".pdrawer__landings .subproject").evaluateAll(links => links.map(link => ({
    name: link.querySelector(".subproject__name").textContent,
    description: link.querySelector(".subproject__desc")?.textContent,
    href: link.getAttribute("href"), target: link.target, rel: link.rel,
  })));
  const expectedLandings = await page.evaluate(() => window.PORTFOLIO_CONTENT.projects["escola-da-bel"].subprojects.map(sub => ({
    name: sub.name, description: sub.description, href: sub.url, target: "_blank", rel: "noopener",
  })));
  assert.deepEqual(landings, expectedLandings, "all original landing-page links and descriptions survive the drawer migration");
  assert.deepEqual(await page.locator('.pgal__img').evaluateAll(images => images.map(img => getComputedStyle(img).objectPosition)),
    expectedLandings.map(() => '50% 50%'), 'landing-page covers use a centered crop');
  await scanAxe(page, "project landing-page links");
  await page.locator(".pgal__item").first().click();
  await page.locator('[data-lightbox][aria-hidden="false"]').waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("[data-proto-sheet]").getAttribute("aria-hidden"), "false");
  await page.keyboard.press("Escape");
  await page.locator('.pdrawer[aria-hidden="true"]').waitFor();

  await page.setViewportSize({ width: 320, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true, "320px has no page overflow");

  for (const key of ["cloudfaster-academy", "dascia", "finq-edu"]) {
    await page.locator(`[data-proto-open="${key}"]`).click();
    await page.locator('.pdrawer[aria-hidden="false"]').waitFor();
    await page.waitForFunction(() => document.querySelector(".pdrawer__shot")?.naturalWidth > 0);
    assert.match(await page.locator(".pdrawer__shot").getAttribute("src"), /^\/assets\/projects\//, "missing/outdated covers have verified local fallbacks");
    await page.keyboard.press("Escape");
  }

  for (const [key, count] of [["bullster", 7], ["sphera-academy", 14], ["cloudfaster-academy", 18], ["finq-edu", 12], ["dascia", 10]]) {
    await page.locator(`[data-proto-open="${key}"]`).click();
    await page.locator('.pdrawer[aria-hidden="false"]').waitFor();
    assert.equal(await page.locator(".pgal__item").count(), count, `${key} has its supplied gallery`);
    if (key === "bullster") {
      assert.equal(await page.locator(".pdrawer__shot").getAttribute("src"), "/assets/projects/bullster/web-cover.webp");
      assert.equal(await page.locator(".pgal__item").last().getAttribute("data-lightbox-src"), "/assets/projects/bullster/landing-page.webp");
      assert.equal(await page.locator(".pgal__item").last().evaluate(el => el.classList.contains("pgal__item--wide")), true, "the landing page closes the gallery at full width");
    }
    assert.equal(await page.locator(".pdrawer__shot").evaluate(el => getComputedStyle(el).borderRadius), "16px");
    const photo = page.locator(".pgal__item").first();
    await photo.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".pgal__img")?.naturalWidth > 0);
    assert.equal(await photo.evaluate(el => getComputedStyle(el).borderRadius), "16px");
    await photo.click();
    await page.locator('[data-lightbox][aria-hidden="false"]').waitFor();
    await page.waitForFunction(() => document.querySelector("[data-lightbox-img]")?.complete);
    assert.equal(await page.locator("[data-lightbox-img]").evaluate(el => {
      const box = el.getBoundingClientRect();
      return getComputedStyle(el).borderRadius === "16px" && el.naturalWidth > 0 &&
        Math.abs(box.width / box.height - el.naturalWidth / el.naturalHeight) < 0.01;
    }), true, "enlarged images retain their proportions and rounded corners");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  }

  const pixelOffice = page.locator('[data-proto-collection="personal"][data-proto-open="prompts"]');
  await pixelOffice.click();
  assert.equal(await page.locator("[data-proto-sheet]").getAttribute("aria-label"), "Pixel Office");
  assert.equal(await page.locator('.pdrawer__head .pdrawer__link .fav').getAttribute('src'),
    'https://gow-pixel-office.vercel.app/favicon-32.png', 'Pixel Office uses its declared favicon instead of a service placeholder');
  assert.equal(await page.locator(".pgal__item").count(), 12, "Pixel Office shows all twelve supplied screenshots");
  assert.equal(await page.locator(".pdrawer__shot").getAttribute("src"), "/assets/projects/pixel-office/cover.png");
  await page.locator(".pgal__item").last().click();
  await page.locator('[data-lightbox][aria-hidden="false"]').waitFor();
  assert.match(await page.locator("[data-lightbox-img]").getAttribute("src"), /12-usage\.png$/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("[data-proto-sheet]").getAttribute("aria-hidden"), "false", "closing a screenshot keeps Pixel Office open");
  await page.keyboard.press("Escape");
  assert.equal(await pixelOffice.evaluate(el => el === document.activeElement), true, "focus returns to Pixel Office");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-proto-open="caderno-de-erros"]').click();
  const grip = page.locator("[data-proto-grip]");
  await grip.focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.locator('.pgal__item').last().evaluate(el => el === document.activeElement), true, "Tab stays inside the drawer");
  await page.keyboard.press("Tab");
  assert.equal(await grip.evaluate(el => el === document.activeElement), true);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator(".pgal__img").first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll(".pgal__img")].slice(0, 2).every(img => img.naturalWidth > 0));
    assert.equal(await page.locator(".pgal__img").first().evaluate(img => {
      const box = img.getBoundingClientRect();
      return Math.abs(box.width / box.height - 16 / 10) < 0.01 && getComputedStyle(img).objectFit === "cover";
    }), true, "desktop thumbnails have a uniform crop");
    assert.equal(await page.locator(".pgal").evaluate(el => getComputedStyle(el).rowGap), width > 560 ? "48px" : "32px", "gallery rows have breathing room");
    assert.equal(await page.locator(".pgal").evaluate(el => getComputedStyle(el).columnGap), width > 560 ? "32px" : "20px", "gallery columns retain clear spacing");
  }
  await grip.focus();
  await page.keyboard.press("Enter");
  await page.locator('.pdrawer[aria-hidden="true"]').waitFor();

  assert.deepEqual(pageErrors, []);
});

// The published page hides drafts. The module keys on location.hostname, so
// serve the same files under a non-loopback host name: every request to
// portfolio.test is answered from the local server. No real collection ships
// with `draft: true` today — projects went live for real 22/08/2026, see
// portfolio-content.js's header — so this exercises the actual hide/show
// gate with one synthetic draft entry injected into `life` at request time,
// the same shape a real placeholder would carry.
test("portfolio drafts are hidden unless on localhost or ?draft", { timeout: 20_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });
  const page = await browser.newPage();
  await page.route(/^https?:\/\/portfolio\.test\//, async (route) => {
    const url = new URL(route.request().url());
    const upstream = await fetch(server.origin + url.pathname + url.search);
    let body = Buffer.from(await upstream.arrayBuffer());
    if (url.pathname === "/portfolio-content.js") {
      const withSyntheticDraft = body.toString("utf8").replace('name: "Brazil, remote",', 'name: "Brazil, remote",\n      draft: true,');
      assert.notEqual(withSyntheticDraft, body.toString("utf8"), "the life.brazil anchor line must still exist to inject the synthetic draft");
      body = Buffer.from(withSyntheticDraft);
    }
    route.fulfill({
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/octet-stream" },
      body,
    });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|portfolio\.test)/, (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("http://portfolio.test/", { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll('[data-list="personal"] .row-btn').length > 0);
  assert.equal(await page.locator('[data-list="life"] .row--draft').count(), 0, "no draft rows in production");
  assert.equal(await page.locator('[data-list="life"] .row-btn:has-text("Brazil, remote")').count(), 0, "the synthetic draft is absent in production");
  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.activeElement?.id === "cmdInput");
  await page.locator("#cmdInput").fill("prerequisite");
  assert.equal(await page.locator(".cmd__item").count(), 0, "drafts are not indexed by ⌘K in production");
  // And ?draft turns it back on, for reviewing the placeholder in place.
  await page.goto("http://portfolio.test/?draft", { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll('[data-list="life"] .row--draft').length > 0);
  assert.equal(await page.locator('[data-list="life"] .row--draft:has-text("Brazil, remote")').count(), 1, "?draft turns the synthetic draft back on");
});

// A project preview image is a live hotlink to the entry's own og:image —
// same "external asset, remove on failure" contract as favicon(). A stub
// SVG (like the other tests here use) never actually errors, so this test
// forces a real 404 on the specific preview URL to exercise onerror.
test("a broken project preview image removes itself, no reserved gap", { timeout: 20_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });
  const page = await browser.newPage();
  await page.route("**/assets/projects/sphera-academy/01-cover.webp", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 204, body: "" }));
  await page.addInitScript(() => sessionStorage.setItem("intro-shown-v1", "true"));
  await page.goto(`${server.origin}/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll(".row-btn").length > 0);
  await page.locator('[data-proto-open="sphera-academy"]').click();
  await page.locator('.pdrawer[aria-hidden="false"]').waitFor();
  await page.waitForFunction(() => document.querySelector(".pdrawer__shot") === null);
  assert.equal(await page.locator(".pdrawer__shot").count(), 0, "the broken image removed itself, not just failed silently");
  assert.equal(await page.locator(".pdrawer__bio").count(), 1, "the rest of the detail still renders");
  await page.keyboard.press("Escape");
  await page.locator('[data-proto-open="escola-da-bel"]').click();
  await page.locator('.pdrawer[aria-hidden="false"]').waitFor();
  assert.equal(await page.locator(".pdrawer__landings a[href]").count(), 5, "LP links remain available even when their preview images fail");
});
