/* ---------------------------------------------------------------------------
   Contribution graph — fills a `.contrib` shell from a year of daily counts.

   Markup contract (see the `.contrib*` block in styles/main.css):

     <div class="contrib">
       <div class="contrib__card">
         <div class="contrib__grid" aria-hidden="true"></div>
         <div class="contrib__meta">
           <span data-contrib-total></span>
           <span class="contrib__legend">Less … More</span>
         </div>
       </div>
     </div>

   `days` is an array of {date, count} in calendar order, oldest first, up to
   371 entries (53 weeks × 7). Cells flow by column, so the array is padded
   at the front to start on a Sunday the way GitHub's own graph does. Levels
   follow GitHub's rule of thumb — quartiles of the non-zero days — so one
   heavy day doesn't wash out the rest of the year.

   Where the data comes from is a separate decision (a JSON file the repo
   refreshes with a scheduled GitHub Action is the plan — the site has no
   server, and GitHub's contribution calendar isn't reachable from a browser
   without a token). This module only knows how to draw an array.

   Hover readout: each cell carries `data-date`/`data-count` and the grid
   gets ONE shared `.contrib__tip` (appended to <body>, position: fixed —
   see the `.contrib*` block in main.css for why it lives outside the card)
   that follows the pointer from cell to cell. Timing comes from the
   `--tip-*` tokens in tokens/motion.css, read back through getComputedStyle:
   the first tooltip waits `--tip-delay` and animates in; moving between
   cells (or coming back within `--tip-warm`) is instant. The cells stay
   aria-hidden — the footer total is the accessible summary — so the tip
   is decorative-for-sighted-pointer-users, like GitHub's own.
--------------------------------------------------------------------------- */

const WEEKS = 53;
const DAYS = WEEKS * 7;

export function levelFor(count, thresholds) {
  if (!count) return 0;
  if (count <= thresholds[0]) return 1;
  if (count <= thresholds[1]) return 2;
  if (count <= thresholds[2]) return 3;
  return 4;
}

// Quartile cut points over the non-zero counts. With no activity at all every
// threshold is 0 and levelFor() still returns 0 for every cell.
export function thresholdsFor(days) {
  const counts = days
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  if (!counts.length) return [0, 0, 0];
  const at = (q) => counts[Math.min(counts.length - 1, Math.floor(q * counts.length))];
  return [at(0.25), at(0.5), at(0.75)];
}

function formatTotal(total) {
  return total.toLocaleString("en-US");
}

export function renderContributions(root, days, options = {}) {
  const grid = root.querySelector(".contrib__grid");
  const totalEl = root.querySelector("[data-contrib-total]");
  if (!grid) return null;

  const window = days.slice(-DAYS);
  // Pad the front so the first column starts on Sunday (row 0), like GitHub.
  const first = window[0] ? new Date(window[0].date + "T00:00:00") : new Date();
  const lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (const day of window) cells.push(day);

  const thresholds = thresholdsFor(window);
  const fragment = document.createDocumentFragment();
  for (const day of cells) {
    const cell = document.createElement("span");
    cell.className = "contrib__cell";
    if (day) {
      cell.dataset.level = String(levelFor(day.count, thresholds));
      cell.dataset.date = day.date;
      cell.dataset.count = String(day.count);
    } else {
      cell.style.visibility = "hidden";
    }
    fragment.appendChild(cell);
  }
  grid.replaceChildren(fragment);

  const total = window.reduce((sum, d) => sum + d.count, 0);
  if (totalEl) {
    totalEl.textContent = options.label
      ? options.label(total)
      : `${formatTotal(total)} contribution${total === 1 ? "" : "s"} in the last year`;
  }
  if (options.tooltip !== false) attachContribTooltip(grid);
  scrollToLatest(grid);
  return { total, thresholds };
}

/* On narrow screens the grid is wider than the card and scrolls sideways
   (`overflow-x: auto`, see the `.contrib*` block in main.css). A scroll
   container always opens at scrollLeft 0 — the OLDEST weeks — so a year
   whose activity sits in its last few months looked empty on a phone until
   you scrolled (visitor bug report, 26/08/2026). Open at the right edge
   instead, where the recent weeks are. On desktop the grid fits, scrollLeft
   is clamped to 0 and this is a no-op. No smooth scrolling on purpose: it's
   the initial position, not a movement (and the section is still at
   opacity 0 behind the stagger when it lands), so reduced-motion is moot.

   The graph is usually rendered while its <section> is still `hidden`
   (portfolio.mjs reveals it right after), and a display:none element has
   no scrollWidth to scroll to. With no layout yet, wait for the first one
   with a ResizeObserver — it fires after layout and before paint, so the
   grid is never painted at the wrong edge — and snap once. */
