import { expect } from "storybook/test";
import { renderContributions, levelFor, thresholdsFor } from "../contrib.mjs";

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
  },
};
