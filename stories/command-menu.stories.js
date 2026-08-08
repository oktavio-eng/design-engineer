import { expect, waitFor } from "storybook/test";
import { expectOnlyA11yDebt } from "./helpers/a11y-baseline.js";

const entries = [
  {
    group: "People",
    name: "Rauno Freiberg",
    what: "Staff Design Engineer, Vercel",
    bio: "A reference for interaction craft, systems thinking and public proof.",
  },
  {
    group: "People",
    name: "Emil Kowalski",
    what: "Design Engineer, Linear",
    bio: "A reference for motion, component polish and focused open-source work.",
  },
  {
    group: "References",
    name: "OKLCH Color Picker",
    what: "Color tool",
    bio: "A practical reference for the perceptual color space used by Craft Wiki.",
  },
];

function escapeHtml(value) {
  return value.replace(
    /[&<>"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}

function renderCommandMenu() {
  document.body.classList.remove("cmd-open", "cmd-detail-open");

  const root = document.createElement("div");
  root.className = "sb-inventory sb-command-story";
  root.innerHTML = `
    <div class="sb-inventory__content sb-pattern">
      <header class="sb-inventory__header">
        <h1>Command menu</h1>
        <p>Open with the button or Ctrl/⌘ K, then filter and move through results without leaving the keyboard.</p>
      </header>
      <button class="see-more sb-command-trigger" type="button" data-a11y-debt="command-trigger">Open search</button>
    </div>
    <div class="cmd-wash" aria-hidden="true"></div>
    <div class="cmd" role="dialog" aria-modal="true" aria-label="Search" aria-hidden="true" data-a11y-debt="command-dialog">
      <div class="cmd__card">
        <div class="cmd__head">
          <input
            class="cmd__input"
            type="text"
            placeholder="Search…"
            autocomplete="off"
            spellcheck="false"
            aria-label="Search Craft Wiki"
            aria-controls="storybookCmdList"
            aria-expanded="false"
          >
          <span class="cmd__esc">ESC</span>
        </div>
        <div class="cmd__rule"></div>
        <div class="cmd__list" id="storybookCmdList" role="listbox" aria-label="Results"></div>
      </div>
    </div>
    <div class="cmd-modal" role="dialog" aria-modal="true" aria-label="Details" aria-hidden="true" data-a11y-debt="detail-dialog">
      <button class="panel-close cmd-modal__back" type="button" aria-label="Back to search">←</button>
      <button class="panel-close cmd-modal__close" type="button" aria-label="Close">×</button>
      <div class="sb-command-detail"></div>
    </div>
  `;

  const trigger = root.querySelector(".sb-command-trigger");
  const wash = root.querySelector(".cmd-wash");
  const command = root.querySelector(".cmd");
  const input = root.querySelector(".cmd__input");
  const list = root.querySelector(".cmd__list");
  const detail = root.querySelector(".cmd-modal");
  const detailBody = root.querySelector(".sb-command-detail");
  const back = root.querySelector(".cmd-modal__back");
  const close = root.querySelector(".cmd-modal__close");
  let results = [];
  let cursor = 0;
  let lastCursor = 0;

  function syncActiveDescendant() {
    const option = list.querySelector('[aria-selected="true"]');
    if (option) input.setAttribute("aria-activedescendant", option.id);
    else input.removeAttribute("aria-activedescendant");
  }

  function renderResults() {
    const query = input.value.trim().toLowerCase();
    results = entries.filter((entry) =>
      `${entry.name} ${entry.what}`.toLowerCase().includes(query),
    );
    cursor = 0;

    if (!results.length) {
      list.innerHTML = '<p class="cmd__empty">No results</p>';
      syncActiveDescendant();
      return;
    }

    let group = "";
    list.innerHTML = results
      .map((entry, index) => {
        const heading =
          entry.group === group
            ? ""
            : `<div class="cmd__group">${escapeHtml(entry.group)}</div>`;
        group = entry.group;
        return `${heading}
          <button
            class="cmd__item"
            id="storybookCmdOption${index}"
            role="option"
            type="button"
            data-index="${index}"
            aria-selected="${index === 0}"
          >
            <span>${escapeHtml(entry.name)}</span>
            <span class="what">${escapeHtml(entry.what)}</span>
          </button>`;
      })
      .join("");
    syncActiveDescendant();
  }

  function setCursor(nextCursor) {
    const options = Array.from(list.querySelectorAll(".cmd__item"));
    if (!options.length) return;
    options[cursor].setAttribute("aria-selected", "false");
    cursor = (nextCursor + options.length) % options.length;
    options[cursor].setAttribute("aria-selected", "true");
    syncActiveDescendant();
    options[cursor].scrollIntoView({ block: "nearest" });
  }

  function openCommand(keepQuery = false) {
    document.body.classList.remove("cmd-detail-open");
    detail.setAttribute("aria-hidden", "true");
    document.body.classList.add("cmd-open");
    wash.setAttribute("aria-hidden", "false");
    command.setAttribute("aria-hidden", "false");
    input.setAttribute("aria-expanded", "true");
    if (!keepQuery) input.value = "";
    renderResults();
    if (keepQuery) setCursor(lastCursor);
    setTimeout(() => input.focus(), 0);
  }

  function closeCommand() {
    document.body.classList.remove("cmd-open");
    wash.setAttribute("aria-hidden", "true");
    command.setAttribute("aria-hidden", "true");
    input.setAttribute("aria-expanded", "false");
  }

  function closeDetail() {
    document.body.classList.remove("cmd-detail-open");
    wash.setAttribute("aria-hidden", "true");
    detail.setAttribute("aria-hidden", "true");
  }

  function openDetail(entry) {
    lastCursor = results.indexOf(entry);
    detailBody.innerHTML = `
      <h3>${escapeHtml(entry.name)}</h3>
      <p class="role">${escapeHtml(entry.what)}</p>
      <p class="bio">${escapeHtml(entry.bio)}</p>
    `;
    closeCommand();
    document.body.classList.add("cmd-detail-open");
    wash.setAttribute("aria-hidden", "false");
    detail.setAttribute("aria-hidden", "false");
  }

  function backToCommand() {
    openCommand(true);
  }

  trigger.addEventListener("click", () => openCommand());
  input.addEventListener("input", renderResults);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor(cursor + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor(cursor - 1);
    } else if (event.key === "Enter" && results[cursor]) {
      event.preventDefault();
      openDetail(results[cursor]);
    }
  });
  list.addEventListener("click", (event) => {
    const option = event.target.closest(".cmd__item");
    if (option) openDetail(results[Number(option.dataset.index)]);
  });
  back.addEventListener("click", backToCommand);
  close.addEventListener("click", closeDetail);
  wash.addEventListener("click", () => {
    if (document.body.classList.contains("cmd-detail-open")) backToCommand();
    else closeCommand();
  });
  root.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (document.body.classList.contains("cmd-open")) closeCommand();
      else openCommand();
      return;
    }
    if (event.key !== "Escape") return;
    if (document.body.classList.contains("cmd-detail-open")) {
      event.stopImmediatePropagation();
      backToCommand();
    } else if (document.body.classList.contains("cmd-open")) {
      event.stopImmediatePropagation();
      closeCommand();
    }
  });

  return root;
}