const SNAPPING = new WeakSet(); // grids whose next scroll event is the snap itself
export function scrollToLatest(grid) {
  const snap = () => {
    const before = grid.scrollLeft;
    grid.scrollLeft = grid.scrollWidth;
    if (grid.scrollLeft === before) return; // fits, or already there: no event coming
    // The scroll event this queues is dispatched in the next frame's scroll
    // steps, which run BEFORE that frame's rAF callbacks — so the flag
    // outlives it by exactly one event, whether snap ran from script or
    // from the ResizeObserver. The tooltip's scroll→hide skips it: that
    // event is the initial positioning, not the pointer losing its cell
    // (a hover started right after render used to be cancelled by it —
    // the Contributions Hover story caught that).
    SNAPPING.add(grid);
    requestAnimationFrame(() => SNAPPING.delete(grid));
  };
  if (grid.clientWidth > 0) {
    snap();
    return;
  }
  if (typeof ResizeObserver !== "function") {
    requestAnimationFrame(snap);
    return;
  }
  const observer = new ResizeObserver(() => {
    if (!grid.clientWidth) return;
    snap();
    observer.disconnect();
  });
  observer.observe(grid);
}

/* ---------------------------------------------------------------- tooltip */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "3 contributions on Aug 12" — the year only when it isn't this one, since
// the graph always spans two calendar years and the older half needs it.
export function tipMarkup(date, count, now = new Date()) {
  const [y, m, d] = date.split("-").map(Number);
  const when = `${MONTHS[m - 1]} ${d}${y === now.getFullYear() ? "" : `, ${y}`}`;
  const n = count === 0 ? "No" : count.toLocaleString("en-US");
  return `<strong>${n} contribution${count === 1 ? "" : "s"}</strong> on ${when}`;
}

const GAP = 8; // cell → tooltip, and tooltip → viewport edge
let tip = null;
function tipEl() {
  if (tip && tip.isConnected) return tip;
  tip = document.createElement("div");
  tip.className = "contrib__tip";
  tip.setAttribute("aria-hidden", "true");
  tip.dataset.open = "false";
  document.body.appendChild(tip);
  return tip;
}

function ms(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return parseFloat(value) || 0;
}

export function attachContribTooltip(grid) {
  if (!grid || grid.dataset.tipWired) return;
  grid.dataset.tipWired = "true";

  let current = null; // the hovered cell
  let warm = false; // a tooltip showed recently → next one is instant
  let showTimer = 0;
  let warmTimer = 0;

  const place = (cell) => {
    const el = tipEl();
    el.innerHTML = tipMarkup(cell.dataset.date, Number(cell.dataset.count));
    const r = cell.getBoundingClientRect();
    // Measure at the position it will occupy: max-content width, so this
    // is stable regardless of where it lands.
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const above = r.top - GAP - h >= GAP;
    el.dataset.side = above ? "top" : "bottom";
    const top = above ? r.top - GAP - h : r.bottom + GAP;
    const centered = r.left + r.width / 2 - w / 2;
    const left = Math.max(GAP, Math.min(centered, window.innerWidth - GAP - w));
    el.style.top = `${Math.round(top)}px`;
    el.style.left = `${Math.round(left)}px`;
  };

  const show = (cell, instant) => {
    const el = tipEl();
    el.classList.toggle("contrib__tip--instant", instant);
    place(cell);
    // Force the position to land before the opacity flips, otherwise the
    // entrance transition would also animate from the last spot.
    void el.offsetWidth;
    el.dataset.open = "true";
    warm = true;
    clearTimeout(warmTimer);
  };

  const hide = () => {
    clearTimeout(showTimer);
    if (tip) {
      tip.classList.remove("contrib__tip--instant");
      tip.dataset.open = "false";
    }
    if (current) current.classList.remove("is-hover");
    current = null;
    // Stay warm a beat so a pointer that grazes out and back doesn't wait.
    clearTimeout(warmTimer);
    warmTimer = setTimeout(() => {
      warm = false;
    }, ms("--tip-warm"));
  };

  const enter = (cell) => {
    if (cell === current) return;
    if (current) current.classList.remove("is-hover");
    current = cell;
    cell.classList.add("is-hover");
    clearTimeout(showTimer);
    if (warm) {
      show(cell, true);
    } else {
      showTimer = setTimeout(() => {
        if (current === cell) show(cell, false);
      }, ms("--tip-delay"));
    }
  };

  const cellFrom = (target) => {
    const cell = target instanceof Element ? target.closest(".contrib__cell") : null;
    return cell && cell.dataset.date ? cell : null;
  };

  // Only cells count. In the 2px gaps between them the target is the grid
  // itself — the current tooltip stays put until the next cell or leave,
  // otherwise it would blink on every crossing.
  grid.addEventListener("pointerover", (event) => {
    const cell = cellFrom(event.target);
    if (cell) enter(cell);
  });
  grid.addEventListener("pointerleave", hide);
  // Touch: a tap on a cell shows it (pointerover fires), a tap anywhere else
  // hides it. Mouse users never reach this branch with a tooltip open —
  // pointerleave already closed it.
  document.addEventListener("pointerdown", (event) => {
    if (current && !grid.contains(event.target)) hide();
  });
  // The graph scrolls sideways on narrow screens and the page scrolls
  // under a fixed tooltip: either moves the cell out from under it.
  grid.addEventListener(
    "scroll",
    () => {
      if (!SNAPPING.has(grid)) hide();
    },
    { passive: true },
  );
  window.addEventListener("scroll", hide, { passive: true });
}
