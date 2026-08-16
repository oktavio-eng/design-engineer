import { expect, waitFor } from "storybook/test";
import { renderContributions, levelFor, thresholdsFor, tipMarkup } from "../contrib.mjs";

/**
 * Portfolio components — built ahead of the page they're for (PORTFOLIO.md).
 * Both are real production CSS from styles/main.css (`.doc-item`, `.contrib`)
 * and, for the graph, the real `contrib.mjs` renderer — the story only owns
 * the markup shell and the sample data. See the `.doc-item`/`.contrib` block
 * in main.css for the measured references (jakub.kr, noechague.vercel.app).
 */

function shell(title, description, content) {
  const root = document.createElement("div");
  root.className = "sb-inventory";
  root.innerHTML = `
    <div class="sb-inventory__content sb-pattern">
      <header class="sb-inventory__header">
        <h1>${title}</h1>
        <p>${description}</p>
      </header>
      ${content}
    </div>
  `;
  return root;
}

const WRITING = [
  ["Less is more, more or less", "Thoughts on building great interfaces in the age of AI."],
  ["Details that make interfaces feel better", "Collection of tips that make your interfaces better."],
  ["What are OKLCH colors?", "How OKLCH colors work and why they're better."],
];

function docIcon() {
  return `
    <span class="doc-icon" aria-hidden="true">
      <span class="doc-icon__page">
        <span class="doc-icon__line"></span>
        <span class="doc-icon__line"></span>
        <span class="doc-icon__line"></span>
        <span class="doc-icon__line"></span>
        <span class="doc-icon__line"></span>
      </span>
    </span>`;
}

function docItem([title, description]) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `
    <a class="doc-item" href="#${slug}">
      ${docIcon()}
      <span class="doc-item__text">
        <span class="doc-item__title">${title}</span>
        <span class="doc-item__desc">${description}</span>
      </span>
    </a>`;
}

export default {
  title: "Patterns/Portfolio",
  parameters: {
    a11y: { test: "error" },
  },
};

export const WritingList = {
  render: () =>
    shell(
      "Writing list",
      "jakub.kr's article row: a raised document icon beside a title and a one-line summary. The whole row is the link; hover fills it instantly, no transition.",
      `<h2 class="sb-pattern__title">Writing</h2>
       <div class="doc-list">${WRITING.map(docItem).join("")}</div>`,
    ),
  play: async ({ canvas, canvasElement }) => {
    const links = canvas.getAllByRole("link");
    await expect(links).toHaveLength(3);
    // The icon is decorative — the link's name must be the title + summary only.
    await expect(links[0]).toHaveAccessibleName("Less is more, more or less Thoughts on building great interfaces in the age of AI.");
    const icon = canvasElement.querySelector(".doc-icon");
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    const lines = canvasElement.querySelectorAll(".doc-icon__line");
    await expect(lines).toHaveLength(15);
    // Five distinct widths per icon (16/32/24/20/12) — the "text" read.
    const widths = [...canvasElement.querySelectorAll(".doc-icon:first-of-type .doc-icon__line")].map(
      (l) => getComputedStyle(l).width,
    );
    await expect(new Set(widths).size).toBe(5);
    // Instant hover: no transition on the row background.
    await expect(getComputedStyle(links[0]).transitionProperty).not.toMatch(/background/);
  },
};

// A plausible year: quiet spring, a busy stretch, weekends lighter.
function sampleYear(seed = 7) {
  let x = seed;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const days = [];
  const end = new Date("2026-08-16T00:00:00");
  for (let i = 370; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const t = 1 - i / 370;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const base = t < 0.45 ? 0.08 : t < 0.7 ? 0.55 : 0.85;
    const p = weekend ? base * 0.35 : base;
    const count = rand() < p ? Math.ceil(rand() * (t > 0.7 ? 12 : 6)) : 0;
    days.push({ date: d.toISOString().slice(0, 10), count });
  }
  return days;
}

function contribShell() {
  return `
    <div class="contrib" data-contrib>
      <div class="contrib__card">
        <div class="contrib__grid" aria-hidden="true"></div>
        <div class="contrib__meta">
          <span data-contrib-total></span>
          <span class="contrib__legend" aria-hidden="true">Less
            <span class="contrib__cell" data-level="0"></span>
            <span class="contrib__cell" data-level="1"></span>
            <span class="contrib__cell" data-level="2"></span>
            <span class="contrib__cell" data-level="3"></span>
            <span class="contrib__cell" data-level="4"></span>
          More</span>
        </div>
      </div>
    </div>`;
}

