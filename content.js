/* ---------------------------------------------------------------------------
   Site content — the five collections the plan is built from (people, plan
   phases, craft references, courses, readings).

   Lives outside script.js so it can be shared: script.js renders the homepage
   from it, and cmd.mjs indexes it for the ⌘K palette on every page (index,
   /changelog, /prompts). Classic script, not a module, because script.js is a
   classic `defer` script and cannot `import` — the collections are published
   on `window.SITE_CONTENT` and read from there by both consumers. Load it
   before script.js and before cmd.mjs; both `defer` scripts and module scripts
   execute in document order once parsing ends, so a plain earlier <script>
   tag is enough.

   Prompts are not here: they live in prompts.mjs (an ES module the /prompts
   page owns) and cmd.mjs imports them from there.

   Wrapped in an IIFE on purpose: top-level `const` in a classic script lands
   in the global lexical scope shared by every classic script on the page, and
   script.js declares the same five names when it unpacks SITE_CONTENT — two
   declarations of `people` in that shared scope is a SyntaxError.
--------------------------------------------------------------------------- */
(function () {
const people = {
    rauno: {
      name: "Rauno Freiberg",
      role: "Staff Design Engineer, Vercel",
      bio: "Estonian, ex-Browser Company (Arc). Wrote the yardstick the whole community cites when talking about UI detail. His work is the canon's starting point.",
      links: [
        ["Site", "https://rauno.me"],
        ["Craft", "https://rauno.me/craft"],
        ["Web Interface Guidelines", "https://interfaces.rauno.me"],
        ["Devouring Details", "https://devouringdetails.com"],
        ["X", "https://x.com/raunofreiberg"],
        ["GitHub", "https://github.com/raunofreiberg"],
      ],
    },
    emil: {
      name: "Emil Kowalski",
      role: "Design Engineer, Linear · ex-Vercel",
      bio: "The most didactic of the group. Vaul and Sonner run in thousands of products. Writes about taste and judgment as trainable skills.",
      links: [
        ["Site", "https://emilkowal.ski"],
        ["Writing", "https://emilkowal.ski/ui"],
        ["Animations.dev", "https://animations.dev"],
        ["Vaul", "https://vaul.emilkowal.ski"],
        ["Sonner", "https://sonner.emilkowal.ski"],
        ["Skills (repo)", "https://github.com/emilkowalski/skills"],
        ["X", "https://x.com/emilkowalski_"],
      ],
    },
    jakub: {
      name: "Jakub Krehel",
      role: "Founding Design Engineer, Interfere · ex-OpenSea",
      bio: "Author of Interfaces, the monthly design engineering magazine. The better-ui and better-typography skills that generated this document are his.",
      links: [
        ["Site", "https://www.jakub.kr"],
        ["Interfaces", "https://interfaces.dev"],
        ["oklch.fyi", "https://www.oklch.fyi"],
        ["X", "https://x.com/jakubkrehel"],
        ["GitHub", "https://github.com/jakubkrehel"],
      ],
    },
    josh: {
      name: "Josh Puckett",
      role: "Co-founder, Iteration · ex-Dropbox",
      bio: "The closest to the studio path: design for early-stage founders. Interface Craft is his craft library, already purchased.",
      links: [
        ["Site", "https://joshpuckett.me"],
        ["Interface Craft", "https://www.interfacecraft.dev/library"],
        ["Iteration", "https://iteration.design"],
      ],
    },
    paco: {
      name: "Paco Coursey",
      role: "Design Engineer, Linear · ex-Vercel",
      bio: "Built Vercel's design system, site, and dashboard. His <span class='gloss' tabindex='0'>cmdk<span class='gloss-tip'>His library for building command menus (Cmd+K). Became the market standard.</span></span> became the market standard for command menus.",
      links: [
        ["Site", "https://paco.me"],
        ["cmdk", "https://cmdk.paco.me"],
        ["X", "https://x.com/pacocoursey"],
        ["GitHub", "https://github.com/pacocoursey"],
      ],
    },
    shadcn: {
      name: "shadcn",
      role: "Design Engineer, Vercel AI",
      bio: "Anonymous by choice. shadcn/ui redefined component distribution: copy-paste instead of an npm package. Co-created v0.",
      links: [
        ["Site", "https://shadcn.com"],
        ["shadcn/ui", "https://ui.shadcn.com"],
        ["v0", "https://v0.dev"],
        ["X", "https://x.com/shadcn"],
        ["GitHub", "https://github.com/shadcn"],
      ],
    },
    floguo: {
      name: "Flora Guo",
      role: "Founding Design Engineer, Paradigm · ex-Vercel",
      bio: "From Vercel's Design Engineering team in NY. Her Finder-style column site inspired this panel. Key phrase: material understanding beats tool proficiency.",
      links: [
        ["Site", "https://www.floguo.com"],
        ["Changelog", "https://www.floguo.com/changelog"],
        ["Curius", "https://curius.app/flora-guo"],
        ["X", "https://x.com/floguo"],
        ["GitHub", "https://github.com/floguo"],
      ],
    },
    raphael: {
      name: "Raphael Salaja",
      role: "Design Engineer, Warp",
      bio: "Works on the Warp terminal. Maintains userinterface.wiki and spoke at MIT about the rise of design engineering.",
      links: [
        ["Site", "https://www.raphaelsalaja.com"],
        ["userinterface.wiki", "https://userinterface.wiki"],
        ["Warp", "https://www.warp.dev"],
      ],
    },
    tcosta: {
      name: "Thiago Costa",
      role: "Co-founder and Principal Designer, Fey",
      bio: "Brazilian in Montreal. Left studio work (Narative) for his own product (Fey), sold to Wealthsimple in 2025. The closest reference to GOW's trajectory.",
      links: [
        ["Site", "https://tcosta.com"],
        ["Fey", "https://fey.com"],
        ["X", "https://x.com/tcosta"],
      ],
    },
    dmytro: {
      name: "Dmytro",
      role: "Design Engineer, Mintlify",
      bio: 'Created lucide-animated (350+ animated icons, MIT, 7.8k+ stars) and the Invisible Details course. His blog is a collection of "crafts": small projects, published one at a time. It\'s phase 02 of your plan in real execution.',
      links: [
        ["Site", "https://pqoqubbw.dev"],
        ["lucide-animated", "https://lucide-animated.com"],
        ["Invisible Details", "https://invisibledetails.com"],
        ["X", "https://x.com/pqoqubbw"],
        ["GitHub", "https://github.com/pqoqubbw"],
      ],
    },
    flo: {
      name: "Flo (Florian Höller)",
      role: "Solo founder, adfects · SaaS/AI",
      bio: "Solo studio for SaaS and AI startups: web, product, and social/ads, delivered in days, by one designer, direct. Delivers both Figma and working code. Flexible monthly retainer, not a fixed-scope project — the model closest to what GOW could become.",
      links: [
        ["Site", "https://www.adfects.com"],
        ["X", "https://x.com/growthflo"],
      ],
    },
    eve: {
      name: "Eve Bouffard",
      role: "Head of Design, Y Combinator",
      bio: 'Joined YC in 2022 reviewing over 10,000 startup applications. Now leads design and works across product, data, and operations. Coined "imagination engineering": exploring more ambitious product ideas now that AI has lowered the cost of prototyping.',
      links: [
        ["Site", "https://www.evebouffard.com"],
        ["X", "https://x.com/eve_bouff"],
        ["Y Combinator", "https://www.ycombinator.com"],
      ],
    },
    rasmus: {
      name: "Rasmus Andersson",
      role: "Designer/Engineer · creator of Inter",
      bio: "Designer/Engineer · creator of Inter",
      links: [["Site", "https://rsms.me"]],
    },
    levon: {
      name: "Levon Tutundzhian",
      role: "Craft Product Designer · Hamburg",
      bio: "Craft Product Designer · Hamburg",
      links: [["Site", "https://tutundzhian.com"]],
    },
    taras: {
      name: "Taras Migulko",
      role: "Product Designer, Shopify · micro-interactions",
      bio: "Product Designer, Shopify · micro-interactions",
      links: [["Site", "http://www.migulko.cz"]],
    },
    shivani: {
      name: "Shivani Matlapudi",
      role: "Product Designer · ex-CRED, frog · editorial UX",
      bio: "Product Designer · ex-CRED, frog · editorial UX",
      links: [["Site", "https://www.shivanimatlapudi.com"]],
    },
    lichin: {
      name: "Lichin Lin",
      role: "Design Engineer, GitHub Copilot · Figma plugins",
      bio: "Design Engineer, GitHub Copilot · Figma plugins",
      links: [["Site", "https://designtips.today"]],
    },
    danmarek: {
      name: "Dan Marek",
      role: "Product Designer · design lead at Spruce · web &amp; motion",
      bio: "Product Designer · design lead at Spruce · web &amp; motion",
      links: [["Site", "https://dan-marek.framer.website"]],
    },
    peterd: {
      name: "Peter Damrongpiriyapong",
      role: "Engineer, Figma · Sites, Slides, FigJam AI",
      bio: "Engineer, Figma · Sites, Slides, FigJam AI",
      links: [["Site", "https://www.peterdpong.com"]],
    },
    gabriel: {
      name: "Gabriel",
      role: "Design Engineer, Rava Labs · automotive HMI · ex-Porsche, Audi",
      bio: "Design Engineer, Rava Labs · automotive HMI · ex-Porsche, Audi",
      links: [["Site", "https://ravalabs.com"]],
    },
    zahra: {
      name: "Zahra Jabini",
      role: "Director of Design Engineering, Vercel",
      bio: "Director of Design Engineering, Vercel",
      links: [["LinkedIn", "https://www.linkedin.com/in/zahraj"]],
    },
    karenlou: {
      name: "Karen Lou",
      role: "Internet artist &amp; designer · ex-Browser Company, Figma",
      bio: "Internet artist &amp; designer · ex-Browser Company, Figma",
      links: [["Site", "https://karenlou.com"]],
    },
    lucasquan: {
      name: "Lucas Quan",
      role: "Founder, Hard Launch · launch &amp; growth design",
      bio: "Founder, Hard Launch · launch &amp; growth design",
      links: [["Site", "https://lucasquan.com"]],
    },
    hardlaunch: {
      name: "Hard Launch Company",
      role: "Launch design studio",
      bio: "Launch design studio",
      links: [["Site", "https://hardlaunchcompany.com"]],
    },
    arjun: {
      name: "Arjun Mahesh",
      role: "Head of Design, Hebbia · ex-Stripe · architect",
      bio: "Head of Design, Hebbia · ex-Stripe · architect",
      links: [["Site", "https://arjunmahesh.com"]],
    },
    oldfriends: {
      name: "Old Friends",
      role: "Engineering studio · custom sites for craft-driven teams",
      bio: "Engineering studio · custom sites for craft-driven teams",
      links: [["Site", "https://www.oldfriends.studio"]],
    },
    glennh: {
      name: "Glenn Hitchcock",
      role: "Creative Director, Poolside · ex-Vercel, Sketch · Index",
      bio: "Creative Director, Poolside · ex-Vercel, Sketch · Index",
      links: [["Site", "https://glenn.me"]],
    },
    alasdairm: {
      name: "Alasdair Monk",
      role: "Co-founder, Superlogical · ex-VP Design Vercel · founding Poolside",
      bio: "Co-founder, Superlogical · ex-VP Design Vercel · founding Poolside",
      links: [["Site", "https://www.alasdairmonk.com"]],
    },
    johnpham: {
      name: "John Pham",
      role: "Lead Design Engineer, Vercel · ex-SF Compute, Highlight",
      bio: "Lead Design Engineer, Vercel · ex-SF Compute, Highlight",
      links: [["Site", "https://pham.codes"]],
    },
    hectors: {
      name: "Hector Simpson",
      role: "Interface designer &amp; developer · ex-Vercel, Poolside · Sleeve",
      bio: "Interface designer &amp; developer · ex-Vercel, Poolside · Sleeve",
      links: [["Site", "https://hector.me"]],
    },
    janikb: {
      name: "Janik Baumgartner",
      role: "Icon designer · Sketch toolbar &amp; app icons",
      bio: "Icon designer · Sketch toolbar &amp; app icons",
      links: [["Site", "https://kinaj.com"]],
    },
    maria: {
      name: "María Zuil González",
      role: "Creative developer, Lyra Creative Studio · animation, 3D, shaders",
      bio: "Mathematician and computer scientist who brings web pages to life with bold animations and 3D experiences. Combines design and development into sites that balance aesthetics with functionality — currently playing with shaders to make sites actually fun to explore.",
      links: [
        ["Site", "https://lyra-creative-studio.com"],
        ["GitHub", "https://github.com/mZuil"],
      ],
    },
  },
  phases = {
    f1: {
      name: "Foundation",
      role: "Phase 01 · starts now",
      bio: "The goal isn't to consume everything, it's to calibrate the yardstick. One material at a time, always applied to that week's real work.",
      items: [
        "Study order: Rauno's Web Interface Guidelines first. It's short and turns into a checklist: audit one of your Caderno de Erros screens against it.",
        "Then Emil's texts on taste and judgment. One per week, applied to the active project.",
        "Jakub's 3 free issues of Interfaces give you a taste of the format before subscribing.",
        "Interface Craft is already yours: one practice from the library per week, not a marathon.",
        "Code: one component per week in plain React, outside Framer. Motion with <span class='gloss' tabindex='0'>springs<span class='gloss-tip'>Animation based on spring physics instead of fixed time curves. Feels more natural.</span></span>, <span class='gloss' tabindex='0'>OKLCH<span class='gloss-tip'>Perceptually uniform color space, more predictable than RGB/HSL for building palettes and adjusting tones.</span></span>, text-wrap. Small and polished beats big and shallow.",
      ],
      links: [
        ["Web Interface Guidelines", "https://interfaces.rauno.me"],
        ["Emil's writing", "https://emilkowal.ski/ui"],
        ["Interfaces' free issues", "https://interfaces.dev"],
        ["Interface Craft", "https://www.interfacecraft.dev/library"],
        ["Design Circuit", "https://designcircuit.co"],
      ],
    },
    f2: {
      name: "Public proof",
      role: "Phase 02 · the calling card",
      bio: "The whole group's rule: one small thing done extremely well is worth more than a big portfolio. Vaul is a drawer. Sonner is a toast. cmdk is a menu.",
      items: [
        "Natural candidate: pull a problem out of your Framer overrides and open it as a small, focused lib, with a flawless demo.",
        "Alternative: a technical write-up in English of a real system you built, with code and decisions.",
        "Personal site in the style you've already decoded: white, typographic, precise micro-interactions. This document is the prototype.",
        "Publish in public on X and GitHub from day one. Visible imperfect progress beats hidden perfection.",
        "Emil's skills repo shows how to package your own philosophy into a format others use. Study the structure, not just the content.",
      ],
      links: [
        ["Vaul, scope example", "https://vaul.emilkowal.ski"],
        ["cmdk, scope example", "https://cmdk.paco.me"],
        ["emilkowalski/skills", "https://github.com/emilkowalski/skills"],
        ["Flora's changelog, building in public", "https://www.floguo.com/changelog"],
      ],
    },
    f3: {
      name: "Positioning",
      role: "Phase 03 · how to sell yourself",
      bio: "Title changes the salary bracket. Design engineer gets evaluated against the engineering band, not the design one. You already deliver what the role asks for: production code with design judgment.",
      items: [
        "Apply as mid-level remote. Never junior: full <span class='gloss' tabindex='0'>handoff<span class='gloss-tip'>Handing off a design ready for implementation, with specs, assets, and behavior documented.</span></span>, API, a real squad, and production aren't a junior profile anywhere.",
        "Resume in English, starting from Lupa's resume: lead with what ran in production, not with mockups.",
        "Every application points to the phase 02 public proof, not to a PDF.",
        "Target: remote early-stage startups, where the design+code hybrid is worth more because one person covers two.",
        "The deng list shows where this category actually gets hired. Study the companies that show up there.",
        "Price benchmark: agencies like Blissful Studio sell design engineering as a standalone service, starting at $10K per fixed-scope project or $6K/month embedded. A market reference to calibrate your own rate.",
      ],
      links: [
        ["deng.theedgar.dev", "https://deng.theedgar.dev"],
        ["Wellfound, startup jobs", "https://wellfound.com"],
        ["Blissful Studio, price benchmark", "https://blissful-studio.com/"],
      ],
    },
    f4: {
      name: "Inside the company",
      role: "Phase 04 · accelerate through proximity",
      bio: "Mentorship doesn't come from a title, it comes from actively hunting for it. The group's pattern: everyone got good near better people, contributing in public.",
      items: [
        "First week: map out who the most accessible senior design engineer is and ask for a recurring pair session.",
        "Ask for code review as routine, not as exception. It's the cheapest, densest feedback there is.",
        "Contribute to the canon's repos: open issues on shadcn/ui, cmdk, Vaul. Small, well-made <span class='gloss' tabindex='0'>PRs<span class='gloss-tip'>Pull requests: proposed code changes submitted for review before entering the project.</span></span> are real networking.",
        "Presence on X: comment with substance on what the group publishes. That's how this market notices people, far more than LinkedIn.",
        "Earn in dollars, stay in Brazil. Relocation remains plan B, decided by life, not by career.",
      ],
      links: [
        ["shadcn/ui issues", "https://github.com/shadcn-ui/ui/issues"],
        ["cmdk issues", "https://github.com/pacocoursey/cmdk/issues"],
        ["Vaul issues", "https://github.com/emilkowalski/vaul/issues"],
      ],
    },
  },
  refs = {
    mistral: {
      name: "Mistral AI",
      role: "mistral.ai · site by Brightscout",
      bio: "A deliberate counterpoint to the Vercel canon: identity rooted in pixel art, old-computing nostalgia applied to frontier AI, with product-level polish. Brightscout came in as an embedded partner to bring the pixel-perfect aesthetic to the site, a modular design system, and motion. Proof that high-level craft isn't synonymous with typographic minimalism.",
      links: [
        ["Site", "https://mistral.ai"],
        ["Brightscout's case study", "https://www.brightscout.com/work/mistral"],
        ["Brightscout", "https://www.brightscout.com"],
      ],
    },
    heyiamdk: {
      name: "Dominik Kandravý",
      role: "heyiam.dk · designer at Schema · Monocle for macOS",
      bio: "The exact intersection of design-engineer aesthetics with heavy motion and Apple-style language: large-scale display typography with per-character entrance animation, prototype videos as primary content instead of screenshots, materials and blur straight out of macOS's vocabulary. The site is built in Framer, so every detail is replicable in the stack you already know. And he built Monocle, a paid macOS app that reached #2 on Product Hunt, without knowing how to code: a year spent reviewing every line the AI suggested. It's phase 02 of your plan taken a different way — your own product instead of a lib.",
      links: [
        ["Site", "https://www.heyiam.dk"],
        ["Monocle", "https://www.heyiam.dk/monocle"],
        ["How he built Monocle", "https://www.heyiam.dk/monocle/about"],
        ["X", "https://x.com/heyiamdk"],
        ["Play, prototyping tool", "https://createwithplay.com"],
      ],
    },
    halaska: {
      name: "Chris Halaska",
      role: "halaskastudio.com · product designer, ex-Google",
      bio: "Twenty years of product design, six of them at Google — he joined as the sole UX designer leading a team of 16 engineers, and was flying to India to run user interviews by his second week. Now runs Halaska Studio, an independent studio working with funded founders, with partnerships listed publicly from $8,000/month. That last part is the useful bit: it's the same solo-studio-to-product path as Thiago Costa and Josh Puckett, but with the price tag out in the open — a second data point next to the Blissful Studio benchmark in phase 03.",
      links: [
        ["X", "https://x.com/chalaska"],
        ["Halaska Studio", "https://halaskastudio.com"],
        ["Personal site", "https://chrishalaska.com"],
      ],
    },
    barashkov: {
      name: "Alex Barashkov",
      role: "pixelpoint.io · design engineer, founder of Pixel Point",
      bio: "Runs Pixel Point, a brand and design studio for tech companies, and calls himself a design engineer rather than a designer. The client story is the part worth studying: they started with Neon on day one in 2021, before the product had launched, stayed through the Series B, and were still there for the 1B dollar acquisition by Databricks in 2025 — which then made Databricks a client too. He also built Toolcraft, an open-source starter kit and UI library for building custom design tools with AI. That is phase 02 at studio scale: the lib is free, public, and does the selling.",
      links: [
        ["Pixel Point", "https://pixelpoint.io"],
        ["Toolcraft", "https://toolcraft.sh"],
        ["Case studies", "https://pixelpoint.io/case-studies/"],
        ["X", "https://x.com/alex_barashkov"],
        ["GitHub", "https://github.com/pixel-point"],
      ],
    },
    jenkins: {
      name: "Jordan Jenkins",
      role: "jkane.co · independent brand studio, Wales",
      bio: "Ten years of brand identity work for clients from Google and Walmart to Snapchat, run solo as Jkane. He is the deliberate counterpoint to the rest of this list: no libs, no code, pure identity and art direction — and the closest reference to what GOW already does today. Worth studying for the portfolio site itself, which is loud where this document is quiet: bold type, saturated colour, and a smiley-face cursor that reacts to anything clickable. Proof that craft is not one aesthetic.",
      links: [
        ["Site", "https://www.jkane.co"],
        ["Behance", "https://www.behance.net/JordKane"],
        ["Dribbble", "https://dribbble.com/jkane"],
        ["X", "https://x.com/jkane"],
      ],
    },
    nevflynn: {
      name: "Nev Flynn",
      role: "Leading Design at ElevenLabs · ex-Evervault",
      bio: "Leads design at ElevenLabs, and got there without a design degree — his is in Mechanical Engineering from University College Dublin. Before that he was Head of Product and design engineer at Evervault, where the work he is known for lives: a hero built from a 3D model of the logo rendered as encrypted text, and product pages that let animation carry the explanation instead of copy. He also co-founded Recroot, a video hiring platform acquired in 2023. The clearest proof in this list of the principle at the top of this page.",
      links: [
        ["Site", "https://nevflynn.com"],
        ["X", "https://x.com/NevFlynn"],
        ["GitHub", "https://github.com/nevflynn"],
        ["ElevenLabs", "https://elevenlabs.io"],
      ],
    },
    ceborski: {
      name: "Jarek Ceborski",
      role: "cebor.ski · designer and engineer, Wrocław",
      bio: "Describes himself in three words on his own site: designer and engineer. A decade and 15+ digital products for other people, and then the part that matters here — he started shipping his own. LocalCan and Kerlig are paid Mac products; webhook.cool and journal.do are free. His degree is in Architecture and Urban Planning. The LocalCan origin story is the most copyable method on this whole page: he had the idea from his own frustration, ran a poll on X to check anyone else cared, designed a single screen in Figma on a rainy holiday, and put up a pre-order page before writing the product. Validate, then build.",
      links: [
        ["Site", "https://cebor.ski"],
        ["LocalCan", "https://www.localcan.com"],
        ["Kerlig", "https://www.kerlig.com"],
        ["webhook.cool", "https://webhook.cool"],
        ["YouTube", "https://www.youtube.com/@jarekceborski"],
      ],
    },
    jace: {
      name: "Jace",
      role: "Designer, Figma-native · apps, browsers, plugins, icons · ex-Browser Company",
      bio: "Designer, Figma-native · apps, browsers, plugins, icons · ex-Browser Company",
      links: [["Site", "https://ja.mt"]],
    },
    jacobsargent: {
      name: "Jacob Sargent",
      role: "Design engineer, London · full-stack + product · CompaniesBoard",
      bio: "Design engineer, London · full-stack + product · CompaniesBoard",
      links: [["Site", "https://jacobsargent.co.uk"]],
    },
    nikhilr: {
      name: "Nikhil Rajpurohit",
      role: "Software engineer, Pune · full-stack + AI · nmemo, Zellr",
      bio: "Software engineer, Pune · full-stack + AI · nmemo, Zellr",
      links: [["Site", "https://nikhilwho.in"]],
    },
  },
  courses = {
    interfacecraft: {
      name: "Interface Craft",
      role: "Josh Puckett · Bought",
      bio: "A library of product craft practices, written by someone who's run a studio for early-stage founders.",
      links: [["Open", "https://www.interfacecraft.dev/library"]],
    },
    interfaces: {
      name: "Interfaces",
      role: "Jakub Krehel · monthly magazine · Evaluate",
      bio: "Technical publication on design engineering. The better-ui and better-typography skills come from the same author.",
      links: [["Open", "https://interfaces.dev"]],
    },
    devouring: {
      name: "Devouring Details",
      role: "Rauno · interaction design · Evaluate",
      bio: "An interaction design manual with 23 chapters and interactive React components.",
      links: [["Open", "https://devouringdetails.com"]],
    },
    animations: {
      name: "Animations.dev",
      role: "Emil Kowalski · motion · Evaluate",
      bio: "A motion course directly applicable in Framer: timing, easing, springs.",
      links: [["Open", "https://animations.dev"]],
    },
    designcircuit: {
      name: "Design Circuit",
      role: "BR mentorship · In progress",
      bio: "Brazilian mentorship, good for calibrating how to sell yourself and interview for the international market.",
      links: [["Open", "https://designcircuit.co"]],
    },
    invisibledetails: {
      name: "Invisible Details",
      role: "Dmytro · timing, states, feedback · Evaluate",
      bio: "A course on the hard-to-explain part: timing, states, feedback, the weight of a click. Same author as lucide-animated.",
      links: [["Open", "https://invisibledetails.com"]],
    },
    indexcourse: {
      name: "Index",
      role: "Emil Kowalski &amp; Glenn Hitchcock · UI craft education · Evaluate",
      bio: "A UI craft education platform from Emil Kowalski and Glenn Hitchcock, launching fall 2026.",
      links: [["Open", "https://index.how"]],
    },
  },
  readings = {
    wig: {
      name: "Web Interface Guidelines",
      role: "Rauno",
      bio: "The community's most-cited UI detail yardstick. The canon's starting point.",
      links: [["Open", "https://interfaces.rauno.me"]],
    },
    emilwriting: {
      name: "Emil's writing",
      role: "taste, animation, judgment",
      bio: "Texts on how to train judgment and taste as skills, not innate talent.",
      links: [["Open", "https://emilkowal.ski/ui"]],
    },
    skills: {
      name: "emilkowalski/skills",
      role: "his philosophy as agent skills",
      bio: "Emil's design engineering philosophy packaged into a format AI agents can use.",
      links: [["Open", "https://github.com/emilkowalski/skills"]],
    },
    oklch: {
      name: "oklch.fyi",
      role: "Jakub · color tool",
      bio: "A tool for converting and adjusting color in OKLCH, the color space used in this document.",
      links: [["Open", "https://www.oklch.fyi"]],
    },
    deng: {
      name: "deng.theedgar.dev",
      role: "the original design engineers list",
      bio: "The curation that gave rise to this entire document.",
      links: [["Open", "https://deng.theedgar.dev"]],
    },
  };
window.SITE_CONTENT = { people: people, phases: phases, refs: refs, courses: courses, readings: readings };
})();
