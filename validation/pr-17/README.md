# PR #17 — validation evidence (08/08/2026)

Persistent copy of the build/runtime/HTML validation for
`feature/geist-font-family`, committed here for the same reason
`validation/pr-16/` exists: evidence living only in a session's `/tmp`
scratchpad isn't auditable by a reviewer or by anyone after the session
ends. Treat this as a snapshot tied to the commit it ships in, not a living
doc.

## How it was produced

```bash
npm install
npm run build-storybook            # -> storybook-static/ (gitignored)
python3 -m http.server 8795 --directory storybook-static
# separately, headless Chrome with --remote-debugging-port=9334
node validation/pr-17/cdp-driver.js
npx --yes vnu-jar index.html
npx --yes vnu-jar storybook-static/iframe.html
```

`cdp-driver.js` drives real headless Chrome over the DevTools Protocol via
a raw Node/`ws` client (same approach as `validation/pr-16/cdp-driver.js`
— no browser-automation dependency beyond what's already in
`package.json`), navigated straight to the built Typography story
(`iframe.html?id=foundations--typography&viewMode=story`), not the
Storybook manager UI. HTML validation uses `npx --yes vnu-jar` — the
Node-packaged build of the W3C/WHATWG Nu Html Checker, the same engine
behind `validator.w3.org/nu`, run ad hoc (not added to `package.json`;
this PR doesn't own the Storybook safety-net/CI front).

## What's covered

- **`npm run build-storybook` actually succeeds** (`build-storybook.log`):
  full stdout/stderr and the exit code appended as the last line
  (`EXIT_CODE=0`). The one Vite warning in the log ("Some chunks are larger
  than 500 kB") is a pre-existing generic bundling note about
  `storybook-static/assets/iframe-*.js` (Storybook's own framework/manager
  bundle), unrelated to this PR's three-line CSS/token/doc diff — not
  something #17 introduces or is in scope to fix.
- **The three families actually served over the network** (`results.json`
  → `fontNetworkRequests`): the single Google Fonts CSS request
  (`family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&family=Geist+Pixel&display=swap`)
  and all three `.woff2` files it resolves to (`fonts.gstatic.com/s/geist/…`,
  `/s/geistmono/…`, `/s/geistpixel/…|`), every one **200**, `fromCache:
  false` — a real fetch, not a cache hit standing in for one. The driver
  calls `Network.setCacheDisabled` before navigating (right after
  `Network.enable`, before `Page.navigate`) specifically so this holds on
  every run, not just a cold one: re-running the driver against an
  already-warm Chrome profile — which is exactly what happened once during
  this PR's own review, see git history — would otherwise silently turn
  these into disk-cache hits with no error, and the `fromCache: false`
  claim here would stop being true the moment anyone reproduced it.
- **`getComputedStyle` on each token's live sample** in the Typography
  story's new "Font family" section (`results.json` → `sampleSans` /
  `sampleMono` / `samplePixel`, matched by the `<code class="sb-token-name">`
  label next to each row, not by position): `Geist, system-ui, sans-serif`,
  `"Geist Mono", monospace`, `"Geist Pixel", Geist, system-ui, sans-serif`
  respectively — the declared family resolves through, not silently falls
  back to the next name in the stack.
- **`document.fonts.check`** (`results.json` → `fontsCheck`): true for all
  three at 16px, plus the explicit `400 16px Geist` weight check. **Raw
  `document.fonts` entries** (`documentFontsEntries`) show one `"loaded"`
  `FontFace` per family alongside the `"unloaded"` weight-range entries the
  variable `@font-face` rule declares upfront — confirms the browser
  actually resolved and used a face from each family, not just parsed the
  declaration.
- **`CSS.getPlatformFontsForNode`** (`results.json` →
  `platformFontsSans`/`Mono`/`Pixel`) — the layer `getComputedStyle`/
  `document.fonts.check` can't cover, because both only confirm the
  *declaration* and that *some* face with that family name is loaded, not
  which face actually got rasterized for that specific node. All three
  report `isCustomFont: true` with the expected PostScript name
  (`Geist-Regular`, `GeistMono-Regular`, `GeistPixel-Regular`) — the pixels
  on screen are the real webfont, not a system fallback silently
  substituted in.
- **Screenshots** (`screenshots/01-typography-story.png`,
  `02-font-family-section.png`): the second one, scrolled to the "Font
  family" section specifically, shows all three faces rendering visibly
  differently from each other (Geist's humanist sans, Geist Mono's
  monospaced letterforms, Geist Pixel's blocky bitmap-style glyphs) — a
  sanity check that the isolation actually reads as three different
  typefaces, not three names pointing at the same rendered face.
- **Console**: zero error-level messages, zero uncaught exceptions
  (`consoleMessages`, `exceptionsCount` in `results.json`), for the whole
  session (load through both screenshots).
- **HTML validation, index.html** (`html-validation/index-html.txt`):
  **2 errors, both pre-existing, neither touched by this PR's diff.** This
  PR's entire `index.html` change is the `<head>` `<link>`/comment for the
  Google Fonts URL (`git diff` against the merge-base — lines 40–49 only).
  The two errors the Nu checker reports are in the `<body>` (a single
  ~39KB line, no useful line breaks — see `validation/pr-16/README.md` for
  why): an `<img id="avatarBig">` with no `src`/`srcset` (the avatar viewer
  sets it via JS at runtime — pre-existing feature, unrelated to any of
  #16/#17/#19), and `#cmdInput` missing a `role` ARIA-in-HTML requires for
  `aria-expanded` on a plain `<input>` (from PR #16's command palette,
  already merged into `main` before this branch was updated against it).
  **Confirmed pre-existing, not introduced by this PR's commits**:
  `html-validation/index-html-preexisting-baseline.txt` is the same
  validator run against `index.html` at the merge-base commit (`main`
  *before* any of `feature/geist-font-family`'s own commits) — identical
  two errors, same elements, only the line number shifted by 2 (this PR's
  own head comment adds two lines above the body). No global "HTML valid"
  claim is made here; these two are called out precisely instead, and both
  are out of this PR's scope to fix (`--font-mono`/`--font-pixel` are
  unconsumed tokens plus a font URL — no component markup changes).
- **HTML validation, the built Storybook iframe**
  (`html-validation/storybook-iframe.txt`, `storybook-static/iframe.html`
  — the actual document `.storybook/preview-head.html`'s fragment gets
  built into; that fragment alone isn't a standalone document, so
  validating it in isolation would just report a missing
  `<!DOCTYPE>`/`<html>`/`<body>` and prove nothing real): **0 errors** —
  exit code 0. Four `info`-level notes, all from Storybook's own build
  tooling and framework chrome, none from this PR's content: three
  "trailing slash on void elements has no effect" (Vite's generated
  `<meta … />` tags in the document head) and one "empty heading" on
  `<h1 id="error-message">` (Storybook's built-in error-boundary markup,
  empty until a story throws — line 679, nowhere near the Typography
  story's own markup).

## Files

- `build-storybook.log` — full `npm run build-storybook` stdout/stderr plus
  `EXIT_CODE=0` as the last line.
- `cdp-driver.js` / `results.json` — the driver and its raw output (font
  network requests, `document.fonts` state, computed styles, platform
  fonts, console/exceptions).
- `screenshots/01-typography-story.png`,
  `screenshots/02-font-family-section.png` — the built Typography story,
  the second scrolled to the new "Font family" section.
- `html-validation/index-html.txt` — Nu Html Checker output for the real
  `index.html` at this PR's HEAD.
- `html-validation/index-html-preexisting-baseline.txt` — the same check
  run against `index.html` at the merge-base (pre-#17), proving both
  errors already existed before this branch's commits.
- `html-validation/storybook-iframe.txt` — Nu Html Checker output for
  `storybook-static/iframe.html`, the real built document that incorporates
  `.storybook/preview-head.html`.

## Reproducing

Serve the repo root is not required for this PR's own validation (unlike
`validation/pr-16/`'s driver, which drives the live site) — everything
here runs against the Storybook static build. From the repo root:

```bash
npm install
npm run build-storybook
python3 -m http.server 8795 --directory storybook-static &
# start headless Chrome separately:
#   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
#     --headless=new --remote-debugging-port=9334 \
#     --user-data-dir=<scratch dir> --window-size=1280,900 about:blank
node validation/pr-17/cdp-driver.js
npx --yes vnu-jar index.html
npx --yes vnu-jar storybook-static/iframe.html
```
