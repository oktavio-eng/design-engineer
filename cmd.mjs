/* ---------------------------------------------------------------------------
   ⌘K palette — one search over everything saved on the site, on every page.

   Runs on index, /changelog and /prompts. It used to be an IIFE at the bottom
   of script.js, which only the homepage loads (that file wires homepage-only
   elements with no null guards — see the notes in changelog.html/prompts.html
   for why they never include it). Pulling the palette out means:

   - the palette's markup (wash, list dialog, detail dialog) is built here and
     appended to <body> on load, so no page has to carry a copy of it;
   - the data comes from two places: `window.SITE_CONTENT` (content.js —
     people, plan phases, references, courses, readings) and `PROMPTS`
     (prompts.mjs). Plus a small "Pages" group so the palette doubles as
     cross-page navigation now that it's everywhere;
   - the page hooks in through events instead of function calls. Before the
     palette opens it dispatches `cmd:beforeopen` on document; the homepage
     answers by closing its panel/comment/about/avatar/mail layers, the
     prompts page by closing its own prompt modal. Nothing here knows those
     surfaces exist;
   - the trigger is opt-in: any element with `data-cmd-trigger` (the homepage
     logo). Other pages' logos stay real links home.

   Load order: this is a module script, so it executes after every deferred
   classic script that precedes it in the document — content.js, favicons.js
   and (on the homepage) script.js all run first.
--------------------------------------------------------------------------- */
import { PROMPTS, renderPromptDetail, attachPromptCopy } from "/prompts.mjs";

const PAGES = [
  { name: "The plan", what: "wiki", href: "/wiki" },
  { name: "Portfolio", what: "home — client work, personal projects, life", href: "/" },
  { name: "Changelog", what: "what changed, day by day", href: "/changelog" },
  { name: "Prompts", what: "prompts used in real work", href: "/prompts" },
];

// Portfolio drafts (placeholder client entries — see portfolio-content.js)
// stay out of the index unless the page itself is showing them.
const showDrafts =
  /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || new URLSearchParams(location.search).has("draft");

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// favicons.js is a classic script that owns the <img> builder and the
// fallback cascade (Google -> DuckDuckGo -> origin -> remove). It's global on
// purpose so the inline `onerror="favFallback(this)"` in the markup string can
// find it. If a page ever loads this module without favicons.js, links still
// render — just without the icon.
function favicon(url) {
  return typeof window.favicon === "function" ? window.favicon(url) : "";
}

// Same body switch names the homepage always used (`cmd-open`,
// `cmd-detail-open`); tests and stories key on them. The wash/dialog CSS
// itself keys on each element's own aria-hidden, because /prompts has a second
// `.cmd-modal` (its prompt detail) that must not light up when this one does.
// Both dialogs are `inert` while closed (cleared only while open), the same
// pairing the /prompts modal uses: aria-hidden alone leaves the input and the
// ×/back buttons as real Tab stops in an invisible dialog — axe's
// aria-hidden-focus, and a genuine keyboard trap.
function ensureMarkup() {
  if (document.getElementById("cmd")) return;
  const host = document.createElement("div");
  host.innerHTML =
    '<div class="cmd-wash" id="cmdWash" aria-hidden="true"></div>' +
    '<div class="cmd" id="cmd" role="dialog" aria-modal="true" aria-label="Search" aria-hidden="true" inert>' +
    '<div class="cmd__card"><div class="cmd__head">' +
    '<input class="cmd__input" id="cmdInput" type="text" placeholder="Search…" autocomplete="off" spellcheck="false" aria-controls="cmdList" aria-expanded="true" aria-describedby="cmdEscHint">' +
    '<span class="cmd__esc" id="cmdEsc" aria-hidden="true">⌘K</span>' +
    '<span class="sr-only" id="cmdEscHint">Press Command K to close</span>' +
    '</div><div class="cmd__rule"></div>' +
    '<div class="cmd__list" id="cmdList" role="listbox" aria-label="Results"></div>' +
    "</div></div>" +
    '<div class="cmd-modal" id="cmdModal" role="dialog" aria-modal="true" aria-label="Details" aria-hidden="true" inert>' +
    '<button class="panel-close cmd-modal__back" id="cmdModalBack" type="button" aria-label="Back to search">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>' +
    "</button> " +
    '<button class="panel-close cmd-modal__close" id="cmdModalClose" type="button" aria-label="Close">×</button>' +
    '<div id="cmdModalBody"></div></div>';
  while (host.firstChild) document.body.appendChild(host.firstChild);
}

