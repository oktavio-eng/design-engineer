import axe from "axe-core";
import { expect } from "storybook/test";
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
          <label class="prompt-search__label" for="storybookPromptSearch">Search prompts</label>
          <input class="prompt-search__input" id="storybookPromptSearch" name="query" type="search" placeholder="Try “fintech”" autocomplete="off" spellcheck="false" data-prompts-search>
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
    </main>
  `;
  initPromptsPage(root, { writeClipboard });
  return root;
}

export default {
  title: "Patterns/Prompts",
};

export const SearchAndCopy = {
  name: "Search and copy",
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

    await step("The real prompt model renders in the initial state", async () => {
      await expect(canvas.getByRole("heading", { name: PROMPTS[0].title })).toBeVisible();
      await expect(canvasElement.querySelector(".prompt-search__status")).toHaveTextContent("1 prompt");
      await expectAxeClean(canvasElement);
    });

    await step("Search covers metadata and prompt content without submitting", async () => {
      await userEvent.click(input);
      await userEvent.type(input, "transactions");
      await expect(canvas.getByRole("heading", { name: PROMPTS[0].title })).toBeVisible();
      await expect(canvas.getByText("1 prompt", { selector: ".prompt-search__status" })).toBeVisible();
    });

    await step("An unmatched query exposes an actionable empty state", async () => {
      await userEvent.clear(input);
      await userEvent.type(input, "cinematic storyboard");
      await expect(canvas.getByText("No prompts found for “cinematic storyboard”.")).toBeVisible();
      await expect(canvas.getByRole("button", { name: "Clear search" })).toBeVisible();
      await expectAxeClean(canvasElement);
    });

    await step("Clearing restores the collection and returns focus to search", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
      await expect(input).toHaveFocus();
      await expect(input).toHaveValue("");
      await expect(canvas.getByRole("heading", { name: PROMPTS[0].title })).toBeVisible();
    });

    await step("The keyboard copy action receives only the raw prompt", async () => {
      await userEvent.tab();
      const copyButton = canvas.getByRole("button", { name: "Copy prompt" });
      await expect(copyButton).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect(copyButton).toHaveTextContent("Copied");
      await expect(canvasElement.querySelector(".sb-inventory").copiedPrompts).toEqual([
        PROMPTS[0].prompt,
      ]);
      await expect(canvasElement.querySelector(".prompt-copy__status")).toHaveTextContent(
        "Prompt copied to clipboard.",
      );
      await expectAxeClean(canvasElement);
    });
  },
};
