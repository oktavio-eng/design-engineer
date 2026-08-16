/* ---------------------------------------------------------------------------
   Portfolio content — the collections /portfolio is built from, published on
   `window.PORTFOLIO_CONTENT`. Same classic-script + IIFE pattern as content.js
   (see the header there for why): portfolio.mjs renders the page from it and
   cmd.mjs indexes it for ⌘K on every page.

   Every entry keeps the shape the site's detail renderer expects:

     { name, role, bio, items?, links, draft? }

   `draft: true` marks an entry that is a placeholder for Otavio to replace —
   the page hides drafts unless the URL carries `?draft` (or on localhost),
   and ⌘K skips them. THE CLIENT PROJECTS BELOW ARE ALL DRAFTS: they show the
   shape (name = client/project, role = what it was + year, bio = problem →
   result, items = 2–4 craft decisions, links = live site / case study /
   repo). Replace them with real ones — with permission to publish each — and
   drop the `draft` flag. Everything else is real as of 16/08/2026.

   Order inside each collection is the order on the page.
--------------------------------------------------------------------------- */
(function () {
  const clients = {
    // ---- DRAFTS: replace with real client work (see header) -----------------
    "client-a": {
      draft: true,
      name: "Client project — template A",
      role: "Product website · 2026",
      bio: "One paragraph: what the client needed, what was in the way, and what shipped. Lead with the outcome — a number, a launch, a before/after — not the process.",
      items: [
        "Craft decision 1 — e.g. type scale and rhythm chosen against a measured reference.",
        "Craft decision 2 — e.g. motion kept interruptible; no animation on repeated actions.",
        "Craft decision 3 — e.g. OKLCH palette so hues hold across light and dark.",
      ],
      links: [
        ["Live site", "https://example.com"],
        ["Case study", "https://example.com/case"],
      ],
    },
    "client-b": {
      draft: true,
      name: "Client project — template B",
      role: "Design system · 2025",
      bio: "Problem → what you did → result. Two or three sentences at most; the modal is a card, not a case study.",
      items: ["Decision 1.", "Decision 2."],
      links: [["Live site", "https://example.com"]],
    },
    "client-c": {
      draft: true,
      name: "Client project — template C",
      role: "Brand + site · 2025",
      bio: "Problem → what you did → result.",
      links: [["Live site", "https://example.com"]],
    },
  };

  const personal = {
    "design-engineer": {
      name: "design-engineer",
      role: "This site · 2026 · public proof",
      bio: "A career-transition plan for design engineering that doubles as its own portfolio piece: a typographic single-page document with a ⌘K palette, a resizable panel, glossary tooltips and a Storybook + visual-regression harness — static HTML/CSS/JS, zero build step, every decision written down.",
      items: [
        "Type and spacing measured against emilkowal.ski in a real browser, not eyeballed: one size, two weights, 128px between sections.",
        "OKLCH tokens for color, motion, spacing, typography and radius; every literal lives in one token file.",
        "Motion stays interruptible; nothing animates on the keyboard path (⌘K opens instantly).",
        "Storybook renders the production CSS, axe runs on every state, and eleven visual baselines gate each pull request.",
      ],
      links: [
        ["Site", "https://design-engineer-phi.vercel.app"],
        ["Repo", "https://github.com/oktavio-eng/design-engineer"],
        ["Changelog", "https://design-engineer-phi.vercel.app/changelog"],
      ],
    },
    prompts: {
      name: "Prompts",
      role: "Collection · 2026",
      bio: "Prompts used in real design, engineering and AI work, kept with the context that made them useful — searchable, copyable, and indexed by the same ⌘K palette as everything else on the site.",
      items: [
        "Each prompt opens in the same modal surface as the palette detail, so the two never drift apart.",
        "Copy is exact: raw multiline text, no smart-quote or whitespace surprises.",
      ],
      links: [["Open", "https://design-engineer-phi.vercel.app/prompts"]],
    },
    "gow-studio": {
      name: "GOW Studio",
      role: "Studio · ongoing",
      bio: "The studio the client work ships under. Visual design first, moving toward design engineering: the same eye, now with the code to carry it through.",
      // No public studio site yet — add the link when it's live.
      links: [],
    },
  };

  const life = {
    brazil: {
      name: "Brazil, remote",
      role: "Where I work from",
      bio: "Earning in dollars, staying in Brazil. Relocation is plan B, not a prerequisite — the work travels, I don't have to.",
      links: [],
    },
    "design-circuit": {
      name: "Design Circuit",
      role: "Mentorship · 2026",
      bio: "A Brazilian mentorship circle with Willian Matiola, joined with one goal: decide which project becomes the public proof, then ship it.",
      links: [["Design Circuit", "https://designcircuit.co"]],
    },
    canon: {
      name: "The canon",
      role: "What I study",
      bio: "Rauno, Emil, Jakub, Josh — the design engineers whose public work set the yardstick this site is measured against. The reading order and why is on the plan page.",
      links: [["The plan", "https://design-engineer-phi.vercel.app/#people"]],
    },
  };

  // Writing — the doc-icon list (jakub.kr's row). Each entry opens in the
  // same modal as a project (title, summary, then the link to read it), so
  // clicking never leaves the page. Same shape as everything else: `bio` is
  // the summary shown in the row, `links` carries where the piece lives.
  const writing = {
    plan: {
      name: "Design Engineer — a transition plan",
      role: "Writing · 2026",
      bio: "The plan itself: principle, phases, people, and what got discarded.",
      links: [["Read", "/"]],
    },
    changelog: {
      name: "Changelog, as a habit",
      role: "Writing · 2026",
      bio: "Every change written down as it ships — building in public only counts if the record is public too.",
      links: [["Read", "/changelog"]],
    },
    prompts: {
      name: "Prompts used in real work",
      role: "Writing · 2026",
      bio: "Kept with the context that made them useful.",
      links: [["Read", "/prompts"]],
    },
  };

  // Gallery — photos are content, not decoration (PORTFOLIO.md §4). Each item
  // is {src, alt, caption, width, height}; width/height are the intrinsic
  // pixel size (they set the aspect ratio so the grid never jumps). Files go
  // in /photos as .webp. These three are the only images the repo has today;
  // replace/extend with real photos.
  const gallery = [
    { src: "/avatar.webp", alt: "Portrait of Otavio Alexandre", caption: "Otavio", width: 150, height: 150 },
    { src: "/Logo%20Black.svg", alt: "GOW Studio mark", caption: "GOW Studio", width: 44, height: 56 },
    { src: "/og.jpg", alt: "The plan page's share card", caption: "The plan, as a card", width: 1200, height: 628 },
  ];

  window.PORTFOLIO_CONTENT = { clients, personal, life, writing, gallery };
})();
