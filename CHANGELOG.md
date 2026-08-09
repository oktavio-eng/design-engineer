# Changelog

Notable changes to this site, in the order they landed on `main`. Newest first. This is the technical log — for the narrated version, see `/changelog` on the site itself. See `AGENTS.md` for the deeper "why" behind several of these; a few entries below only summarize it.

## 2026-08-07

- Add dark mode with a toggle that also follows the OS theme live (`prefers-color-scheme`). No-flash on load via a synchronous inline script in `<head>` that sets `data-theme` before any stylesheet paints; an explicit click on the toggle wins forever after, until clicked again. (#14)
- Add a Storybook MVP as a dev-only visual inventory: config in `.storybook/`, stories in `stories/`, deps/scripts in `package.json`. Imports `styles/main.css` and the existing tokens directly — no component refactor, no new production build. (#15)

## 2026-08-06

- Add 19 people, 3 craft references, and an Index course entry to the lists.
- Revert the tag-pill experiment back to short text summaries; fix a horizontal-scroll bug on mobile that the pills had introduced.

## 2026-08-05

- Add `styles/experiments/flat-type.css`: a revertible experiment that flattens the whole type scale to one size (1.1rem) and one weight (460 — a real interpolated instance, since Geist ships as a variable font), pushing all hierarchy onto gray, space, and rhythm. Toggled by a single `<link>` after `main.css`; the intro's own type size is explicitly left out. (#11)
- Add neighbor dimming to list rows: hovering inside a list drops every row except the one under the cursor to 30% opacity, triggered by `:has()` on the container rather than `:hover`, so passing through a heading or the gap between rows doesn't fire it.
- Two follow-up passes keep the intro's word size steady at 1.2rem while other tuning continued around it. (#12, #13)

## 2026-08-02 to 2026-08-04

- Add an Apple-style "hello screensaver" intro: a greeting in several languages that plays once per tab session (`sessionStorage`) before the homepage content, ending on "Hello" and the mark. (#3)
- Trim the language list four times as the sequence got tuned for feel, not just runtime: 20 → 7 languages (#4), → 6 (#6), → 5 (#8) — landing on a 200ms-per-word cut with an extra hold on the last greeting.
- Fix the intro not playing at all in Safari, desktop and mobile: `defer` doesn't block execution until `<head>` stylesheets finish loading there the way it does in Chrome/Firefox, so `getComputedStyle` was reading empty custom properties before `main.css` had applied. (#7, #9)
- Increase the intro word size to 1.2rem for legibility. (#10)
- Replace `favicon.svg` with the new flag mark, then swap the topbar/navbar logo to the black version of it. (#5)

## 2026-08-01

- Recover the site from its production deployment; add `AGENTS.md` documenting the project's craft rules for any agent (human or otherwise) that touches it afterward.
- Split the single-file `index.html` into `index.html` + `styles.css` + `script.js`; drop `window.storage` (a Claude-Artifact-sandbox API that doesn't exist in real browsers — every call threw and silently fell through a `try/catch` into `localStorage`); fix `favicon.svg`, which the initial recovery had saved as Vercel's 404 page text instead of the actual SVG. (#1)
- Add a back button to the search (cmdk) detail modal.
- Add `PORTFOLIO.md`: a roadmap for reusing this structure as a portfolio.
- Show the logo and social actions in the mobile topbar, and match the desktop show-on-scroll behavior for it; halve the top page padding on phones.
- Extract design tokens out of `styles.css` into `styles/tokens/*.css` (`colors`, `motion`, `spacing`, `typography`, `radius`) — zero visual change, validated by a structural CSSOM diff (all 854 original declarations matched after resolving `var()`) and pixel-for-pixel screenshots, desktop and mobile, before/after. (#2)

---

More entries land here as the PRs currently in review get merged into `main`.