export const Contributions = {
  render: () => {
    const root = shell(
      "Contributions",
      "GitHub's contribution calendar as noechague.vercel.app draws it — two-layer shell, 7×53 grid of 9px cells — in the site's blue (#00B9FF is level 3). Fed by contrib.mjs from a year of daily counts.",
      `<h2 class="sb-pattern__title">Contributions</h2>${contribShell()}`,
    );
    renderContributions(root.querySelector("[data-contrib]"), sampleYear());
    return root;
  },
  play: async ({ canvasElement }) => {
    const grid = canvasElement.querySelector(".contrib__grid");
    const cells = grid.querySelectorAll(".contrib__cell");
    // 371 days plus the leading pad up to a Sunday start.
    await expect(cells.length).toBeGreaterThanOrEqual(371);
    await expect(cells.length).toBeLessThanOrEqual(377);
    await expect(getComputedStyle(grid).gridAutoFlow).toBe("column");
    await expect(getComputedStyle(cells[cells.length - 1]).width).toBe("9px");
    // All five levels are present in the sample year.
    const levels = new Set([...cells].map((c) => c.dataset.level).filter(Boolean));
    await expect(levels.size).toBe(5);
    // Level 3 is the site's blue.
    const l3 = [...cells].find((c) => c.dataset.level === "3");
    const bg = getComputedStyle(l3).backgroundColor;
    await expect(bg).toMatch(/oklch\(0\.741 0\.157 235\)|rgb\(0, 185, 255\)/);
    // The accessible summary is the total in the footer, not the grid.
    await expect(grid).toHaveAttribute("aria-hidden", "true");
    await expect(canvasElement.querySelector("[data-contrib-total]").textContent).toMatch(
      /^[\d,]+ contributions in the last year$/,
    );
    // Thresholds are quartiles of the non-zero days.
    await expect(levelFor(0, [1, 2, 3])).toBe(0);
    await expect(levelFor(4, [1, 2, 3])).toBe(4);
    await expect(thresholdsFor([])).toEqual([0, 0, 0]);
    // The readout copy: count in ink, date muted, year only when it isn't this one.
    await expect(tipMarkup("2026-08-12", 3, new Date("2026-08-16"))).toBe("<strong>3 contributions</strong> on Aug 12");
    await expect(tipMarkup("2025-12-01", 1, new Date("2026-08-16"))).toBe("<strong>1 contribution</strong> on Dec 1, 2025");
    await expect(tipMarkup("2026-01-04", 0, new Date("2026-08-16"))).toBe("<strong>No contributions</strong> on Jan 4");
  },
};

/* Hover readout — one shared `.contrib__tip` that follows the pointer.
   The first cell waits `--tip-delay` and animates in; the next cell is
   instant (`.contrib__tip--instant`); leaving hides it. The tip lives in
   <body>, so the story reads it from document, not the canvas. */
export const ContributionsHover = {
  render: () => {
    const root = shell(
      "Contributions — hover",
      "Hover a cell: the first tooltip waits a beat and scales in from the cell; sweeping to the next cell swaps it instantly, no delay and no animation; the hovered cell wears a 1px ring. Leaving the grid fades it out.",
      `<h2 class="sb-pattern__title">Contributions</h2>${contribShell()}`,
    );
    renderContributions(root.querySelector("[data-contrib]"), sampleYear());
    return root;
  },
  play: async ({ canvasElement, userEvent }) => {
    const cells = [...canvasElement.querySelectorAll(".contrib__grid .contrib__cell[data-date]")];
    // Real cells carry the data the tooltip reads; no native title to double it.
    await expect(cells[0].title).toBe("");
    const a = cells[cells.length - 60];
    const b = cells[cells.length - 59];
    const tip = () => document.querySelector(".contrib__tip");

    await userEvent.hover(a);
    await expect(a).toHaveClass("is-hover");
    // Not yet: the first tooltip waits --tip-delay.
    await expect(tip()?.dataset.open ?? "false").toBe("false");
    await waitFor(() => expect(tip()).toHaveAttribute("data-open", "true"), { timeout: 1500 });
    await expect(tip()).not.toHaveClass("contrib__tip--instant");
    await expect(tip().textContent).toBe(tipMarkup(a.dataset.date, Number(a.dataset.count)).replace(/<[^>]+>/g, ""));
    await expect(tip()).toHaveAttribute("aria-hidden", "true");
    // Sits above the cell, centered on it (unless clamped to the viewport).
    const tr = tip().getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    await expect(tr.bottom).toBeLessThanOrEqual(ar.top);

    // The next cell is instant: no delay, no transition, ring moves with it.
    await userEvent.hover(b);
    await expect(tip()).toHaveClass("contrib__tip--instant");
    await expect(tip()).toHaveAttribute("data-open", "true");
    await expect(tip().textContent).toBe(tipMarkup(b.dataset.date, Number(b.dataset.count)).replace(/<[^>]+>/g, ""));
    await expect(getComputedStyle(tip()).transitionDuration).toBe("0s");
    await expect(b).toHaveClass("is-hover");
    await expect(a).not.toHaveClass("is-hover");

    // Leaving hides it and drops the ring.
    await userEvent.unhover(b);
    await waitFor(() => expect(tip()).toHaveAttribute("data-open", "false"));
    await expect(b).not.toHaveClass("is-hover");
  },
};

