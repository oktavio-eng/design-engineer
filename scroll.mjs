/**
 * Smooth scroll — auto-mounted ES module, same pattern as cursor.mjs and
 * sound.mjs: one script tag per page, no markup required.
 *
 * Wraps the window scroll in Lenis (https://lenis.dev, MIT, darkroom.engineering)
 * so wheel input eases instead of stepping. Vendored in /vendor/lenis for the
 * same reason cuelume is: no bundler, so a bare `import "lenis"` would not
 * resolve in the browser (package.json only documents the version of origin).
 *
 * What Lenis does on its own, so this file stays two lines:
 * - `prefers-reduced-motion: reduce` → smoothing off, scrolls are instant
 *   (`respectReducedMotion` defaults to true since 1.3).
 * - Touch/trackpad-flick on phones stays native (`syncTouch` is off).
 * - Scrolls the window with `behavior: "instant"`, so the `scroll-behavior:
 *   smooth` on <html> (main.css) never fights it.
 *
 * What it can't know: which elements scroll on their own. Every container
 * with `overflow-y: auto` in main.css is listed in NESTED so a wheel over the
 * wiki sidebar, the About sheet, the comment composer, the ⌘K list or a
 * detail modal scrolls that element natively instead of the page behind it.
 * A new scrollable surface must be added here (or carry `data-lenis-prevent`).
 */
import Lenis from "/vendor/lenis/lenis.mjs";

const NESTED = ".panel, .about-modal, .composer__input, .cmd__list, .cmd-modal";

new Lenis({
  autoRaf: true,
  prevent: (node) => typeof node.matches === "function" && node.matches(NESTED),
});
