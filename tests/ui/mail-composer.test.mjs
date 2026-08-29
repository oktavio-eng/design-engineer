import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const axeScriptPath = path.resolve(repositoryRoot, "node_modules/axe-core/axe.min.js");

// Stand-in Supabase project. The test serves a copy of mail.js with the real
// URL/key swapped for these, so the assertions below prove the request shape
// (headers, body, path) without ever touching the production table.
const FAKE_SUPABASE_URL = "https://test-project.supabase.co";
const FAKE_SUPABASE_KEY = "anon-key-for-tests";

async function scanAxe(page, state) {
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document.getElementById("mailModal"), {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    return result.violations.flatMap((rule) =>
      rule.nodes.map((node) => `${rule.id}:${node.target.join(" ")}`),
    );
  });
  assert.deepEqual(violations, [], `${state} must be axe-clean`);
}

test("mail composer validates the reply email before sending and archives the message in Supabase", { timeout: 60_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // The home plays the intro since 16/08/2026 (intro.js) — skip it.
  await page.addInitScript(() => sessionStorage.setItem("intro-shown-v1", "1"));

  const mailSource = await readFile(path.join(repositoryRoot, "mail.js"), "utf8");
  const urlLine = /var SUPABASE_URL = "[^"]*";/;
  const keyLine = /var SUPABASE_ANON_KEY = "[^"]*";/;
  assert.match(mailSource, urlLine, "mail.js declares SUPABASE_URL");
  assert.match(mailSource, keyLine, "mail.js declares SUPABASE_ANON_KEY");
  await page.route("**/mail.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: mailSource
        .replace(urlLine, `var SUPABASE_URL = "${FAKE_SUPABASE_URL}";`)
        .replace(keyLine, `var SUPABASE_ANON_KEY = "${FAKE_SUPABASE_KEY}";`),
    }),
  );

  const web3formsRequests = [];
  const supabaseRequests = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const request = route.request();
    const url = request.url();
    if (url === "https://api.web3forms.com/submit") {
      web3formsRequests.push(request.postDataJSON());
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' });
    }
    if (url.startsWith(FAKE_SUPABASE_URL)) {
      supabaseRequests.push({ url, headers: request.headers(), body: request.postDataJSON() });
      return route.fulfill({ status: 201, body: "" });
    }
    if (request.resourceType() === "stylesheet") {
      return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    }
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto(`${server.origin}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("intro-playing"));
  // The home's content stagger starts once the intro releases and keeps the
  // topbar out of pointer reach until it lands (same wait as
  // portfolio-page.test.mjs) — click the envelope only after that.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await page.waitForSelector("#mailModal", { state: "attached" });

  const trigger = page.locator("#mailTrigger");
  const reply = page.locator("#mailReply");
  const replyHint = page.locator("#mailReplyHint");
  const next = page.locator("#mailNext");
  const stepEmail = page.locator("#stepEmail");
  const stepMessage = page.locator("#stepMessage");
  const text = page.locator("#mailText");
  const send = page.locator("#mailSend");

  // The topbar reveals on scroll and hides again after 1.2s idle (chrome.js)
  // — a real visitor scrolls, then reaches up; hovering it keeps it open.
  async function openComposer() {
    await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
    await page.waitForFunction(() => document.querySelector(".topbar").classList.contains("visible"));
    await page.hover(".topbar");
    await trigger.click();
    await page.waitForFunction(() => document.body.classList.contains("mail-open"));
  }

  await openComposer();
  await page.waitForFunction(() => document.activeElement === document.getElementById("mailReply"));
  assert.equal(await replyHint.isVisible(), false, "no hint before the first attempt");
  assert.equal(await stepEmail.locator(".composer__to").textContent(), "Used only to reply.", "the transparency line sits in the actions row");
  // Field limits mirror the CHECK constraints in supabase/schema.sql.
  assert.equal(await reply.getAttribute("maxlength"), "254");
  assert.equal(await text.getAttribute("maxlength"), "5000");

  // 1. Empty → blocked with the "add your email" line, focus stays.
  await next.click();
  assert.equal(await stepMessage.isHidden(), true, "empty email must not advance");
  assert.equal(await replyHint.textContent(), "Add your email so I can reply.");
  assert.equal(await reply.getAttribute("aria-invalid"), "true");
  assert.equal(await reply.getAttribute("aria-describedby"), "mailReplyHint");
  assert.equal(await replyHint.getAttribute("role"), "alert");
  assert.equal(await reply.evaluate((element) => element === document.activeElement), true);

  await page.addScriptTag({ path: axeScriptPath });
  await scanAxe(page, "invalid email step");

  // 2. Typing clears the error; a malformed address (no dot in the domain)
  //    brings a different line. Enter is the same gate as the arrow.
  await reply.fill("name@gmail");
  assert.equal(await replyHint.isVisible(), false, "typing clears the hint");
  assert.equal(await reply.getAttribute("aria-invalid"), null);
  await reply.press("Enter");
  assert.equal(await stepMessage.isHidden(), true, "name@gmail must not advance");
  assert.equal(await replyHint.textContent(), "That email doesn’t look right.");
  assert.equal(await reply.getAttribute("aria-invalid"), "true");

  // 3. Valid → the message step, with focus on the textarea.
  await reply.fill("  visitor@example.com ");
  await reply.press("Enter");
  await page.waitForFunction(() => !document.getElementById("stepMessage").hidden);
  await page.waitForFunction(() => document.activeElement === document.getElementById("mailText"));
  assert.equal(await stepEmail.isHidden(), true);
  assert.equal(await replyHint.isVisible(), false);

  // The honeypot lives in this step: rendered (not display:none — bots skip
  // those), but off-canvas, off the Tab order and out of the accessibility tree.
  const trap = page.locator("#mailTrap");
  assert.equal(await trap.count(), 1);
  assert.equal(await trap.getAttribute("tabindex"), "-1");
  assert.equal(await trap.getAttribute("aria-hidden"), "true");
  assert.notEqual(await trap.evaluate((el) => getComputedStyle(el).display), "none");
  assert.equal(await trap.evaluate((el) => el.getBoundingClientRect().right < 0), true, "off-canvas");

  // 4. Send: Web3Forms and Supabase both receive the message, the button
  //    lands on "sent", the sheet auto-closes.
  await text.fill("Hello from the test suite");
  assert.equal(await send.getAttribute("data-mode"), "send");
  await send.click();
  await page.waitForFunction(() => document.getElementById("mailSend").getAttribute("data-mode") === "sent");

  assert.equal(web3formsRequests.length, 1, "one Web3Forms submit");
  assert.equal(web3formsRequests[0].email, "visitor@example.com", "the reply address is trimmed");
  assert.equal(web3formsRequests[0].message, "Hello from the test suite");

  assert.equal(supabaseRequests.length, 1, "one Supabase insert");
  assert.equal(supabaseRequests[0].url, `${FAKE_SUPABASE_URL}/rest/v1/messages`);
  assert.equal(supabaseRequests[0].headers.apikey, FAKE_SUPABASE_KEY);
  assert.equal(supabaseRequests[0].headers.authorization, `Bearer ${FAKE_SUPABASE_KEY}`);
  assert.equal(supabaseRequests[0].headers.prefer, "return=minimal");
  assert.deepEqual(supabaseRequests[0].body, {
    email: "visitor@example.com",
    message: "Hello from the test suite",
    page: "/",
  });

  await page.waitForFunction(() => !document.body.classList.contains("mail-open"), null, { timeout: 5_000 });
  assert.equal(await text.inputValue(), "", "the draft is cleared after a successful send");

  // 5. Both destinations down → the message step says so instead of going
  //    silent, and nothing is cleared.
  await page.unroute(/^https?:\/\/(?!127\.0\.0\.1)/);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 500, body: "{}" }));
  await openComposer();
  await text.fill("Second try");
  await send.click();
  const textHint = page.locator("#mailTextHint");
  await page.waitForFunction(() => !document.getElementById("mailTextHint").hidden);
  assert.equal(await textHint.textContent(), "Couldn’t send — try again.");
  assert.equal(await send.getAttribute("data-mode"), "send", "a failed send keeps the send affordance");
  assert.equal(await text.inputValue(), "Second try");
  await text.type("!");
  assert.equal(await textHint.isVisible(), false, "typing again clears the failure line");

  // 6. Honeypot filled → nothing is posted anywhere, but the sheet plays the
  //    same "sent" state so a bot sees no difference.
  const posted = [];
  await page.unroute(/^https?:\/\/(?!127\.0\.0\.1)/);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    posted.push(route.request().url());
    return route.fulfill({ status: 204, body: "" });
  });
  await trap.evaluate((el) => (el.value = "http://spam.example"));
  await send.click();
  await page.waitForFunction(() => document.getElementById("mailSend").getAttribute("data-mode") === "sent");
  assert.deepEqual(posted.filter((u) => /web3forms|supabase/.test(u)), [], "a honeypot hit posts nothing");
  await page.waitForFunction(() => !document.body.classList.contains("mail-open"), null, { timeout: 5_000 });

  assert.deepEqual(pageErrors, []);
});
