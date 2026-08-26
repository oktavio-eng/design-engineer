/**
 * Interaction sound — auto-mounted ES module, same pattern as cursor.mjs
 * and cmd.mjs: one script tag per page, no markup required.
 *
 * Wires the handful of data-cuelume-* attributes already in the HTML
 * (see wiki.html, index.html, changelog.html, prompts.html) via cuelume's
 * own delegated bind(). Vendored locally in /vendor/cuelume — this repo
 * has no bundler, so a bare `import "cuelume"` specifier wouldn't resolve
 * in the browser even though the package is in package.json.
 *
 * Volume sits below cuelume's full-blast default (1.0): these are meant
 * to read as a detail, not a soundtrack.
 */
import { bind, setVolume } from "/vendor/cuelume/index.js";

setVolume(0.5);
bind();
