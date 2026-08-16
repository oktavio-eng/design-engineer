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
  {
    slug: "animated-toast-drawer-kit-emil-kowalski",
    title: "Animated Toast & Drawer Kit — Emil Kowalski-inspired",
    description:
      "A prompt for building an unstyled, accessible toast and drawer component pair with the interaction craft behind Sonner and Vaul — spring-based motion, swipe-to-dismiss, and sensible defaults with real escape hatches.",
    category: "Component Design",
    tags: ["React", "Animation", "Accessibility", "Component API", "Motion Design"],
    prompt: `Design and implement a small, unstyled component pair — a toast notification system and a bottom-sheet drawer — with the interaction craft of Emil Kowalski's Sonner and Vaul libraries as the reference for feel, not literal source code.

Reference: https://sonner.emilkowal.ski and https://vaul.emilkowal.ski

Build both components in React with TypeScript and a spring-physics animation primitive (e.g. Motion, React Spring) — no CSS-only easing curves — with zero required styling, so consumers bring their own classes or design tokens.

**Toast component:**
- Stack multiple toasts with a slight vertical offset and scale, expanding to full height on hover
- Swipe-to-dismiss on touch, with velocity-aware momentum, not a fixed-duration slide
- A promise-based API — toast.promise(fn, { loading, success, error }) — that swaps content in place instead of stacking a new toast
- Auto-dismiss timer that pauses on hover/focus and resumes on leave
- Enter/exit that is always interruptible — a toast dismissed mid-animation must never finish its enter animation first

**Drawer component:**
- Bottom-sheet drag with real touch tracking, not a scripted transform
- Snap points (e.g. 25%/50%/90% of viewport height) with spring settle, not linear easing
- Background scale-and-blur while open, echoing iOS's native sheet-over-app depth
- Releasing mid-drag should either settle at the nearest snap point or dismiss, based on velocity and position — never just distance
- Full keyboard support: Escape closes, focus is trapped while open, and focus returns to the trigger on close

**Design and motion principles to hold throughout:**
- Every animation is interruptible; nothing locks input
- Durations and easing read as physical, not decorative — favor spring physics over fixed-duration curves
- Defaults should look finished with zero configuration, but every timing, snap point, and dismiss threshold should be overridable
- A reduced-motion preference must degrade to instant or near-instant transitions, not just shorter ones

Ship both as small, tree-shakeable, headless primitives — the same shape as a library meant to be copied into a project's own component folder, not installed as a black box.`,
  },
  {
    slug: "motion-audit-emil-kowalski-craft-review",
    title: "Motion & Micro-interaction Audit — Emil Kowalski-inspired",
    description:
      "A prompt for auditing an existing interface's animations against Emil Kowalski's craft principles — interruptibility, spring-based timing, and purposeful motion — and turning the findings into a prioritized punch list.",
    category: "Motion Review",
    tags: ["Animation", "Motion Design", "UI Polish", "Code Review", "Accessibility"],
    prompt: `Act as a senior motion reviewer applying Emil Kowalski's writing on UI craft (emilkowal.ski) to review the animation and micro-interaction code in this codebase. Do not propose a redesign — audit what exists and flag what breaks his standard.

For every animated element (modals, drawers, dropdowns, hover states, list reordering, loading states, toasts), check:

**Interruptibility:**
- Can a user reverse or cancel the animation mid-flight, or does it lock input until it finishes?
- Does a rapid second interaction (double-click, quick re-open) restart cleanly, or does it stack/glitch?

**Timing and easing:**
- Is the duration proportional to the distance or size of the change, or a single flat number reused everywhere regardless of context?
- Are entrances and exits using different curves on purpose, or copy-pasted from one to the other?
- Would the motion feel more physical as a spring (mass/stiffness/damping) than a fixed-duration curve, especially for anything gesture-driven?

**Purpose:**
- Does the animation communicate a real state change (what moved, what appeared, what caused it), or is it decoration with no information value?
- Is there any animation competing with itself — multiple elements animating on unrelated timers that visually clash?

**Accessibility:**
- Does everything respect prefers-reduced-motion, with reduced motion meaning "no motion," not just "shorter motion"?
- Does any animation block keyboard focus from landing where the user expects during the transition?

Output a prioritized list: for each finding, name the exact element or selector, the specific problem, and a concrete fix — an easing curve, a duration, an "make this interruptible" note — not a general recommendation. Rank by how often a user hits the interaction, not by how visually obvious the flaw is.`,
  },
  {
    slug: "minimal-typographic-landing-jakub-krehel",
    title: "Minimal Typographic Landing Page — Jakub Krehel-inspired",
    description:
      "A prompt for building a restrained, monochrome, typography-led landing page in the visual language of jakub.kr — hierarchy carried by weight, spacing, and rhythm instead of color or imagery.",
    category: "UI Generation",
    tags: ["Typography", "Minimalism", "Landing Page", "Monochrome", "Product Design"],
    prompt: `Design a single-page product landing page in the visual language of Jakub Krehel's portfolio (jakub.kr) as the primary reference — restrained, monochrome, and carried almost entirely by typography and spacing rather than color, icons, or photography.

Reference: https://www.jakub.kr

Build a responsive desktop layout (1280px wide) using one typeface family across the whole page, varying only weight, size, and letter-spacing to create hierarchy — no secondary display font, no decorative icon set, no cover imagery.

**Palette:**
- Near-black text on a near-white background (or the inverse for a dark variant)
- A single muted gray for secondary text and dividers
- One accent used sparingly — a single link color or a single button state, nowhere else

**Structure:**
- A short, direct headline (one sentence, no filler) followed by a one-line subhead
- A feature list expressed as short text rows, not icon-plus-card grids — each row is a label and a one-line description, separated by hairline borders
- A minimal footer: product name, one or two links, no social icon row

**Rhythm and craft:**
- Generous vertical whitespace between sections — let the page breathe instead of filling it
- Consistent baseline spacing scale (an 8pt-style system) applied to every margin and padding, no one-off values
- Subtle entrance motion on scroll (fade plus a small upward shift), short and interruptible, never a slide-in from off-screen
- Left-aligned text throughout; avoid centered paragraphs beyond a single short headline

**What to avoid:**
- Stock photography, illustration, or gradient backgrounds
- More than one font family
- Color used to carry meaning that spacing or weight could carry instead

The result should feel confident because of what it leaves out, not what it adds — precision through restraint, not embellishment.`,
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
// way the ⌘K detail's does. Exported because the ⌘K palette (cmd.mjs) shows a
// prompt with this exact renderer, on every page — one source for the sheet.
export function renderPromptDetail(prompt) {
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

// Delegated "Copy prompt" handler for any container that shows a prompt
// detail: this page's modal and the ⌘K detail modal both call it once.
export function attachPromptCopy(container, prompts = PROMPTS, copy = writeClipboard) {
  container.addEventListener("click", async (event) => {
    const button = event.target.closest(".prompt-copy");
    if (!button) return;

    const prompt = prompts.find(({ slug }) => slug === button.dataset.promptSlug);
    if (!prompt) return;

    const status = container.querySelector(".prompt-copy__status");
    try {
      await copy(prompt.prompt);
      button.textContent = "Copied";
      status.textContent = "Prompt copied to clipboard.";
    } catch (error) {
      button.textContent = "Copy failed";
      status.textContent = "Unable to copy. Select the prompt text and copy it manually.";
    }
  });
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
  // detail in cmd.mjs, so the two dialogs move and dismiss identically.
  // `inert` (cleared only while open) is what keeps the closed dialog's ×
  // out of the tab order and out of axe's aria-hidden-focus rule.
  // Open/closed is tracked here rather than read back off the body class:
  // the ⌘K palette on this page toggles the same class for its own detail,
  // and Escape/⌘K must only fold the dialog this module actually put up.
  let opener = null;
  let modalOpen = false;

  function isModalOpen() {
    return modalOpen;
  }

  function openModal(prompt, trigger) {
    opener = trigger || null;
    modalOpen = true;
    modalBody.replaceChildren(renderPromptDetail(prompt));
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
    modalOpen = false;
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
  // The ⌘K palette (cmd.mjs) is on this page too. It announces itself before
  // it opens; this modal folds so the two never stack — same contract the
  // homepage's panel/about/mail layers follow.
  document.addEventListener("cmd:beforeopen", closeModal);

  attachPromptCopy(modal, prompts, copy);

  update();
  return { update, entries, openModal, closeModal };
}

if (typeof document !== "undefined") {
  const pageRoot = document.querySelector("[data-prompts-root]");
  if (pageRoot) initPromptsPage(pageRoot);
}