export default {
  title: "Patterns/Command menu",
  parameters: {
    a11y: {
      test: "error",
      // The play function executes both disabled rules separately and accepts
      // only the three marked production-debt targets in the closed state.
      options: {
        rules: {
          "aria-hidden-focus": { enabled: false },
          "color-contrast": { enabled: false },
        },
      },
    },
  },
};

export const KeyboardFlow = {
  render: renderCommandMenu,
  play: async ({ canvas, canvasElement, userEvent, step }) => {
    const trigger = canvas.getByRole("button", { name: "Open search" });

    await step("Keep the known accessibility debt exact", async () => {
      await expectOnlyA11yDebt(canvasElement, [
        "aria-hidden-focus:command-dialog",
        "aria-hidden-focus:detail-dialog",
        "color-contrast:command-trigger",
      ]);
    });

    await step("Open from the keyboard shortcut and move focus to search", async () => {
      trigger.focus();
      await userEvent.keyboard("{Control>}k{/Control}");
      const search = canvas.getByRole("textbox", { name: "Search Craft Wiki" });
      await waitFor(() => expect(search).toHaveFocus());
      await waitFor(() =>
        expect(canvas.getByRole("dialog", { name: "Search" })).toBeVisible(),
      );
    });

    const search = canvas.getByRole("textbox", { name: "Search Craft Wiki" });

    await step("Move the active result while focus stays in the search field", async () => {
      const options = canvas.getAllByRole("option");
      await expect(options[0]).toHaveAttribute("aria-selected", "true");
      await userEvent.keyboard("{ArrowDown}");
      await expect(options[1]).toHaveAttribute("aria-selected", "true");
      await expect(search).toHaveFocus();
      await expect(search).toHaveAttribute("aria-activedescendant", options[1].id);
    });

    await step("Filter and open the selected result", async () => {
      await userEvent.clear(search);
      await userEvent.type(search, "Emil");
      const option = canvas.getByRole("option", { name: /Emil Kowalski/ });
      await expect(option).toHaveAttribute("aria-selected", "true");
      await userEvent.keyboard("{Enter}");
      await waitFor(() =>
        expect(canvas.getByRole("dialog", { name: "Details" })).toBeVisible(),
      );
      await expect(canvas.getByRole("heading", { name: "Emil Kowalski" })).toBeVisible();
    });

    await step("Peel back one layer at a time with Escape", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(canvas.getByRole("dialog", { name: "Search" })).toBeVisible());
      await waitFor(() => expect(search).toHaveFocus());
      await expect(search).toHaveValue("Emil");
      await userEvent.keyboard("{Escape}");
      await expect(canvas.queryByRole("dialog", { name: "Search" })).not.toBeInTheDocument();
      await expect(canvas.queryByRole("dialog", { name: "Details" })).not.toBeInTheDocument();
    });

  },
};
