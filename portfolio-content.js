/* ---------------------------------------------------------------------------
   Portfolio content — the collections /portfolio is built from, published on
   `window.PORTFOLIO_CONTENT`. Same classic-script + IIFE pattern as content.js
   (see the header there for why): portfolio.mjs renders the page from it and
   cmd.mjs indexes it for ⌘K on every page.

   Every entry keeps the shape the site's detail renderer expects:

     { name, role, summary?, preview?, bio, items?, gallery?, subprojects?, links, draft? }

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

   `summary` e `gallery` (12/09/2026) nasceram do protótipo da nova home
   (/testes/prototipo-nova-home, frames 124:562 e 133:248 do Figma).
   `summary` é a linha curta do card — um registro diferente do `role`: o
   card diz o que o projeto é ("Founding design for a medical-education
   company"), o `role` diz a disciplina ("Interactive Product + Campaigns ·
   Medical Education"). Writing já usava o campo com o mesmo sentido.
   `gallery` é um array de `{ src, alt, caption }` com as fotos do detalhe
   do projeto; sem ele o protótipo cai nas capas dos `subprojects`. Os dois
   são editáveis no Studio ("Resumo na home" e "Galeria do projeto").

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
    "caderno-de-erros": {
      name: "Caderno de Erros",
      role: "UX/UI + Design Systems · EdTech SaaS",
      summary: "Founding design for website and multi-device platform",
      preview: "https://framerusercontent.com/images/3hNIyBkZHnghlMhz2wT4u2MiDw.jpg",
      bio: "UX/UI and visual identity for an EdTech SaaS platform built around logging mistakes by cause and reviewing them on a spaced schedule. I design user flows, reusable design systems and responsive interfaces across desktop, tablet and mobile, in light and dark themes, collaborating with developers and stakeholders from product decisions and prototyping through handoff and QA. Website and subscription pages are built in Framer, including a custom coupon system (live price updates via DOM overrides) and ASAAS payment integration. 15K Instagram followers; beta testers have specifically praised logging discursive (essay-style) questions and the clean, distraction-free interface.",
      items: [
        "Platform UX/UI across desktop, tablet and mobile, light and dark — user flows, design systems, Figma prototypes, developer handoff and QA.",
        "Built the subscription page's coupon logic as reusable Framer overrides.",
        "Kept the interface deliberately quiet so the study method stays the focus."
      ],
      // `gallery` (12/09/2026): as fotos do detalhe do projeto, no ritmo do
      // frame 133:248 — duas meias, depois inteiras. Mesmo contrato de
      // imagem externa do `preview` acima: hotlink, `onerror` remove, e só
      // entra URL conferida. Estas quatro são telas reais do produto,
      // baixadas da própria home do Caderno de Erros e abertas uma a uma
      // antes de entrar aqui (regra 7 do AGENTS.md, aplicada a imagem).
      // O campo é editável no Studio ("Galeria do projeto"); um projeto sem
      // ele cai nas capas dos `subprojects`, e sem nenhum dos dois o bloco
      // não aparece.
      gallery: [
        {
          src: "https://framerusercontent.com/images/4mVd8cIXTAWMJcjRNnR9amYNGAw.png",
          alt: "Caderno de Erros home screen with study streak, daily goal and mastery levels",
          caption: "Home — streak, daily goal, and mastery levels",
        },
        {
          src: "https://framerusercontent.com/images/0Cd7SnzI0cVyId7kF0ZDBFvNI.png",
          alt: "The notebook screen, with the subject tree beside a rich-text editor",
          caption: "The notebook — subject tree and editor",
        },
        {
          src: "https://framerusercontent.com/images/4V0XVkH2RkvjjDelHIfX0ZnK0.png",
          alt: "Progress dashboard with study time, answer rate and a focus calendar",
          caption: "Progress — study time, accuracy, and focus",
        },
        {
          src: "https://framerusercontent.com/images/RIFaJsvpbtKaYUyn5BRWhZDo6E.png",
          alt: "Question card with answer options and a dropdown for tagging the cause of a mistake",
          caption: "Logging a mistake by its cause",
        },
      ],
      links: [["Live site", "https://www.cadernodeerros.com.br/"]],
    },
    "sphera-academy": {
      name: "Sphera Academy",
      role: "UX/UI + Design System",
      summary: "Interface craft for EdTech with academic clean style",
      preview: "https://framerusercontent.com/images/PgbsHlNgpSQclDuYYOPfMT6Zo.png",
      bio: "Design system and visual language for a university-admissions coaching platform, built around academic-university aesthetic — matching the credibility register that students and families already associate with the schools they're applying to. Designed the identity plus the core screens that set the system's components and tone (onboarding, home, class list/modules, classroom), then handed the file to the dev team to extend and trained a junior designer to take ownership of it. The client has used the identity and those first screens ever since; students describe the study environment as comfortable and immersive. The platform today documents dozens of admissions to schools including Duke, Cornell, and Columbia.",
      items: [
        "Visual language built around academic-university aesthetic to match the credibility register students expect — not generic edtech UI.",
        "Designed identity + core screens (onboarding, home, class list/modules, classroom) to set the system's components; dev team extended from there.",
        "Client has used the identity and those screens since launch; students describe the environment as comfortable and immersive.",
        "Mentored a junior designer into ownership of the file."
      ],
      links: [["Live site", "https://www.spheraacademy.com/"]],
    },
    "escola-da-bel": {
      name: "Escola da Bel",
      role: "Web + UX/UI + Visual Design · Aesthetics Education",
      summary: "Founding design for a medical-education company",
      preview: "https://framerusercontent.com/images/BP6trVJNYC4N4uySVf4sXwSvUA.jpg",
      bio: "Web design, UX/UI and visual communication for a Brazilian education brand in the aesthetics industry. I design and evolve the main website, landing pages, course and event pages, responsive interfaces and interactive experiences in Figma and Framer, collaborating with developers on frontend and product implementation. Built a Framer-based diagnostic quiz with a seven-course recommendation engine, Google Sheets webhook and iframe height sync, used as a lead-generation tool on the site. It generated around 600 leads at a single event with 1,500–2,000 attendees. Interactive work also includes a voting experience for the brand's reality show. Ongoing campaign work includes the Fresh Frozen Paris and Las Vegas series and a full anatomical illustration set for an educational atlas.",
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
    "cloudfaster-academy": {
      name: "CloudFaster Academy",
      role: "UX/UI + Identity + Website · Cloud/AWS training",
      summary: "Identity and website for AWS certification training",
      preview: "https://cloudfaster.academy/assets/og-image.png",
      bio: "Visual identity and website for an AWS certification training brand serving individual learners and corporate teams — built on solid UI/UX fundamentals for a straightforward certification-prep flow. The brand has since expanded to a mobile app and B2B plans, a later business decision outside this project's scope.",
      links: [["Live site", "https://cloudfaster.academy/"]],
    },
    dascia: {
      name: "DascIA",
      role: "UX/UI + Identity + Website · AI Education",
      summary: "Identity and website for an AI-education brand",
      bio: "Visual identity and website, via GOW Design, for an AI-education brand positioned against shallow 'AI in three clicks' courses — built to read as technical and credible.",
      items: ["Compressed, mixed-weight capital headline as the core brand device."],
      links: [["Live site", "https://dascia.com.br/"]],
    },
    "finq-edu": {
      name: "FinQ Edu",
      role: "UX/UI + Brand + Web & Mobile · IB/PE Education",
      summary: "Launch identity for an investment-banking prep brand",
      bio: "Visual identity, product interfaces and the initial website, at company launch, for an investment-banking/private-equity prep brand founded by people with real Wall Street backgrounds — built to give women a foothold in an IB/PE space that's highly competitive and visually closed off. Bet on gradients and vivid color, a deliberate break from every competitor's visual convention in the category. Designed the first website version, core flows, responsive interfaces and reusable components for the web platform and mobile app; the live site has evolved since.",
      items: [
        "Identity built to stand out for women in IB/PE — a category where competitor branding is uniformly conservative.",
        "Gradients and vivid color as a deliberate break from category convention.",
        "Designed the first website version and interfaces for the web platform and mobile app — the live site has evolved since."
      ],
      faviconFrom: "https://www.finqedu.com.br/",
      links: [
        ["App LP", "https://finqedu.webflow.io/"],
        ["Original site", "https://dev-finqedu.webflow.io/"],
      ],
    },
    "jlcp-tecnologia": {
      name: "JLCP Tecnologia",
      role: "Brand Identity + Positioning · IT Observability",
      summary: "Brand redesign for the #1 Zabbix partner in Brazil",
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
      bio: "A public learning and building project: a static HTML/CSS/JS portfolio with a Wiki, Changelog, shared design tokens, command search, glossary tooltips and a Storybook + visual-regression harness. I study React, modern CSS, interaction design, motion and component systems, and apply the learning directly to real interfaces. Design decisions, accessibility work, frontend architecture and technical experiments are documented as they ship.",
      items: [
        "Type and spacing measured against emilkowal.ski in a real browser — one size, two weights and a shared spacing scale.",
        "Shared OKLCH color tokens plus motion, spacing, typography and radius tokens keep the interface consistent.",
        "Motion stays interruptible; keyboard interactions preserve focus and support reduced motion.",
        "Storybook renders the production CSS; accessibility checks, browser interaction tests and visual regression checks help catch changes before release."
      ],
      links: [
        ["Site", "https://oktavio.vercel.app"],
        ["Repo", "https://github.com/oktavio-eng/design-engineer"],
        ["Changelog", "https://oktavio.vercel.app/changelog"],
      ],
    },
    prompts: {
      "name": "Pixel Office",
      "role": "Product · 2026",
      "bio": "A multiplayer virtual workspace I designed and built to explore how product design, interaction and engineering can come together in one system.",
      "items": [
        "Built as a real product: realtime presence, chat, calls, tasks, calendar, focus tools and multiplayer interactions",
        "Designed and implemented end to end, from interaction patterns and UI systems to React, Phaser and Supabase."
      ],
      "links": [
        [
          "Open",
          "https://gow-pixel-office.vercel.app/"
        ]
      ]
    },
    "gow-studio": {
      name: "GOW Design",
      role: "Studio · ongoing",
      bio: "The studio I've run since 2019 — UI/UX, visual design and brand systems, with a growing focus on implementation and design engineering.",
      links: [["Site", "https://gowdesign.framer.website/"]],
    },
  };

  const life = {
    brazil: {
      name: "Brazil, remote",
      role: "Where I work from",
      bio: "Currently based in Brazil, working remotely with international teams and open to relocating for the right product opportunity.",
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
      links: [
        [
          "The plan",
          "https://oktavio.vercel.app/wiki#people"
        ]
      ],
    },
  };

  // Writing — the doc-icon list (jakub.kr's row). Each entry opens in the
  // same modal as a project (title, summary, then the link to read it), so
  // clicking never leaves the page. Same shape as everything else, plus
  // `summary`: the row's second line, one short line (1–6 words is what
  // Emil/Jakub use; the text comes from the Figma `Article` instances on
  // Home). `bio` is the modal's paragraph only, `links` where the piece
  // lives.
  const writing = {
    plan: {
      name: "Design Engineer — a transition plan",
      role: "Writing · 2026",
      summary: "The plan itself: principle, phases, people, and what got discarded.",
      bio: "The plan itself: principle, phases, people, and what got discarded.",
      links: [
        [
          "Read",
          "/wiki"
        ]
      ],
    },
    changelog: {
      name: "Changelog, as a habit",
      role: "Writing · 2026",
      summary: "Written down as it ships.",
      bio: "Every change written down as it ships — building in public only counts if the record is public too.",
      links: [["Read", "/changelog"]],
    },
    prompts: {
      name: "Prompts used in real work",
      role: "Writing · 2026",
      summary: "Kept with the context that made them useful.",
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
    { src: "/Logo%20Black.svg", alt: "GOW Design mark", caption: "GOW Design", width: 44, height: 56 },
    { src: "/og.jpg", alt: "The plan page's share card", caption: "The plan, as a card", width: 1200, height: 628 },
  ];

  window.PORTFOLIO_CONTENT = { projects, personal, life, writing, gallery };
})();