export function initCommandMenu() {
  ensureMarkup();

  const wash = document.getElementById("cmdWash"),
    cmd = document.getElementById("cmd"),
    input = document.getElementById("cmdInput"),
    list = document.getElementById("cmdList"),
    modal = document.getElementById("cmdModal"),
    modalBody = document.getElementById("cmdModalBody"),
    modalClose = document.getElementById("cmdModalClose"),
    modalBack = document.getElementById("cmdModalBack"),
    escHint = document.getElementById("cmdEsc"),
    trigger = document.querySelector("[data-cmd-trigger]");

  // The hint badge shows the real toggle shortcut (opens when closed, closes
  // when open — see the keydown handler below), not a decorative fragment.
  // Mac gets the glyph; everyone else gets the word, since Ctrl has no glyph
  // convention on the web. `userAgentData.platform` is Chromium-only, so it
  // falls back to the deprecated-but-still-live `navigator.platform`, then to
  // a `userAgent` string match — never assume Mac by default.
  //
  // The badge itself is `aria-hidden` — a bare <span> has no role that
  // reliably carries an `aria-label` to assistive tech. The instruction lives
  // instead in `#cmdEscHint`, a `.sr-only` sibling wired to the input via
  // `aria-describedby` — that's the pairing (interactive control +
  // description) screen readers actually expose.
  const platform =
    (navigator.userAgentData && navigator.userAgentData.platform) ||
    navigator.platform ||
    navigator.userAgent ||
    "";
  const isMac = /Mac|iPhone|iPad|iPod/i.test(platform);
  escHint.textContent = isMac ? "⌘K" : "Ctrl K";
  document.getElementById("cmdEscHint").textContent =
    "Press " + (isMac ? "Command K" : "Control K") + " to close";

  // One flat index over every collection. Built once: these objects never
  // change at runtime. `what` is the secondary line in the row; `text` is
  // extra searchable material (tags, descriptions) that isn't shown.
  const index = [];
  // `collection` is the key of the map on the content object ("projects",
  // "people"…) — what `[data-open="collection:key"]` on a page row refers to.
  function add(group, map, collection) {
    for (const key in map) {
      const e = map[key];
      if (e.draft && !showDrafts) continue;
      index.push({ group, collection, kind: "entry", key, name: e.name, what: e.role || "", text: e.bio || "", entry: e });
    }
  }
  const content = window.SITE_CONTENT || {};
  add("People", content.people || {}, "people");
  add("Plan", content.phases || {}, "phases");
  add("References", content.refs || {}, "refs");
  add("Courses", content.courses || {}, "courses");
  add("Reading", content.readings || {}, "readings");
  // Portfolio collections (portfolio-content.js) — loaded on every page, so a
  // project is one ⌘K away from the plan page too.
  const portfolio = window.PORTFOLIO_CONTENT || {};
  add("Projects", portfolio.projects || {}, "projects");
  add("Personal projects", portfolio.personal || {}, "personal");
  add("Life", portfolio.life || {}, "life");
  add("Writing", portfolio.writing || {}, "writing");
  PROMPTS.forEach((prompt) => {
    index.push({
      group: "Prompts",
      kind: "prompt",
      key: prompt.slug,
      name: prompt.title,
      what: prompt.category,
      text: prompt.tags.concat(prompt.description).join(" "),
      entry: prompt,
    });
  });
  PAGES.forEach((page) => {
    index.push({ group: "Pages", kind: "page", key: page.href, name: page.name, what: page.what, text: "", entry: page });
  });

  let results = [],
    cursor = 0,
    // Where the list was when the detail opened, so going back lands on the
    // same row instead of snapping to the top.
    lastCursor = 0,
    // Own state, not just the body classes: /prompts has a second detail
    // dialog that toggles `cmd-detail-open` too, and Escape must only reach
    // for the layer this module actually put up.
    listOpen = false,
    detailOpen = false,
    // True when the detail was opened straight from a page row (`[data-open]`),
    // not from the results list: there is no list to go "back" to, so the
    // back button hides and Escape/wash dismiss outright.
    directOpen = false;

  function score(item, q) {
    const n = item.name.toLowerCase(),
      w = (item.what || "").toLowerCase(),
      t = (item.text || "").toLowerCase();
    if (n === q) return 0;
    if (n.indexOf(q) === 0) return 1;
    if (n.indexOf(q) > -1) return 2;
    if (w.indexOf(q) > -1) return 3;
    if (t.indexOf(q) > -1) return 4;
    return -1;
  }

  function renderResults() {
    const q = input.value.trim().toLowerCase();
    results = [];
    if (!q) {
      results = index.slice();
    } else {
      const scored = [];
      for (let i = 0; i < index.length; i++) {
        const s = score(index[i], q);
        if (s > -1) scored.push({ s, i, item: index[i] });
      }
      scored.sort((a, b) => a.s - b.s || a.i - b.i);
      for (let j = 0; j < scored.length; j++) results.push(scored[j].item);
    }
    cursor = 0;
    if (!results.length) {
      list.innerHTML = '<p class="cmd__empty">No results</p>';
      return;
    }
    let html = "",
      last = null;
    for (let k = 0; k < results.length; k++) {
      const r = results[k];
      if (r.group !== last) {
        html += '<div class="cmd__group">' + r.group + "</div>";
        last = r.group;
      }
      html +=
        '<button class="cmd__item" role="option" data-i="' +
        k +
        '" aria-selected="' +
        (k === 0) +
        '">' +
        "<span>" +
        esc(r.name) +
        "</span>" +
        (r.what ? '<span class="what">' + esc(r.what) + "</span>" : "") +
        "</button>";
    }
    list.innerHTML = html;
  }

  function setCursor(i) {
    if (!results.length) return;
    const items = list.querySelectorAll(".cmd__item");
    if (!items.length) return;
    items[cursor].setAttribute("aria-selected", "false");
    cursor = Math.min(Math.max(i, 0), items.length - 1);
    items[cursor].setAttribute("aria-selected", "true");
    if (items[cursor].scrollIntoView) items[cursor].scrollIntoView({ block: "nearest" });
  }

  function moveCursor(delta) {
    if (!results.length) return;
    setCursor((cursor + delta + results.length) % results.length);
  }

  // Where focus returns on a complete dismissal — whatever had it before the
  // palette opened, not necessarily the trigger. Captured once per session
  // (see the isFreshOpen check in openCmd) so the "back from detail" hop and
  // the ⌘K "swap surfaces" hop don't clobber it with focus that's already
  // inside the palette. Can go stale between capture and use — see
  // isExposedFocusable — so it's re-validated at restore time, not trusted
  // just because it was once real.
  let opener = null;

  // openCmd() waits 60ms before focusing #cmdInput (see below for why). A
  // dismiss or a hop into detail can land inside that window; the pending
  // timer is cancelled the instant the list layer stops being the thing on
  // screen so it can't fire late and steal focus back onto a control that's
  // gone dark. Belt-and-suspenders with the isExposedFocusable guard inside
  // the callback itself, in case some future caller closes the list without
  // going through closeCmd().
  let pendingFocusTimer = null;
  function cancelPendingFocus() {
    if (pendingFocusTimer !== null) {
      clearTimeout(pendingFocusTimer);
      pendingFocusTimer = null;
    }
  }

  // The confirmed bug: a control kept focus after its subtree went
  // aria-hidden, which assistive tech treats as focus vanishing into the
  // void. Blur before hiding, every time — callers that know where focus
  // belongs next (returnFocus, or the layer that's about to take over) move
  // it there in the same tick, before anything repaints.
  function blurIfInside(root) {
    if (root.contains(document.activeElement)) document.activeElement.blur();
  }

  // True only for an element that's reachable right now: connected, not
  // behind an aria-hidden or inert ancestor — every surface on the site
  // marks its own container aria-hidden the instant it closes, so this
  // doubles as "not inside a surface that just closed" — and genuinely
  // focusable, not just present in the DOM. Checked at the moment focus is
  // about to move, never cached: the opener can go stale between capture and
  // use (⌘K pressed from inside the homepage mail composer closes the mail
  // modal as a side effect of opening the palette), and the fallback trigger
  // isn't exempt either (the topbar aria-hides itself after 1.2s idle).
  function isExposedFocusable(el) {
    if (!el || el.nodeType !== 1 || typeof el.focus !== "function") return false;
    if (!document.contains(el)) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    if (el.closest("[inert]")) return false;
    if (el.hasAttribute("disabled")) return false;
    const tag = el.tagName;
    const naturallyFocusable =
      tag === "BUTTON" ||
      tag === "INPUT" ||
      tag === "SELECT" ||
      tag === "TEXTAREA" ||
      (tag === "A" && el.hasAttribute("href"));
    const tabIndexAttr = el.getAttribute("tabindex");
    const hasTabIndex = tabIndexAttr !== null && parseInt(tabIndexAttr, 10) >= 0;
    return naturallyFocusable || hasTabIndex;
  }

  function returnFocus() {
    let target = opener;
    opener = null;
    if (!isExposedFocusable(target)) target = trigger;
    if (!isExposedFocusable(target)) target = null;
    if (target) target.focus();
    // Neither the opener nor the trigger is reachable right now — blurIfInside
    // already moved focus off the closing surface above; there's nowhere
    // safer to send it, so it stays cleared rather than forcing a hidden
    // element to take focus just to have *a* target.
  }

  // keepQuery is the "back from detail" path: same query, same selected row.
  function openCmd(keepQuery) {
    const isFreshOpen = !listOpen && !detailOpen;
    cancelPendingFocus();
    // The page folds whatever it has open (see the file header). Fired before
    // this module touches its own layers so a page that reads the body
    // classes sees a consistent "palette not up yet" state.
    document.dispatchEvent(new CustomEvent("cmd:beforeopen"));
    // Captured after the page folded its layers, not before: a surface that
    // returns focus on close (the /prompts modal hands it back to its row)
    // leaves the better opener behind. The homepage closers don't move
    // focus, so there it's the same element either way.
    if (isFreshOpen) opener = document.activeElement;
    // Also tears down the detail layer, so ⌘K on top of an open detail swaps
    // surfaces instead of stacking them.
    detailOpen = false;
    directOpen = false;
    modal.classList.remove("cmd-modal--direct");
    document.body.classList.remove("cmd-detail-open");
    blurIfInside(modal);
    modal.inert = true;
    modal.setAttribute("aria-hidden", "true");
    listOpen = true;
    document.body.classList.add("cmd-open");
    wash.setAttribute("aria-hidden", "false");
    cmd.inert = false;
    cmd.setAttribute("aria-hidden", "false");
    if (!keepQuery) input.value = "";
    renderResults();
    // renderResults() rebuilds the list and resets the cursor, so restoring
    // comes after.
    if (keepQuery) setCursor(lastCursor);
    pendingFocusTimer = setTimeout(function () {
      pendingFocusTimer = null;
      // A dismiss or a hop into detail can land inside this delay — only
      // claim focus if #cmdInput is still genuinely the thing to focus.
      if (listOpen && isExposedFocusable(input)) input.focus();
    }, 60);
  }

  // restore=false is the "hop into detail" case (openDetail() calls this to
  // tear the list down first) — the detail layer takes focus itself right
  // after, so returning it to the opener here would just be a flash to
  // undo. Every other caller is a genuine complete dismissal: Meta+K/Ctrl+K
  // toggle-close and Escape from the list both hit the default.
  function closeCmd(restore) {
    cancelPendingFocus();
    listOpen = false;
    document.body.classList.remove("cmd-open");
    blurIfInside(cmd);
    wash.setAttribute("aria-hidden", "true");
    cmd.inert = true;
    cmd.setAttribute("aria-hidden", "true");
    if (restore !== false) returnFocus();
  }

  function closeCmdDetail() {
    cancelPendingFocus();
    detailOpen = false;
    directOpen = false;
    modal.classList.remove("cmd-modal--direct");
    document.body.classList.remove("cmd-detail-open");
    blurIfInside(modal);
    wash.setAttribute("aria-hidden", "true");
    modal.inert = true;
    modal.setAttribute("aria-hidden", "true");
    returnFocus();
  }
  // Back to the results. The wash stays up the whole time — both states share
  // the same rule in the CSS, so hiding and re-showing it would flash.
  function backToCmd() {
    // A directly-opened detail has no list behind it — dismiss instead.
    if (directOpen) return closeCmdDetail();
    openCmd(true);
  }

  // The same markup the homepage side panel builds for a person/phase/
  // reference, so the two surfaces can never drift apart.
  function entryHtml(e) {
    let html =
      '<div class="p-stagger"><h3>' +
      esc(e.name) +
      '</h3><p class="role">' +
      e.role +
      "</p></div>";
    // `preview` (22/08/2026, projects only): the entry's own og:image,
    // hotlinked live — same "external asset, remove on failure" contract
    // favicon() uses below, just a bigger image with nothing to fall back
    // to. onerror has to be inline: the markup is built as a string and
    // inserted via innerHTML, so a JS-attached listener would never bind.
    if (e.preview) {
      html += '<img class="cmd-modal__preview p-stagger" src="' + e.preview + '" onerror="this.remove()" alt="" loading="lazy">';
    }
    html += '<p class="bio p-stagger">' + e.bio + "</p>";
    if (e.items) {
      html += '<span class="label p-stagger">In practice</span><div class="p-stagger">';
      for (let i = 0; i < e.items.length; i++) html += '<p class="item">' + e.items[i] + "</p>";
      html += "</div>";
    }
    // `subprojects` (22/08/2026, escola-da-bel only): individual landing
    // pages worth a preview of their own, each its own live-fetched image +
    // description, same onerror contract as `preview` above.
    if (e.subprojects) {
      html += '<span class="label p-stagger">Landing pages</span><div class="p-stagger cmd-modal__subprojects">';
      for (let k = 0; k < e.subprojects.length; k++) {
        const s = e.subprojects[k];
        html +=
          '<a class="subproject" href="' + s.url + '" target="_blank" rel="noopener">' +
          '<img class="subproject__preview" src="' + s.preview + '" onerror="this.remove()" alt="" loading="lazy">' +
          '<span class="subproject__name">' + esc(s.name) + "</span>" +
          '<p class="subproject__desc">' + s.description + "</p>" +
          "</a>";
      }
      html += "</div>";
    }
    html += '<span class="label p-stagger">Links</span><div class="p-stagger">';
    for (let j = 0; j < e.links.length; j++) {
      const l = e.links[j];
      html +=
        '<div class="row"><span class="who">' +
        favicon(l[1]) +
        '<a href="' +
        l[1] +
        '" target="_blank" rel="noopener">' +
        l[0] +
        "</a></span></div>";
    }
    html += "</div>";
    return html;
  }

  function samePage(href) {
    const here = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
    const there = href.replace(/\/$/, "") || "/";
    return here === there;
  }

  function openDetail(item, options) {
    const direct = !!(options && options.direct);
    // Pages are actions, not records: pick one and go there. Picking the
    // page you're already on just dismisses — nothing to navigate to.
    if (item.kind === "page") {
      closeCmd();
      if (!samePage(item.entry.href)) location.assign(item.entry.href);
      return;
    }
    if (direct) {
      // Same choreography as a fresh open: the page folds its layers and the
      // opener (the row) is what focus returns to.
      document.dispatchEvent(new CustomEvent("cmd:beforeopen"));
      opener = document.activeElement;
    }
    directOpen = direct;
    modal.classList.toggle("cmd-modal--direct", direct);
    if (item.kind === "prompt") {
      // The prompt detail is the /prompts modal's own renderer, so the two
      // never diverge. `.prompt-modal` widens the sheet for long-form text.
      modalBody.replaceChildren(renderPromptDetail(item.entry));
      modal.classList.add("prompt-modal");
      modal.setAttribute("aria-label", item.entry.title);
    } else {
      modalBody.innerHTML = entryHtml(item.entry);
      modal.classList.remove("prompt-modal");
      modal.setAttribute("aria-label", "Details");
    }
    // Taken from the item, not the global cursor: a click opens a row the
    // keyboard cursor was never on.
    lastCursor = results.indexOf(item);
    // false: this tears the list down to swap surfaces, not to dismiss —
    // focus moves into the detail layer below, not back to the opener.
    closeCmd(false);
    detailOpen = true;
    document.body.classList.add("cmd-detail-open");
    wash.setAttribute("aria-hidden", "false");
    modal.inert = false;
    modal.setAttribute("aria-hidden", "false");
    modal.scrollTop = 0;
    modalClose.focus();
  }

  attachPromptCopy(modal, PROMPTS);

  input.addEventListener("input", renderResults);

  input.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      moveCursor(1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      moveCursor(-1);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (results[cursor]) openDetail(results[cursor]);
    }
  });

  list.addEventListener("click", function (ev) {
    const b = ev.target.closest(".cmd__item");
    if (b) openDetail(results[+b.dataset.i]);
  });

  // Page rows that open a record directly: `data-open="Group:key"` (the
  // portfolio's client/personal/life rows). Same detail card as a palette
  // result, minus the back button.
  document.addEventListener("click", function (ev) {
    const el = ev.target.closest("[data-open]");
    if (!el) return;
    const [collection, key] = String(el.dataset.open).split(":");
    const item = index.find((i) => i.kind === "entry" && i.collection === collection && i.key === key);
    if (!item) return;
    ev.preventDefault();
    openDetail(item, { direct: true });
  });

  // The homepage logo is the trigger. It's an anchor to "#", which would jump
  // the page out from under the dialog, so the default is suppressed.
  if (trigger) {
    trigger.classList.add("cmd-trigger");
    trigger.addEventListener("click", function (ev) {
      ev.preventDefault();
      openCmd();
    });
  }

  wash.addEventListener("click", function () {
    detailOpen ? backToCmd() : closeCmd();
  });
  modalBack.addEventListener("click", backToCmd);
  // The × is the only gesture that dismisses the whole stack at once.
  modalClose.addEventListener("click", closeCmdDetail);

  document.addEventListener(
    "keydown",
    function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && (ev.key === "k" || ev.key === "K")) {
        ev.preventDefault();
        listOpen ? closeCmd() : openCmd();
        return;
      }
      if (ev.key !== "Escape") return;
      // Innermost surface first, so Escape peels one layer at a time.
      if (detailOpen) {
        ev.stopImmediatePropagation();
        backToCmd();
      } else if (listOpen) {
        ev.stopImmediatePropagation();
        closeCmd();
      }
    },
    true,
  );

  return { open: openCmd, close: closeCmd };
}

if (typeof document !== "undefined") initCommandMenu();
