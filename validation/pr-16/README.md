# PR #16 — validation evidence (round 2, 07/08/2026)

Persistent copy of the CDP validation for `feature/cmdk-modal-polish`, committed
here because evidence living only in a session's `/tmp` scratchpad isn't
auditable by a reviewer or by anyone after the session ends. This directory is
the source of truth referenced from the PR description and comments — treat it
as a snapshot tied to the commit it ships in, not a living doc.

## How it was produced

Real Chrome (not Playwright, not `--virtual-time-budget` headless — both are
documented dead ends in `AGENTS.md`), driven over the DevTools Protocol via a
raw Node/`ws` WebSocket client, no browser-automation dependency beyond what
Storybook already installs:

```
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome \
  --headless=new --remote-debugging-port=9333 \
  --user-data-dir=<scratch dir> --window-size=1280,900 about:blank
```

`cdp-driver.js` in this folder is the exact script that produced
`results.json` and every PNG in `screenshots/`. It is not a general-purpose
test harness — it's a record of what was actually run. To reproduce: serve the
repo root over HTTP (`python3 -m http.server 8794`, never `file://` — see
`AGENTS.md`), start Chrome as above, edit the `PORT`/`SITE` constants at the
top of the script if needed, then `node validation/pr-16/cdp-driver.js`.

## What's covered

- **Typography** (`styles/experiments/flat-type.css`, 460 weight, 17.92px /
  1.12rem): `document.fonts.check("17.92px Geist")`, `getComputedStyle` on a
  representative `h1` and `.row` link (both 460), 185-element scale count from
  the round-1 pass (`results.json` from the first validation, not duplicated
  here — see history), **and, new this round,
  `CSS.getPlatformFontsForNode`** on the `h1`, a `.row`, and `#cmdInput` — the
  layer `getComputedStyle`/`document.fonts.check` can't cover, because both
  only confirm the *declaration* and that *some* face with that family name is
  loaded, not which instance actually got rasterized for that node. All three
  report `postScriptName: "Geist-Regular_wght1CC0000"` — the interpolated
  variable-font instance actually painted. `1CC` hex = `460` decimal, matching
  the computed-style weight exactly; this is Chrome's own encoding of the
  `wght` axis coordinate baked into the instance, not something we computed —
  it's independent confirmation that the pixels on screen are the 460
  instance, not a static face silently rounded to 400 or 500.
- **Layout**: no horizontal overflow at desktop (1280) or at the 320px reflow
  breakpoint (`scrollWidth === clientWidth` on both `<html>` and `<body>` at
  both widths).
- **Command palette, all three states**: empty (`03-cmd-empty.png`), with
  results (`04-cmd-results.png`), and the detail view
  (`05-cmd-detail.png`) — the detail click targets `.cmd__item` specifically
  (not `list.children[0]`, which can land on a non-interactive `.cmd__group`
  section header and silently no-op).
- **Both shortcut hints**: `⌘K` on a Mac-flavored UA (`03-cmd-empty.png`) and
  `Ctrl K` on a spoofed Windows UA (`navigator.platform`/`userAgentData`/
  `userAgent` overridden via `Page.addScriptToEvaluateOnNewDocument` before a
  fresh navigation — `07-cmd-nonmac-hint.png`, see `cmdNonMacHint` in
  `results.json`). Both render on one line (`white-space: nowrap`) with no
  reflow, confirmed at 320px too (`06-cmd-mobile-320.png`).
- **Console**: zero messages, zero uncaught exceptions, across every state
  above (`consoleMessages`, `exceptionsCount` in `results.json`).
- **Accessibility tree** (finding 2 — `aria-describedby`, not a bare
  `aria-label` on `.cmd__esc`): `results.json` → `axInputPartial_RAW` and
  `axInputFromFullTree_RAW` are the **unedited** output of
  `Accessibility.getPartialAXTree`/`Accessibility.getFullAXTree` for the real
  accessible node backing `#cmdInput`. The node the browser actually builds:

  ```json
  {
    "role": { "value": "textbox" },
    "name": { "value": "Search…" },
    "description": { "value": "Press Command K to close" },
    "properties": [
      { "name": "describedby", "value": { "value": "cmdEscHint",
        "relatedNodes": [{ "idref": "cmdEscHint", "backendDOMNodeId": 722 }] } }
    ]
  }
  ```

  This confirms the description is exposed on the interactive control itself
  (not floating, unreachable, on the inert `<span id="cmdEsc">`), which is
  what a screen reader actually announces when the input receives focus. The
  fix: `#cmdEsc` (the visible glyph badge) is `aria-hidden="true"`;
  `#cmdEscHint`, a `.sr-only` sibling with the full sentence
  ("Press Command K to close" / "Press Control K to close"), is the
  `aria-describedby` target on `#cmdInput`. See `index.html` (`.cmd__head`
  markup) and `script.js` (the `escHint`/`escHintDesc` block) and the new
  `.sr-only` utility in `styles/main.css`.

## Files

- `results.json` — raw output of the round-2 driver run (font checks,
  overflow, palette states, both hints, console/exceptions, full AX tree dump).
- `cdp-driver.js` — the script that produced it.
- `screenshots/01`–`07` — desktop, 320px reflow, the three palette states,
  320px with the palette open, and the non-Mac hint.

Round-1 evidence (the CDP pass behind the `AGENTS.md` line 100 note) was
produced the same way but wasn't persisted to the repo — this directory is
what closes that gap going forward.
