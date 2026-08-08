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
      return {
        id: a.id || null,
        className: a.className || null,
        tag: a.tagName,
        insideCmd: cmd.contains(a),
        insideModal: modal.contains(a),
        isTrigger: !!(a.classList && a.classList.contains('topbar__logo'))
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
