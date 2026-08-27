/* Favicon fallback + the favicon() <img> builder moved to favicons.js (loaded
   before this file) so cmd.mjs can share them on every page. */

/* Intro ("hello screensaver") moved to intro.js (loaded before this file) so
   the home plays it too. */


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
/* Deeper entries (27/08/2026, Simile first). `bio` may be a list of
   paragraphs: one wrapper keeps the .bio lead and the p-stagger count, the
   paragraphs sit inside. A string renders exactly as before. */
function bioHtml(bio) {
  return Array.isArray(bio)
    ? '<div class="bio p-stagger"><p>' + bio.join("</p><p>") + "</p></div>"
    : '<p class="bio p-stagger">' + bio + "</p>";
}
/* Optional `sections` after Links: each one is a label plus any of `text`
   (one muted line), `list` (plain lines, the same .item the "In practice"
   block uses) and `entries` (a person or a lineage node: name + role on a
   .row, descriptor under it, inline links). All sections share ONE
   p-stagger: the note row + Links already make five steps, and the
   nth-child delays stop at seven, so the annex enters as a single step
   after Links instead of its tail landing at zero delay. Mirrored in
   cmd.mjs entryHtml() like the rest of this markup. */
function sectionsHtml(e) {
  currentSubs = [];
  return e.sections
    ? '<div class="p-stagger">' +
        e.sections
          .map(function (s) {
            let o = '<span class="label">' + s.label + "</span>";
            return (
              s.text && (o += '<p class="section-text">' + s.text + "</p>"),
              s.list &&
                (o += s.list
                  .map(function (t) {
                    return '<p class="item">' + t + "</p>";
                  })
                  .join("")),
              s.people && (o += s.people.map(personRow).join("")),
              s.entries && (o += s.entries.map(entryHtml).join("")),
              o
            );
          })
          .join("") +
        "</div>"
    : "";
}
/* A person as a link row (name + role, the page-row shape); the index in
   data-sub is the position in currentSubs, read by the click handler below.
   `{ ref: key }` reuses an entry of the People list instead of repeating it. */
function personRow(p) {
  p.ref && (p = people[p.ref]);
  if (!p) return "";
  const i = currentSubs.push(p) - 1;
  /* The whole row is the link (an <a> with the .row layout), not just the
     name: one target for pointer, keyboard and the iPadOS cursor alike. */
  return (
    '<a class="row" href="#" data-sub="' +
    i +
    '"><span class="who">' +
    p.name +
    "</span>" +
    (p.role ? '<span class="what">' + p.role + "</span>" : "") +
    "</a>"
  );
}
function entryHtml(p) {
  let o = '<div class="entry"><div class="row"><span class="who">' + p.name + "</span>";
  return (
    p.role && (o += '<span class="what">' + p.role + "</span>"),
    (o += "</div>"),
    p.what && (o += '<p class="entry-desc">' + p.what + "</p>"),
    p.links &&
      (o +=
        '<p class="entry-links">' +
        p.links
          .map(function (l) {
            return '<a class="inline-link" href="' + l[1] + '" target="_blank" rel="noopener">' + l[0] + "</a>";
          })
          .join(" · ") +
        "</p>"),
    o + "</div>"
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
    "</p></div>" +
    bioHtml(e.bio);
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
    e.links &&
      e.links.length &&
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
    (a += sectionsHtml(e)),
    (content.innerHTML = a);
}
/* Sub-entries (27/08/2026): a `people` row inside an entry opens that person
   in the same modal (plain render(): name, role, bio, links) and #panelBack
   returns to the entry. One level only, no stack: currentTop remembers the
   render() arguments of the entry the row came from. Escape peels the sub
   first, then closes, the same innermost-first order the ⌘K detail keeps. */
const panelBack = document.getElementById("panelBack");
let currentTop = null,
  subOpen = false,
  currentSubs = [];
function rememberTop(e, t, n) {
  (currentTop = [e, t, n]), (subOpen = false), (panelBack.hidden = true);
}
function openSub(i) {
  const s = currentSubs[i];
  s && (render(s, null, null), (subOpen = true), (panelBack.hidden = false), (panel.scrollTop = 0), panelBack.focus());
}
function backToTop() {
  subOpen &&
    currentTop &&
    (render.apply(null, currentTop), (subOpen = false), (panelBack.hidden = true), (panel.scrollTop = 0), closeBtn.focus());
}
content.addEventListener("click", function (e) {
  const a = e.target.closest("[data-sub]");
  a && content.contains(a) && (e.preventDefault(), openSub(parseInt(a.dataset.sub, 10)));
}),
  panelBack.addEventListener("click", backToTop);
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
    rememberTop(e, n, a),
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
    (subOpen = false),
    (panelBack.hidden = true),
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
    seeMore = document.getElementById(sectionId + "SeeMore"),
    extras = section && section.querySelector(".extras"),
    extrasInner = section && section.querySelector(".extras-inner");
  if (!section || !seeMore) return;
  /* Settle-overflow fix (22/08/2026, /better-colors follow-up) — same shape
     as the `enter` filter-clearing listener above, one level up. `.extras-
     inner`'s `overflow: hidden` (main.css) is load-bearing *during* the
     320ms grid-template-rows transition — without it the collapsed 0fr
     track can't visually hide oversized content — but once expand settles
     at 1fr, nothing needs clipping anymore, and it was clipping the last
     `.row.extra`'s own hover shadow instead (the fixed 6px slack the CSS
     already adds is exactly the shadow's own reach, zero margin, so it cut
     flush there). Flipping to `visible` only after the transition ends,
     then straight back to `hidden` the moment either direction starts
     again, keeps the collapse animation intact and stops that clip. */
  if (extras && extrasInner) {
    extras.addEventListener("transitionend", function (e) {
      if (e.propertyName === "grid-template-rows" && section.classList.contains("expanded")) {
        extrasInner.style.overflow = "visible";
      }
    });
  }
  seeMore.addEventListener("click", function () {
    if (extrasInner) extrasInner.style.overflow = "hidden";
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
    if ("Escape" === e.key) return void (subOpen ? backToTop() : close());
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
        /* A person row re-renders the panel, so by the time this bubbling
           handler runs the clicked link is already detached and
           panel.contains() says no. closest() still works on it. */
        e.target.closest("[data-sub]") ||
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
/* Mail composer lives in mail.js now (shared with every page). It exposes
   window.openMail/closeMail and announces `mail:beforeopen` on document
   before opening; this page answers by folding its own surfaces. */
document.addEventListener("mail:beforeopen", function () {
  close();
  closeComment();
  closeAbout();
  closeAvatar();
});
loadComments();
/* ---------------------------------------------------------------------------
   ⌘K palette — lives in cmd.mjs now (shared with /changelog and /prompts).
   The one thing it needs from this page is "close whatever surface is open
   before the palette takes over": it announces itself with a `cmd:beforeopen`
   event on document, and the homepage answers by folding its own layers
   (panel, comment, about, avatar; the mail composer closes itself from
   mail.js). ⌘K on top of any of them swaps surfaces instead of stacking. cmd.mjs registers its Escape handler after
   the ones above (module scripts run after this deferred one), so the
   innermost-first Escape order those capture handlers rely on is kept.
--------------------------------------------------------------------------- */
document.addEventListener("cmd:beforeopen", function () {
  close();
  closeComment();
  closeAbout();
  closeAvatar();
});

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
   chrome.js (every non-wiki page) for the same reason that file is split
   from this one. */
document.addEventListener("animationend", function (e) {
  if (e.animationName === "enter") {
    e.target.style.setProperty("filter", "none", "important");
  }
});
