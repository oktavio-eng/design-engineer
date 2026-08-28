import { expect, waitFor } from "storybook/test";
import { expectOnlyA11yDebt } from "./helpers/a11y-baseline.js";

// `asMain` wraps the content in a real <main>: the page-list hover fill is
// keyed on `main > section .row` in production (see main.css), so a fixture
// that wants to show it has to sit in the same ancestry, not a look-alike.
function patternShell(title, description, content, { asMain = false } = {}) {
  const root = document.createElement("div");
  root.className = "sb-inventory";
  const tag = asMain ? "main" : "div";
  root.innerHTML = `
    <${tag} class="sb-inventory__content sb-pattern">
      <header class="sb-inventory__header">
        <h1>${title}</h1>
        <p>${description}</p>
      </header>
      ${content}
    </${tag}>
  `;
  return root;
}

export default {
  title: "Patterns",
};

/**
 * Mirrors production's `wireSeeMore(sectionId)` in script.js: same id
 * convention (`<sectionId>` + `<sectionId>SeeMore`), same null guard, same
 * three writes on click — `classList.toggle("expanded")`, the show more/show
 * less label and `aria-expanded`. The only difference is the lookup root:
 * production reads `document.getElementById` because the page is already
 * parsed when the deferred script runs, while a story's fixture is not in the
 * document yet at render time. Nothing else is re-implemented; if that
 * controller is ever extracted into a module, this copy goes away and the
 * stories import it (see AGENTS.md, "Storybook e testes de UI").
 */
