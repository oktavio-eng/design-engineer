import { expect, waitFor } from "storybook/test";
import { expectOnlyA11yDebt } from "./helpers/a11y-baseline.js";

function patternShell(title, description, content) {
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

export default {
  title: "Patterns",
};

export const Rows = {
  parameters: {
    a11y: {
      test: "error",
      // The play function runs the disabled rule separately and accepts only
      // the two marked production-debt nodes below.
      options: { rules: { "color-contrast": { enabled: false } } },
    },
  },
  render: () =>
    patternShell(
      "Rows",
      "The repeated .row pattern used for people, courses, readings and references. Hover an item to inspect the existing neighborhood-focus behavior.",
      `
        <section>
          <h2>People</h2>
          <div class="row">
            <span class="who"><a href="#">Rauno Freiberg</a></span>
            <span class="what">Staff Design Engineer, Vercel</span>
          </div>
          <div class="row">
            <span class="who"><a href="#">Emil Kowalski</a></span>
            <span class="what">Design Engineer, Linear · Vaul, Sonner</span>
          </div>
          <div class="row">
            <span class="who"><a href="#">Jakub Krehel</a></span>
            <span class="what">Founding Design Engineer, Interfere</span>
          </div>
        </section>
        <section>
          <h2>Course status</h2>
          <div class="row">
            <span class="who"><a href="#">Interface Craft</a></span>
            <span class="what">Josh Puckett</span>
            <span class="status" data-a11y-debt="status-bought">Bought</span>
          </div>
          <div class="row">
            <span class="who"><a href="#">Animations.dev</a></span>
            <span class="what">Emil Kowalski · motion</span>
            <span class="status" data-a11y-debt="status-evaluate">Evaluate</span>
          </div>
        </section>
      `,
    ),
  play: async ({ canvasElement }) => {
    await expectOnlyA11yDebt(canvasElement, [
      "color-contrast:status-bought",
      "color-contrast:status-evaluate",
    ]);
  },
};

export const PhaseAndGlossary = {
  name: "Phase · Glossary",
  parameters: {
    a11y: {
      test: "error",
      // Axe still runs globally; the play function narrows this one disabled
      // rule to the marked production-debt node.
      options: { rules: { "color-contrast": { enabled: false } } },
    },
  },
  render: () =>
    patternShell(
      "Phase and glossary",
      "The .phase planning pattern with the existing keyboard-focusable .gloss tooltip. Hover list items or focus the underlined term with the keyboard.",
      `
        <h2>Plan</h2>
        <div class="phases">
          <div class="phase">
            <div class="phase-head">
              <span class="phase-num" data-a11y-debt="phase-number-one">01</span>
              <h3>Foundation, now</h3>
            </div>
            <ul>
              <li>Study interaction and interface craft references.</li>
              <li>
                Practice modern CSS with
                <span class="gloss" tabindex="0">OKLCH<span class="gloss-tip">Perceptually uniform color space, more predictable than RGB/HSL for building palettes and adjusting tones.</span></span>.
              </li>
              <li>Keep the public proof grounded in working code.</li>
            </ul>
          </div>
          <div class="phase">
            <div class="phase-head">
              <span class="phase-num" data-a11y-debt="phase-number-two">02</span>
              <h3>Public proof</h3>
            </div>
            <ul>
              <li>Open one project and document the decisions.</li>
              <li>Keep the interface typographic and precise.</li>
              <li>Publish the work where peers can inspect it.</li>
            </ul>
          </div>
        </div>
      `,
    ),
  play: async ({ canvas, canvasElement, userEvent, step }) => {
    const glossary = canvas.getByText("OKLCH", { selector: ".gloss" });
    const tooltip = glossary.querySelector(".gloss-tip");
    const restingBorderColor = getComputedStyle(glossary).borderBottomColor;

    await step("Tab to the glossary term", async () => {
      await userEvent.tab();
      await expect(glossary).toHaveFocus();
    });

    await step("Expose the tooltip without a pointer", async () => {
      await waitFor(() => expect(tooltip).toBeVisible());
      await waitFor(() =>
        expect(getComputedStyle(glossary).borderBottomColor).not.toBe(restingBorderColor),
      );
    });

    await step("Keep the same information available to pointer users", async () => {
      await userEvent.tab();
      await expect(glossary).not.toHaveFocus();
      await userEvent.hover(glossary);
      await waitFor(() => expect(tooltip).toBeVisible());
      await userEvent.unhover(glossary);
      await waitFor(() => expect(tooltip).not.toBeVisible());
    });

    await step("Keep the known contrast debt exact", async () => {
      await expectOnlyA11yDebt(canvasElement, [
        "color-contrast:phase-number-one",
        "color-contrast:phase-number-two",
      ]);
    });
  },
};

export const ExpandablePeople = {
  name: "Expandable people",
  parameters: {
    a11y: {
      test: "error",
      // The play function separately verifies that the disabled contrast rule
      // reports this marked button and nothing else.
      options: { rules: { "color-contrast": { enabled: false } } },
    },
  },
  render: () => {
    const root = patternShell(
      "Expandable people",
      "The production .extras grid transition, driven by one class.",
      `
        <section class="people" id="storybookPeople">
          <h2>People</h2>
          <div class="row">
            <span class="who"><a href="#rauno">Rauno Freiberg</a></span>
            <span class="what">Staff Design Engineer, Vercel</span>
          </div>
          <div class="extras">
            <div class="extras-inner">
              <div class="row extra">
                <span class="who"><a href="#emil">Emil Kowalski</a></span>
                <span class="what">Design Engineer, Linear</span>
              </div>
              <div class="row extra">
                <span class="who"><a href="#jakub">Jakub Krehel</a></span>
                <span class="what">Founding Design Engineer, Interfere</span>
              </div>
            </div>
          </div>
          <button class="see-more" type="button" data-a11y-debt="see-more">show more</button>
        </section>
      `,
    );
    const section = root.querySelector(".people");
    const button = root.querySelector(".see-more");

    button.addEventListener("click", () => {
      const expanded = section.classList.toggle("expanded");
      button.textContent = expanded ? "show less" : "show more";
    });

    return root;
  },
  play: async ({ canvas, canvasElement, userEvent, step }) => {
    const section = canvas.getByRole("heading", { name: "People" }).closest(".people");
    const firstLink = canvas.getByRole("link", { name: "Rauno Freiberg" });
    const button = canvas.getByRole("button", { name: "show more" });

    await step("Activate the native button from the keyboard", async () => {
      await userEvent.tab();
      await expect(firstLink).toHaveFocus();
      await userEvent.tab();
      await expect(button).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect(section).toHaveClass("expanded");
      await expect(button).toHaveTextContent("show less");
    });

    await step("Collapse without leaving the keyboard", async () => {
      await userEvent.keyboard(" ");
      await expect(section).not.toHaveClass("expanded");
      await expect(button).toHaveTextContent("show more");
      await expect(button).toHaveFocus();
    });

    await step("Keep the known contrast debt exact", async () => {
      await expectOnlyA11yDebt(canvasElement, ["color-contrast:see-more"]);
    });
  },
};

export const PeopleSelection = {
  name: "People — selected + sidebar open",
  parameters: {
    a11y: { test: "error" },
  },
  render: () => {
    // Same reset precedent as the command menu fixture: a fresh mount should
    // never inherit body.panel-open from a previous story/test run.
    document.body.classList.remove("panel-open");

    const root = patternShell(
      "People — selected + sidebar open",
      "Mirrors script.js: activeRow/body.panel-open (set by open()/close()) drive .row.active, not a separate styling flag. Click a name to open, click another to switch, close to restore — the rest of the list stays dimmed even with no pointer over it.",
      `
        <section class="people" id="storybookPeopleSelection">
          <h2>People</h2>
          <div class="row" data-person="rauno">
            <span class="who"><a href="#rauno">Rauno Freiberg</a></span>
            <span class="what">Staff Design Engineer, Vercel</span>
          </div>
          <div class="row" data-person="emil">
            <span class="who"><a href="#emil">Emil Kowalski</a></span>
            <span class="what">Design Engineer, Linear</span>
          </div>
          <div class="row" data-person="jakub">
            <span class="who"><a href="#jakub">Jakub Krehel</a></span>
            <span class="what">Founding Design Engineer, Interfere</span>
          </div>
        </section>
        <div class="sb-people-panel-stub">
          <button class="panel-close sb-people-close" type="button" aria-label="Close panel">×</button>
        </div>
      `,
    );

    const rows = Array.from(root.querySelectorAll(".people .row"));
    const closeButton = root.querySelector(".sb-people-close");
    let activeRow = null;

    // The exact toggle production uses in script.js: activeRow !== row ?
    // open : close. Only the two flags CSS actually reads move here —
    // body.panel-open and .row.active — nothing styling-only invented.
    function openRow(row) {
      if (activeRow) activeRow.classList.remove("active");
      activeRow = row;
      activeRow.classList.add("active");
      document.body.classList.add("panel-open");
    }

    function closePanel() {
      if (activeRow) activeRow.classList.remove("active");
      activeRow = null;
      document.body.classList.remove("panel-open");
    }

    rows.forEach((row) => {
      row.querySelector("a").addEventListener("click", (event) => {
        event.preventDefault();
        activeRow !== row ? openRow(row) : closePanel();
      });
    });
    closeButton.addEventListener("click", closePanel);

    return root;
  },
  play: async ({ canvas, canvasElement, userEvent, step }) => {
    const rauno = canvas.getByRole("link", { name: "Rauno Freiberg" }).closest(".row");
    const emil = canvas.getByRole("link", { name: "Emil Kowalski" }).closest(".row");
    const jakub = canvas.getByRole("link", { name: "Jakub Krehel" }).closest(".row");
    const closeButton = canvas.getByRole("button", { name: "Close panel" });
    const opacityOf = (row) => getComputedStyle(row.querySelector(".who")).opacity;

    await step("Normal list: nothing selected, nothing dimmed", async () => {
      await expect(document.body).not.toHaveClass("panel-open");
      await expect(rauno).not.toHaveClass("active");
      await expect(opacityOf(rauno)).toBe("1");
      await expect(opacityOf(emil)).toBe("1");
    });

    await step("Selecting a person opens the sidebar and persists without a pointer over the list", async () => {
      await userEvent.click(canvas.getByRole("link", { name: "Rauno Freiberg" }));
      await userEvent.unhover(rauno);
      await expect(document.body).toHaveClass("panel-open");
      await expect(rauno).toHaveClass("active");
      // .who carries opacity in its transition-property (same rows used for
      // the pre-existing hover dim), so the 250ms dim is still in flight
      // right after the class change — wait for the settled value like the
      // rest of the file does for other CSS transitions. Only .who dims (see
      // main.css above .row.active): .what stays at full opacity because
      // --muted has no contrast headroom left to give up.
      await waitFor(() => expect(opacityOf(rauno)).toBe("1"));
      await waitFor(() => expect(opacityOf(emil)).toBe("0.6"));
      await waitFor(() => expect(opacityOf(jakub)).toBe("0.6"));
    });

    await step("Axe passes while the selection is persisted, not just after closing", async () => {
      // The addon's own end-of-play scan only ever sees whatever state play()
      // finishes in; a violation that exists only in this dimmed, sidebar-open
      // state would otherwise never be caught. Run the scan here explicitly
      // instead of just moving it to the end.
      await expectOnlyA11yDebt(canvasElement, []);
    });

    await step("Switching directly to another person moves the highlight in one step", async () => {
      await userEvent.click(canvas.getByRole("link", { name: "Emil Kowalski" }));
      await userEvent.unhover(emil);
      await expect(document.body).toHaveClass("panel-open");
      await expect(emil).toHaveClass("active");
      await expect(rauno).not.toHaveClass("active");
      await waitFor(() => expect(opacityOf(emil)).toBe("1"));
      await waitFor(() => expect(opacityOf(rauno)).toBe("0.6"));
      await waitFor(() => expect(opacityOf(jakub)).toBe("0.6"));
    });

    await step("Axe still passes after switching the persisted selection", async () => {
      await expectOnlyA11yDebt(canvasElement, []);
    });

    // A row hovered next to the persisted selection (mouse on a different,
    // non-active row while body.panel-open/.row.active hold) is intentionally
    // not exercised here: @testing-library/user-event's hover() dispatches
    // synthetic pointer events that do not reliably set real CSS :hover in a
    // Chromium tab (confirmed independently — a hovered row's opacity never
    // moved across a 2s poll even though document.elementFromPoint located
    // the right row). That interplay — active row at full opacity, the
    // actually-hovered row also at full opacity, everyone else at 0.6, axe
    // clean throughout — is covered deterministically instead by
    // tests/ui/people-persistent-selection.test.mjs, which drives real
    // script.js/main.css on the production page with genuine OS-level pointer
    // movement (Playwright's locator.hover()) and a real axe-core scan taken
    // mid-hover.

    await step("Closing the sidebar restores the normal list state", async () => {
      await userEvent.click(closeButton);
      await expect(document.body).not.toHaveClass("panel-open");
      await expect(emil).not.toHaveClass("active");
      await waitFor(() => expect(opacityOf(emil)).toBe("1"));
      await waitFor(() => expect(opacityOf(rauno)).toBe("1"));
      await waitFor(() => expect(opacityOf(jakub)).toBe("1"));
    });

    await expectOnlyA11yDebt(canvasElement, []);
  },
};
