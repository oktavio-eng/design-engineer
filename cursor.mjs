/* ---------------------------------------------------------------------------
   iPadOS-style pointer for every page.

   The native arrow is replaced by the pointer iPadOS draws when a trackpad or
   mouse is attached (and macOS adopted in 27 / "Golden Gate"): a small
   translucent circle that follows the mouse 1:1, turns into an I-beam over
   text (locked to the line's height and vertical center), and morphs into a
   rounded rectangle that snaps around a button or link — with a little
   parallax as the mouse moves inside it — then springs back to a dot on the
   way out. It fades after ~2s without movement, shrinks slightly on press,
   and hides when the pointer leaves the window.

   Four modes, decided per pointermove by hit-testing what's under the pointer:

     dot    – nothing interactive, no text under the point (default)
     text   – the point sits on a glyph (caret hit test), or in a text field
     rect   – an interactive element; the pointer becomes its highlight
     ring   – rect drawn as an outline instead of a fill, for image buttons
              (avatar, gallery): a translucent fill on top of a photo only
              dims it, and iPadOS paints the highlight *behind* the button,
              which an overlay can't do — the ring is the honest equivalent
     merge  – an interactive element that already paints its own hover fill
              (page rows, doc rows, ⌘K items): the pointer takes the element's
              shape and fades out *into* it, so the fill reads as the pointer.
              Coming back out, it re-inflates from that shape. This is the
              same trick iPadOS pulls on toolbar buttons — you never see two
              highlights.
     native – `[data-cursor="native"]` (the sidebar resize handle): the custom
              pointer hides and the OS cursor comes back, so col-resize and
              friends still work.

   Opt-in / opt-out per element with `data-cursor="rect|merge|ring|native|none"`.

   Gates: only pointerType === "mouse", only when the device reports
   (hover: hover) and (pointer: fine), and never under prefers-reduced-motion
   — there the OS pointer stays, untouched. The element is `aria-hidden`,
   `pointer-events: none`, and painted only from pointer events, so tests that
   drive the page by keyboard never see it and tests that drive it by mouse
   only see an inert overlay.

   Geometry animates in a rAF loop with per-property exponential smoothing
   (a critically-damped spring approximation: k = 1 − e^(−dt/τ)); the loop
   parks itself when everything has settled. Position is 1:1 in dot mode (an
   on-screen pointer that lags is a broken pointer) and eased only while it's
   snapped to a shape or flying back to the mouse.

   Timings and sizes come from tokens (`--cursor-*` in styles/tokens/*), read
   back through getComputedStyle — same pattern as the intro and --panel-w.

   Exports `paintCursor()` and `mountCursor()` so Storybook can render the
   real states from the real module; auto-mounts unless the root carries
   `data-cursor-mount="manual"`.
--------------------------------------------------------------------------- */

const INTERACTIVE = [
  "a[href]",
  "button",
  "[role='button']",
  "input",
  "textarea",
  "select",
  "summary",
  "label",
  "[tabindex]:not([tabindex='-1'])",
  ".row",
  "[data-cursor='rect']",
  "[data-cursor='merge']",
  "[data-cursor='ring']",
].join(",");

/* Elements whose own :hover already paints the highlight (see main.css). The
   pointer merges into these instead of drawing a second fill on top. */
const MERGE = "main > section .row, .row-btn, .doc-item, .cmd__item, .admin-content-row, .admin-nav-item, .admin-inbox-row";

const TEXT_FIELDS = "input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [contenteditable='']:not([contenteditable='false']), [contenteditable='true']";

const root = document.documentElement;