function wireSeeMore(root, sectionId) {
  const section = root.querySelector(`#${sectionId}`);
  const seeMore = root.querySelector(`#${sectionId}SeeMore`);
  if (!section || !seeMore) return;
  seeMore.addEventListener("click", () => {
    const expanded = section.classList.toggle("expanded");
    seeMore.textContent = expanded ? "show less" : "show more";
    seeMore.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
}

function rowMarkup({ name, what, extra = false }) {
  const anchor = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `
    <div class="row${extra ? " extra" : ""}">
      <span class="who"><a href="#${anchor}">${name}</a></span>
      <span class="what">${what}</span>
    </div>`;
}

/**
 * The production shape of a see-more section: visible rows, then
 * `.extras > .extras-inner > .row.extra`, then the `.see-more` button that
 * owns `aria-expanded`/`aria-controls`. `sectionClass` is the whole point of
 * this fixture — People carries `.people`, Courses and References do not, and
 * the CSS that drives the disclosure is keyed on `.expanded` alone.
 */
function seeMoreSectionMarkup({ id, sectionClass, heading, rows, extras, debtMarker }) {
  return `
    <section class="${sectionClass}" id="${id}">
      <h2>${heading}</h2>
      ${rows.map((row) => rowMarkup(row)).join("")}
      <div class="extras" id="${id}Extras">
        <div class="extras-inner">
          ${extras.map((row) => rowMarkup({ ...row, extra: true })).join("")}
        </div>
      </div>
      <button class="see-more" id="${id}SeeMore" type="button" aria-expanded="false" aria-controls="${id}Extras" data-a11y-debt="${debtMarker}">show more</button>
    </section>`;
}

export const Rows = {
  render: () =>
    patternShell(
      "Rows",
      "The repeated .row pattern used for people, courses, readings and references. Hover an item: it fills instantly (no transition), bleeding 8px past the column — the jakub.kr row.",
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
          <h2>Courses</h2>
          <div class="row">
            <span class="who"><a href="#">Interface Craft</a></span>
            <span class="what">Josh Puckett · Bought</span>
          </div>
          <div class="row">
            <span class="who"><a href="#">Animations.dev</a></span>
            <span class="what">Emil Kowalski · motion · Evaluate</span>
          </div>
        </section>
      `,
      { asMain: true },
    ),
  play: async ({ canvasElement }) => {
    // Two columns only since 16/08/2026 — the course status (Bought /
    // Evaluate / In progress) folded into `.what`, and with it went the
    // `--faint` status column and its color-contrast debt.
    await expectOnlyA11yDebt(canvasElement, []);
    // The static half of the hover contract: no transition on the fill, the
    // 8px bleed (negative margin), and the text column unmoved by it — the
    // row's content box starts exactly where the section's does. The fill
    // itself needs a real pointer (`:hover` + the hover/pointer media query),
    // which synthetic events can't produce; the product smoke test covers it.
    const rows = canvasElement.querySelectorAll(".row");
    await expect(getComputedStyle(rows[0]).transitionProperty).not.toMatch(/background/);
    await expect(parseFloat(getComputedStyle(rows[0]).marginLeft)).toBeLessThan(0);
    const section = rows[0].closest("section");
    const textLeft = rows[0].querySelector(".who").getBoundingClientRect().left;
    await expect(textLeft).toBe(section.getBoundingClientRect().left);
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
          <div class="extras" id="storybookPeopleExtras">
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
          <button class="see-more" id="storybookPeopleSeeMore" type="button" aria-expanded="false" aria-controls="storybookPeopleExtras" data-a11y-debt="see-more">show more</button>
        </section>
      `,
    );
    // aria-expanded/aria-controls used to be deliberately absent here because
    // production did not have them yet (AGENTS.md: never give the fixture ARIA
    // the site lacks). script.js now writes aria-expanded on every see-more and
    // index.html ships aria-controls, so the story carries the same contract.
    wireSeeMore(root, "storybookPeople");

    return root;
  },
  play: async ({ canvas, canvasElement, userEvent, step }) => {
    const section = canvas.getByRole("heading", { name: "People" }).closest(".people");
    const firstLink = canvas.getByRole("link", { name: "Rauno Freiberg" });
    const button = canvas.getByRole("button", { name: "show more" });

    await step("The collapsed button announces its state and a target that exists", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "false");
      // aria-controls is only worth anything if it resolves: look the id up the
      // way an assistive technology does instead of comparing two strings.
      const controlled = document.getElementById(button.getAttribute("aria-controls"));
      await expect(controlled).toBe(section.querySelector(".extras"));
    });

    await step("Activate the native button from the keyboard", async () => {
      await userEvent.tab();
      await expect(firstLink).toHaveFocus();
      await userEvent.tab();
      await expect(button).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect(section).toHaveClass("expanded");
      await expect(button).toHaveTextContent("show less");
      await expect(button).toHaveAttribute("aria-expanded", "true");
    });

    await step("Collapse without leaving the keyboard", async () => {
      await userEvent.keyboard(" ");
      await expect(section).not.toHaveClass("expanded");
      await expect(button).toHaveTextContent("show more");
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(button).toHaveFocus();
    });

    await step("Keep the known contrast debt exact", async () => {
      await expectOnlyA11yDebt(canvasElement, ["color-contrast:see-more"]);
    });
  },
};

// Summaries are kept short enough to fit at 320px without truncating. The
// ellipsis of a truncated .what lands on a different glyph under
// Chromium/Linux than under Chrome/macOS, and this fixture is captured at that
// width by sections-expanded-narrow; text that never reaches the boundary
// keeps the capture's diff down to plain glyph rasterization.
//
// This is a one-off exception to the fixture mirroring production content,
// granted only because truncation already has a dedicated owner: rows-narrow
// captures it deliberately, at content chosen to truncate. That is what makes
// dodging the boundary here safe rather than silent coverage loss. It is not
// a precedent — a future fixture with a cross-platform diff at its truncation
// boundary needs its own owning baseline before shortening text to route
// around it, the same way rows-narrow does here.
const SEE_MORE_SECTIONS = [
  {
    id: "sbSeeMorePeople",
    // The only section that still carries `.people`. Everything below it has
    // to work without that class for the pattern to be a pattern at all.
    sectionClass: "people",
    heading: "People",
    debtMarker: "see-more-people",
    rows: [{ name: "Rauno Freiberg", what: "Vercel" }],
    extras: [{ name: "floguo", what: "Paradigm" }],
  },
  {
    id: "sbSeeMoreCourses",
    sectionClass: "",
    heading: "Courses & materials",
    debtMarker: "see-more-courses",
    rows: [{ name: "Interface Craft", what: "Josh Puckett" }],
    extras: [{ name: "Invisible Details", what: "Rauno" }],
  },
  {
    id: "sbSeeMoreReferences",
    sectionClass: "",
    heading: "Craft references",
    debtMarker: "see-more-references",
    rows: [{ name: "Jordan Jenkins", what: "Jkane" }],
    extras: [{ name: "Nev Flynn", what: "ElevenLabs" }],
  },
];

