/* Favicon fallback + the favicon() <img> builder moved to favicons.js (loaded
   before this file) so cmd.mjs can share them on every page. */

/* ---------------------------------------------------------------------------
   Intro — the "hello screensaver".

   Greets in six languages — one cut per --intro-step, no fade between them,
   the way Apple's setup greeting reads — then dissolves the last word into the
   mark and hands the page over. Every duration is read back out of
   tokens/motion.css so the schedule here and the transitions in main.css can
   never drift apart. Runs once per tab session (sessionStorage), not once
   per visit — see the SESSION_KEY block below.

   Three rules the sequence has to keep:
   - It is interruptible. Any deliberate input ends it on the spot.
   - It cannot trap the page. `.intro-playing` comes off <html> on every exit
     path — finished, skipped, already seen this session, or refused for
     reduced motion.
   - No held state is free. Every pause (the per-word step, the mark's beat
     before the dissolve) is a deliberate number that adds to the total; when
     the total needs to move, that's the first place to look.

   This block sits at the top of the file on purpose: it is the first thing the
   page does, so it runs before the rest of the script is even parsed.
--------------------------------------------------------------------------- */
(function () {
  const root = document.documentElement;
  const intro = document.getElementById("intro");
  if (!intro) return;

  // Latin scripts ride on Geist; the rest fall through to system-ui, which
  // carries CJK on every platform we target.
  const GREETINGS = [
    "Hola",
    "Bonjour",
    "Olá",
    "こんにちは",
    "你好",
    "Hello",
  ];

  const word = document.getElementById("intro-word");
  const text = document.getElementById("intro-text");
  const mark = document.getElementById("intro-mark");

  // Chrome/Firefox hold a `defer` script until stylesheets queued earlier in
  // <head> have applied, so `main.css` is always in by the time this runs.
  // Safari doesn't make that guarantee: it can run this script before
  // `main.css` lands, and every --intro-* read below then comes back empty.
  // `parseFloat("") || 0` turns that into a 0ms duration for the whole
  // sequence, which finishes in a handful of same-tick timeouts — the intro
  // "runs" in under a millisecond and never paints a frame.
  // A `link.sheet` / `load` check isn't enough to guard against this: in
  // Safari `link.sheet` can go non-null before the sheet's rules are actually
  // folded into computed style, so it reports ready one frame too early.
  // Poll the token itself instead — the one thing that's true exactly when
  // reading it will work — capped so a stylesheet that genuinely never loads
  // can't hang the intro forever.
  let tokenWait = 0;
  (function waitForTokens() {
    const ready = getComputedStyle(root).getPropertyValue("--intro-fade").trim() !== "";
    if (ready || ++tokenWait > 60) {
      start();
      return;
    }
    requestAnimationFrame(waitForTokens);
  })();

  function start() {
    const tokens = getComputedStyle(root);
    const ms = function (name) {
      return parseFloat(tokens.getPropertyValue(name)) || 0;
    };
    const STEP = ms("--intro-step");
    const HOLD_LAST = ms("--intro-hold-last");
    const FADE = ms("--intro-fade");
    const REVEAL = ms("--intro-reveal");
    const MARK_HOLD = ms("--intro-mark-hold");
    const OUT = ms("--intro-out");

    // Once per tab session, not per visit: sessionStorage (not the
    // localStorage the rest of the site uses for real persistence) is the
    // correct tool here — a reload five minutes later shouldn't replay a
    // 7s greeting, but a fresh tab should. Documented as a deliberate
    // exception in AGENTS.md. Same swallow-the-exception shape as the
    // localStorage helpers below (readStored/writeStored): persistence here
    // is a nicety, never a requirement.
    const SESSION_KEY = "intro-shown-v1";
    function seenIntro() {
      try {
        return sessionStorage.getItem(SESSION_KEY) === "1";
      } catch (e) {
        return false;
      }
    }
    function markIntroSeen() {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch (e) {}
    }

    const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchmove"];
    const SKIP_OPTS = { capture: true, passive: true };
    let timer = null;
    let ended = false;

    function end(skipped) {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      SKIP_EVENTS.forEach(function (type) {
        window.removeEventListener(type, skip, SKIP_OPTS);
      });
      if (skipped) root.classList.add("intro-skipped");
      // `intro-done` fades the overlay out and releases the content stagger in
      // the same frame, so the page arrives as the greeting leaves.
      root.classList.add("intro-done");
      setTimeout(function () {
        root.classList.remove("intro-playing", "intro-done", "intro-skipped");
        intro.remove();
      }, skipped ? FADE : OUT);
    }

    function skip() {
      end(true);
    }

    // All six greetings go into the DOM up front, stacked in one grid cell (see
    // `.intro__langs` in main.css). Swapping is then a class toggle between two
    // elements that are already laid out — no text measurement, no reflow, and
    // nothing for the bullet to shift against on a cut.
    const slots = GREETINGS.map(function (greeting) {
      const span = document.createElement("span");
      span.className = "intro__lang";
      span.textContent = greeting;
      text.appendChild(span);
      return span;
    });

    function step(i) {
      if (i >= slots.length) {
        // The one dissolve in the sequence: the last greeting fades out, then the
        // mark fades in. `.dissolve` is what gives the row a transition at all, so the
        // opacity-1 state has to be flushed under it before `visible` comes off —
        // set both in the same frame and the browser sees a single computed
        // change with no "before" to animate from, i.e. another cut.
        word.classList.add("dissolve");
        void word.offsetWidth;
        word.classList.remove("visible");
        timer = setTimeout(function () {
          mark.classList.add("visible");
          timer = setTimeout(function () {
            end(false);
          }, REVEAL + MARK_HOLD);
        }, FADE);
        return;
      }
      if (i > 0) slots[i - 1].classList.remove("on");
      slots[i].classList.add("on");
      // The row itself only cuts in once, under the first word. After that it
      // stays put and the languages swap inside it.
      if (i === 0) word.classList.add("visible");
      // "Hello" is where the shuffle lands, so it holds --intro-hold-last longer
      // than the words it just ran through.
      const hold = i === slots.length - 1 ? STEP + HOLD_LAST : STEP;
      timer = setTimeout(function () {
        step(i + 1);
      }, hold);
    }

    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if ((still && still.matches) || seenIntro()) {
      root.classList.remove("intro-playing");
      intro.remove();
      return;
    }

    markIntroSeen();
    SKIP_EVENTS.forEach(function (type) {
      window.addEventListener(type, skip, SKIP_OPTS);
    });
    step(0);
  }
})();