function readToken(name, fallback) {
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/* Paints one frame. Pure: geometry in, styles out. Used by the runtime loop
   and by the Storybook story that lays the states out side by side. */
export function paintCursor(el, s) {
  el.style.transform = "translate3d(" + (s.x - s.w / 2).toFixed(2) + "px," + (s.y - s.h / 2).toFixed(2) + "px,0)";
  el.style.width = s.w.toFixed(2) + "px";
  el.style.height = s.h.toFixed(2) + "px";
  el.style.borderRadius = s.r.toFixed(2) + "px";
  el.style.opacity = s.o.toFixed(3);
  el.dataset.mode = s.mode;
  el.classList.toggle("is-pressed", !!s.pressed);
}

export function mountCursor(options = {}) {
  const doc = options.document || document;
  const win = doc.defaultView || window;
  const html = doc.documentElement;

  const fine = win.matchMedia("(hover: hover) and (pointer: fine)");
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  if (!fine.matches || reduced.matches) return null;

  const el = doc.createElement("div");
  el.className = "ipad-cursor";
  el.setAttribute("aria-hidden", "true");
  doc.body.appendChild(el);

  const SIZE = readToken("--cursor-size", 20);
  const PAD = readToken("--cursor-pad", 4);
  const PAD_INLINE = readToken("--cursor-pad-inline", 2);
  const PAD_TEXT_X = readToken("--cursor-pad-text-x", 8);
  const BEAM_W = readToken("--cursor-beam-w", 2);
  const PARALLAX = readToken("--cursor-parallax", 4);
  const IDLE_MS = readToken("--cursor-idle", 2000);
  const TAU_SHAPE = readToken("--cursor-tau-shape", 70);
  const TAU_POS = readToken("--cursor-tau-pos", 60);
  const TAU_FADE = readToken("--cursor-tau-fade", 110);
  const RADIUS_MIN = readToken("--cursor-radius-min", 8);
  const RADIUS_INLINE = readToken("--cursor-radius-inline", 6);

  const target = { x: -100, y: -100, w: SIZE, h: SIZE, r: SIZE / 2, o: 0, mode: "dot", pressed: false };
  const cur = { x: -100, y: -100, w: SIZE, h: SIZE, r: SIZE / 2, o: 0, mode: "dot", pressed: false };
  let posTau = 0; // 0 → position follows 1:1
  let raf = 0;
  let last = 0;
  let idleTimer = 0;
  let active = false; // a mouse has moved at least once
  let visible = false; // pointer is inside the window and awake
  let pointerX = 0;
  let pointerY = 0;
  let pressed = false;
  let hoverEl = null;

  function setActive(on) {
    if (active === on) return;
    active = on;
    html.classList.toggle("cursor-on", on);
    if (!on) {
      html.classList.remove("cursor-native");
      target.o = 0;
      hoverEl = null;
      kick();
    }
  }

  function setNative(on) {
    html.classList.toggle("cursor-native", on);
  }

  /* --- hit testing ------------------------------------------------------ */

  function caretAt(x, y) {
    if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(x, y);
      return p ? { node: p.offsetNode, offset: p.offset } : null;
    }
    if (doc.caretRangeFromPoint) {
      const r = doc.caretRangeFromPoint(x, y);
      return r ? { node: r.startContainer, offset: r.startOffset } : null;
    }
    return null;
  }

  /* Is the point actually on a run of text? Caret APIs snap to the nearest
     text even from the padding, so the caret alone isn't proof; the line box
     of the text node has to contain the point. Returns that line box. */
  function textLineAt(x, y, under) {
    const c = caretAt(x, y);
    if (!c || !c.node || c.node.nodeType !== 3) return null;
    const parent = c.node.parentElement;
    if (!parent || !(under === parent || parent.contains(under) || under.contains(parent))) return null;
    if (parent.closest("svg")) return null;
    if (!/\S/.test(c.node.data)) return null;
    const range = doc.createRange();
    range.selectNodeContents(c.node);
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const rc = rects[i];
      if (rc.width === 0 || rc.height === 0) continue;
      if (y >= rc.top && y <= rc.bottom && x >= rc.left - 1 && x <= rc.right + 1) return rc;
    }
    return null;
  }

  function isInline(node) {
    return getComputedStyle(node).display === "inline";
  }

  /* The client rect of an interactive element that contains the point —
     inline links wrap across lines, so "the" rect is the fragment under the
     pointer, not the union. Falls back to the union. */
  function rectFor(node, x, y) {
    const rects = node.getClientRects();
    if (rects.length > 1) {
      for (let i = 0; i < rects.length; i++) {
        const rc = rects[i];
        if (y >= rc.top && y <= rc.bottom && x >= rc.left && x <= rc.right) return { rect: rc, fragment: true };
      }
    }
    return { rect: node.getBoundingClientRect(), fragment: false };
  }

  function textRangeOf(node) {
    const range = doc.createRange();
    range.selectNodeContents(node);
    return range;
  }

  function cornerRadius(node, fallback, w, h, pad) {
    const raw = parseFloat(getComputedStyle(node).borderTopLeftRadius);
    let r = Number.isFinite(raw) && raw > 0 ? raw + pad : fallback;
    return Math.min(r, w / 2, h / 2);
  }

  function resolve(x, y) {
    const under = doc.elementFromPoint(x, y);
    if (!under) return { mode: "hidden" };

    const tagged = under.closest("[data-cursor]");
    const tag = tagged ? tagged.dataset.cursor : "";
    if (tag === "native") return { mode: "native" };
    if (tag === "none") return { mode: "dot", el: null };

    let hit = under.closest(INTERACTIVE);
    if (hit && !hit.matches(":disabled, [aria-disabled='true']")) {
      // A link inside a row: the row already paints the highlight, so the
      // pointer merges into the row rather than boxing the link on top of it.
      const mergeHost = hit.dataset.cursor ? null : hit.closest(MERGE);
      if (mergeHost) hit = mergeHost;
      if (hit.matches(TEXT_FIELDS)) {
        const lh = parseFloat(getComputedStyle(hit).fontSize) * 1.25 || 18;
        return { mode: "text", x, y, h: lh, el: hit };
      }
      const forced = hit.dataset.cursor;
      const mode = forced === "rect" || forced === "merge" || forced === "ring" ? forced : hit.matches(MERGE) ? "merge" : "rect";
      const textOnly = mode === "rect" && hit.children.length === 0 && /\S/.test(hit.textContent);
      const { rect, fragment } = rectFor(textOnly ? textRangeOf(hit) : hit, x, y);
      const inline = fragment || isInline(hit);
      // Text-only targets (nav links, footer links, "show more") get the pill
      // iPadOS draws around a toolbar label: the *text's* box, padded, not the
      // element's hit box (a nav link padded to the bar's full height would
      // otherwise read as a 50px slab). Boxes (icon buttons, images, rows)
      // use their own bounds.
      const merge = mode === "merge";
      const padX = merge ? 0 : textOnly ? PAD_TEXT_X : PAD;
      const padY = merge ? 0 : inline ? PAD_INLINE : PAD;
      const w = rect.width + padX * 2;
      const h = rect.height + padY * 2;
      const r = textOnly
        ? Math.min(inline ? RADIUS_INLINE + PAD_INLINE : RADIUS_MIN, h / 2)
        : cornerRadius(hit, RADIUS_MIN, w, h, merge ? 0 : PAD);
      return { mode, el: hit, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, w, h, r, inline };
    }

    const line = textLineAt(x, y, under);
    if (line) return { mode: "text", x, y, h: line.height, cy: line.top + line.height / 2, el: null };

    return { mode: "dot", el: null };
  }

  /* --- targets ------------------------------------------------------------ */

  function applyResolution(res) {
    const prevMode = target.mode;
    if (res.mode === "native") {
      setNative(true);
      target.mode = "native";
      target.o = 0;
      hoverEl = null;
      return;
    }
    setNative(false);

    if (res.mode === "hidden") {
      target.o = 0;
      hoverEl = null;
      return;
    }

    target.mode = res.mode;
    hoverEl = res.el || null;

    if (res.mode === "dot") {
      const size = pressed ? SIZE * 0.85 : SIZE;
      target.w = size;
      target.h = size;
      target.r = size / 2;
      target.x = pointerX;
      target.y = pointerY;
      target.o = 1;
      if (prevMode !== "dot") posTau = TAU_POS; // fly back to the mouse, then lock
    } else if (res.mode === "text") {
      target.w = BEAM_W;
      target.h = res.h;
      target.r = BEAM_W / 2;
      target.x = pointerX;
      target.y = res.cy != null ? res.cy : pointerY;
      target.o = 1;
      posTau = res.cy != null ? TAU_POS : 0;
    } else {
      // rect / merge — snap to the element, parallax inside it
      const dx = Math.max(-PARALLAX, Math.min(PARALLAX, (pointerX - res.cx) * 0.08));
      const dy = Math.max(-PARALLAX, Math.min(PARALLAX, (pointerY - res.cy) * 0.08));
      const shrink = pressed && res.mode !== "merge" ? 2 : 0;
      target.w = res.w - shrink * 2;
      target.h = res.h - shrink * 2;
      target.r = Math.max(0, res.r - shrink);
      target.x = res.cx + (res.mode === "merge" ? 0 : dx);
      target.y = res.cy + (res.mode === "merge" ? 0 : dy);
      target.o = res.mode === "merge" ? 0 : 1;
      posTau = TAU_POS;
    }
    target.pressed = pressed;
  }

  function update() {
    if (!active || !visible) return;
    applyResolution(resolve(pointerX, pointerY));
    kick();
  }

  /* --- loop ---------------------------------------------------------------- */

  function kick() {
    if (!raf) {
      last = 0;
      raf = win.requestAnimationFrame(frame);
    }
  }

  function step(from, to, tau, dt) {
    if (tau <= 0) return to;
    const k = 1 - Math.exp(-dt / tau);
    const next = from + (to - from) * k;
    return Math.abs(to - next) < 0.05 ? to : next;
  }

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(48, now - last) : 16;
    last = now;

    cur.w = step(cur.w, target.w, TAU_SHAPE, dt);
    cur.h = step(cur.h, target.h, TAU_SHAPE, dt);
    cur.r = step(cur.r, target.r, TAU_SHAPE, dt);
    cur.o = step(cur.o, target.o, TAU_FADE, dt);
    cur.x = step(cur.x, target.x, posTau, dt);
    cur.y = step(cur.y, target.y, posTau, dt);
    cur.mode = target.mode;
    cur.pressed = target.pressed;

    // Once the dot has caught up with the mouse, lock 1:1 again.
    if (target.mode === "dot" && posTau > 0) {
      posTau *= 0.75;
      if (posTau < 2 || (cur.x === target.x && cur.y === target.y)) posTau = 0;
    }

    paintCursor(el, cur);

    const settled =
      cur.w === target.w && cur.h === target.h && cur.r === target.r && cur.o === target.o &&
      cur.x === target.x && cur.y === target.y;
    if (!settled) raf = win.requestAnimationFrame(frame);
  }

  /* --- events -------------------------------------------------------------- */

  function wake() {
    visible = true;
    win.clearTimeout(idleTimer);
    idleTimer = win.setTimeout(() => {
      if (doc.body.classList.contains('admin-page') && hoverEl?.matches(TEXT_FIELDS)) return;
      target.o = 0;
      kick();
    }, IDLE_MS);
  }

  function onMove(e) {
    if (e.pointerType && e.pointerType !== "mouse") {
      // A finger or pen took over: get out of the way until a mouse moves again.
      setActive(false);
      return;
    }
    pointerX = e.clientX;
    pointerY = e.clientY;
    if (!active) {
      // First frame: appear where the mouse is, no fly-in from the corner.
      cur.x = pointerX;
      cur.y = pointerY;
      setActive(true);
    }
    wake();
    update();
  }

  function onLeave(e) {
    if (e.relatedTarget === null || e.relatedTarget === undefined) {
      visible = false;
      target.o = 0;
      hoverEl = null;
      kick();
    }
  }

  function onDown(e) {
    if (e.pointerType && e.pointerType !== "mouse") return;
    pressed = true;
    update();
  }
  function onUp() {
    pressed = false;
    update();
  }

  doc.addEventListener("pointermove", onMove, { passive: true });
  doc.addEventListener("pointerdown", onDown, { passive: true });
  doc.addEventListener("pointerup", onUp, { passive: true });
  doc.addEventListener("pointercancel", onUp, { passive: true });
  doc.addEventListener("pointerout", onLeave, { passive: true });
  win.addEventListener("blur", () => { visible = false; target.o = 0; kick(); });
  doc.addEventListener("visibilitychange", () => { if (doc.hidden) { visible = false; target.o = 0; kick(); } });
  // Content moves under a still mouse (scroll, panels opening): re-aim.
  win.addEventListener("scroll", update, { passive: true, capture: true });
  win.addEventListener("resize", update, { passive: true });

  const onGate = () => { if (!fine.matches || reduced.matches) setActive(false); };
  fine.addEventListener && fine.addEventListener("change", onGate);
  reduced.addEventListener && reduced.addEventListener("change", onGate);

  return {
    element: el,
    get state() { return { ...cur }; },
    get target() { return { ...target }; },
    get hoverElement() { return hoverEl; },
    refresh: update,
    destroy() {
      win.cancelAnimationFrame(raf);
      win.clearTimeout(idleTimer);
      doc.removeEventListener("pointermove", onMove);
      doc.removeEventListener("pointerdown", onDown);
      doc.removeEventListener("pointerup", onUp);
      doc.removeEventListener("pointercancel", onUp);
      doc.removeEventListener("pointerout", onLeave);
      win.removeEventListener("scroll", update, { capture: true });
      win.removeEventListener("resize", update);
      setActive(false);
      el.remove();
    },
  };
}

if (typeof document !== "undefined" && document.documentElement.dataset.cursorMount !== "manual") {
  const boot = () => { window.__ipadCursor = mountCursor(); };
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
}
