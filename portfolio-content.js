/* ---------------------------------------------------------------------------
   Portfolio content — the collections /portfolio is built from, published on
   `window.PORTFOLIO_CONTENT`. Same classic-script + IIFE pattern as content.js
   (see the header there for why): portfolio.mjs renders the page from it and
   cmd.mjs indexes it for ⌘K on every page.

   Every entry keeps the shape the site's detail renderer expects:

     { name, role, bio, items?, links, draft? }

   `draft: true` marks an entry that is a placeholder for Otavio to replace —
   the page hides drafts unless the URL carries `?draft` (or on localhost),
   and ⌘K skips them. EVERY `projects` ENTRY BELOW IS A DRAFT: they're real
   work with a best-effort bio (name = client/project, role = what it was +
   year, bio = problem → result, items = 2–4 craft decisions, links = live
   site) — Otavio reviews each one and drops the flag entry by entry.
   Everything else is real as of 16/08/2026.

   `projects` gets one thing `personal`/`life` don't: a favicon in the row,
   from `entry.links[0][1]` (portfolio.mjs's renderList opts in per group).
   No `domain` field needed — favicon() extracts the hostname.

   The `clients` collection (three fake `client-a/b/c` templates) was
   removed 22/08/2026 — `projects` replaced it with real work, so the
   templates were redundant rather than useful as a second placeholder
   section. `gallery` still exists below but portfolio.mjs no longer calls
   renderGallery() from initPortfolioPage — paused on Otavio's request,
   real photos pending; the data and the render function are both intact,
   restoring it is a one-line change there.

   Order inside each collection is the order on the page.
--------------------------------------------------------------------------- */
(function () {
  // Projects — real client/studio work, favicon shown left of the name in
  // the row (opt-in per row via portfolio.mjs's rowMarkup, from
  // links[0][1]; see portfolio.mjs's renderList call site). All six are
  // draft: true until Otavio reviews each bio/items line by line — see the
  // file header and task-projects-home-v2.md.
  const projects = {
    "sphera-academy": {
      name: "Sphera Academy",
      role: "UX/UI + Design System · MBA admissions prep",
      bio: "Designed most of the interface screens and the entire design system in Figma, then trained a junior designer to take ownership of the file before moving to other client work. The platform today documents dozens of student admissions to schools including Duke, Cornell, and Columbia.",
      items: [
        "Full design system built in Figma → Framer.",
        "Mentored a junior designer to take over the file structure.",
      ],
      links: [["Live site", "https://www.spheraacademy.com/"]],
      draft: true,
    },
    "caderno-de-erros": {
      name: "Caderno de Erros",
      role: "Identity + Website · EdTech",
      bio: "Visual identity and full website, Figma → Framer, for a study method built around logging mistakes by cause and reviewing them on a spaced schedule. 15K Instagram followers; beta testers have specifically praised being able to log discursive (essay-style) questions and the clean, distraction-free interface.",
      items: [
        "Visual identity + full site, Figma → Framer.",
        "Kept the interface deliberately quiet so the study method stays the focus.",
      ],
      links: [["Live site", "https://www.cadernodeerros.com.br/"]],
      draft: true,
    },
    "cloudfaster-academy": {
      name: "CloudFaster Academy",
      role: "Identity + Website · Cloud/AWS training",
      bio: "Visual identity and website for an AWS certification training brand serving both individual learners and corporate teams. The brand has since scaled to a mobile app on Google Play and corporate/B2B plans beyond the original site.",
      links: [["Live site", "https://cloudfaster.academy/"]],
      draft: true,
    },
    dascia: {
      name: "DascIA",
      role: "Identity + Website · AI Education",
      bio: "Visual identity and website, via GOW Design, for an AI-education brand positioned against shallow 'AI in three clicks' courses — built to read as technical and credible.",
      items: ["Compressed, mixed-weight capital headline as the core brand device."],
      links: [["Live site", "https://dascia.com.br/"]],
      draft: true,
    },
    "finq-edu": {
      name: "FinQ Edu",
      role: "Identity + Website · Investment Banking prep",
      bio: "Visual identity and website at company launch, for an investment-banking / private-equity prep brand founded by people with real Wall Street backgrounds.",
      links: [["Live site", "https://www.finqedu.com/"]],
      draft: true,
    },
    "escola-da-bel": {
      name: "Escola da Bel",
      role: "Campaign key visuals · Aesthetics",
      bio: "Campaign key visuals (e.g. Fresh Frozen Paris) built inside an already-established brand identity that predates this work.",
      links: [["Live site", "https://escoladabel.com/"]],
      draft: true,
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
      links: [["Site", "https://gowdesign.framer.website/"]],
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

  window.PORTFOLIO_CONTENT = { projects, personal, life, writing, gallery };
})();
