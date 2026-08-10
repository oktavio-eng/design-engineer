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

function renderPrompt(prompt) {
  const entry = makeElement("article", "prompt-entry");
  entry.id = prompt.slug;
  entry.dataset.searchText = searchText(prompt);

  const eyebrow = makeElement("div", "prompt-entry__eyebrow");
  eyebrow.appendChild(makeElement("span", "label", prompt.category));

  const copyButton = makeElement("button", "txtbtn prompt-copy", "Copy prompt");
  copyButton.type = "button";
  copyButton.dataset.promptSlug = prompt.slug;
  eyebrow.appendChild(copyButton);

  const copyStatus = makeElement("span", "sr-only prompt-copy__status");
  copyStatus.setAttribute("role", "status");
  copyStatus.setAttribute("aria-live", "polite");
  eyebrow.appendChild(copyStatus);
  entry.appendChild(eyebrow);

  const title = makeElement("h2", "prompt-entry__title", prompt.title);
  entry.appendChild(title);
  entry.appendChild(makeElement("p", "prompt-entry__description", prompt.description));

  const tags = makeElement("ul", "prompt-tags");
  tags.setAttribute("aria-label", "Tags");
  prompt.tags.forEach((tag) => tags.appendChild(makeElement("li", "prompt-tag", tag)));
  entry.appendChild(tags);

  const content = makeElement("pre", "prompt-entry__content", prompt.prompt);
  content.dataset.promptContent = prompt.slug;
  entry.appendChild(content);

  return entry;
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
  const collection = root.querySelector("[data-prompts-collection]");
  const resultStatus = root.querySelector("[data-prompts-status]");
  const empty = root.querySelector("[data-prompts-empty]");
  const emptyMessage = root.querySelector("[data-prompts-empty-message]");
  const clearButton = root.querySelector("[data-prompts-clear]");

  if (!form || !input || !collection || !resultStatus || !empty || !emptyMessage || !clearButton) return null;

  collection.replaceChildren(...prompts.map(renderPrompt));
  const entries = Array.from(collection.querySelectorAll(".prompt-entry"));

  function update() {
    const query = input.value.trim();
    const normalizedQuery = query.toLocaleLowerCase("en");
    let visibleCount = 0;

    entries.forEach((entry) => {
      const matches = !normalizedQuery || entry.dataset.searchText.includes(normalizedQuery);
      entry.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    resultStatus.textContent = `${visibleCount} ${visibleCount === 1 ? "prompt" : "prompts"}`;
    empty.hidden = visibleCount !== 0;
    if (!visibleCount) emptyMessage.textContent = `No prompts found for “${query}”.`;
  }

  form.addEventListener("submit", (event) => event.preventDefault());
  input.addEventListener("input", update);
  clearButton.addEventListener("click", () => {
    input.value = "";
    update();
    input.focus();
  });

  collection.addEventListener("click", async (event) => {
    const button = event.target.closest(".prompt-copy");
    if (!button || !collection.contains(button)) return;

    const prompt = prompts.find(({ slug }) => slug === button.dataset.promptSlug);
    if (!prompt) return;

    const status = button.closest(".prompt-entry").querySelector(".prompt-copy__status");
    try {
      await copy(prompt.prompt);
      collection.querySelectorAll(".prompt-copy").forEach((candidate) => {
        if (candidate !== button) candidate.textContent = "Copy prompt";
      });
      collection.querySelectorAll(".prompt-copy__status").forEach((candidate) => {
        if (candidate !== status) candidate.textContent = "";
      });
      button.textContent = "Copied";
      status.textContent = "Prompt copied to clipboard.";
    } catch (error) {
      button.textContent = "Copy failed";
      status.textContent = "Unable to copy. Select the prompt text and copy it manually.";
    }
  });

  update();
  return { update, entries };
}

if (typeof document !== "undefined") {
  const pageRoot = document.querySelector("[data-prompts-root]");
  if (pageRoot) initPromptsPage(pageRoot);
}
