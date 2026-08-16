import axe from "axe-core";
import { expect, waitFor } from "storybook/test";
import { PROMPTS, initPromptsPage } from "../prompts.mjs";

async function expectAxeClean(root) {
  // See tests/ui/prompts-page.test.mjs: axe-core 4.13 misparses Chrome's
  // computed OKLCH colors. Production tests measure the rendered RGB pairs;
  // this story keeps every non-color rule active in every meaningful state.
  const { violations } = await axe.run(root, {
    resultTypes: ["violations"],
    rules: { "color-contrast": { enabled: false } },
  });
  await expect(
    violations.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}:${node.target.join(" ")}`),
    ),
  ).toEqual([]);
}

// Mirrors prompts.html: pill search with its own clear control, prompt rows,
// and the cmd-style wash + detail modal the rows open. The controller is the
// real production module (prompts.mjs), not a copy.
function promptsFixture(writeClipboard) {
  const root = document.createElement("div");
  root.className = "sb-inventory prompts-page";
  root.innerHTML = `
    <main class="sb-inventory__content sb-pattern" data-prompts-root>
      <header class="sb-inventory__header">
        <h1>Prompts</h1>
        <p>Prompts used in real design, engineering, AI, and creative work — kept with the context that made them useful.</p>
      </header>
      <section class="prompt-search" aria-label="Search prompts">
        <form role="search" data-prompts-form>
          <label class="sr-only" for="storybookPromptSearch">Search prompts</label>
          <div class="prompt-search__pill">
            <input class="prompt-search__input" id="storybookPromptSearch" name="query" type="search" placeholder="Try “fintech”" autocomplete="off" spellcheck="false" data-prompts-search>
            <button class="prompt-search__clear" type="button" aria-label="Clear search" data-prompts-clear-field>
              <svg viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>
            </button>
          </div>
        </form>
        <p class="prompt-search__status" role="status" aria-live="polite" data-prompts-status></p>
      </section>
      <section class="prompt-results" aria-label="Prompt collection">
        <div class="prompt-list" data-prompts-collection></div>
        <div class="prompt-empty" data-prompts-empty hidden>
          <p data-prompts-empty-message>No prompts found.</p>
          <button class="txtbtn prompt-clear" type="button" data-prompts-clear>Clear search</button>
        </div>
      </section>
      <div class="cmd-wash" data-prompt-wash aria-hidden="true"></div>
      <div class="cmd-modal prompt-modal" role="dialog" aria-modal="true" aria-label="Prompt" aria-hidden="true" inert data-prompt-modal>
        <button class="panel-close cmd-modal__close" type="button" aria-label="Close" data-prompt-modal-close>×</button>
        <div data-prompt-modal-body></div>
      </div>
    </main>
  `;
  initPromptsPage(root, { writeClipboard });
  return root;
}

export default {
  title: "Patterns/Prompts",
};

export const SearchAndOpen = {
  name: "Search and open",
  parameters: {
    a11y: {
      test: "error",
      options: { rules: { "color-contrast": { enabled: false } } },
    },
  },
  render: () => {
    const copied = [];
    const root = promptsFixture(async (text) => copied.push(text));
    root.copiedPrompts = copied;
    return root;
  },
  play: async ({ canvas, canvasElement, userEvent, step }) => {
    const input = canvas.getByRole("searchbox", { name: "Search prompts" });
    const row = () => canvas.getByRole("button", { name: new RegExp(PROMPTS[0].title) });

    await step("The collection renders as rows, not full entries", async () => {
      await expect(row()).toBeVisible();
      await expect(canvasElement.querySelector(".prompt-search__status")).toHaveTextContent(
        `${PROMPTS.length} ${PROMPTS.length === 1 ? "prompt" : "prompts"}`,
      );
      await expect(canvasElement.querySelector(".prompt-modal__content")).toBeNull();
      await expectAxeClean(canvasElement);
    });

    await step("Search covers metadata and prompt content without submitting", async () => {
      await userEvent.click(input);
      await userEvent.type(input, "transactions");
      await expect(row()).toBeVisible();
      await expect(canvas.getByText("1 prompt", { selector: ".prompt-search__status" })).toBeVisible();
      await expect(canvasElement.querySelector(".prompt-search__clear")).toHaveClass("visible");
    });

    await step("An unmatched query exposes an actionable empty state", async () => {
      await userEvent.clear(input);
      await userEvent.type(input, "cinematic storyboard");
      await expect(canvas.getByText("No prompts found for “cinematic storyboard”.")).toBeVisible();
      await expect(canvasElement.querySelector(".prompt-clear")).toBeVisible();
      await expectAxeClean(canvasElement);
    });

    await step("The field's own clear pill empties the query and refocuses", async () => {
      await userEvent.click(canvasElement.querySelector(".prompt-search__clear"));
      await expect(input).toHaveFocus();
      await expect(input).toHaveValue("");
      await expect(canvasElement.querySelector(".prompt-search__clear")).not.toHaveClass("visible");
      await expect(row()).toBeVisible();
    });

    await step("Enter on a focused row opens the detail modal", async () => {
      await userEvent.tab();
      await expect(row()).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect(document.body.classList.contains("cmd-detail-open")).toBe(true);
      const modal = canvasElement.querySelector("[data-prompt-modal]");
      await expect(modal.getAttribute("aria-hidden")).toBe("false");
      // The surface fades in over --duration-200; visibility must be polled.
      await waitFor(async () => {
        await expect(canvas.getByRole("heading", { level: 2, name: PROMPTS[0].title })).toBeVisible();
      });
      await expect(canvasElement.querySelector(".prompt-modal__content")).toHaveTextContent(
        "Clone the overall information architecture",
      );
      await expect(canvasElement.querySelector("[data-prompt-modal-close]")).toHaveFocus();
      await expectAxeClean(canvasElement);
    });

    await step("The copy action inside the modal receives only the raw prompt", async () => {
      const copyButton = canvas.getByRole("button", { name: "Copy prompt" });
      await userEvent.click(copyButton);
      await waitFor(async () => {
        await expect(copyButton).toHaveTextContent("Copied");
      });
      await expect(canvasElement.querySelector(".sb-inventory").copiedPrompts).toEqual([
        PROMPTS[0].prompt,
      ]);
      await expect(canvasElement.querySelector(".prompt-copy__status")).toHaveTextContent(
        "Prompt copied to clipboard.",
      );
    });

    await step("Escape dismisses the modal and hands focus back to the row", async () => {
      await userEvent.keyboard("{Escape}");
      await expect(document.body.classList.contains("cmd-detail-open")).toBe(false);
      const modal = canvasElement.querySelector("[data-prompt-modal]");
      await expect(modal.getAttribute("aria-hidden")).toBe("true");
      await expect(modal.inert).toBe(true);
      await expect(row()).toHaveFocus();
      await expectAxeClean(canvasElement);
    });

    // Coverage for the curated Emil Kowalski-inspired prompt added alongside
    // the original Wise-inspired one — a second row, opened by pointer this
    // time, proves the pattern isn't only exercised on PROMPTS[0].
    await step("A curated Emil Kowalski-inspired prompt opens with its own content", async () => {
      const emilPrompt = PROMPTS.find((prompt) => prompt.slug === "animated-toast-drawer-kit-emil-kowalski");
      const emilRow = canvas.getByRole("button", { name: new RegExp(emilPrompt.title) });
      await userEvent.click(emilRow);
      await expect(document.body.classList.contains("cmd-detail-open")).toBe(true);
      await waitFor(async () => {
        await expect(canvas.getByRole("heading", { level: 2, name: emilPrompt.title })).toBeVisible();
      });
      await expect(canvasElement.querySelector(".prompt-modal__content")).toHaveTextContent(
        "Sonner and Vaul libraries",
      );
      await expectAxeClean(canvasElement);
      await userEvent.keyboard("{Escape}");
      await expect(document.body.classList.contains("cmd-detail-open")).toBe(false);
      await expect(emilRow).toHaveFocus();
    });
  },
};
