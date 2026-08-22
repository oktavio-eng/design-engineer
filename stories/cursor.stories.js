import { expect } from "storybook/test";
import { paintCursor } from "../cursor.mjs";

/**
 * iPadOS pointer — the states cursor.mjs paints on every page, laid out
 * statically. Each stage holds a real `.ipad-cursor` element painted by the
 * real `paintCursor()` (the same function the runtime loop calls each frame);
 * the stage is a transformed box so the fixed-position element pins inside
 * the card instead of the viewport (see .storybook/inventory.css). Storybook
 * loads the module with `data-cursor-mount="manual"` (preview-head.html), so
 * nothing here tracks the mouse — the live behaviour is exercised on the real
 * pages by tests/ui/cursor.test.mjs.
 */

const SIZE = 20;

const STATES = [
  { key: "dot", label: "dot", geo: { w: SIZE, h: SIZE, r: SIZE / 2, mode: "dot" } },
  { key: "pressed", label: "pressed", geo: { w: SIZE * 0.85, h: SIZE * 0.85, r: (SIZE * 0.85) / 2, mode: "dot", pressed: true } },
  { key: "text", label: "text (I-beam)", geo: { w: 2, h: 21, r: 1, mode: "text" }, content: "<span>Design engineering</span>" },
  { key: "rect", label: "rect (text link)", geo: { w: 0, h: 0, r: 8, mode: "rect" }, content: '<a href="#rect">Read the plan</a>' },
  { key: "ring", label: "ring (image button)", geo: { w: 0, h: 0, r: 999, mode: "ring" }, content: '<span class="sb-cursor-stage__avatar" aria-hidden="true"></span>' },
  { key: "merge", label: "merge (row)", geo: { w: 0, h: 0, r: 16, mode: "merge" }, content: '<span class="row" style="background: var(--white); box-shadow: var(--shadow-lift); padding: 12px; border-radius: 16px;">Rauno Freiberg</span>' },
];

function stage({ key, label, content = "" }) {
  return `
    <div class="sb-cursor-stage" data-stage="${key}">
      <span class="sb-cursor-stage__label">${label}</span>
      ${content}
      <div class="ipad-cursor" aria-hidden="true"></div>
    </div>`;
}

function paintAll(root) {
  STATES.forEach(({ key, geo }) => {
    const box = root.querySelector(`[data-stage="${key}"]`);
    const el = box.querySelector(".ipad-cursor");
    const target = box.querySelector("a, span:not(.sb-cursor-stage__label)");
    const b = box.getBoundingClientRect();
    let { w, h, r } = geo;
    let x = b.width / 2;
    let y = b.height / 2;
    if (target) {
      const t = target.getBoundingClientRect();
      x = t.left - b.left + t.width / 2;
      y = t.top - b.top + t.height / 2;
      if (geo.mode === "rect") { w = t.width + 16; h = t.height + 8; }
      if (geo.mode === "ring") { w = t.width + 8; h = t.height + 8; r = w / 2; }
      if (geo.mode === "merge") { w = t.width; h = t.height; }
      if (geo.mode === "text") { x = t.left - b.left + 38; }
    }
    // The merged pointer is invisible in production (the row's fill is the
    // highlight); the inventory shows it at low alpha so the shape is visible.
    const o = geo.mode === "merge" ? 0.35 : 1;
    paintCursor(el, { x, y, w, h, r, o, mode: geo.mode, pressed: !!geo.pressed });
  });
}

export default {
  title: "Patterns/iPad pointer",
  parameters: { a11y: { test: "error" } },
};

export const States = {
  render: () => {
    const root = document.createElement("div");
    root.className = "sb-inventory";
    root.innerHTML = `
      <div class="sb-inventory__content sb-pattern">
        <header class="sb-inventory__header">
          <h1>iPad pointer</h1>
          <p>The pointer iPadOS draws for a mouse: a translucent dot that becomes an I-beam over text and a highlight around anything pressable. Painted by cursor.mjs from the <code>--cursor-*</code> tokens; these are its resting shapes.</p>
        </header>
        <div class="sb-cursor-stages">${STATES.map(stage).join("")}</div>
      </div>`;
    requestAnimationFrame(() => paintAll(root));
    return root;
  },
  play: async ({ canvasElement }) => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // background-color transitions over --duration-120 when a mode is set.
    await new Promise((r) => setTimeout(r, 250));
    const cursor = (key) => canvasElement.querySelector(`[data-stage="${key}"] .ipad-cursor`);
    const cs = (key) => getComputedStyle(cursor(key));

    await expect(cursor("dot")).toHaveAttribute("aria-hidden", "true");
    await expect(cs("dot").pointerEvents).toBe("none");
    await expect(cs("dot").width).toBe("20px");
    await expect(cs("dot").borderRadius).toBe("10px");
    await expect(cs("dot").position).toBe("fixed");

    await expect(cursor("pressed")).toHaveClass("is-pressed");
    await expect(cs("pressed").width).toBe("17px");
    await expect(cs("pressed").backgroundColor).not.toBe(cs("dot").backgroundColor);

    await expect(cursor("text")).toHaveAttribute("data-mode", "text");
    await expect(cs("text").width).toBe("2px");
    // The beam runs darker than the dot (a 2px line at the dot's alpha vanishes).
    await expect(cs("text").backgroundColor).not.toBe(cs("dot").backgroundColor);

    await expect(cursor("ring")).toHaveAttribute("data-mode", "ring");
    await expect(cs("ring").backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await expect(cs("ring").boxShadow).toMatch(/inset/);

    await expect(cursor("rect")).toHaveAttribute("data-mode", "rect");
    const link = canvasElement.querySelector('[data-stage="rect"] a').getBoundingClientRect();
    const rect = cursor("rect").getBoundingClientRect();
    await expect(rect.width).toBeGreaterThan(link.width);
    await expect(rect.height).toBeGreaterThan(link.height);
  },
};