export const SeeMoreSections = {
  name: "See more — people, courses, references",
  parameters: {
    a11y: {
      test: "error",
      // Same known --faint debt as the single-section story, once per button.
      // The play function pins the exact list in both collapsed and expanded
      // state, since the addon's own scan only sees the state play() ends in.
      options: { rules: { "color-contrast": { enabled: false } } },
    },
  },
  render: () => {
    // The blurb stays to one short, deliberately unwrapped sentence because
    // this story is captured at 320px by the visual matrix
    // (sections-expanded-narrow). A longer paragraph re-wraps at different
    // words under Chromium/Linux than under Chrome/macOS — measured on CI at
    // raw 4.72% / perceptual 1.27% against a macOS-generated baseline, over
    // both limits — and that is a rendering-environment artifact, not a UI
    // regression. The reasoning that used to live here is in the comments
    // around SEE_MORE_SECTIONS and wireSeeMore above, where it costs no pixels.
    const root = patternShell(
      "See more — people, courses, references",
      "One disclosure pattern, three sections.",
      SEE_MORE_SECTIONS.map(seeMoreSectionMarkup).join(""),
    );

    SEE_MORE_SECTIONS.forEach(({ id }) => wireSeeMore(root, id));

    return root;
  },
  play: async ({ canvas, canvasElement, userEvent, step }) => {
    const sections = SEE_MORE_SECTIONS.map(({ id, heading, debtMarker }) => ({
      heading,
      debtMarker,
      element: canvasElement.querySelector(`#${id}`),
      extras: canvasElement.querySelector(`#${id}Extras`),
      button: canvasElement.querySelector(`#${id}SeeMore`),
    }));
    const openHeightOf = (extras) => getComputedStyle(extras).gridTemplateRows;

    await step("All three sections start collapsed and closed to assistive tech", async () => {
      // Role-based, so this fails if a see-more ever stops being a real button.
      await expect(canvas.getAllByRole("button", { name: "show more" })).toHaveLength(3);
      for (const { element, extras, button } of sections) {
        await expect(element).not.toHaveClass("expanded");
        await expect(button).toHaveAttribute("aria-expanded", "false");
        // Resolve aria-controls through the document, not by string compare:
        // a target id that does not exist is the failure mode worth catching.
        await expect(document.getElementById(button.getAttribute("aria-controls"))).toBe(extras);
        await expect(getComputedStyle(extras).visibility).toBe("hidden");
        await expect(openHeightOf(extras)).toBe("0px");
      }
    });

    await step("Known contrast debt is exact while collapsed", async () => {
      await expectOnlyA11yDebt(
        canvasElement,
        sections.map(({ debtMarker }) => `color-contrast:${debtMarker}`),
      );
    });

    for (const { heading, element, extras, button } of sections) {
      await step(`Expanding ${heading} opens its extras and flips the announced state`, async () => {
        await userEvent.click(button);
        await expect(element).toHaveClass("expanded");
        await expect(button).toHaveTextContent("show less");
        await expect(button).toHaveAttribute("aria-expanded", "true");
        await expect(getComputedStyle(extras).visibility).toBe("visible");
        // The 320ms grid-template-rows transition is still running right after
        // the class flip; wait for the settled, non-zero track.
        await waitFor(() => expect(openHeightOf(extras)).not.toBe("0px"));
        // And the stagger the disclosure exists for: `.expanded .row.extra`
        // ends the `enter` animation at opacity 1 (forwards), which is the
        // rule the reduced-motion block has to cancel.
        for (const extraRow of extras.querySelectorAll(".row.extra")) {
          await waitFor(() => expect(getComputedStyle(extraRow).opacity).toBe("1"));
        }
      });
    }

    await step("Known contrast debt is still exact with every section open", async () => {
      await expect(canvas.getAllByRole("button", { name: "show less" })).toHaveLength(3);
      await expectOnlyA11yDebt(
        canvasElement,
        sections.map(({ debtMarker }) => `color-contrast:${debtMarker}`),
      );
    });

    for (const { heading, element, extras, button } of sections) {
      await step(`Collapsing ${heading} returns it to the initial contract`, async () => {
        await userEvent.click(button);
        await expect(element).not.toHaveClass("expanded");
        await expect(button).toHaveTextContent("show more");
        await expect(button).toHaveAttribute("aria-expanded", "false");
        await waitFor(() => expect(openHeightOf(extras)).toBe("0px"));
        // visibility flips back only after the 320ms height transition
        // (transition: visibility 0s linear var(--duration-320)), so the rows
        // never disappear before the list has finished closing.
        await waitFor(() => expect(getComputedStyle(extras).visibility).toBe("hidden"));
      });
    }
  },
};

