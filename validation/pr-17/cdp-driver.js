// CDP driver for PR #17 ("Instala família Geist completa: sans + mono +
// pixel") — real Chrome runtime evidence for the built Storybook's
// Foundations/Typography story: network fetch of the three .woff2 families,
// getComputedStyle on each --font-sans/--font-mono/--font-pixel sample,
// document.fonts.check per family, CSS.getPlatformFontsForNode confirming
// the actually-rasterized face (not just the declared one), and a
// console/exception count. Not a general-purpose test harness — a record of
// what was actually run against `npm run build-storybook`'s output.
//
// To reproduce: `npm install && npm run build-storybook` at the repo root,
// serve the static build (`python3 -m http.server 8795 --directory
// storybook-static`), start headless Chrome with --remote-debugging-port,
// edit PORT/SITE below if needed, then `node validation/pr-17/cdp-driver.js`.
const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT_DIR = __dirname;
const SCREENSHOT_DIR = path.join(OUT_DIR, "screenshots");
const CDP_PORT = 9334;
const HTTP_PORT = 8795;
const SITE = `http://localhost:${HTTP_PORT}/iframe.html?id=foundations--typography&viewMode=story`;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(JSON.parse(data)));
      })
      .on("error", reject);
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
  const fontRequests = [];

  const targets = await putJson(`http://localhost:${CDP_PORT}/json/new?${SITE}`);
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
    if (msg.method === "Network.responseReceived") {
      const r = msg.params.response;
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url)) {
        fontRequests.push({
          url: r.url,
          status: r.status,
          mimeType: r.mimeType,
          fromCache: !!r.fromDiskCache || !!r.fromServiceWorker,
        });
      }
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("CSS.enable");
  await send("Network.enable");
  // Disable cache before navigation, not just for this run but for the
  // reproducibility contract this driver is supposed to hold: reusing an
  // already-warm Chrome profile (e.g. re-running the driver after an
  // unrelated code change, same headless instance) would otherwise silently
  // turn the font requests into disk-cache hits, and the *first* run's
  // fromCache: false would stop being reproducible on every run after it —
  // which is exactly what happened before this fix (see PR #17 review).
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send("Page.navigate", { url: SITE });
  await new Promise((r) => setTimeout(r, 300));
  await send("Page.loadEventFired").catch(() => {});
  // Give web fonts (three families, one @font-face request each) time to
  // actually resolve.
  await new Promise((r) => setTimeout(r, 2000));

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

  results.fontsReady = await evalExpr(
    "document.fonts.ready.then(() => true)",
    true,
    true,
  );

  // document.fonts.check per family — confirms *some* face with that family
  // name is loaded at that size/weight (declaration-level, not which
  // instance got rasterized — CSS.getPlatformFontsForNode below covers that
  // layer).
  results.fontsCheck = await evalExpr(`({
    sans16: document.fonts.check("16px Geist"),
    sans400: document.fonts.check("400 16px Geist"),
    mono16: document.fonts.check("16px 'Geist Mono'"),
    pixel16: document.fonts.check("16px 'Geist Pixel'")
  })`);

  // Raw document.fonts entries — every FontFace the browser actually
  // registered from the @font-face rules the Google Fonts CSS response
  // produced (one entry per weight instance/subset Chrome decided to keep).
  results.documentFontsEntries = await evalExpr(`(function(){
    var out = [];
    document.fonts.forEach(function (f) {
      out.push({ family: f.family, style: f.style, weight: f.weight, status: f.status });
    });
    return out;
  })()`);

  // The three token samples the Typography story renders — one row per
  // family, matched by the <code class="sb-token-name"> label next to each
  // (see stories/foundations.stories.js tokenRows()), not by index, so this
  // stays correct if the row order in the story ever changes.
  async function sampleFor(tokenName) {
    const info = await evalExpr(`(function(){
      var rows = document.querySelectorAll('.sb-token-row');
      for (var i = 0; i < rows.length; i++) {
        var name = rows[i].querySelector('.sb-token-name');
        if (name && name.textContent.trim() === ${JSON.stringify(tokenName)}) {
          var sample = rows[i].querySelector('.sb-type-sample');
          var cs = getComputedStyle(sample);
          return {
            found: true,
            text: sample.textContent,
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight
          };
        }
      }
      return { found: false };
    })()`);
    return info;
  }

  results.sampleSans = await sampleFor("--font-sans");
  results.sampleMono = await sampleFor("--font-mono");
  results.samplePixel = await sampleFor("--font-pixel");

  // CSS.getPlatformFontsForNode — the layer getComputedStyle/document.fonts
  // can't cover: confirms which face was actually rasterized for that node,
  // not just that a same-named face is declared and loaded somewhere.
  async function platformFontsForTokenRow(tokenName) {
    const doc = await send("DOM.getDocument", { depth: -1, pierce: true });
    const rowsResult = await send("DOM.querySelectorAll", {
      nodeId: doc.root.nodeId,
      selector: ".sb-token-row",
    });
    for (const nodeId of rowsResult.nodeIds) {
      const html = await send("DOM.getOuterHTML", { nodeId });
      if (html.outerHTML.includes(`>${tokenName}<`)) {
        const sampleResult = await send("DOM.querySelector", {
          nodeId,
          selector: ".sb-type-sample",
        });
        if (!sampleResult.nodeId) return { error: "sample not found for " + tokenName };
        return send("CSS.getPlatformFontsForNode", { nodeId: sampleResult.nodeId });
      }
    }
    return { error: "row not found for " + tokenName };
  }

  results.platformFontsSans = await platformFontsForTokenRow("--font-sans");
  results.platformFontsMono = await platformFontsForTokenRow("--font-mono");
  results.platformFontsPixel = await platformFontsForTokenRow("--font-pixel");

  await send("Page.captureScreenshot", { format: "png" }).then((r) => {
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, "01-typography-story.png"),
      Buffer.from(r.data, "base64"),
    );
  });

  // Scroll the "Font family" section into view specifically — the top-of-page
  // screenshot above is dominated by the pre-existing size/weight scales and
  // cuts this section off below the fold.
  await evalExpr(`(function(){
    var rows = document.querySelectorAll('.sb-token-row');
    for (var i = 0; i < rows.length; i++) {
      var name = rows[i].querySelector('.sb-token-name');
      if (name && name.textContent.trim() === '--font-sans') {
        rows[i].closest('.sb-inventory__section').scrollIntoView({ block: 'start' });
        break;
      }
    }
  })()`);
  await new Promise((r) => setTimeout(r, 150));
  await send("Page.captureScreenshot", { format: "png" }).then((r) => {
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, "02-font-family-section.png"),
      Buffer.from(r.data, "base64"),
    );
  });

  // Font network requests: dedupe by URL (Chrome may report the same
  // resource more than once across cache revalidation), keep the essentials.
  const seen = new Map();
  for (const r of fontRequests) if (!seen.has(r.url)) seen.set(r.url, r);
  results.fontNetworkRequests = Array.from(seen.values());

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