/* The five content collections (people, phases, refs, courses, readings) live
   in content.js and are published on window.SITE_CONTENT — shared with cmd.mjs,
   which indexes them for the ⌘K palette on every page. content.js is loaded
   before this file (see the <script> order in index.html). */
const { people, phases, refs, courses, readings } = window.SITE_CONTENT,
  panel = document.getElementById("panel"),
  panelWash = document.getElementById("panelWash"),
  content = document.getElementById("panelContent"),
  closeBtn = document.getElementById("panelClose"),
  rows = document.querySelectorAll(".people .row");
let activeRow = null;
const PANEL_W_KEY = "panel-width",
  PANEL_W_MIN = 300;

/* localStorage throws instead of returning null in a few real cases (Safari
   private mode, blocked third-party storage, quota). Persistence is a nicety
   here, so both helpers swallow the failure and the UI carries on. */
function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

/* ---------------------------------------------------------------------------
   Dark mode toggle. The theme itself is already applied to <html> by the
   inline script at the top of <head> before this file even downloads (that's
   what avoids a light-mode flash on load) — all this does is sync the
   button's icon to whatever was already decided, flip + persist an explicit
   choice on click, and keep following the OS theme live for anyone who
   hasn't clicked the toggle yet. Key is plain "theme" (not versioned like
   plan-comments-v2): the value space is just "dark"/"light"/absent, nothing
   to migrate.

   Two sources can set the theme, and they rank in this order:
   1. An explicit click — stored, and wins forever after (until clicked
      again).
   2. The OS preference — read once by the inline head script on load, and
      then tracked live here via matchMedia's `change` event, so switching
      the system theme while the tab is open (or between visits, before ever
      touching the toggle) moves the page without a reload.
   `getStoredTheme()` returning non-null is what tells the two apart: it's
   only ever written by the click handler below.
--------------------------------------------------------------------------- */
const THEME_KEY = "theme",
  themeTrigger = document.getElementById("themeTrigger"),
  themeMedia = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
