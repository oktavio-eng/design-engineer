import { expect, waitFor } from "storybook/test";
import { renderContributions, levelFor, thresholdsFor, tipMarkup } from "../contrib.mjs";
import { expectOnlyA11yDebt } from "./helpers/a11y-baseline.js";

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

const GALLERY_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="oklch(0.9 0.06 235)"/><circle cx="300" cy="300" r="180" fill="oklch(0.741 0.157 235)"/></svg>',
  );

const PROJECTS_FIXTURE = Object.fromEntries(
  ["Sphera Academy", "Caderno de Erros", "CloudFaster Academy", "DascIA", "FinQ Edu"].map((name, i) => [
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    {
      name,
      role: "Identity + Website · " + (2024 + (i % 3)),
      bio: "One paragraph: problem, what shipped, result.",
      links: [["Live site", `https://${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`]],
    },
  ]),
);

// One fixture, set once, for every story below that imports the real
// portfolio.mjs (Gallery, ProjectsList): that module reads
// `window.PORTFOLIO_CONTENT` into a module-scope `const` at import time, and
// Vitest's browser mode shares one module registry across every story in
// this file — so only the *first* story to `import("../portfolio.mjs")`
// actually triggers that read; every story after it reuses the same cached
// module and the same already-frozen `content`, no matter what it sets
// `window.PORTFOLIO_CONTENT` to in its own render(). Assigning the full
// object here, before any story runs, means whichever one imports first
// still sees every collection the others need.
window.PORTFOLIO_CONTENT = {
  gallery: [
    { src: GALLERY_PHOTO, alt: "Blue disc on a pale field", caption: "Study 01", width: 600, height: 600 },
    { src: GALLERY_PHOTO, alt: "Blue disc on a pale field", caption: "Study 02", width: 600, height: 600 },
    { src: GALLERY_PHOTO, alt: "Blue disc on a pale field", caption: "Study 03", width: 600, height: 600 },
  ],
  projects: PROJECTS_FIXTURE,
};

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
      "jakub.kr's article row, as the Figma Article component: an outlined 50×60 document icon (no shadow) beside a title and one short summary, padding 6, radius 12, rows 4px apart. The whole row is the link; hover is a --row-hover fill only — no shadow, no transition.",
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
    // Five distinct widths per icon (16/30/26/20/12) — the "text" read.
    const widths = [...canvasElement.querySelectorAll(".doc-icon:first-of-type .doc-icon__line")].map(
      (l) => getComputedStyle(l).width,
    );
    await expect(new Set(widths).size).toBe(5);
    // Instant hover: nothing on the row transitions (fill only, no shadow).
    const rowStyle = getComputedStyle(links[0]);
    // (`a` itself transitions `color` globally — the fixture is an anchor; the
    // row's own fill and shadow must not be in the list.)
    await expect(rowStyle.transitionProperty).not.toMatch(/background|box-shadow|all/);
    await expect(rowStyle.boxShadow).toBe("none");
    await expect(rowStyle.paddingLeft).toBe("6px");
    await expect(rowStyle.borderRadius).toBe("12px");
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

export const Gallery = {
  render: () => {
    // window.PORTFOLIO_CONTENT is the shared fixture set once at the top of
    // this file — see the comment there for why it can't be set here instead.
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

// The Projects row list: the same .row/.row-btn clients/personal/life use,
// plus the two things unique to this group — a favicon left of the name
// (opt-in, from entry.links[0][1]) and a show-more overflow past a
// threshold, ported from wiki.html's people/courses/references pattern
// (task-projects-home-v2.md). Uses the real portfolio.mjs renderer + the
// real wireSeeMore(), not a reimplementation, so the two can't drift apart.
export const ProjectsList = {
  // `.see-more`'s `--faint`-on-`--bg` contrast is pre-existing production
  // debt (see stories/patterns.stories.js's "color-contrast:see-more"
  // markers) — narrowed to the marked node below, same pattern.
  parameters: {
    a11y: {
      test: "error",
      options: { rules: { "color-contrast": { enabled: false } } },
    },
  },
  render: () => {
    // window.PORTFOLIO_CONTENT (the "projects" key) is the shared fixture
    // set once at the top of this file. wireSeeMore() reads
    // document.getElementById(sectionId) for the section itself (toggling
    // .expanded there), so the fixture below needs the real <section
    // id="projects"> wrapper index.html uses, not just the parts renderList
    // touches.
    const root = shell(
      "Projects",
      "Client/studio work — favicon in the row (unique to this group) and a show-more overflow past 3 rows, same .extras/.row.extra contract wiki.html uses for People/Courses/References.",
      `<section id="projects">
         <h2 class="sb-pattern__title">Projects</h2>
         <div data-list="projects"></div>
         <button class="see-more" id="projectsSeeMore" type="button" aria-expanded="false" aria-controls="projectsExtras" data-a11y-debt="see-more-projects">show more</button>
       </section>`,
    );
    // favicons.js is a classic script index.html loads before portfolio.mjs
    // (see that file's header) — the inventory doesn't load it globally, so
    // pull in the real file rather than duplicate its favicon()/favFallback
    // logic here. renderList()'s favicon opt is a soft dependency on it
    // (cmd.mjs: "if a page loads this module without favicons.js, links
    // still render — just without the icon"), so wait for it explicitly.
    const ready = window.favicon
      ? Promise.resolve()
      : new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = "/favicons.js";
          script.onload = resolve;
          document.head.appendChild(script);
        });
    ready.then(() => {
      import("../portfolio.mjs").then((mod) => {
        mod.renderList(root, "projects", { favicon: true, threshold: 3 });
        mod.wireSeeMore("projects");
      });
    });
    return root;
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll(".row-btn")).toHaveLength(5));
    const rows = canvasElement.querySelectorAll(".row-btn");
    // Every row carries a favicon, unlike clients/personal/life.
    await expect(canvasElement.querySelectorAll(".row-btn .fav")).toHaveLength(5);
    await expect(rows[0].querySelector(".fav")).toHaveAttribute("data-domain", "spheraacademy.com");
    // First 3 rows are plain; the rest start inside the collapsed overflow.
    await expect(canvasElement.querySelectorAll('[data-list="projects"] > .row-btn')).toHaveLength(3);
    const extras = canvasElement.querySelector("#projectsExtras");
    await expect(extras).not.toBeNull();
    await expect(extras.querySelectorAll(".row.extra")).toHaveLength(2);
    await expect(getComputedStyle(extras).visibility).toBe("hidden");

    const seeMore = canvas.getByRole("button", { name: "show more" });
    await expect(seeMore).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(seeMore);
    await waitFor(() => expect(canvasElement.querySelector("#projects")).toHaveClass("expanded"));
    await waitFor(() => expect(getComputedStyle(extras).visibility).toBe("visible"));
    await expect(canvas.getByRole("button", { name: "show less" })).toHaveAttribute("aria-expanded", "true");

    await expectOnlyA11yDebt(canvasElement, ["color-contrast:see-more-projects"]);
  },
};
