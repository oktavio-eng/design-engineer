export const PROMPTS = [
  {
    slug: "fintech-dashboard-wise-inspired",
    title: "Fintech Dashboard — Wise-inspired",
    description:
      "A prompt used to generate a responsive fintech dashboard in a Framer agent, using Wise's information architecture and interaction patterns as the primary reference.",
    category: "UI Generation",
    tags: ["Framer", "Mobbin", "Dashboard", "Fintech", "Product Design"],
    prompt: `Clone the overall information architecture, layout structure, and interaction patterns of the Wise web dashboard using the Mobbin reference as the primary inspiration. Recreate the experience with a fresh implementation, keeping the interface visually distinct while maintaining the same usability, hierarchy, and premium fintech feel.

Reference: https://mobbin.com/flows/5ee4db65-7476-48c2-903a-e8f28b0d4c00

Build a responsive desktop dashboard (1440px wide) with a modern, minimal aesthetic inspired by Wise, Linear, Stripe, and Notion.

The interface should prioritize clarity, whitespace, accessibility, and data visualization with soft shadows, rounded corners (16–20px), subtle borders, and clean typography.

Include the following sections:

**Sidebar Navigation:**
- Company logo
- Home
- Accounts
- Cards
- Recipients
- Payments
- Transactions
- Analytics
- Team
- Settings
- Help & Support
- User profile at the bottom

**Top Navigation:**
- Search bar
- Currency selector
- Notifications
- Messages
- User profile
- Quick action button ("Send Money")

**Dashboard Overview:**
- Personalized greeting
- Current balance cards for multiple currencies
- Total balance summary
- Available balance
- Recent activity indicator

**Quick Actions:**
- Send Money
- Receive Money
- Convert Currency
- Add Funds
- Request Payment
- Create Virtual Card

**Financial Analytics:**
- Cash flow chart
- Spending overview
- Income vs Expenses
- Monthly performance graph
- Currency allocation chart

**Recent Transactions:**
- Modern transaction table
- Recipient avatar
- Transaction type
- Amount
- Currency
- Status
- Date
- Search, filter, and sort functionality

**Multi-Currency Accounts:**
Display account cards for:
- USD
- EUR
- GBP
- CAD
- AUD

**Each card should show:**
- Available balance
- Currency symbol
- Percentage change
- Quick actions

**Cards Section:**
- Physical card
- Virtual card
- Freeze/Unfreeze
- Spending limits
- Recent card activity

**Insights Panel:**
- Spending categories
- Monthly trends
- Budget progress
- Smart recommendations
- Exchange rate updates

**Activity Feed:**
- Recent transfers
- Incoming payments
- Currency conversions
- Card payments
- Security notifications

**Design Style:**
- Premium fintech aesthetic
- Minimal, clean interface
- Large whitespace
- Modern card-based layout
- Soft shadows
- Subtle borders
- Neutral color palette (white, gray, black)
- Green accent for positive actions and financial highlights
- SF Pro / Inter typography
- 8pt spacing system
- Fully responsive desktop layout
- Pixel-perfect alignment
- Smooth hover states and micro-interactions
- Professional charts and data visualizations
- Production-ready UI suitable for a real fintech product

The final result should feel like a polished, enterprise-grade financial dashboard inspired by Wise's user experience while using an original visual treatment and components.`,
  },
];

function searchText(prompt) {
  return [prompt.title, prompt.description, prompt.category, ...prompt.tags, prompt.prompt]
    .join("\n")
    .toLocaleLowerCase("en");
}

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// The list shows one row per prompt (title + category, the shared `.row`
// layout); everything else lives in the detail modal a row opens.
function renderPrompt(prompt) {
  const row = makeElement("button", "row prompt-row");
  row.type = "button";
  row.id = prompt.slug;
  row.dataset.promptSlug = prompt.slug;
  row.dataset.searchText = searchText(prompt);
  row.setAttribute("aria-haspopup", "dialog");
  row.appendChild(makeElement("span", "who", prompt.title));
  row.appendChild(makeElement("span", "what", prompt.category));
  return row;
}

// Rebuilt on every open, so the `.p-stagger` enter animation replays the same
// way the ⌘K detail's does.
function renderDetail(prompt) {
  const fragment = document.createDocumentFragment();

  const head = makeElement("div", "p-stagger");
  const eyebrow = makeElement("div", "prompt-modal__eyebrow");
  eyebrow.appendChild(makeElement("span", "label", prompt.category));

  const copyButton = makeElement("button", "txtbtn prompt-copy", "Copy prompt");
  copyButton.type = "button";
  copyButton.dataset.promptSlug = prompt.slug;
  eyebrow.appendChild(copyButton);

  const copyStatus = makeElement("span", "sr-only prompt-copy__status");
  copyStatus.setAttribute("role", "status");
  copyStatus.setAttribute("aria-live", "polite");
  eyebrow.appendChild(copyStatus);
  head.appendChild(eyebrow);
  head.appendChild(makeElement("h2", "prompt-modal__title", prompt.title));
  fragment.appendChild(head);

  fragment.appendChild(makeElement("p", "prompt-modal__description p-stagger", prompt.description));

  const tags = makeElement("ul", "prompt-tags p-stagger");
  tags.setAttribute("aria-label", "Tags");
  prompt.tags.forEach((tag) => tags.appendChild(makeElement("li", "prompt-tag", tag)));
  fragment.appendChild(tags);

  const content = makeElement("pre", "prompt-modal__content p-stagger", prompt.prompt);
  content.dataset.promptContent = prompt.slug;
  fragment.appendChild(content);

  return fragment;
}