function getStoredTheme() {
  return readStored(THEME_KEY);
}
function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
function applyTheme(theme) {
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  if (themeTrigger) themeTrigger.setAttribute("data-mode", theme);
}
if (themeTrigger) {
  themeTrigger.setAttribute("data-mode", currentTheme());
  themeTrigger.addEventListener("click", function () {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    writeStored(THEME_KEY, next);
  });
}
if (themeMedia) {
  const followSystemTheme = function (e) {
    if (getStoredTheme()) return; // an explicit click already overrode this
    applyTheme(e.matches ? "dark" : "light");
  };
  // `addEventListener` on a MediaQueryList is unsupported in Safari <14;
  // `addListener` is its deprecated-but-still-there predecessor there.
  if (themeMedia.addEventListener) themeMedia.addEventListener("change", followSystemTheme);
  else if (themeMedia.addListener) themeMedia.addListener(followSystemTheme);
}

function panelWMax() {
  return Math.min(640, window.innerWidth - 80);
}
function setPanelWidth(e, t) {
  const n = Math.max(PANEL_W_MIN, Math.min(panelWMax(), e));
  document.documentElement.style.setProperty("--panel-w", n + "px");
  if (t) writeStored(PANEL_W_KEY, String(n));
}
function loadPanelWidth() {
  const stored = readStored(PANEL_W_KEY);
  if (stored) setPanelWidth(parseInt(stored, 10), !1);
}
loadPanelWidth();
const panelResize = document.getElementById("panelResize");
let dragging = !1,
  dragStartX = 0,
  dragStartW = 0;
function endDrag() {
  dragging &&
    ((dragging = !1),
    panel.classList.remove("resizing", "resize-hint"),
    document.body.classList.remove("resizing"),
    setPanelWidth(
      parseInt(getComputedStyle(document.documentElement).getPropertyValue("--panel-w"), 10),
      !0,
    ));
}
function esc(e) {
  return e
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function itemHtml(e, t, n) {
  const a = e + "-" + t;
  let o = '<p class="item" data-c="' + a + '">' + n + '<span class="c-add">comment</span>';
  return (
    comments[a] && (o += '<span class="c-link"><a href="#">' + esc(comments[a]) + "</a></span>"),
    o + "</p>"
  );
}
function noteBlock(e) {
  return (
    '<div class="note-row p-stagger" data-c="' +
    e +
    '">' +
    (comments[e]
      ? '<a href="#" class="note-open">' + esc(comments[e]) + "</a>"
      : '<a href="#" class="note-open note-empty">add a note</a>') +
    "</div>"
  );
}
panelResize.addEventListener("mouseenter", function () {
  panel.classList.add("resize-hint");
}),
  panelResize.addEventListener("mouseleave", function () {
    dragging || panel.classList.remove("resize-hint");
  }),
  panelResize.addEventListener("pointerdown", function (e) {
    (dragging = !0),
      (dragStartX = e.clientX),
      (dragStartW = panel.getBoundingClientRect().width),
      panel.classList.add("resizing"),
      document.body.classList.add("resizing"),
      panelResize.setPointerCapture(e.pointerId);
  }),
  panelResize.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    const t = dragStartX - e.clientX;
    setPanelWidth(dragStartW + t, !1);
  }),
  panelResize.addEventListener("pointerup", endDrag),
  panelResize.addEventListener("pointercancel", endDrag);
