/* ---------------------------------------------------------------------------
   Portfolio content — the collections /portfolio is built from, published on
   `window.PORTFOLIO_CONTENT`. Same classic-script + IIFE pattern as content.js
   (see the header there for why): portfolio.mjs renders the page from it and
   cmd.mjs indexes it for ⌘K on every page.

   Every entry keeps the shape the site's detail renderer expects:

     { name, role, preview?, bio, items?, subprojects?, links, draft? }

   `preview` (22/08/2026): a live-fetched image URL (the entry's own
   `og:image`, hotlinked, not downloaded — same "live external asset, remove
   on failure" pattern favicons.js already uses for the row icons) shown in
   the ⌘K/panel detail between the role line and the bio. Only add it when
   the URL is verified to actually resolve — DascIA has no og:image at all
   and FinQ Edu's points at a leftover `localhost:3000` URL, so neither
   entry carries the field; a real image (or the site getting fixed) is what
   promotes them later. `subprojects` (22/08/2026, `escola-da-bel` only): an
   array of `{ name, url, preview, description }` for individual landing
   pages worth calling out inside one project's detail — same "live image +
   onerror removal" contract as the top-level `preview`. See cmd.mjs's
   `entryHtml()` for how both render.

   `draft: true` marks an entry that is a placeholder for Otavio to replace —
   the page hides drafts unless the URL carries `?draft` (or on localhost),
   and ⌘K skips them. `projects` shipped as six drafts (16/08/2026) and went
   live for real (22/08/2026) once Otavio reviewed and rewrote each bio/items
   line by line — none of the six carry the flag anymore. Everything else is
   real as of 16/08/2026.

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
  // links[0][1]; see portfolio.mjs's renderList call site). Live as of
  // 22/08/2026 — see the file header and task-projects-home-v2.md.
  const projects = {
    "sphera-academy": {
      name: "Sphera Academy",
      role: "UX/UI + Design System",
      preview: "https://framerusercontent.com/images/PgbsHlNgpSQclDuYYOPfMT6Zo.png",
      bio: "Design system and visual language for a university-admissions coaching platform, built around academic-university aesthetic — matching the credibility register that students and families already associate with the schools they're applying to. Designed the identity plus the core screens that set the system's components and tone (onboarding, home, class list/modules, classroom), then handed the file to the dev team to extend and trained a junior designer to take ownership of it. The client has used the identity and those first screens ever since; students describe the study environment as comfortable and immersive. The platform today documents dozens of admissions to schools including Duke, Cornell, and Columbia.",
      items: [
        "Visual language built around academic-university aesthetic to match the credibility register students expect — not generic edtech UI.",
        "Designed identity + core screens (onboarding, home, class list/modules, classroom) to set the system's components; dev team extended from there.",
        "Client has used the identity and those screens since launch; students describe the environment as comfortable and immersive.",
        "Mentored a junior designer into ownership of the file; structure now being revisited as the internal team grows.",
      ],
      links: [["Live site", "https://www.spheraacademy.com/"]],
    },
    "caderno-de-erros": {
      name: "Caderno de Erros",
      role: "UX/UI + Identity + Website · EdTech",
      preview: "https://framerusercontent.com/images/3hNIyBkZHnghlMhz2wT4u2MiDw.jpg",
      bio: "Visual identity and full platform — desktop, tablet, and mobile, light and dark — for a study method built around logging mistakes by cause and reviewing them on a spaced schedule. Designed end-to-end in Figma and shipped to Framer, including the subscription flow with a custom coupon system (live price updates via DOM overrides) and ASAAS payment integration. 15K Instagram followers; beta testers have specifically praised logging discursive (essay-style) questions and the clean, distraction-free interface.",
      items: [
        "Full platform design across desktop/tablet/mobile, light/dark — Figma → Framer.",
        "Built the subscription page's coupon logic as reusable Framer overrides.",
        "Kept the interface deliberately quiet so the study method stays the focus.",
      ],
      links: [["Live site", "https://www.cadernodeerros.com.br/"]],
    },
    "cloudfaster-academy": {
      name: "CloudFaster Academy",
      role: "UX/UI + Identity + Website · Cloud/AWS training",
      preview: "https://cloudfaster.academy/assets/og-image.png",
      bio: "Visual identity and website for an AWS certification training brand serving individual learners and corporate teams — built on solid UI/UX fundamentals for a straightforward certification-prep flow. The brand has since expanded to a mobile app and B2B plans, a later business decision outside this project's scope.",
      links: [["Live site", "https://cloudfaster.academy/"]],
    },
    dascia: {
      name: "DascIA",
      role: "UX/UI + Identity + Website · AI Education",
      bio: "Visual identity and website, via GOW Design, for an AI-education brand positioned against shallow 'AI in three clicks' courses — built to read as technical and credible.",
      items: ["Compressed, mixed-weight capital headline as the core brand device."],
      links: [["Live site", "https://dascia.com.br/"]],
    },
    "finq-edu": {
      name: "FinQ Edu",
      role: "UX/UI + Identity + Website · Investment Banking prep",
      bio: "Visual identity and initial website version, at company launch, for an investment-banking/private-equity prep brand founded by people with real Wall Street backgrounds — built to give women a foothold in an IB/PE space that's highly competitive and visually closed off. Bet on gradients and vivid color, a deliberate break from every competitor's visual convention in the category. Structured the first version of the site and built out the app and web system screens; the live site has evolved since.",
      items: [
        "Identity built to stand out for women in IB/PE — a category where competitor branding is uniformly conservative.",
        "Gradients and vivid color as a deliberate break from category convention.",
        "Structured the first site version and built the app + web system screens — not the version currently live.",
      ],
      links: [
        ["App LP", "https://finqedu.webflow.io/"],
        ["Original site", "https://dev-finqedu.webflow.io/"],
      ],
    },
    "escola-da-bel": {
      name: "Escola da Bel",
      role: "Campaign key visuals · Medical aesthetics",
      preview: "https://framerusercontent.com/images/BP6trVJNYC4N4uySVf4sXwSvUA.jpg",
      bio: "Ongoing campaign key visuals inside an already-established brand identity — includes surrealist matte-painting series (Fresh Frozen Paris, Las Vegas) and a full anatomical illustration set for a medical-education atlas. Also built a Framer-based diagnostic quiz (7-course recommendation engine) with a Google Sheets webhook and iframe height-sync, used as a lead-gen tool on the site — it generated around 600 leads at a single event of 1,500–2,000 attendees.",
      items: [
        "Surrealist campaign series: Fresh Frozen Paris, Las Vegas.",
        "Anatomical illustration set for a course atlas.",
        "Interactive Framer diagnostic quiz with live course recommendations — ~600 leads generated at one event of 1,500–2,000 attendees.",
      ],
      // Landing pages: same process on each (key visual → landing page
      // design → Framer implementation, Clarity + Analytics wired in) unless
      // noted otherwise. "BG" is Bel Guerra, the school's founder.
      subprojects: [
        {
          name: "Fresh Frozen Paris",
          url: "https://escoladabel.com/freshfrozen/paris",
          preview: "https://framerusercontent.com/assets/VO63HMeiALGb7kNi7cEOCQscfQ.webp",
          description:
            "Key visual, landing page, and Framer build for the Paris edition of the Fresh Frozen series — with a custom sound component playing ambient Paris audio for a more immersive page.",
        },
        {
          name: "BGEx 26",
          url: "https://escoladabel.com/bgex-2",
          preview: "https://framerusercontent.com/assets/mWYFPeZqAp1QJ2RgVpwodOz0yU.png",
          description:
            "Landing page for BGEx 26, Bel Guerra's facial-harmonization congress — a live, 100%-demonstrative event in São Paulo. Built an interactive card component profiling each speaking doctor and biomedical professional.",
        },
        {
          name: "Aceleradora 4P",
          url: "https://escoladabel.com/aceleradora4p-b",
          preview: "https://framerusercontent.com/assets/gE2A6YDijn05PlGuvlP7mNGfwpU.png",
          description:
            "Key visual, landing page, and Framer build for Aceleradora 4P, a mid-ticket accelerator program one tier below the flagship Mentoria BG.",
        },
        {
          name: "Mentoria BG — Turma 9",
          url: "https://escoladabel.com/mentoriabg-turma-9",
          preview: "https://framerusercontent.com/assets/atnMrUm6uvfmTDGfr3hofLBydvw.jpg",
          description:
            "Key visual, landing page, and Framer build for the ninth cohort of Mentoria BG, the school's flagship mentorship program.",
        },
        {
          name: "A Nova Face do Mercado",
          url: "https://escoladabel.com/workshop/nova-face-do-mercado",
          preview: "https://framerusercontent.com/assets/2rbs1g30EVxvnPV2bkzxjEAxpA.jpg",
          description:
            "Key visual, landing page, and Framer build for a workshop helping facial-harmonization professionals read where the market is heading in 2026 and position themselves accordingly.",
        },
      ],
      links: [["Live site", "https://escoladabel.com/"]],
    },
    "jlcp-tecnologia": {
      name: "JLCP Tecnologia",
      role: "Brand Identity + Positioning · IT Observability",
      preview: "https://www.jlcp.com.br/images/favicon.svg",
      bio: "Brand and logomark redesign for the #1 Zabbix partner in Brazil, an IT observability consultancy serving enterprise clients like Globo, Riachuelo, and EcoRodovias. Replaced a dated isometric-cube mark with a modular grid of squares — data points, monitored environments — resolving into a minimalist star, repositioning the brand as AI-first. Defended the direction against a competing AI-generated concept the founder had produced himself, then wrote the presentation rationale that won the room.",
      items: [
        "New logomark: modular grid of squares resolving into a star — monitored environments coalescing into AI-driven insight.",
        "Repositioned the brand as AI-first, replacing a dated isometric 3D cube mark.",
        "Defended the direction in front of the founder against his own AI-generated alternative, and wrote the rationale that shipped it.",
        "Extended into event naming and a Portuguese-language copy pass on the live monitoring dashboard UI.",
      ],
      links: [["Live site", "https://www.jlcp.com.br/"]],
    },
  };

  const personal = {
    "design-engineer": {
      name: "Design Engineer",
      role: "This site · 2026",
      bio: "A single-page site — palette, ⌘K search, glossary tooltips, a Storybook + visual-regression harness — static HTML/CSS/JS, zero build step, every decision written down as it ships.",
      items: [
        "Type and spacing measured against emilkowal.ski in a real browser, not eyeballed: one size, two weights, 128px between sections.",
        "OKLCH tokens for color, motion, spacing, typography and radius; every literal lives in one token file.",
        "Motion stays interruptible; nothing animates on the keyboard path (⌘K opens instantly).",
        "Storybook renders the production CSS, axe runs on every state, and eleven visual baselines gate each pull request.",
      ],
      links: [
        ["Site", "https://oktavio.vercel.app"],
        ["Repo", "https://github.com/oktavio-eng/design-engineer"],
        ["Changelog", "https://oktavio.vercel.app/changelog"],
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
      links: [["Open", "https://oktavio.vercel.app/prompts"]],
    },
    "gow-studio": {
      name: "GOW Studio",
      role: "Studio · ongoing",
      bio: "The studio the client work ships under, since 2019 — interface design, brand systems, and design engineering.",
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
      links: [["The plan", "https://oktavio.vercel.app/#people"]],
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
