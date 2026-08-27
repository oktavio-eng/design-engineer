/* ---------------------------------------------------------------------------
   Page chrome for every page that isn't the homepage: the theme toggle and
   the topbar that reveals on scroll and hides on idle. changelog.html,
   prompts.html and index.html (the portfolio home) load this; wiki.html gets the same two
   behaviors from script.js (which also wires the homepage-only surfaces —
   see the note in changelog.html for why that file can't just be loaded
   here). Until 16/08/2026 this lived as an inline copy at the bottom of each
   page; three copies was two too many.

   Theme: same "theme" key and rule order as script.js — an explicit click
   wins forever after; until then the OS preference is followed live. The
   no-flash read of that key happens in a tiny inline <script> at the top of
   each page's <head>, before any stylesheet, not here.

   Topbar: hidden on load, shown on the first scroll, hidden again after
   1200ms without scrolling or hovering it; hovering holds it open. `inert`
   is toggled alongside `aria-hidden` so the links inside the hidden bar
   aren't invisible Tab stops.
--------------------------------------------------------------------------- */
(function () {
  var KEY = "theme";
  var trigger = document.getElementById("themeTrigger");
  var media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  function readStored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function writeStored(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
  }
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }
  function applyTheme(theme) {
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    if (trigger) trigger.setAttribute("data-mode", theme);
  }
  if (trigger) {
    trigger.setAttribute("data-mode", currentTheme());
    trigger.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      writeStored(next);
    });
  }
  if (media) {
    var followSystemTheme = function (event) {
      if (readStored()) return;
      applyTheme(event.matches ? "dark" : "light");
    };
    if (media.addEventListener) media.addEventListener("change", followSystemTheme);
    else if (media.addListener) media.addListener(followSystemTheme);
  }
})();

(function () {
  var topbar = document.querySelector(".topbar");
  if (!topbar) return;
  var NAV_IDLE_MS = 1200;
  var navIdleTimer = null;
  var navHovering = false;
  function scheduleNavIdle() {
    clearTimeout(navIdleTimer);
    if (navHovering) return;
    navIdleTimer = setTimeout(function () {
      topbar.classList.remove("visible");
      topbar.setAttribute("aria-hidden", "true");
      topbar.inert = true;
    }, NAV_IDLE_MS);
  }
  function showNav() {
    topbar.inert = false;
    topbar.classList.add("visible");
    topbar.setAttribute("aria-hidden", "false");
    scheduleNavIdle();
  }
  window.addEventListener("scroll", showNav, { passive: true });
  topbar.addEventListener("mouseenter", function () {
    navHovering = true;
    clearTimeout(navIdleTimer);
    topbar.inert = false;
    topbar.classList.add("visible");
    topbar.setAttribute("aria-hidden", "false");
  });
  topbar.addEventListener("mouseleave", function () {
    navHovering = false;
    scheduleNavIdle();
  });
})();

/* "Back" links remember where the visitor came from (26/08/2026). Both
   changelog.html and prompts.html hard-coded their two `.about-trigger`
   back links to /wiki ("&larr; Plan" up top, "Back to the plan" in the
   footer) — fine if the plan is the only way in, wrong once the navbar
   makes / -> /changelog and / -> /prompts direct hops too: landing from
   home and getting routed back through the wiki on the way out reads as
   a bug. `document.referrer` (not a sessionStorage trail) is enough:
   this only needs the immediately-previous page, and it degrades to the
   old fixed /wiki behavior for a direct visit, a reload, or an external
   link, which is the right fallback anyway. index.html has no matching
   `[href="/wiki"]` link, so the querySelectorAll below is empty there and
   this whole block is a no-op. */
(function () {
  var backLinks = document.querySelectorAll('a.about-trigger[href="/wiki"]');
  if (!backLinks.length) return;
  var ROUTES = { "/": "Home", "/wiki": "Wiki", "/changelog": "Changelog", "/prompts": "Prompts" };
  var here = location.pathname;
  var href = "/wiki";
  var label = "Wiki";
  try {
    var ref = document.referrer && new URL(document.referrer);
    if (ref && ref.origin === location.origin && ROUTES[ref.pathname] && ref.pathname !== here) {
      href = ref.pathname;
      label = ROUTES[ref.pathname];
    }
  } catch (e) {}
  backLinks.forEach(function (el) {
    el.href = href;
    el.textContent = el.closest("footer") ? "Back to " + label : "← " + label;
  });
})();

/* `enter`'s settle-filter fix (22/08/2026) — see the comment on
   `@keyframes enter` in main.css for the why. A CSS Animation interpolating
   away from a real `blur()` always resolves its end value to a concrete
   `blur(0px)`, never the bare keyword `none`, no matter what the keyframe
   itself declares — so every `.stagger`/`.p-stagger`/`.row.extra` consumer
   of `enter` keeps a non-`none` filter after it "finishes", which gives the
   element its own stacking context and clips any box-shadow bleeding past
   its own border box. Clearing `filter` from outside the animation, once it
   ends, produces a genuine `none` and drops that stacking context;
   `!important` is required because a still forwards-filling animation
   outranks a plain style change on the same property. Duplicated in
   script.js (wiki) for the same reason chrome.js itself is split from it. */
document.addEventListener("animationend", function (e) {
  if (e.animationName === "enter") {
    e.target.style.setProperty("filter", "none", "important");
  }
});
