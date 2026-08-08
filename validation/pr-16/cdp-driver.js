// CDP driver for PR #16 revalidation — desktop, 320px reflow, cmd palette
// states, console errors, Mac/non-Mac hints, real painted font via
// CSS.getPlatformFontsForNode, the accessibility tree for the cmdInput <->
// cmdEscHint aria-describedby pairing, and — round 3 — focus restoration on
// every complete dismissal (Meta+K, Ctrl+K, Escape, both the list and the
// detail layer): the confirmed bug was focus staying on #cmdInput after its
// tree went aria-hidden.
// Resolves via normal Node module resolution (walks up from this file to the
// repo root's node_modules/ws, installed as a Storybook transitive dep — run
// `npm install` at the repo root first if it's missing).
const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT_DIR = __dirname;
const SCREENSHOT_DIR = path.join(OUT_DIR, "screenshots");
const PORT = 9333;
const SITE = "http://localhost:8794/index.html";

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

function putJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "PUT" }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    req.end();
  });
}

function openWs(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { maxPayload: 500 * 1024 * 1024 });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function makeSend(ws) {
  let id = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  return function send(method, params = {}) {
    const thisId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(thisId, { resolve, reject });
      ws.send(JSON.stringify({ id: thisId, method, params }));
    });
  };
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const results = {};
  const consoleMessages = [];
  const exceptions = [];

  const targets = await putJson(`http://localhost:${PORT}/json/new?${SITE}`);
  const wsUrl = targets.webSocketDebuggerUrl;
  const ws = await openWs(wsUrl);
  const send = makeSend(ws);

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = (msg.params.args || [])
        .map((a) => a.value ?? a.description ?? "")
        .join(" ");
      consoleMessages.push({ type: msg.params.type, text });
    }
    if (msg.method === "Runtime.exceptionThrown") {
      exceptions.push(msg.params.exceptionDetails.text);
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("CSS.enable");
  await send("Accessibility.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send("Page.navigate", { url: SITE });
  await new Promise((r) => setTimeout(r, 300));
  await send("Page.loadEventFired").catch(() => {});
  // Give the intro + defer script + web fonts time to settle.
  await new Promise((r) => setTimeout(r, 3600));

  async function evalExpr(expr, returnByValue = true, awaitPromise = false) {
    const r = await send("Runtime.evaluate", {
      expression: expr,
      returnByValue,
      awaitPromise,
    });
    if (r.exceptionDetails) {
      throw new Error(JSON.stringify(r.exceptionDetails));
    }
    return r.result.value;
  }

  // Fonts ready + Geist actually rendering at the flat-type scale.
  results.fontsReady = await evalExpr(
    "document.fonts.ready.then(() => true)",
    true,
    true,
  );
  results.geistCheckAt17_92px = await evalExpr(
    'document.fonts.check("17.92px Geist")',
  );

  results.h1Info = await evalExpr(`(function(){
    var h1 = document.querySelector('h1');
    var cs = getComputedStyle(h1);
    return { text: h1.textContent.trim(), fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily };
  })()`);

  results.rowInfo = await evalExpr(`(function(){
    var a = document.querySelector('.row a, a.row, .row');
    var cs = getComputedStyle(a);
    return { text: a.textContent.trim().slice(0,40), fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily };
  })()`);

  // Round 4: the site-wide sweep AGENTS.md has quoted as "185/185" since
  // round 1 was never actually run by this driver or persisted anywhere —
  // it was a narrated number, not committed evidence. Every element that
  // carries its own visible text (a direct, non-whitespace text node) is
  // checked against the flat-type scale; elements inside an aria-hidden
  // ancestor are skipped on purpose — a closed surface in this codebase
  // (palette, panel, mail composer, ...) keeps its layout and just goes
  // opacity:0/aria-hidden, so without this it isn't a *visible*-text sweep.
  // Run before any modal/palette has been touched, so nothing is open to
  // exclude yet.
  results.typographySweep = await evalExpr(`(function(){
    var EXPECTED_SIZE = '17.92px', EXPECTED_WEIGHT = '460';
    var all = document.querySelectorAll('body *');
    var checked = [], mismatches = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('[aria-hidden="true"]')) continue;
      var hasOwnText = false;
      for (var c = 0; c < el.childNodes.length; c++) {
        var n = el.childNodes[c];
        if (n.nodeType === 3 && n.textContent.trim().length > 0) { hasOwnText = true; break; }
      }
      if (!hasOwnText) continue;
      if (!el.getClientRects().length) continue;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var entry = {
        tag: el.tagName,
        id: el.id || null,
        className: el.className || null,
        text: el.textContent.trim().slice(0, 30),
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight
      };
      checked.push(entry);
      if (cs.fontSize !== EXPECTED_SIZE || cs.fontWeight !== EXPECTED_WEIGHT) mismatches.push(entry);
    }
    return {
      expectedSize: EXPECTED_SIZE,
      expectedWeight: EXPECTED_WEIGHT,
      totalChecked: checked.length,
      matching: checked.length - mismatches.length,
      mismatches: mismatches.slice(0, 20)
    };
  })()`);

  // NEW LAYER: real painted font via CSS.getPlatformFontsForNode, not just
  // getComputedStyle/document.fonts.check (those confirm the declaration and
  // that a face with that name is loaded, not that it's the face actually
  // rasterized for that node).
  async function platformFontsFor(selector) {
    const doc = await send("DOM.getDocument", { depth: -1, pierce: true });
    const nodeIdResult = await send("DOM.querySelector", {
      nodeId: doc.root.nodeId,
      selector,
    });
    if (!nodeIdResult.nodeId) return { error: "not found: " + selector };
    const fonts = await send("CSS.getPlatformFontsForNode", {
      nodeId: nodeIdResult.nodeId,
    });
    return fonts;
  }

  results.platformFontsH1 = await platformFontsFor("h1");
  results.platformFontsRow = await platformFontsFor(".row");
  results.platformFontsCmdInput = await platformFontsFor("#cmdInput");

  // Desktop overflow
  results.overflowDesktop = await evalExpr(`({
    htmlScrollWidth: document.documentElement.scrollWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth
  })`);

  await send("Page.captureScreenshot", { format: "png" }).then((r) => {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "01-desktop-1280.png"), Buffer.from(r.data, "base64"));
  });

  // 320px reflow
  await send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await new Promise((r) => setTimeout(r, 300));
  results.overflow320 = await evalExpr(`({
    htmlScrollWidth: document.documentElement.scrollWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth
  })`);
  await send("Page.captureScreenshot", { format: "png" }).then((r) => {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "02-mobile-320.png"), Buffer.from(r.data, "base64"));
  });

  // Back to desktop for cmd palette states
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise((r) => setTimeout(r, 200));

  // Open cmd palette (Mac hint path — default UA is Mac-flavored headless UA string,
  // but we drive the platform check explicitly too, see below).
  await evalExpr(`(function(){
    var trigger = document.querySelector('.topbar__logo');
    trigger.click();
  })()`);
  await new Promise((r) => setTimeout(r, 400));

  results.cmdEmptyInfo = await evalExpr(`(function(){
    var cmd = document.getElementById('cmd');
    var esc = document.getElementById('cmdEsc');
    var escHint = document.getElementById('cmdEscHint');
    var input = document.getElementById('cmdInput');
    var list = document.getElementById('cmdList');
    return {
      cmdOpen: cmd.getAttribute('aria-hidden') === 'false' || document.body.classList.contains('cmd-open'),
      escVisibleText: esc.textContent,
      escAriaHidden: esc.getAttribute('aria-hidden'),
      escHintText: escHint.textContent,
      escHintClass: escHint.className,
      inputAriaDescribedby: input.getAttribute('aria-describedby'),
      inputPlaceholder: input.placeholder,
      listChildCount: list.children.length
    };
  })()`);
  await send("Page.captureScreenshot", { format: "png" }).then((r) => {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "03-cmd-empty.png"), Buffer.from(r.data, "base64"));
  });

  // Type a query -> results state
  await evalExpr(`(function(){
    var input = document.getElementById('cmdInput');
    input.focus();
    input.value = 'Rauno';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await new Promise((r) => setTimeout(r, 300));
  results.cmdResultsInfo = await evalExpr(`(function(){
    var list = document.getElementById('cmdList');
    return { listChildCount: list.children.length, firstItemText: list.children[0] ? list.children[0].textContent.trim().slice(0,60) : null };
  })()`);
  await send("Page.captureScreenshot", { format: "png" }).then((r) => {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "04-cmd-results.png"), Buffer.from(r.data, "base64"));
  });

  // Open detail (click first actual result — list also contains
  // non-interactive `.cmd__group` section headers, so `children[0]` isn't
  // reliably a row).
  await evalExpr(`(function(){
    var first = document.querySelector('#cmdList .cmd__item');
    if (first) first.click();
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  results.cmdDetailInfo = await evalExpr(`(function(){
    var modal = document.getElementById('cmdModal');
    var body = document.getElementById('cmdModalBody');
    return {
      detailOpen: modal.getAttribute('aria-hidden') === 'false',
      modalTitle: body.querySelector('h2,h3') ? body.querySelector('h2,h3').textContent.trim() : body.textContent.trim().slice(0,60)
    };
  })()`);
  await send("Page.captureScreenshot", { format: "png" }).then((r) => {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "05-cmd-detail.png"), Buffer.from(r.data, "base64"));
  });

  // Close detail, close palette, reopen fresh for accessibility tree snapshot
  await evalExpr(`(function(){
    var back = document.getElementById('cmdModalBack');
    if (back) back.click();
  })()`);
  await new Promise((r) => setTimeout(r, 300));

  // Accessibility tree: confirm aria-describedby is exposed on the REAL
  // accessible node for #cmdInput, not just present as an HTML attribute.
  const doc = await send("DOM.getDocument", { depth: -1, pierce: true });
  const inputNode = await send("DOM.querySelector", {
    nodeId: doc.root.nodeId,
    selector: "#cmdInput",
  });
  const axInputPartial = await send("Accessibility.getPartialAXTree", {
    nodeId: inputNode.nodeId,
    fetchRelatives: true,
  });
  results.axInputPartial_RAW = axInputPartial;

  const fullTree = await send("Accessibility.getFullAXTree", {});
  // Find the AX node backed by #cmdInput's backend node id.
  const inputBackendId = (await send("DOM.describeNode", { nodeId: inputNode.nodeId })).node.backendNodeId;
  const matchingAxNodes = fullTree.nodes.filter((n) => n.backendDOMNodeId === inputBackendId);
  results.axInputFromFullTree_RAW = matchingAxNodes;

  // 320px mobile reflow with cmd palette open, still-empty state (mobile) —
  // confirms hint badge doesn't cause overflow at the narrowest breakpoint.
  await evalExpr(`(function(){
    var input = document.getElementById('cmdInput');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await new Promise((r) => setTimeout(r, 300));
  await send("Page.captureScreenshot", { format: "png" }).then((r) => {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "06-cmd-mobile-320.png"), Buffer.from(r.data, "base64"));
  });

  // Non-Mac hint path: override navigator.platform/userAgent BEFORE reload
  // via Page.addScriptToEvaluateOnNewDocument, then reload and reopen cmd.
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });
      Object.defineProperty(navigator, 'userAgentData', { get: () => undefined, configurable: true });
      Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', configurable: true });
    `,
  });
  await send("Page.navigate", { url: SITE });
  await new Promise((r) => setTimeout(r, 3600));
  await evalExpr(`(function(){ document.querySelector('.topbar__logo').click(); })()`);
  await new Promise((r) => setTimeout(r, 400));
  results.cmdNonMacHint = await evalExpr(`(function(){
    var esc = document.getElementById('cmdEsc');
    var escHint = document.getElementById('cmdEscHint');
    var input = document.getElementById('cmdInput');
    return {
      platform: navigator.platform,
      escVisibleText: esc.textContent,
      escHintText: escHint.textContent,
      inputAriaDescribedby: input.getAttribute('aria-describedby')
    };
  })()`);
  await send("Page.captureScreenshot", { format: "png" }).then((r) => {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "07-cmd-nonmac-hint.png"), Buffer.from(r.data, "base64"));
  });

  // --- Round 3: focus restoration on every complete dismissal ---
  // The confirmed bug: closeCmd() hid #cmd (aria-hidden) without ever moving
  // focus off #cmdInput, stranding it inside a subtree assistive tech can no
  // longer see. Continues from the non-Mac session already open above —
  // Meta+K and Ctrl+K share the same toggle logic regardless of platform
  // (only the *hint text* differs), so one session covers both keys.
  async function activeInfo() {
    return evalExpr(`(function(){
      var a = document.activeElement;
      var cmd = document.getElementById('cmd');
      var modal = document.getElementById('cmdModal');
      // General-purpose check, not scoped to #cmd/#cmdModal specifically:
      // is the actual focused node sitting inside ANY aria-hidden ancestor
      // right now, regardless of which surface put it there (palette, mail
      // composer, panel, ...). This is the one invariant every scenario
      // below cares about — round-2's activeInfo only checked the two
      // palette containers by name, which can't see focus stranded inside
      // an unrelated closed surface (the mail composer, say).
      var hiddenAncestor = a.closest ? a.closest('[aria-hidden="true"]') : null;
      var inertAncestor = a.closest ? a.closest('[inert]') : null;
      return {
        id: a.id || null,
        className: a.className || null,
        tag: a.tagName,
        insideCmd: cmd.contains(a),
        insideModal: modal.contains(a),
        isTrigger: !!(a.classList && a.classList.contains('topbar__logo')),
        insideAriaHiddenAncestor: !!hiddenAncestor,
        hiddenAncestorSelector: hiddenAncestor
          ? hiddenAncestor.id
            ? "#" + hiddenAncestor.id
            : hiddenAncestor.className || hiddenAncestor.tagName
          : null,
        insideInertAncestor: !!inertAncestor
      };
    })()`);
  }
  async function cmdAriaState() {
    return evalExpr(`(function(){
      return {
        cmdOpen: document.body.classList.contains('cmd-open'),
        cmdDetailOpen: document.body.classList.contains('cmd-detail-open'),
        cmdAriaHidden: document.getElementById('cmd').getAttribute('aria-hidden'),
        modalAriaHidden: document.getElementById('cmdModal').getAttribute('aria-hidden')
      };
    })()`);
  }
  function dispatchKey(props) {
    const p = JSON.stringify(props);
    return evalExpr(
      `document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, ${p})))`,
    );
  }

  results.focusRestoration = {};

  // 1) Baseline: the list layer is already open from the non-Mac hint
  // capture above — #cmdInput should have focus.
  results.focusRestoration.listOpenBaseline = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };

  // 2) Ctrl+K closes it — complete dismissal from the list layer.
  await dispatchKey({ key: "k", ctrlKey: true });
  results.focusRestoration.afterCtrlKClose = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };

  // 3) Meta+K reopens fresh (opener re-captured off whatever Ctrl+K
  // restored focus to) — wait for the 60ms deferred input.focus().
  await dispatchKey({ key: "k", metaKey: true });
  await new Promise((r) => setTimeout(r, 150));
  results.focusRestoration.afterMetaKReopen = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };

  // 4) Meta+K again closes it the other way — same complete-dismiss contract.
  await dispatchKey({ key: "k", metaKey: true });
  results.focusRestoration.afterMetaKClose = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };

  // 5) Escape from the list layer.
  await evalExpr(`document.querySelector('.topbar__logo').click()`);
  await new Promise((r) => setTimeout(r, 150));
  await dispatchKey({ key: "Escape" });
  results.focusRestoration.afterEscapeFromList = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };

  // 6) Escape peels one layer at a time from the detail view: reopen, drill
  // into a result with the keyboard (Enter — keeps this pass keyboard-only),
  // confirm focus lands inside the detail layer (not stranded on the now
  // aria-hidden #cmdInput), Escape once to go back to the list (input
  // refocused), Escape again for the full dismiss (focus back on opener).
  await evalExpr(`document.querySelector('.topbar__logo').click()`);
  await new Promise((r) => setTimeout(r, 150));
  await evalExpr(`(function(){
    var input = document.getElementById('cmdInput');
    input.value = 'Rauno';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await new Promise((r) => setTimeout(r, 200));
  await evalExpr(
    `document.getElementById('cmdInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`,
  );
  await new Promise((r) => setTimeout(r, 200));
  results.focusRestoration.afterEnterIntoDetail = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };
  await dispatchKey({ key: "Escape" });
  await new Promise((r) => setTimeout(r, 150));
  results.focusRestoration.afterFirstEscapeFromDetail = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };
  await dispatchKey({ key: "Escape" });
  results.focusRestoration.afterSecondEscapeFromDetail = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };

  // 7) The × button is also a complete dismissal, straight from the detail
  // layer with no list hop — same contract, exercised via click since
  // that's its only trigger (not a keyboard shortcut, but the same
  // closeCmdDetail() code path this round fixed).
  await evalExpr(`document.querySelector('.topbar__logo').click()`);
  await new Promise((r) => setTimeout(r, 150));
  await evalExpr(`(function(){
    var first = document.querySelector('#cmdList .cmd__item');
    if (first) first.click();
  })()`);
  await new Promise((r) => setTimeout(r, 200));
  await evalExpr(`document.getElementById('cmdModalClose').click()`);
  results.focusRestoration.afterModalCloseButton = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };

  // --- Round 4: the edge cases round 3 didn't reach ---
  // A stale opener, a hidden fallback, and the two sub-60ms races round 3's
  // generous waits always let resolve before checking — so the race was
  // asserted against, never actually forced to happen. Fresh reload for a
  // clean baseline (this target still has the non-Mac UA override from
  // above — Page.addScriptToEvaluateOnNewDocument persists across
  // navigations by design — harmless here, nothing below depends on the
  // hint text, only on ctrlKey/metaKey both working).
  //
  // Discovered while writing this section, not assumed going in: `.topbar`
  // ships `aria-hidden="true"` in the static HTML and only becomes reachable
  // after a real `scroll` event (showNav(), see script.js) — so the trigger
  // itself is *not* a given fallback target, it depends on nav state. Every
  // case below that wants the trigger to be a genuinely exposed fallback
  // establishes that on purpose via wakeNav() (a real `scroll` dispatch —
  // the same event showNav() listens for, not a synthetic hook) rather than
  // leaning on the incidental scroll-into-view side effect of an unrelated
  // .focus() call, which is what first surfaced this and would have made
  // the suite's outcomes depend on element layout instead of being
  // deterministic. Everything else is real user-observable state: clicks,
  // dispatched KeyboardEvents, and — for the topbar-hides-mid-session case —
  // the exact DOM mutation scheduleNavIdle()'s callback performs. Nothing
  // pokes the closured openCmd/closeCmd/returnFocus functions directly.
  await send("Page.navigate", { url: SITE });
  await new Promise((r) => setTimeout(r, 3600));

  async function wakeNav() {
    await evalExpr(`window.dispatchEvent(new Event('scroll'))`);
  }

  results.focusRegression = {};

  // A) Dismiss inside the 60ms window openCmd() waits before focusing
  // #cmdInput — open and close in the same synchronous tick (0ms elapsed,
  // reliably inside the window, not a timing gamble), then wait past 60ms
  // and confirm the stale timer didn't claim focus back for a #cmdInput
  // that's since gone aria-hidden. Doesn't wake nav first: this is the
  // "user hits Ctrl+K right after landing on the page, before ever
  // scrolling" case, so the trigger is legitimately unreachable too — the
  // assertion that matters is that focus isn't left on #cmdInput or inside
  // any hidden ancestor, not which exact element it lands on.
  await evalExpr(`(function(){
    document.querySelector('.topbar__logo').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
  })()`);
  await new Promise((r) => setTimeout(r, 200));
  results.focusRegression.dismissUnder60ms = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };

  // B) Same race, hopping into the detail layer instead of dismissing —
  // open, type, and Enter into the first result all in one synchronous
  // tick, then confirm the stale timer didn't refocus the now-hidden
  // #cmdInput out from under the detail view 60ms later.
  await evalExpr(`(function(){
    document.querySelector('.topbar__logo').click();
    var input = document.getElementById('cmdInput');
    input.value = 'Rauno';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  })()`);
  await new Promise((r) => setTimeout(r, 200));
  results.focusRegression.listToDetailUnder60ms = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };
  // Back to a clean closed baseline: Escape once (detail -> list), once more
  // (list -> closed).
  await dispatchKey({ key: "Escape" });
  await new Promise((r) => setTimeout(r, 150));
  await dispatchKey({ key: "Escape" });
  await new Promise((r) => setTimeout(r, 150));

  // C) The opener itself can go stale: focus something inside a different
  // surface, open the palette from there (openCmd()'s own closeMail() call
  // closes that surface as a side effect), then dismiss and confirm focus
  // does NOT return to a control now sitting inside an aria-hidden
  // `.mail-modal` — and, with nav explicitly woken first, DOES land on the
  // exposed trigger rather than merely "somewhere safe".
  await wakeNav();
  await evalExpr(`document.getElementById('mailTrigger').click()`);
  await new Promise((r) => setTimeout(r, 350)); // openMail()'s own 260ms focus delay
  results.focusRegression.openerHiddenAfterOpeningPalette_preState = await activeInfo();
  await evalExpr(
    `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }))`,
  );
  await new Promise((r) => setTimeout(r, 200));
  const mailAriaWhileCmdOpen = await evalExpr(
    `document.getElementById('mailModal').getAttribute('aria-hidden')`,
  );
  await dispatchKey({ key: "k", ctrlKey: true });
  await new Promise((r) => setTimeout(r, 150));
  results.focusRegression.openerHiddenAfterOpeningPalette = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
    mailModalAriaHiddenWhileCmdWasOpen: mailAriaWhileCmdOpen,
  };

  // D) An ANCESTOR of the opener — not the opener element itself — can gain
  // `inert` while the palette stays open. Marking the opener directly would
  // only prove the self-match half of `closest("[inert]")`; the point of
  // this case is the ancestor walk, since that's the shape the real
  // isExposedFocusable() check depends on (a container going inert, the
  // link inside it along for the ride). Nothing in this app uses `inert`
  // today, but isExposedFocusable() treats it exactly like aria-hidden;
  // prove that branch explicitly rather than leaving it dark just because
  // production doesn't exercise it yet. Nav woken first for the same reason
  // as (C): isolates "opener rejected" from "fallback also unreachable",
  // which is its own case (E).
  await wakeNav();
  await evalExpr(`document.querySelector('.row a').focus()`);
  // Pre-state, persisted: the opener itself carries no `inert` and isn't
  // inside one yet — establishes the ancestor-only precondition before the
  // rest of this case claims to test it.
  results.focusRegression.openerInertAncestor_preState = await evalExpr(`(function(){
    var opener = document.querySelector('.row a');
    var ancestor = opener.closest('.row');
    return {
      openerHasInertAttribute: opener.hasAttribute('inert'),
      openerClosestInert: !!opener.closest('[inert]'),
      ancestorIsOpenerItself: ancestor === opener,
      ancestorTag: ancestor.tagName,
      ancestorClassName: ancestor.className
    };
  })()`);
  await evalExpr(
    `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }))`,
  );
  await new Promise((r) => setTimeout(r, 200));
  // `.closest('.row')` from the opener, not the opener itself — the anchor
  // lives inside `<div class="row" data-person="rauno"><span class="who">
  // <a>...`, so this is a real two-level-up ancestor, not a same-element
  // no-op.
  await evalExpr(`document.querySelector('.row a').closest('.row').setAttribute('inert', '')`);
  // Confirmed, not assumed: the opener itself still has no `inert`
  // attribute, but the ancestor walk now finds one — and it's the ancestor,
  // not the opener, that `closest` returned.
  const inertAncestorCheck = await evalExpr(`(function(){
    var opener = document.querySelector('.row a');
    var found = opener.closest('[inert]');
    return {
      openerItselfHasInertAttribute: opener.hasAttribute('inert'),
      closestInertFound: !!found,
      closestInertIsOpener: found === opener,
      closestInertTag: found ? found.tagName : null,
      closestInertClassName: found ? found.className : null
    };
  })()`);
  await dispatchKey({ key: "Escape" });
  await new Promise((r) => setTimeout(r, 150));
  results.focusRegression.openerInertAncestor = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
    inertAncestorCheck: inertAncestorCheck,
  };
  await evalExpr(`document.querySelector('.row a').closest('.row').removeAttribute('inert')`);

  // E) The fallback can be hidden too: wake nav and open normally (opener
  // === trigger, the ordinary case, confirmed exposed at capture time),
  // then — while the palette is still open — simulate the topbar's own
  // 1.2s scroll-idle auto-hide: the exact aria-hidden and class toggle
  // scheduleNavIdle()'s callback performs, not a synthetic hook. Neither
  // the opener nor the fallback is reachable at dismiss time; the invariant
  // is just that focus doesn't get forced onto a trigger that's gone dark.
  await wakeNav();
  await evalExpr(`document.querySelector('.topbar__logo').click()`);
  await new Promise((r) => setTimeout(r, 200));
  await evalExpr(`(function(){
    var tb = document.querySelector('.topbar');
    tb.classList.remove('visible');
    tb.setAttribute('aria-hidden', 'true');
  })()`);
  await dispatchKey({ key: "Escape" });
  await new Promise((r) => setTimeout(r, 150));
  results.focusRegression.fallbackTriggerAlsoHidden = {
    active: await activeInfo(),
    aria: await cmdAriaState(),
  };
  await evalExpr(`(function(){
    var tb = document.querySelector('.topbar');
    tb.classList.add('visible');
    tb.setAttribute('aria-hidden', 'false');
  })()`);

  // Explicit invariant, not a narrative one: no activeInfo() snapshot taken
  // anywhere in this run — round 3's happy-path dismissals or round 4's
  // edge cases — should ever show focus inside an aria-hidden or inert
  // ancestor. Collected after the fact so results.json carries one flag
  // that answers "did this actually hold" without re-deriving it by hand
  // from the raw snapshots.
  const allSnapshots = [];
  Object.keys(results.focusRestoration).forEach((k) => {
    allSnapshots.push([`focusRestoration.${k}`, results.focusRestoration[k].active]);
  });
  Object.keys(results.focusRegression).forEach((k) => {
    const v = results.focusRegression[k];
    if (v && v.active) allSnapshots.push([`focusRegression.${k}`, v.active]);
  });
  const invariantViolations = allSnapshots
    .filter(([, a]) => a.insideAriaHiddenAncestor || a.insideInertAncestor)
    .map(([label, a]) => Object.assign({ label: label }, a));
  results.focusInvariant = {
    checked: allSnapshots.length,
    violations: invariantViolations,
    holds: invariantViolations.length === 0,
  };

  results.consoleMessages = consoleMessages.filter((m) => m.type === "error");
  results.consoleMessagesAll = consoleMessages;
  results.exceptionsCount = exceptions.length;
  results.exceptions = exceptions;

  fs.writeFileSync(
    path.join(OUT_DIR, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log("DONE");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