let currentNoteCid = null,
  currentNoteLabel = "";
function render(e, t, n) {
  (currentNoteCid = n || null), (currentNoteLabel = e.name);
  let a =
    '<div class="p-stagger"><h3>' +
    e.name +
    '</h3><p class="role">' +
    e.role +
    '</p></div><p class="bio p-stagger">' +
    e.bio +
    "</p>";
  e.items &&
    (a +=
      '<span class="label p-stagger">In practice</span><div class="p-stagger">' +
      e.items
        .map(function (e, n) {
          return itemHtml(t, n, e);
        })
        .join("") +
      "</div>"),
    n && (a += noteBlock(n)),
    (a +=
      '<span class="label p-stagger">Links</span><div class="p-stagger">' +
      e.links
        .map(function (e) {
          return (
            '<div class="row"><span class="who">' +
            favicon(e[1]) +
            '<a href="' +
            e[1] +
            '" target="_blank" rel="noopener">' +
            e[0] +
            "</a></span></div>"
          );
        })
        .join("") +
      "</div>"),
    (content.innerHTML = a);
}
let currentPhaseId = null,
  currentKind = null,
  currentIndex = -1;
const lists = {
  people: {
    els: Array.from(rows),
    get: function (e) {
      return people[e.dataset.person];
    },
    idAttr: "person",
  },
  phase: {
    els: Array.from(document.querySelectorAll(".phase")),
    get: function (e) {
      return phases[e.dataset.phase];
    },
  },
  ref: {
    els: Array.from(document.querySelectorAll("[data-ref]")),
    get: function (e) {
      return refs[e.dataset.ref];
    },
    idAttr: "ref",
  },
  course: {
    els: Array.from(document.querySelectorAll("[data-course]")),
    get: function (e) {
      return courses[e.dataset.course];
    },
    idAttr: "course",
  },
  reading: {
    els: Array.from(document.querySelectorAll("[data-reading]")),
    get: function (e) {
      return readings[e.dataset.reading];
    },
    idAttr: "reading",
  },
};
/* Which surface a kind opens in. Only "The plan" (phases) keeps the sidebar;
   people, refs, courses and readings open as a centered modal. Same #panel
   element, same render(): body.panel-modal just restyles it (see main.css). */