export const PeopleSelection = {
  name: "People — selected + panel open",
  parameters: {
    a11y: { test: "error" },
  },
  render: () => {
    // Same reset precedent as the command menu fixture: a fresh mount should
    // never inherit body.panel-open from a previous story/test run.
    document.body.classList.remove("panel-open");

    const root = patternShell(
      "People — selected + panel open",
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
    // The dim is a solid color (--row-dim), not opacity — see main.css above
    // .row.active for why opacity alone can't hit AA contrast here. A probe
    // element resolves --row-dim to the same rgb() string getComputedStyle
    // reports on real text, so the assertions below don't hardcode a color.
    const probe = document.createElement("span");
    probe.style.color = "var(--row-dim)";
    canvasElement.appendChild(probe);
    const dimColor = getComputedStyle(probe).color;
    probe.remove();
    const whoColorOf = (row) => getComputedStyle(row.querySelector(".who a")).color;
    const whatColorOf = (row) => getComputedStyle(row.querySelector(".what")).color;
    const opacityOf = (row) => getComputedStyle(row.querySelector(".who")).opacity;

    await step("Normal list: nothing selected, nothing dimmed", async () => {
      await expect(document.body).not.toHaveClass("panel-open");
      await expect(rauno).not.toHaveClass("active");
      await expect(whoColorOf(rauno)).not.toBe(dimColor);
      await expect(whatColorOf(emil)).not.toBe(dimColor);
    });

    await step("Selecting a person opens the panel and persists without a pointer over the list", async () => {
      await userEvent.click(canvas.getByRole("link", { name: "Rauno Freiberg" }));
      await userEvent.unhover(rauno);
      await expect(document.body).toHaveClass("panel-open");
      await expect(rauno).toHaveClass("active");
      // a's transition-property already covers color (main.css, top of file)
      // and .what carries its own color transition too, so the 200ms/250ms
      // fade is still in flight right after the class change — wait for the
      // settled value like the rest of the file does for other transitions.
      // opacity stays pinned at 1 throughout this feature now (see main.css):
      // the dim is entirely a color change, never an alpha blend toward --bg.
      await waitFor(() => expect(whoColorOf(rauno)).not.toBe(dimColor));
      await waitFor(() => expect(whoColorOf(emil)).toBe(dimColor));
      await waitFor(() => expect(whatColorOf(emil)).toBe(dimColor));
      await waitFor(() => expect(whoColorOf(jakub)).toBe(dimColor));
      await waitFor(() => expect(whatColorOf(jakub)).toBe(dimColor));
      await expect(opacityOf(rauno)).toBe("1");
      await expect(opacityOf(emil)).toBe("1");
    });

    await step("Axe passes while the selection is persisted, not just after closing", async () => {
      // The addon's own end-of-play scan only ever sees whatever state play()
      // finishes in; a violation that exists only in this dimmed, panel-open
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
      await waitFor(() => expect(whoColorOf(emil)).not.toBe(dimColor));
      await waitFor(() => expect(whoColorOf(rauno)).toBe(dimColor));
      await waitFor(() => expect(whatColorOf(rauno)).toBe(dimColor));
    });

    await step("Axe still passes after switching the persisted selection", async () => {
      await expectOnlyA11yDebt(canvasElement, []);
    });

    // The pointer over a different, non-active row while the selection holds
    // is intentionally not exercised here: @testing-library/user-event's
    // hover() dispatches synthetic pointer events that do not reliably set
    // real CSS :hover in a Chromium tab, and in production people open #panel
    // in modal mode (body.panel-modal + #panelWash), so a real pointer over
    // the list lands on the wash and the row never enters :hover at all. That
    // interplay — selection owned by body.panel-open/.row.active, pointer
    // ignored, axe clean throughout — is covered deterministically by
    // tests/ui/people-persistent-selection.test.mjs, which drives real
    // script.js/main.css on the production page with genuine OS-level pointer
    // movement and a real axe-core scan taken with the pointer over the list.

    await step("Closing the panel restores the normal list state", async () => {
      await userEvent.click(closeButton);
      await expect(document.body).not.toHaveClass("panel-open");
      await expect(emil).not.toHaveClass("active");
      await waitFor(() => expect(whoColorOf(emil)).not.toBe(dimColor));
      await waitFor(() => expect(whoColorOf(rauno)).not.toBe(dimColor));
      await waitFor(() => expect(whoColorOf(jakub)).not.toBe(dimColor));
      await expect(whatColorOf(rauno)).not.toBe(dimColor);
      await expect(whatColorOf(emil)).not.toBe(dimColor);
      await expect(whatColorOf(jakub)).not.toBe(dimColor);
    });

    await expectOnlyA11yDebt(canvasElement, []);
  },
};

export const SelectedExtraRow = {
  name: "People — show more + selected extra row",
  parameters: {
    a11y: {
      test: "error",
      // Only the see-more button's known --faint debt, same as the other
      // disclosure stories. The play function pins the exact list while a row
      // revealed by show more is selected — the state this story exists for.
      options: { rules: { "color-contrast": { enabled: false } } },
    },
  },
  render: () => {
    // Same reset precedent as the command menu and PeopleSelection fixtures.
    document.body.classList.remove("panel-open");

    const root = patternShell(
      "People — show more + selected extra row",
      "Where the two features meet: a row that only exists after show more is still a .people .row, so selecting it opens the panel (a modal in production, only the plan's phases keep the sidebar), holds --ink while the rest falls to --row-dim, and leaves the list expanded. The enter animation ends at opacity 1 (forwards) and must not fight the opacity: 1 pin that keeps the dim a pure color change.",
      `
        <section class="people" id="sbExtraSelection">
          <h2>People</h2>
          <div class="row" data-person="rauno">
            <span class="who"><a href="#rauno">Rauno Freiberg</a></span>
            <span class="what">Staff Design Engineer, Vercel</span>
          </div>
          <div class="row" data-person="emil">
            <span class="who"><a href="#emil">Emil Kowalski</a></span>
            <span class="what">Design Engineer, Linear</span>
          </div>
          <div class="extras" id="sbExtraSelectionExtras">
            <div class="extras-inner">
              <div class="row extra" data-person="floguo">
                <span class="who"><a href="#floguo">floguo</a></span>
                <span class="what">Founding DE, Paradigm · ex-Vercel</span>
              </div>
              <div class="row extra" data-person="janikb">
                <span class="who"><a href="#janikb">Janik Baumgartner</a></span>
                <span class="what">Icon designer · Sketch icons</span>
              </div>
            </div>
          </div>
          <button class="see-more" id="sbExtraSelectionSeeMore" type="button" aria-expanded="false" aria-controls="sbExtraSelectionExtras" data-a11y-debt="see-more">show more</button>
        </section>
        <div class="sb-people-panel-stub">
          <button class="panel-close sb-people-close" type="button" aria-label="Close panel">&times;</button>
        </div>
      `,
    );

    wireSeeMore(root, "sbExtraSelection");

    // The same open/close mirror PeopleSelection uses: production's rows list
    // is document.querySelectorAll(".people .row"), which already includes the
    // .row.extra elements, so a revealed row goes through the exact same
    // openAt("people", index) path as a visible one. Only the two flags CSS
    // reads move here — body.panel-open and .row.active.
    const rows = Array.from(root.querySelectorAll(".people .row"));
    const closeButton = root.querySelector(".sb-people-close");
    let activeRow = null;

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
    const section = canvasElement.querySelector("#sbExtraSelection");
    const extras = canvasElement.querySelector("#sbExtraSelectionExtras");
    const button = canvasElement.querySelector("#sbExtraSelectionSeeMore");
    const rauno = canvas.getByRole("link", { name: "Rauno Freiberg" }).closest(".row");
    const emil = canvas.getByRole("link", { name: "Emil Kowalski" }).closest(".row");
    const closeButton = canvas.getByRole("button", { name: "Close panel" });
    // Deliberately not resolved yet: while the list is collapsed, `.extras` is
    // visibility: hidden, so the extra rows are outside the accessibility tree
    // and getByRole cannot see them. Resolving them only after the disclosure
    // opens is itself the assertion that show more actually exposes them.
    let floguo;
    let janik;
    // Resolve --row-dim through a probe instead of hardcoding a color, same
    // as PeopleSelection above.
    const probe = document.createElement("span");
    probe.style.color = "var(--row-dim)";
    canvasElement.appendChild(probe);
    const dimColor = getComputedStyle(probe).color;
    probe.remove();
    const whoColorOf = (row) => getComputedStyle(row.querySelector(".who a")).color;
    const whatColorOf = (row) => getComputedStyle(row.querySelector(".what")).color;

    await step("Reveal the extra rows and let the stagger settle", async () => {
      await expect(canvas.queryByRole("link", { name: "floguo" })).toBe(null);
      await userEvent.click(button);
      await expect(section).toHaveClass("expanded");
      await expect(button).toHaveAttribute("aria-expanded", "true");
      floguo = (await canvas.findByRole("link", { name: "floguo" })).closest(".row");
      janik = (await canvas.findByRole("link", { name: "Janik Baumgartner" })).closest(".row");
      await waitFor(() => expect(getComputedStyle(floguo).opacity).toBe("1"));
      await waitFor(() => expect(getComputedStyle(janik).opacity).toBe("1"));
    });

    await step("Selecting a revealed row opens the panel like any other row", async () => {
      await userEvent.click(canvas.getByRole("link", { name: "floguo" }));
      await userEvent.unhover(floguo);
      await expect(document.body).toHaveClass("panel-open");
      await expect(floguo).toHaveClass("active");
      await waitFor(() => expect(whoColorOf(floguo)).not.toBe(dimColor));
      await waitFor(() => expect(whoColorOf(rauno)).toBe(dimColor));
      await waitFor(() => expect(whatColorOf(rauno)).toBe(dimColor));
      await waitFor(() => expect(whoColorOf(emil)).toBe(dimColor));
      await waitFor(() => expect(whoColorOf(janik)).toBe(dimColor));
      await waitFor(() => expect(whatColorOf(janik)).toBe(dimColor));
    });

    await step("The list stays open and the dim stays a pure color change", async () => {
      await expect(section).toHaveClass("expanded");
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await expect(getComputedStyle(extras).visibility).toBe("visible");
      await expect(getComputedStyle(extras).gridTemplateRows).not.toBe("0px");
      // The `enter` animation runs with `forwards`, so it — not the
      // `body.panel-open .people:has(.row.active) .row > *` pin — owns the
      // row's own opacity once it lands. Both have to read 1, otherwise a
      // dimmed extra row would blend toward --bg and reopen the contrast
      // violation the solid --row-dim exists to avoid.
      await expect(getComputedStyle(janik).opacity).toBe("1");
      await expect(getComputedStyle(janik.querySelector(".who")).opacity).toBe("1");
      await expect(getComputedStyle(floguo.querySelector(".what")).opacity).toBe("1");
    });

    await step("Axe passes in the expanded + selected state, not just after closing", async () => {
      await expectOnlyA11yDebt(canvasElement, ["color-contrast:see-more"]);
    });

    // Collapsing the list while an extra row is still selected is not asserted
    // in this fixture: the outcome depends on the document-level outside-click
    // handler in script.js (predates this feature — present since the repo's
    // very first commit), which this Storybook harness does not reproduce.
    // Verified directly against the real page instead (mouse and Space-key
    // activation of the see-more button): the handler already treats a click
    // on `#peopleSeeMore` as "outside", so close() runs — the panel closes,
    // the row deactivates, and the section collapses, all in the same click.
    // No orphaned panel.

    await step("Closing the panel restores the expanded list to its plain state", async () => {
      await userEvent.click(closeButton);
      await expect(document.body).not.toHaveClass("panel-open");
      await expect(floguo).not.toHaveClass("active");
      await expect(section).toHaveClass("expanded");
      await waitFor(() => expect(whoColorOf(rauno)).not.toBe(dimColor));
      await waitFor(() => expect(whoColorOf(janik)).not.toBe(dimColor));
      await waitFor(() => expect(whatColorOf(janik)).not.toBe(dimColor));
    });

    await expectOnlyA11yDebt(canvasElement, ["color-contrast:see-more"]);
  },
};

/**
 * A reference entry that goes deeper (27/08/2026, `refs.simile`): the same
 * modal detail (h3 + .role + .bio + Links) with two optional fields after
 * Links: a multi-paragraph `bio` and `sections` (label + `text` / `list` /
 * `people` / `entries`). People are link rows that swap the modal for the
 * person's own detail in production (the swap itself lives in script.js /
 * cmd.mjs and is covered by the product smoke, not simulated here). Static
 * copy of the string `render()` in script.js and
 * `entryHtml()` in cmd.mjs build; no `.p-stagger` here, same as the
 * command-menu detail fixture. Sits in a `.cmd-modal` because that surface
 * already carries `role="dialog"` in production and the new rules are
 * written for `.panel` and `.cmd-modal` together. The inline style only
 * takes the modal out of its fixed, viewport-capped box and lays it in
 * flow: axe skips contrast on anything scrolled out of the modal's own
 * viewport, and the whole state should be reviewable at once anyway. The
 * h3 after the inventory's h1 is the same heading-order debt the
 * command-menu detail story carries.
 */
export const DeeperReference = {
  name: "Reference · deeper entry",
  parameters: {
    a11y: {
      test: "error",
      // Only the `.label` (--faint) debt every panel already carries; the
      // play function pins the exact list.
      options: { rules: { "color-contrast": { enabled: false }, "heading-order": { enabled: false } } },
    },
  },
  render: () => {
    const root = patternShell(
      "Reference · deeper entry",
      "Simile in Craft references opens the same modal as every other row, then continues past Links with people (link rows that swap the modal for the person's detail), a study list and a visual lineage. Lineage entries reuse .row/.who/.what; descriptor and inline link sit under the name because .what is one nowrap line.",
      `
        <div class="cmd-modal" role="dialog" aria-modal="true" aria-label="Details" aria-hidden="false" id="sbDeeperModal" style="position: static; transform: none; max-height: none; margin: 0 auto;">
          <button class="panel-close cmd-modal__close sb-people-close" type="button" aria-label="Close">&times;</button>
          <div>
            <div><h3 data-a11y-debt="deeper-detail-heading">Simile</h3><p class="role">The Simulation Company</p></div>
            <div class="bio"><p>Simile is building AI systems that simulate human behaviour, allowing teams to explore how populations might respond to products, policies, pricing and other decisions before testing them in the real world.</p><p>What makes Simile especially interesting here is the overlap between research, product design and engineering.</p></div>
            <span class="label" data-a11y-debt="label-links">Links</span>
            <div>
              <a class="row" href="https://www.simile.com/" target="_blank" rel="noopener"><span class="who">Website</span></a>
              <a class="row" href="https://x.com/simile_ai" target="_blank" rel="noopener"><span class="who">X</span></a>
            </div>
            <div>
              <span class="label" data-a11y-debt="label-people">People to follow</span>
              <a class="row" href="#natasha" data-sub="0"><span class="who">Natasha Tenggoro</span><span class="what">Founding Designer</span></a>
              <a class="row" href="#jenning" data-sub="1"><span class="who">Jenning Chen</span><span class="what">Engineering</span></a>
              <span class="label" data-a11y-debt="label-study">What to study</span>
              <p class="item">simulation UX</p>
              <p class="item">AI-native interaction patterns</p>
              <p class="item">designers who ship</p>
              <span class="label" data-a11y-debt="label-lineage">Visual lineage</span>
              <p class="section-text">Simile → Generative Agents → Smallville → LimeZu</p>
              <div class="entry">
                <div class="row"><span class="who">Generative Agents / Smallville</span></div>
                <p class="entry-desc">AI agents represented as a living top-down simulated world</p>
              </div>
              <div class="entry">
                <div class="row"><span class="who">LimeZu</span></div>
                <p class="entry-desc">modular pixel-art interiors and environments used in the Smallville visual world</p>
                <p class="entry-links"><a class="inline-link" href="https://limezu.itch.io/" target="_blank" rel="noopener">itch.io</a></p>
              </div>
            </div>
          </div>
        </div>
      `,
    );
    return root;
  },
  play: async ({ canvasElement }) => {
    const modal = canvasElement.querySelector("#sbDeeperModal");
    const bioParagraphs = modal.querySelectorAll(".bio p");
    // Two paragraphs in one .bio: the second one opens 12px under the first.
    await expect(bioParagraphs.length).toBe(2);
    await expect(getComputedStyle(bioParagraphs[1]).marginTop).toBe("12px");
    // An entry row is a list line, not a card: no padding of its own, and it
    // may wrap so a name never truncates on a phone-wide modal.
    const entryRow = modal.querySelector(".entry .row");
    await expect(getComputedStyle(entryRow).paddingTop).toBe("0px");
    await expect(getComputedStyle(entryRow).flexWrap).toBe("wrap");
    await expect(getComputedStyle(entryRow).cursor).toBe("default");
    // People rows are whole-row links: the panel row's 8px, a pointer cursor,
    // and the role keeps the row's muted colour rather than the link's ink.
    const personRow = modal.querySelector("[data-sub]");
    await expect(personRow.tagName).toBe("A");
    await expect(getComputedStyle(personRow).paddingTop).toBe("8px");
    await expect(getComputedStyle(personRow).cursor).toBe("pointer");
    await expect(getComputedStyle(personRow.querySelector(".what")).color).toBe(getComputedStyle(modal.querySelector(".role")).color);
    await expect(modal.querySelectorAll("[data-sub]").length).toBe(2);
    // Every external link keeps the site's contract.
    const links = Array.from(modal.querySelectorAll("a[href^='http']"));
    await expect(links.length).toBe(3);
    for (const link of links) {
      await expect(link.target).toBe("_blank");
      await expect(link.rel).toMatch(/noopener/);
    }
    await expectOnlyA11yDebt(canvasElement, [
      "heading-order:deeper-detail-heading",
      "color-contrast:label-links",
      "color-contrast:label-people",
      "color-contrast:label-study",
      "color-contrast:label-lineage",
    ]);
  },
};