// ---- Gallery + lightbox ------------------------------------------------------
// The one surface /portfolio adds: photos as content in a fixed-aspect grid
// wearing the same lift shell as the doc icon and the graph, opening into a
// lightbox with the ⌘K modal's motion contract. Uses the real portfolio.mjs
// renderer and lightbox controller with an inline photo (data URI) so the
// story is self-contained.

const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="oklch(0.9 0.06 235)"/><circle cx="300" cy="300" r="180" fill="oklch(0.741 0.157 235)"/></svg>',
  );

export const Gallery = {
  render: () => {
    window.PORTFOLIO_CONTENT = {
      gallery: [
        { src: PHOTO, alt: "Blue disc on a pale field", caption: "Study 01", width: 600, height: 600 },
        { src: PHOTO, alt: "Blue disc on a pale field", caption: "Study 02", width: 600, height: 600 },
        { src: PHOTO, alt: "Blue disc on a pale field", caption: "Study 03", width: 600, height: 600 },
      ],
    };
    const root = shell(
      "Gallery",
      "Photos as content: a fixed-aspect grid in the lift shell, each cell a button that opens the lightbox. Escape, the wash and × close it; focus returns to the thumbnail.",
      `<h2 class="sb-pattern__title">Gallery</h2>
       <div class="gallery" data-gallery></div>
       <div class="cmd-wash lightbox-wash" data-lightbox-wash aria-hidden="true"></div>
       <div class="lightbox" role="dialog" aria-modal="true" aria-label="Photo" aria-hidden="true" inert data-lightbox>
         <button class="panel-close lightbox__close" type="button" aria-label="Close" data-lightbox-close>×</button>
         <figure class="lightbox__figure">
           <img class="lightbox__img" alt="" data-lightbox-img>
           <figcaption class="lightbox__caption" data-lightbox-text></figcaption>
         </figure>
       </div>`,
    );
    // The renderer reads window.PORTFOLIO_CONTENT at import time in the page;
    // here it's re-read through the module's exported functions on the fixture.
    import("../portfolio.mjs").then((mod) => {
      mod.renderGallery(root);
      mod.initLightbox(root);
    });
    return root;
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll(".gallery__item")).toHaveLength(3));
    const items = canvasElement.querySelectorAll(".gallery__item");
    await expect(getComputedStyle(items[0].querySelector(".gallery__frame")).aspectRatio).toBe("1 / 1");
    const box = canvasElement.querySelector("[data-lightbox]");
    await expect(box).toHaveAttribute("aria-hidden", "true");
    await expect(box.inert).toBe(true);
    await userEvent.click(items[1]);
    await waitFor(() => expect(box).toHaveAttribute("aria-hidden", "false"));
    await expect(box.inert).toBe(false);
    await expect(canvasElement.querySelector("[data-lightbox-text]")).toHaveTextContent("Study 02");
    // The thumbnail that carries the same caption as data is untouched.
    await expect(items[0].querySelector(".gallery__img")).not.toBeNull();
    await expect(canvas.getByRole("button", { name: "Close" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(box).toHaveAttribute("aria-hidden", "true"));
    await expect(items[1]).toHaveFocus();
    await expect(document.activeElement.closest('[aria-hidden="true"], [inert]')).toBeNull();
  },
};