const MODAL_KINDS = { people: 1, ref: 1, course: 1, reading: 1 };
function setPanelMode(kind) {
  const wantModal = !!MODAL_KINDS[kind],
    body = document.body,
    isModal = body.classList.contains("panel-modal");
  if (wantModal === isModal) return;
  /* Swapping surface while open: reset without transition so the panel
     re-enters in the new mode instead of morphing sidebar <-> modal. */
  if (body.classList.contains("panel-open")) {
    panel.classList.add("no-transition"),
      body.classList.remove("panel-open"),
      body.classList.toggle("panel-modal", wantModal),
      void panel.offsetWidth,
      panel.classList.remove("no-transition");
  } else body.classList.toggle("panel-modal", wantModal);
}
function open(e, t, n, a) {
  (currentPhaseId = n || null),
    closeComment(),
    closeAvatar(),
    closeMail(),
    render(e, n, a),
    setPanelMode(currentKind),
    document.body.classList.add("panel-open"),
    panelWash.setAttribute("aria-hidden", MODAL_KINDS[currentKind] ? "false" : "true"),
    panel.setAttribute("aria-hidden", "false"),
    (panel.scrollTop = 0),
    activeRow && activeRow.classList.remove("active"),
    (activeRow = t),
    t.classList.add("active");
}
function openAt(e, t) {
  const n = lists[e];
  if (!n || t < 0 || t >= n.els.length) return;
  const a = n.els[t],
    o = n.get(a),
    s = "phase" === e ? a.dataset.phase : null,
    i = n.idAttr ? e + ":" + a.dataset[n.idAttr] : null;
  (currentKind = e), (currentIndex = t), open(o, a, s, i);
}
function close() {
  document.body.classList.remove("panel-open"),
    panel.setAttribute("aria-hidden", "true"),
    panelWash.setAttribute("aria-hidden", "true"),
    activeRow && activeRow.classList.remove("active"),
    (activeRow = null),
    (currentPhaseId = null),
    (currentKind = null),
    (currentIndex = -1),
    (currentNoteCid = null),
    closeComment();
}
rows.forEach(function (e, t) {
  e.addEventListener("click", function () {
    activeRow !== e ? openAt("people", t) : close();
  }),
    e.querySelector("a").addEventListener("click", function (n) {
      n.metaKey ||
        n.ctrlKey ||
        n.shiftKey ||
        1 === n.button ||
        (n.preventDefault(), n.stopPropagation(), activeRow !== e ? openAt("people", t) : close());
    });
});
function wireSeeMore(sectionId) {
  const section = document.getElementById(sectionId),
    seeMore = document.getElementById(sectionId + "SeeMore");
  if (!section || !seeMore) return;
  seeMore.addEventListener("click", function () {
    const e = section.classList.toggle("expanded");
    seeMore.textContent = e ? "show less" : "show more";
    seeMore.setAttribute("aria-expanded", e ? "true" : "false");
  });
}
["people", "courses", "references"].forEach(wireSeeMore);
lists.phase.els.forEach(function (e, t) {
  e.querySelector(".phase-head").addEventListener("click", function () {
    activeRow !== e ? openAt("phase", t) : close();
  });
}),
  ["ref", "course", "reading"].forEach(function (e) {
    lists[e].els.forEach(function (t, n) {
      t.addEventListener("click", function () {
        activeRow !== t ? openAt(e, n) : close();
      }),
        t.querySelector("a").addEventListener("click", function (a) {
          a.metaKey ||
            a.ctrlKey ||
            a.shiftKey ||
            1 === a.button ||
            (a.preventDefault(), a.stopPropagation(), activeRow !== t ? openAt(e, n) : close());
        });
    });
  });
const nvLinks = document.querySelectorAll(".topbar__nav a"),
  nvMap = {};
nvLinks.forEach(function (e) {
  const t = e.getAttribute("href");
  // Only in-page anchors get scroll-spy; cross-page links (e.g. /changelog)
  // stay out of the map so they never claim an "on" state.
  "#" === t.charAt(0) && (nvMap[t.slice(1)] = e);
});
const nvIO = new IntersectionObserver(
  function (e) {
    e.forEach(function (e) {
      if (!e.isIntersecting) return;
      nvLinks.forEach(function (e) {
        e.classList.remove("on");
      });
      const t = nvMap[e.target.id];
      t && t.classList.add("on");
    });
  },
  { rootMargin: "-15% 0px -70% 0px" },
);
Object.keys(nvMap).forEach(function (e) {
  const t = document.getElementById(e);
  t && nvIO.observe(t);
});
const topbar = document.querySelector(".topbar"),
  NAV_IDLE_MS = 1200;
let navIdleTimer = null,
  navHovering = !1;