async function writeClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.className = "sr-only";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed");
}

export function initPromptsPage(root, options = {}) {
  const prompts = options.prompts || PROMPTS;
  const copy = options.writeClipboard || writeClipboard;
  const form = root.querySelector("[data-prompts-form]");
  const input = root.querySelector("[data-prompts-search]");
  const clearField = root.querySelector("[data-prompts-clear-field]");
  const collection = root.querySelector("[data-prompts-collection]");
  const resultStatus = root.querySelector("[data-prompts-status]");
  const empty = root.querySelector("[data-prompts-empty]");
  const emptyMessage = root.querySelector("[data-prompts-empty-message]");
  const clearButton = root.querySelector("[data-prompts-clear]");
  const wash = root.querySelector("[data-prompt-wash]");
  const modal = root.querySelector("[data-prompt-modal]");
  const modalBody = root.querySelector("[data-prompt-modal-body]");
  const modalClose = root.querySelector("[data-prompt-modal-close]");

  if (
    !form ||
    !input ||
    !clearField ||
    !collection ||
    !resultStatus ||
    !empty ||
    !emptyMessage ||
    !clearButton ||
    !wash ||
    !modal ||
    !modalBody ||
    !modalClose
  ) {
    return null;
  }

  collection.replaceChildren(...prompts.map(renderPrompt));
  const entries = Array.from(collection.querySelectorAll(".prompt-row"));

  function update() {
    const query = input.value.trim();
    const normalizedQuery = query.toLocaleLowerCase("en");
    let visibleCount = 0;

    entries.forEach((entry) => {
      const matches = !normalizedQuery || entry.dataset.searchText.includes(normalizedQuery);
      entry.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    // `.visible` drives the fade; `tabIndex` leaves the tab order immediately —
    // the exit animation holds `visibility` for its duration, which would
    // otherwise keep a fading-out button as a Tab stop.
    const hasQuery = input.value.length > 0;
    clearField.classList.toggle("visible", hasQuery);
    clearField.tabIndex = hasQuery ? 0 : -1;
    resultStatus.textContent = `${visibleCount} ${visibleCount === 1 ? "prompt" : "prompts"}`;
    empty.hidden = visibleCount !== 0;
    if (!visibleCount) emptyMessage.textContent = `No prompts found for “${query}”.`;
  }

  function clearSearch() {
    input.value = "";
    update();
    input.focus();
  }

  // Same body switch (`cmd-detail-open`) and aria choreography as the ⌘K
  // detail in script.js, so the two dialogs move and dismiss identically.
  // `inert` (cleared only while open) is what keeps the closed dialog's ×
  // out of the tab order and out of axe's aria-hidden-focus rule.
  let opener = null;

  function isModalOpen() {
    return document.body.classList.contains("cmd-detail-open");
  }

  function openModal(prompt, trigger) {
    opener = trigger || null;
    modalBody.replaceChildren(renderDetail(prompt));
    modal.setAttribute("aria-label", prompt.title);
    modal.inert = false;
    modal.setAttribute("aria-hidden", "false");
    wash.setAttribute("aria-hidden", "false");
    document.body.classList.add("cmd-detail-open");
    modal.scrollTop = 0;
    modalClose.focus();
  }

  function closeModal() {
    if (!isModalOpen()) return;
    document.body.classList.remove("cmd-detail-open");
    if (modal.contains(document.activeElement)) document.activeElement.blur();
    modal.inert = true;
    modal.setAttribute("aria-hidden", "true");
    wash.setAttribute("aria-hidden", "true");
    const target = opener;
    opener = null;
    if (target && target.isConnected && !target.hidden) target.focus();
  }

  form.addEventListener("submit", (event) => event.preventDefault());
  input.addEventListener("input", update);
  clearField.addEventListener("click", clearSearch);
  clearButton.addEventListener("click", clearSearch);

  collection.addEventListener("click", (event) => {
    const row = event.target.closest(".prompt-row");
    if (!row || !collection.contains(row)) return;
    const prompt = prompts.find(({ slug }) => slug === row.dataset.promptSlug);
    if (prompt) openModal(prompt, row);
  });

  wash.addEventListener("click", closeModal);
  modalClose.addEventListener("click", closeModal);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!root.isConnected || !isModalOpen()) return;
    closeModal();
  });

  modal.addEventListener("click", async (event) => {
    const button = event.target.closest(".prompt-copy");
    if (!button) return;

    const prompt = prompts.find(({ slug }) => slug === button.dataset.promptSlug);
    if (!prompt) return;

    const status = modal.querySelector(".prompt-copy__status");
    try {
      await copy(prompt.prompt);
      button.textContent = "Copied";
      status.textContent = "Prompt copied to clipboard.";
    } catch (error) {
      button.textContent = "Copy failed";
      status.textContent = "Unable to copy. Select the prompt text and copy it manually.";
    }
  });

  update();
  return { update, entries, openModal, closeModal };
}

if (typeof document !== "undefined") {
  const pageRoot = document.querySelector("[data-prompts-root]");
  if (pageRoot) initPromptsPage(pageRoot);
}
