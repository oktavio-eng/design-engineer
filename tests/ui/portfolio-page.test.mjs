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

  // Projects: favicon in the row (opt-in, unlike personal/life), and a
  // show-more overflow past the 3-row threshold. Live for real since
  // 22/08/2026 (no longer draft-gated) — see portfolio-content.js's header.
  assert.equal(await page.locator('[data-list="projects"] .row--draft').count(), 0, "no draft-flagged rows left");
  assert.equal(await page.locator('[data-list="projects"] .row-btn').count(), 7, "all seven project rows render");
  assert.equal(await page.locator('[data-list="projects"] .row-btn .fav').count(), 7, "every project row carries a favicon");
  assert.equal(await page.locator('[data-list="personal"] .row-btn .fav').count(), 0, "personal rows stay icon-free");
  assert.equal(await page.locator("#projectsExtras .row.extra").count(), 4, "rows past the threshold sit in the overflow");
  assert.equal(await page.locator("#projectsSeeMore").getAttribute("aria-expanded"), "false", "starts collapsed");

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
  assert.equal(await page.locator(".doc-list .doc-item").count(), 3);
  assert.equal(await page.locator(".doc-list .doc-icon").first().getAttribute("aria-hidden"), "true");
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

  // Project preview image (22/08/2026): the entry's own og:image, between
  // .role and .bio. Every image request is already routed to a stub SVG
  // above, so this is really asserting the element/attributes, not a real
  // fetch — the broken-image removal path has its own dedicated test below.
  await page.locator('[data-open="projects:sphera-academy"]').click();
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  assert.equal(await page.locator("#cmdModal .cmd-modal__preview").count(), 1, "sphera-academy carries a preview image");
  assert.equal(await page.locator("#cmdModal .cmd-modal__preview").getAttribute("loading"), "lazy");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));

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
  assert.equal(await page.locator('.cmd__item:has-text("GOW Studio")').count(), 1);
  await page.locator("#cmdInput").fill("Sphera");
  assert.equal(await page.locator(".cmd__item").count(), 1, "project rows are searchable");
  await page.keyboard.press("Escape");

  // Projects show more: ported wireSeeMore(), same .expanded/aria-expanded/
  // text-swap contract as wiki.html's people/courses/references. Exercised
  // down here (after the contrib-graph hover assertions above) since
  // clicking it scrolls the page, and an in-flight extras transition throws
  // off Playwright's scroll-into-view for a hover target earlier on the page.
  await page.locator("#projectsSeeMore").click();
  await page.waitForFunction(() => document.getElementById("projects").classList.contains("expanded"));
  assert.equal(await page.locator("#projectsSeeMore").textContent(), "show less");
  assert.equal(await page.locator("#projectsSeeMore").getAttribute("aria-expanded"), "true");

  // dascia has no og:image on the real site — no preview field, no image.
  // (dascia sits past the show-more threshold, so this needs the expand
  // above; can't run alongside sphera-academy earlier on the page.)
  await page.locator('[data-open="projects:dascia"]').click();
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  assert.equal(await page.locator("#cmdModal .cmd-modal__preview").count(), 0, "dascia has no preview to show");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));

  // Sub-projects (22/08/2026, escola-da-bel only): each is its own preview
  // image + name + description; only .subproject__name is the tap target
  // (22/08/2026 follow-up — a card-wide link made hover read too heavy),
  // same "no reserved gap on failure" contract as the top-level preview.
  await page.locator('[data-open="projects:escola-da-bel"]').click();
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  assert.equal(await page.locator("#cmdModal .cmd-modal__preview").count(), 1, "escola-da-bel also carries its own top-level preview");
  assert.equal(await page.locator("#cmdModal .subproject").count(), 5, "five landing pages listed");
  assert.equal(await page.locator("#cmdModal .subproject__preview").count(), 5, "every sub-project card carries a preview image");
  assert.equal(await page.locator("#cmdModal .subproject img").count(), 5, "the image is not itself a link");
  assert.deepEqual(
    await page.locator("#cmdModal .subproject__name").evaluateAll((as) => as.map((a) => a.getAttribute("target"))),
    Array(5).fill("_blank"),
    "only the name opens the live page, not the modal",
  );
  const nameBox = await page.locator("#cmdModal .subproject__name").first().boundingBox();
  const cardBox = await page.locator("#cmdModal .subproject").first().boundingBox();
  assert.ok(nameBox.width < cardBox.width, "the tap target is the name's own width, not the full card");
  await scanAxe(page, "portfolio, escola-da-bel sub-projects open");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.classList.contains("cmd-detail-open"));

  await page.locator("#projectsSeeMore").click();
  await page.waitForFunction(() => !document.getElementById("projects").classList.contains("expanded"));
  assert.equal(await page.locator("#projectsSeeMore").textContent(), "show more");
  assert.equal(await page.locator("#projectsSeeMore").getAttribute("aria-expanded"), "false");

  // Narrow viewport: no horizontal overflow. The two-column `.gallery` grid
  // check that used to live here was dropped along with the gallery pause
  // (22/08/2026): with the section `hidden` and empty, Chrome can't resolve
  // `grid-template-columns` into pixel tracks and hands back the literal
  // `repeat(2, minmax(0px, 1fr))` formula instead — a getComputedStyle
  // artifact of an unrendered element, not a real regression. Restoring the
  // gallery should bring a real rendered-layout assertion back with it.
  await page.setViewportSize({ width: 320, height: 800 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth),
    true,
    "320px viewport has no horizontal overflow",
  );

  // Show more, at 320px (22/08/2026 regression): `.extras-inner`'s
  // `overflow: hidden` -> `visible` swap (the transitionend listener above,
  // for the last row's hover shadow) used to also cancel CSS Grid's
  // automatic min-width: 0 on that item — once `visible`, the item's
  // minimum floor became its nowrap children's min-content width instead,
  // ballooning every row-btn's 100%-based width along with it and undoing
  // `.row .what`'s ellipsis (nothing was left to shrink it against). The
  // collapsed-then-narrow check above didn't catch this — it never expanded
  // at 320px — so this expands specifically at the narrow width.
  await page.locator("#projectsSeeMore").click();
  await page.waitForFunction(() => document.getElementById("projects").classList.contains("expanded"));
  await page.waitForTimeout(400); // let the transitionend overflow swap settle
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth),
    true,
    "320px viewport has no horizontal overflow with Projects expanded",
  );
  const longestWhat = page.locator('[data-open="projects:finq-edu"] .what');
  assert.ok(
    await longestWhat.evaluate((el) => el.scrollWidth > el.clientWidth),
    "the longest role line still truncates instead of forcing the row wider",
  );

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
      const withSyntheticDraft = body.toString("utf8").replace("links: [],", 'links: [],\n      draft: true,');
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
  await page.route("https://framerusercontent.com/images/PgbsHlNgpSQclDuYYOPfMT6Zo.png", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 204, body: "" }));
  await page.addInitScript(() => sessionStorage.setItem("intro-shown-v1", "true"));
  await page.goto(`${server.origin}/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll(".row-btn").length > 0);
  await page.locator('[data-open="projects:sphera-academy"]').click();
  await page.waitForFunction(() => document.body.classList.contains("cmd-detail-open"));
  await page.waitForFunction(() => document.querySelector("#cmdModal .cmd-modal__preview") === null);
  assert.equal(await page.locator("#cmdModal .cmd-modal__preview").count(), 0, "the broken image removed itself, not just failed silently");
  assert.equal(await page.locator("#cmdModal .bio").count(), 1, "the rest of the detail still renders");
});