function scheduleNavIdle() {
  clearTimeout(navIdleTimer),
    navHovering ||
      (navIdleTimer = setTimeout(function () {
        topbar.classList.remove("visible"), topbar.setAttribute("aria-hidden", "true");
      }, 1200));
}
function showNav() {
  topbar.classList.add("visible"), topbar.setAttribute("aria-hidden", "false"), scheduleNavIdle();
}
window.addEventListener("scroll", showNav, { passive: !0 }),
  topbar.addEventListener("mouseenter", function () {
    (navHovering = !0),
      clearTimeout(navIdleTimer),
      topbar.classList.add("visible"),
      topbar.setAttribute("aria-hidden", "false");
  }),
  topbar.addEventListener("mouseleave", function () {
    (navHovering = !1), scheduleNavIdle();
  }),
  closeBtn.addEventListener("click", close),
  panelWash.addEventListener("click", close),
  document.addEventListener("keydown", function (e) {
    if ("Escape" === e.key) return void close();
    const t = (e.target && e.target.tagName) || "";
    if (
      "TEXTAREA" !== t &&
      "INPUT" !== t &&
      e.shiftKey &&
      ("ArrowDown" === e.key || "ArrowUp" === e.key) &&
      document.body.classList.contains("panel-open") &&
      !document.body.classList.contains("cpanel-open") &&
      currentKind
    ) {
      e.preventDefault();
      const t = lists[currentKind].els.length;
      let n = currentIndex + ("ArrowDown" === e.key ? 1 : -1);
      n < 0 && (n = t - 1), n >= t && (n = 0), openAt(currentKind, n);
    }
  }),
  document.addEventListener("click", function (e) {
    document.body.classList.contains("panel-open") &&
      (panel.contains(e.target) ||
        cpanel.contains(e.target) ||
        e.target.closest(".people .row") ||
        e.target.closest("[data-ref]") ||
        e.target.closest("[data-course]") ||
        e.target.closest("[data-reading]") ||
        e.target.closest(".phase-head") ||
        e.target.closest(".c-add") ||
        e.target.closest(".c-link") ||
        close());
  });
const cpanel = document.getElementById("cpanel"),
  cContent = document.getElementById("cpanelContent"),
  cClose = document.getElementById("cpanelClose"),
  STORAGE_KEY = "plan-comments-v2";
let comments = {},
  activeCommentId = null;
function loadComments() {
  const raw = readStored(STORAGE_KEY);
  if (raw) {
    try {
      comments = JSON.parse(raw);
    } catch (e) {
      // Corrupt payload: start clean rather than leaving the panel wedged.
      comments = {};
    }
  }
  currentPhaseId && refreshPanelComments();
}
function persistComments() {
  writeStored(STORAGE_KEY, JSON.stringify(comments));
}
function refreshPanelComments() {
  content.querySelectorAll(".item[data-c]").forEach(function (e) {
    const t = e.dataset.c,
      n = e.querySelector(".c-link");
    if ((n && n.remove(), comments[t])) {
      const n = document.createElement("span");
      n.className = "c-link";
      const a = document.createElement("a");
      (a.href = "#"), (a.textContent = comments[t]), n.appendChild(a), e.appendChild(n);
    }
  }),
    content.querySelectorAll(".note-row[data-c]").forEach(function (e) {
      const t = e.dataset.c;
      e.innerHTML = comments[t]
        ? '<a href="#" class="note-open">' + esc(comments[t]) + "</a>"
        : '<a href="#" class="note-open note-empty">add a note</a>';
    });
}
function itemTextFor(e) {
  const t = content.querySelector('.item[data-c="' + e + '"]');
  return t ? t.childNodes[0].textContent.trim() : e === currentNoteCid ? currentNoteLabel : "";
}
function renderCommentRead(e) {
  (cContent.innerHTML =
    '<div class="p-stagger"><h3>Comment</h3><p class="ctx">' +
    esc(itemTextFor(e)) +
    '</p></div><p class="ctext p-stagger">' +
    esc(comments[e]) +
    '</p><div class="actions p-stagger"><button class="txtbtn" id="cEdit">Edit</button><button class="txtbtn quiet" id="cRemove">Remove</button></div>'),
    document.getElementById("cEdit").addEventListener("click", function () {
      renderCommentEdit(e);
    }),
    document.getElementById("cRemove").addEventListener("click", function () {
      delete comments[e], persistComments(), refreshPanelComments(), closeComment();
    });
}
function renderCommentEdit(e) {
  cContent.innerHTML =
    '<div class="p-stagger"><h3>Comment</h3><p class="ctx">' +
    esc(itemTextFor(e)) +
    '</p></div><div class="p-stagger"><textarea id="cText" placeholder="Write here"></textarea></div><div class="actions p-stagger"><button class="txtbtn" id="cSave">Save</button></div>';
  const t = document.getElementById("cText");
  (t.value = comments[e] || ""),
    setTimeout(function () {
      t.focus();
    }, 260),
    document.getElementById("cSave").addEventListener("click", function () {
      const n = t.value.trim();
      n ? (comments[e] = n) : delete comments[e],
        persistComments(),
        refreshPanelComments(),
        comments[e] ? renderCommentRead(e) : closeComment();
    }),
    t.addEventListener("keydown", function (e) {
      (e.metaKey || e.ctrlKey) && "Enter" === e.key && document.getElementById("cSave").click();
    });
}
function openComment(e) {
  (activeCommentId = e),
    comments[e] ? renderCommentRead(e) : renderCommentEdit(e),
    document.body.classList.add("cpanel-open"),
    cpanel.setAttribute("aria-hidden", "false"),
    (cpanel.scrollTop = 0);
}
function closeComment() {
  document.body.classList.remove("cpanel-open"),
    cpanel.setAttribute("aria-hidden", "true"),
    (activeCommentId = null);
}
content.addEventListener("click", function (e) {
  const t = e.target.closest(".c-add"),
    n = e.target.closest(".c-link"),
    a = e.target.closest(".note-open");
  if (!t && !n && !a) return;
  let o;
  if ((e.preventDefault(), e.stopPropagation(), a)) {
    const t = e.target.closest("[data-c]");
    o = t ? t.dataset.c : null;
  } else {
    const t = e.target.closest(".item[data-c]");
    o = t ? t.dataset.c : null;
  }
  o && (activeCommentId !== o ? openComment(o) : closeComment());
}),
  cClose.addEventListener("click", closeComment),
  document.addEventListener(
    "keydown",
    function (e) {
      "Escape" === e.key &&
        document.body.classList.contains("cpanel-open") &&
        (e.stopImmediatePropagation(), closeComment());
    },
    !0,
  );
