# PR #16 — validation evidence (round 4, 08/08/2026)

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
  representative `h1` and `.row` link (both 460), and
  `CSS.getPlatformFontsForNode` on the `h1`, a `.row`, and `#cmdInput` — the
  layer `getComputedStyle`/`document.fonts.check` can't cover, because both
  only confirm the *declaration* and that *some* face with that family name is
  loaded, not which instance actually got rasterized for that node. All three
  report `postScriptName: "Geist-Regular_wght1CC0000"` — the interpolated
  variable-font instance actually painted. `1CC` hex = `460` decimal, matching
  the computed-style weight exactly; this is Chrome's own encoding of the
  `wght` axis coordinate baked into the instance, not something we computed —
  it's independent confirmation that the pixels on screen are the 460
  instance, not a static face silently rounded to 400 or 500.
  - **Site-wide sweep, actually run and persisted (round-4 fix)** — `results.json`
    → `typographySweep`: every element carrying its own visible text (a
    direct, non-whitespace text node; skips anything behind an aria-hidden
    ancestor, since a closed surface in this codebase keeps its layout and
    just goes `opacity: 0`/`aria-hidden`, so without that filter it isn't a
    *visible*-text sweep) checked against 17.92px/460. **110/110 matching,
    zero mismatches.** AGENTS.md (line 100) had quoted "185/185" since round
    1 — that pass was narrated in prose, never actually run by this driver or
    committed anywhere, so there was no way to tell whether 185 was still
    right or whether the DOM had simply changed since (content has been added
    to the site since round 1: 19 more people, 3 craft references, an Index
    course entry — see git history). AGENTS.md now cites the number this
    driver run actually produced, not the inherited one.
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
- **Focus restoration on every complete dismissal** (round-3 fix, hardened
  round-4 — `results.json` → `focusRestoration`, `focusRegression`,
  `focusInvariant`): the confirmed bug was `closeCmd()` hiding `#cmd`
  (`aria-hidden="true"`) without ever moving focus off `#cmdInput`,
  stranding it inside a subtree assistive tech can no longer see. The real
  toggle shortcut is **Meta+K / Ctrl+K** (opens when closed, closes when
  open — same key either way, not a separate open/close pair); **Escape**
  peels one layer at a time (detail → list → closed) rather than jumping
  straight out. Driven with synthetic `KeyboardEvent`s (`ctrlKey`, `metaKey`,
  `key: "Escape"`) dispatched on `document`, since that's exactly what the
  app's own capture-phase `keydown` listener reacts to.

  Round 3 fixed the confirmed bug but `returnFocus()` trusted its restore
  target unconditionally; round 3's own driver run also only ever opened the
  palette from the same trigger, so it never noticed. Round 4's review found
  three real gaps and this driver now exercises all of them deterministically
  (`focusRegression`, five cases) rather than asserting behavior the tests
  never actually forced to happen:
  - **The opener can go stale.** ⌘K pressed from inside the mail composer
    closes it as a side effect of opening the palette (`openCmd()`'s own
    `closeMail()` call) — `#mailText` is still "opener", but it's sitting
    inside an aria-hidden `.mail-modal` by the time the palette itself
    closes. `returnFocus()` now re-validates the target *at restore time*,
    not capture time (`isExposedFocusable()` in `script.js`) —
    `openerHiddenAfterOpeningPalette`: focus doesn't return to `#mailText`
    (`mailModalAriaHiddenWhileCmdWasOpen: "true"`), it correctly falls back
    to the still-reachable trigger. `openerInertAncestor` proves the same
    check against `inert` specifically (nothing in this app uses `inert`
    yet — the branch was dark until this test set an opener's ancestor
    `inert` directly).
  - **The fallback isn't a given either.** Discovered while writing these
    tests, not assumed going in: `.topbar` (the trigger's container) ships
    `aria-hidden="true"` in the static HTML and only becomes reachable after
    a real scroll (`showNav()` in `script.js`) — so `.topbar__logo` is not
    always a safe fallback. `returnFocus()` now checks the fallback with the
    same `isExposedFocusable()`, not just the opener. `fallbackTriggerAlsoHidden`
    simulates the topbar's own 1.2s scroll-idle auto-hide (`scheduleNavIdle()`'s
    exact `aria-hidden`/class toggle, not a synthetic hook) while the palette
    is open — with neither the opener nor the fallback reachable, focus is
    left cleared rather than forced onto a hidden trigger (`isTrigger:
    false`, `insideAriaHiddenAncestor: false`). `dismissUnder60ms` (below)
    hits this same "trigger not yet reachable" path naturally, since nothing
    has scrolled yet that early in the run — its assertion is deliberately
    about the invariant (not `#cmdInput`, not inside any hidden ancestor),
    not about which exact element ends up focused.
  - **The 60ms delayed focus was a live race, not just a narrated one.**
    `openCmd()` waits 60ms before focusing `#cmdInput`; round 3's checks
    always waited well past that before doing anything else, so the timer
    always resolved *before* a dismiss or detail-hop was ever attempted —
    the race condition literally never occurred in that driver run, whatever
    the code did or didn't guard against. `script.js` now cancels the
    pending timer the instant the list layer stops being current
    (`cancelPendingFocus()`, called from `closeCmd()`/`closeCmdDetail()`) and
    the callback itself re-checks exposure before firing
    (`isExposedFocusable(input)`) — belt-and-suspenders. `dismissUnder60ms`
    and `listToDetailUnder60ms` force the actual race deterministically:
    open and dismiss (or open and drill into a result) in the *same
    synchronous tick* — 0ms elapsed, reliably inside the 60ms window, not a
    timing gamble — then wait well past 60ms and confirm the stale timer
    didn't fire and steal focus back onto a `#cmdInput` that's since gone
    aria-hidden.
  - `activeInfo()` (the driver's own snapshot helper) now also reports
    `insideAriaHiddenAncestor`/`insideInertAncestor` for whatever element is
    actually focused, walking up from `document.activeElement` generically —
    round 3's version only checked membership in the two palette containers
    by name, which can't see focus stranded inside an unrelated closed
    surface (the mail composer, the row link marked `inert`). `focusInvariant`
    aggregates every snapshot from both `focusRestoration` and
    `focusRegression` (14 total) and asserts none of them land inside a
    hidden or inert ancestor — `holds: true`, zero violations, computed
    from the raw data rather than eyeballed per-case.
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

- `results.json` — raw output of the round-4 driver run (font checks,
  the site-wide typography sweep, overflow, palette states, both hints,
  console/exceptions, full AX tree dump, `focusRestoration`,
  `focusRegression`, `focusInvariant`). Re-run in full each round rather
  than diffed/appended, so it's always one self-consistent snapshot of the
  commit it ships with — round-1 through round-3 findings are re-verified
  here too, not just the round-4 delta.
- `cdp-driver.js` — the script that produced it. Two drift bugs fixed along
  the way: its output filename used to not match what actually got
  committed (`results-round2.json` in the script vs. `results.json` in the
  tree, round-3), and screenshots were written flat into `validation/pr-16/`
  instead of `validation/pr-16/screenshots/` (also round-3) — both now write
  exactly where this README points. `node validation/pr-16/cdp-driver.js`
  reproduces the whole thing (serve the repo root over HTTP first — see
  above).
- `screenshots/01`–`07` — desktop, 320px reflow, the three palette states,
  320px with the palette open, and the non-Mac hint.

Round-1 evidence (the CDP pass behind the `AGENTS.md` line 100 note) was
produced the same way but wasn't persisted to the repo — round-2 closed
that gap by committing this directory going forward, and every round since
(including this one) re-runs and overwrites it rather than letting evidence
and driver drift apart again. Round 4 additionally closed a gap in *what*
got re-verified, not just whether it did: round 1's "185/185" typography
count and round 3's focus-restoration fallback target were both narrated
claims the driver itself didn't check — see the typography and focus
restoration bullets above for what's actually persisted now.