const aboutWash = document.getElementById("aboutWash"),
  aboutModal = document.getElementById("aboutModal"),
  aboutTrigger = document.getElementById("aboutTrigger"),
  aboutClose = document.getElementById("aboutClose");
function openAbout() {
  close(),
    closeComment(),
    closeAvatar(),
    closeMail(),
    document.body.classList.add("about-open"),
    aboutWash.setAttribute("aria-hidden", "false"),
    aboutModal.setAttribute("aria-hidden", "false");
}
function closeAbout() {
  document.body.classList.remove("about-open"),
    aboutWash.setAttribute("aria-hidden", "true"),
    aboutModal.setAttribute("aria-hidden", "true");
}
aboutTrigger.addEventListener("click", function () {
  document.body.classList.contains("about-open") ? closeAbout() : openAbout();
}),
  aboutClose.addEventListener("click", closeAbout),
  aboutWash.addEventListener("click", closeAbout),
  document.addEventListener(
    "keydown",
    function (e) {
      "Escape" === e.key &&
        document.body.classList.contains("about-open") &&
        (e.stopImmediatePropagation(), closeAbout());
    },
    !0,
  );
const avatarWash = document.getElementById("avatarWash"),
  avatarViewer = document.getElementById("avatarViewer"),
  avatarTrigger = document.getElementById("avatarTrigger"),
  avatarClose = document.getElementById("avatarClose");
function openAvatar() {
  close(),
    closeComment(),
    closeAbout(),
    closeMail(),
    document.body.classList.add("avatar-open"),
    avatarWash.setAttribute("aria-hidden", "false"),
    avatarViewer.setAttribute("aria-hidden", "false");
}
function closeAvatar() {
  document.body.classList.remove("avatar-open"),
    avatarWash.setAttribute("aria-hidden", "true"),
    avatarViewer.setAttribute("aria-hidden", "true");
}
(document.getElementById("avatarBig").src = avatarTrigger.querySelector("img").src),
  avatarTrigger.addEventListener("click", function () {
    document.body.classList.contains("avatar-open") ? closeAvatar() : openAvatar();
  }),
  avatarClose.addEventListener("click", closeAvatar),
  avatarWash.addEventListener("click", closeAvatar),
  document.addEventListener(
    "keydown",
    function (e) {
      "Escape" === e.key &&
        document.body.classList.contains("avatar-open") &&
        (e.stopImmediatePropagation(), closeAvatar());
    },
    !0,
  );
const MAIL_TO = "oktavio@gowdesign.com",
  MAIL_SUBJECT = "Hey Oktavio",
  mailWash = document.getElementById("mailWash"),
  mailModal = document.getElementById("mailModal"),
  mailTrigger = document.getElementById("mailTrigger"),
  mailText = document.getElementById("mailText"),
  mailSend = document.getElementById("mailSend");
function autoGrow() {
  (mailText.style.height = "auto"),
    (mailText.style.height = Math.min(mailText.scrollHeight, 240) + "px");
}
function syncMailHref() {
  const e = "" === mailText.value.trim() ? "close" : "send";
  mailSend.setAttribute("data-mode", e),
    mailSend.setAttribute("aria-label", "close" === e ? "Close" : "Send"),
    (mailSend.href =
      "mailto:" +
      MAIL_TO +
      "?subject=" +
      encodeURIComponent(MAIL_SUBJECT) +
      "&body=" +
      encodeURIComponent(mailText.value));
}
function openMail() {
  close(),
    closeComment(),
    closeAbout(),
    closeAvatar(),
    document.body.classList.add("mail-open"),
    mailWash.setAttribute("aria-hidden", "false"),
    mailModal.setAttribute("aria-hidden", "false"),
    syncMailHref(),
    autoGrow(),
    setTimeout(function () {
      mailText.focus();
    }, 260);
}
function closeMail() {
  document.body.classList.remove("mail-open"),
    mailWash.setAttribute("aria-hidden", "true"),
    mailModal.setAttribute("aria-hidden", "true");
}
mailTrigger.addEventListener("click", function () {
  document.body.classList.contains("mail-open") ? closeMail() : openMail();
}),
  mailWash.addEventListener("click", closeMail),
  mailText.addEventListener("input", function () {
    syncMailHref(), autoGrow();
  }),
  mailSend.addEventListener("click", function (e) {
    "close" === mailSend.getAttribute("data-mode") && e.preventDefault(), closeMail();
  }),
  mailText.addEventListener("keydown", function (e) {
    (e.metaKey || e.ctrlKey) &&
      "Enter" === e.key &&
      (e.preventDefault(), "send" === mailSend.getAttribute("data-mode") && mailSend.click());
  }),
  document.addEventListener(
    "keydown",
    function (e) {
      "Escape" === e.key &&
        document.body.classList.contains("mail-open") &&
        (e.stopImmediatePropagation(), closeMail());
    },
    !0,
  ),
  syncMailHref(),
  loadComments();
/* ---------------------------------------------------------------------------
   ⌘K palette — lives in cmd.mjs now (shared with /changelog and /prompts).
   The one thing it needs from this page is "close whatever surface is open
   before the palette takes over": it announces itself with a `cmd:beforeopen`
   event on document, and the homepage answers by folding its own layers
   (panel, comment, about, avatar, mail). ⌘K on top of any of them swaps
   surfaces instead of stacking. cmd.mjs registers its Escape handler after
   the ones above (module scripts run after this deferred one), so the
   innermost-first Escape order those capture handlers rely on is kept.
--------------------------------------------------------------------------- */
document.addEventListener("cmd:beforeopen", function () {
  close();
  closeComment();
  closeAbout();
  closeAvatar();
  closeMail();
});
