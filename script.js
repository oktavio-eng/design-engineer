/* ---------------------------------------------------------------------------
   Favicon fallback for external reference links.
   Cascade: Google favicon service -> DuckDuckGo -> the origin's own /favicon.ico
   -> remove the <img> entirely. Never leave a broken icon or a reserved gap:
   when every source fails the element goes away and the text flows to the edge.

   This file is loaded with `defer`, so an <img onerror> can fire before this
   function is defined. `sweepFavicons()` below re-runs the cascade on any icon
   that already failed by the time the script executes.
--------------------------------------------------------------------------- */
window.favFallback = function (img) {
  const domain = (img.getAttribute("data-domain") || "").replace(/^www\./, "");
  const step = parseInt(img.getAttribute("data-step") || "0", 10);
  const sources = [
    "https://icons.duckduckgo.com/ip3/" + domain + ".ico",
    "https://" + domain + "/favicon.ico",
  ];
  if (domain && step < sources.length) {
    img.setAttribute("data-step", String(step + 1));
    img.src = sources[step];
    return;
  }
  img.onerror = null;
  img.remove();
};

function sweepFavicons() {
  document.querySelectorAll("img.fav[data-domain]").forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) window.favFallback(img);
  });
}
sweepFavicons();

/* ---------------------------------------------------------------------------
   Intro — the "hello screensaver".

   Greets in six languages — one cut per --intro-step, no fade between them,
   the way Apple's setup greeting reads — then dissolves the last word into the
   mark and hands the page over. Every duration is read back out of
   tokens/motion.css so the schedule here and the transitions in main.css can
   never drift apart. Runs once per tab session (sessionStorage), not once
   per visit — see the SESSION_KEY block below.

   Three rules the sequence has to keep:
   - It is interruptible. Any deliberate input ends it on the spot.
   - It cannot trap the page. `.intro-playing` comes off <html> on every exit
     path — finished, skipped, already seen this session, or refused for
     reduced motion.
   - No held state is free. Every pause (the per-word step, the mark's beat
     before the dissolve) is a deliberate number that adds to the total; when
     the total needs to move, that's the first place to look.

   This block sits at the top of the file on purpose: it is the first thing the
   page does, so it runs before the rest of the script is even parsed.
--------------------------------------------------------------------------- */
(function () {
  const root = document.documentElement;
  const intro = document.getElementById("intro");
  if (!intro) return;

  // Latin scripts ride on Geist; the rest fall through to system-ui, which
  // carries CJK on every platform we target.
  const GREETINGS = [
    "Hola",
    "Bonjour",
    "Olá",
    "こんにちは",
    "你好",
    "Hello",
  ];

  const word = document.getElementById("intro-word");
  const text = document.getElementById("intro-text");
  const mark = document.getElementById("intro-mark");

  // Chrome/Firefox hold a `defer` script until stylesheets queued earlier in
  // <head> have applied, so `main.css` is always in by the time this runs.
  // Safari doesn't make that guarantee: it can run this script before
  // `main.css` lands, and every --intro-* read below then comes back empty.
  // `parseFloat("") || 0` turns that into a 0ms duration for the whole
  // sequence, which finishes in a handful of same-tick timeouts — the intro
  // "runs" in under a millisecond and never paints a frame.
  // A `link.sheet` / `load` check isn't enough to guard against this: in
  // Safari `link.sheet` can go non-null before the sheet's rules are actually
  // folded into computed style, so it reports ready one frame too early.
  // Poll the token itself instead — the one thing that's true exactly when
  // reading it will work — capped so a stylesheet that genuinely never loads
  // can't hang the intro forever.
  let tokenWait = 0;
  (function waitForTokens() {
    const ready = getComputedStyle(root).getPropertyValue("--intro-fade").trim() !== "";
    if (ready || ++tokenWait > 60) {
      start();
      return;
    }
    requestAnimationFrame(waitForTokens);
  })();

  function start() {
    const tokens = getComputedStyle(root);
    const ms = function (name) {
      return parseFloat(tokens.getPropertyValue(name)) || 0;
    };
    const STEP = ms("--intro-step");
    const HOLD_LAST = ms("--intro-hold-last");
    const FADE = ms("--intro-fade");
    const REVEAL = ms("--intro-reveal");
    const MARK_HOLD = ms("--intro-mark-hold");
    const OUT = ms("--intro-out");

    // Once per tab session, not per visit: sessionStorage (not the
    // localStorage the rest of the site uses for real persistence) is the
    // correct tool here — a reload five minutes later shouldn't replay a
    // 7s greeting, but a fresh tab should. Documented as a deliberate
    // exception in AGENTS.md. Same swallow-the-exception shape as the
    // localStorage helpers below (readStored/writeStored): persistence here
    // is a nicety, never a requirement.
    const SESSION_KEY = "intro-shown-v1";
    function seenIntro() {
      try {
        return sessionStorage.getItem(SESSION_KEY) === "1";
      } catch (e) {
        return false;
      }
    }
    function markIntroSeen() {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch (e) {}
    }

    const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchmove"];
    const SKIP_OPTS = { capture: true, passive: true };
    let timer = null;
    let ended = false;

    function end(skipped) {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      SKIP_EVENTS.forEach(function (type) {
        window.removeEventListener(type, skip, SKIP_OPTS);
      });
      if (skipped) root.classList.add("intro-skipped");
      // `intro-done` fades the overlay out and releases the content stagger in
      // the same frame, so the page arrives as the greeting leaves.
      root.classList.add("intro-done");
      setTimeout(function () {
        root.classList.remove("intro-playing", "intro-done", "intro-skipped");
        intro.remove();
      }, skipped ? FADE : OUT);
    }

    function skip() {
      end(true);
    }

    // All six greetings go into the DOM up front, stacked in one grid cell (see
    // `.intro__langs` in main.css). Swapping is then a class toggle between two
    // elements that are already laid out — no text measurement, no reflow, and
    // nothing for the bullet to shift against on a cut.
    const slots = GREETINGS.map(function (greeting) {
      const span = document.createElement("span");
      span.className = "intro__lang";
      span.textContent = greeting;
      text.appendChild(span);
      return span;
    });

    function step(i) {
      if (i >= slots.length) {
        // The one dissolve in the sequence: the last greeting fades out, then the
        // mark fades in. `.dissolve` is what gives the row a transition at all, so the
        // opacity-1 state has to be flushed under it before `visible` comes off —
        // set both in the same frame and the browser sees a single computed
        // change with no "before" to animate from, i.e. another cut.
        word.classList.add("dissolve");
        void word.offsetWidth;
        word.classList.remove("visible");
        timer = setTimeout(function () {
          mark.classList.add("visible");
          timer = setTimeout(function () {
            end(false);
          }, REVEAL + MARK_HOLD);
        }, FADE);
        return;
      }
      if (i > 0) slots[i - 1].classList.remove("on");
      slots[i].classList.add("on");
      // The row itself only cuts in once, under the first word. After that it
      // stays put and the languages swap inside it.
      if (i === 0) word.classList.add("visible");
      // "Hello" is where the shuffle lands, so it holds --intro-hold-last longer
      // than the words it just ran through.
      const hold = i === slots.length - 1 ? STEP + HOLD_LAST : STEP;
      timer = setTimeout(function () {
        step(i + 1);
      }, hold);
    }

    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if ((still && still.matches) || seenIntro()) {
      root.classList.remove("intro-playing");
      intro.remove();
      return;
    }

    markIntroSeen();
    SKIP_EVENTS.forEach(function (type) {
      window.addEventListener(type, skip, SKIP_OPTS);
    });
    step(0);
  }
})();

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
  },
  panel = document.getElementById("panel"),
  panelWash = document.getElementById("panelWash"),
  content = document.getElementById("panelContent"),
  closeBtn = document.getElementById("panelClose"),
  rows = document.querySelectorAll(".people .row");
let activeRow = null;
const PANEL_W_KEY = "panel-width",
  PANEL_W_MIN = 300;

/* localStorage throws instead of returning null in a few real cases (Safari
   private mode, blocked third-party storage, quota). Persistence is a nicety
   here, so both helpers swallow the failure and the UI carries on. */
function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

/* ---------------------------------------------------------------------------
   Dark mode toggle. The theme itself is already applied to <html> by the
   inline script at the top of <head> before this file even downloads (that's
   what avoids a light-mode flash on load) — all this does is sync the
   button's icon to whatever was already decided, flip + persist an explicit
   choice on click, and keep following the OS theme live for anyone who
   hasn't clicked the toggle yet. Key is plain "theme" (not versioned like
   plan-comments-v2): the value space is just "dark"/"light"/absent, nothing
   to migrate.

   Two sources can set the theme, and they rank in this order:
   1. An explicit click — stored, and wins forever after (until clicked
      again).
   2. The OS preference — read once by the inline head script on load, and
      then tracked live here via matchMedia's `change` event, so switching
      the system theme while the tab is open (or between visits, before ever
      touching the toggle) moves the page without a reload.
   `getStoredTheme()` returning non-null is what tells the two apart: it's
   only ever written by the click handler below.
--------------------------------------------------------------------------- */
const THEME_KEY = "theme",
  themeTrigger = document.getElementById("themeTrigger"),
  themeMedia = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
function getStoredTheme() {
  return readStored(THEME_KEY);
}
function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
function applyTheme(theme) {
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  if (themeTrigger) themeTrigger.setAttribute("data-mode", theme);
}
if (themeTrigger) {
  themeTrigger.setAttribute("data-mode", currentTheme());
  themeTrigger.addEventListener("click", function () {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    writeStored(THEME_KEY, next);
  });
}
if (themeMedia) {
  const followSystemTheme = function (e) {
    if (getStoredTheme()) return; // an explicit click already overrode this
    applyTheme(e.matches ? "dark" : "light");
  };
  // `addEventListener` on a MediaQueryList is unsupported in Safari <14;
  // `addListener` is its deprecated-but-still-there predecessor there.
  if (themeMedia.addEventListener) themeMedia.addEventListener("change", followSystemTheme);
  else if (themeMedia.addListener) themeMedia.addListener(followSystemTheme);
}

function panelWMax() {
  return Math.min(640, window.innerWidth - 80);
}
function setPanelWidth(e, t) {
  const n = Math.max(PANEL_W_MIN, Math.min(panelWMax(), e));
  document.documentElement.style.setProperty("--panel-w", n + "px");
  if (t) writeStored(PANEL_W_KEY, String(n));
}
function loadPanelWidth() {
  const stored = readStored(PANEL_W_KEY);
  if (stored) setPanelWidth(parseInt(stored, 10), !1);
}
loadPanelWidth();
const panelResize = document.getElementById("panelResize");
let dragging = !1,
  dragStartX = 0,
  dragStartW = 0;
function endDrag() {
  dragging &&
    ((dragging = !1),
    panel.classList.remove("resizing", "resize-hint"),
    document.body.classList.remove("resizing"),
    setPanelWidth(
      parseInt(getComputedStyle(document.documentElement).getPropertyValue("--panel-w"), 10),
      !0,
    ));
}
function favicon(e) {
  let t = "";
  try {
    t = new URL(e).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
  return (
    '<img class="fav" data-domain="' +
    t +
    '" onerror="favFallback(this)" src="https://www.google.com/s2/favicons?sz=64&domain=' +
    t +
    '" alt="" loading="lazy">'
  );
}
function esc(e) {
  return e
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function itemHtml(e, t, n) {
  const a = e + "-" + t;
  let o = '<p class="item" data-c="' + a + '">' + n + '<span class="c-add">comment</span>';
  return (
    comments[a] && (o += '<span class="c-link"><a href="#">' + esc(comments[a]) + "</a></span>"),
    o + "</p>"
  );
}
function noteBlock(e) {
  return (
    '<div class="note-row p-stagger" data-c="' +
    e +
    '">' +
    (comments[e]
      ? '<a href="#" class="note-open">' + esc(comments[e]) + "</a>"
      : '<a href="#" class="note-open note-empty">add a note</a>') +
    "</div>"
  );
}
panelResize.addEventListener("mouseenter", function () {
  panel.classList.add("resize-hint");
}),
  panelResize.addEventListener("mouseleave", function () {
    dragging || panel.classList.remove("resize-hint");
  }),
  panelResize.addEventListener("pointerdown", function (e) {
    (dragging = !0),
      (dragStartX = e.clientX),
      (dragStartW = panel.getBoundingClientRect().width),
      panel.classList.add("resizing"),
      document.body.classList.add("resizing"),
      panelResize.setPointerCapture(e.pointerId);
  }),
  panelResize.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    const t = dragStartX - e.clientX;
    setPanelWidth(dragStartW + t, !1);
  }),
  panelResize.addEventListener("pointerup", endDrag),
  panelResize.addEventListener("pointercancel", endDrag);
let currentNoteCid = null,
  currentNoteLabel = "";
function render(e, t, n) {
  (currentNoteCid = n || null), (currentNoteLabel = e.name);
  let a =
    '<div class="p-stagger"><h3>' +
    e.name +
    '</h3><p class="role">' +
    e.role +
    '</p></div><p class="bio p-stagger">' +
    e.bio +
    "</p>";
  e.items &&
    (a +=
      '<span class="label p-stagger">In practice</span><div class="p-stagger">' +
      e.items
        .map(function (e, n) {
          return itemHtml(t, n, e);
        })
        .join("") +
      "</div>"),
    n && (a += noteBlock(n)),
    (a +=
      '<span class="label p-stagger">Links</span><div class="p-stagger">' +
      e.links
        .map(function (e) {
          return (
            '<div class="row"><span class="who">' +
            favicon(e[1]) +
            '<a href="' +
            e[1] +
            '" target="_blank" rel="noopener">' +
            e[0] +
            "</a></span></div>"
          );
        })
        .join("") +
      "</div>"),
    (content.innerHTML = a);
}
let currentPhaseId = null,
  currentKind = null,
  currentIndex = -1;
const lists = {
  people: {
    els: Array.from(rows),
    get: function (e) {
      return people[e.dataset.person];
    },
    idAttr: "person",
  },
  phase: {
    els: Array.from(document.querySelectorAll(".phase")),
    get: function (e) {
      return phases[e.dataset.phase];
    },
  },
  ref: {
    els: Array.from(document.querySelectorAll("[data-ref]")),
    get: function (e) {
      return refs[e.dataset.ref];
    },
    idAttr: "ref",
  },
  course: {
    els: Array.from(document.querySelectorAll("[data-course]")),
    get: function (e) {
      return courses[e.dataset.course];
    },
    idAttr: "course",
  },
  reading: {
    els: Array.from(document.querySelectorAll("[data-reading]")),
    get: function (e) {
      return readings[e.dataset.reading];
    },
    idAttr: "reading",
  },
};
/* Which surface a kind opens in. Only "The plan" (phases) keeps the sidebar;
   people, refs, courses and readings open as a centered modal. Same #panel
   element, same render(): body.panel-modal just restyles it (see main.css). */
const MODAL_KINDS = { people: 1, ref: 1, course: 1, reading: 1 };
function setPanelMode(kind) {
  const wantModal = !!MODAL_KINDS[kind],
    body = document.body,
    isModal = body.classList.contains("panel-modal");
  if (wantModal === isModal) return;
  /* Swapping surface while open: reset without transition so the panel
     re-enters in the new mode instead of morphing sidebar <-> modal. */
  if (body.classList.contains("panel-open")) {
    panel.classList.add("no-transition"),
      body.classList.remove("panel-open"),
      body.classList.toggle("panel-modal", wantModal),
      void panel.offsetWidth,
      panel.classList.remove("no-transition");
  } else body.classList.toggle("panel-modal", wantModal);
}
function open(e, t, n, a) {
  (currentPhaseId = n || null),
    closeComment(),
    closeAvatar(),
    closeMail(),
    render(e, n, a),
    setPanelMode(currentKind),
    document.body.classList.add("panel-open"),
    panelWash.setAttribute("aria-hidden", MODAL_KINDS[currentKind] ? "false" : "true"),
    panel.setAttribute("aria-hidden", "false"),
    (panel.scrollTop = 0),
    activeRow && activeRow.classList.remove("active"),
    (activeRow = t),
    t.classList.add("active");
}
function openAt(e, t) {
  const n = lists[e];
  if (!n || t < 0 || t >= n.els.length) return;
  const a = n.els[t],
    o = n.get(a),
    s = "phase" === e ? a.dataset.phase : null,
    i = n.idAttr ? e + ":" + a.dataset[n.idAttr] : null;
  (currentKind = e), (currentIndex = t), open(o, a, s, i);
}
function close() {
  document.body.classList.remove("panel-open"),
    panel.setAttribute("aria-hidden", "true"),
    panelWash.setAttribute("aria-hidden", "true"),
    activeRow && activeRow.classList.remove("active"),
    (activeRow = null),
    (currentPhaseId = null),
    (currentKind = null),
    (currentIndex = -1),
    (currentNoteCid = null),
    closeComment();
}
rows.forEach(function (e, t) {
  e.addEventListener("click", function () {
    activeRow !== e ? openAt("people", t) : close();
  }),
    e.querySelector("a").addEventListener("click", function (n) {
      n.metaKey ||
        n.ctrlKey ||
        n.shiftKey ||
        1 === n.button ||
        (n.preventDefault(), n.stopPropagation(), activeRow !== e ? openAt("people", t) : close());
    });
});
function wireSeeMore(sectionId) {
  const section = document.getElementById(sectionId),
    seeMore = document.getElementById(sectionId + "SeeMore");
  if (!section || !seeMore) return;
  seeMore.addEventListener("click", function () {
    const e = section.classList.toggle("expanded");
    seeMore.textContent = e ? "show less" : "show more";
    seeMore.setAttribute("aria-expanded", e ? "true" : "false");
  });
}
["people", "courses", "references"].forEach(wireSeeMore);
lists.phase.els.forEach(function (e, t) {
  e.querySelector(".phase-head").addEventListener("click", function () {
    activeRow !== e ? openAt("phase", t) : close();
  });
}),
  ["ref", "course", "reading"].forEach(function (e) {
    lists[e].els.forEach(function (t, n) {
      t.addEventListener("click", function () {
        activeRow !== t ? openAt(e, n) : close();
      }),
        t.querySelector("a").addEventListener("click", function (a) {
          a.metaKey ||
            a.ctrlKey ||
            a.shiftKey ||
            1 === a.button ||
            (a.preventDefault(), a.stopPropagation(), activeRow !== t ? openAt(e, n) : close());
        });
    });
  });
const nvLinks = document.querySelectorAll(".topbar__nav a"),
  nvMap = {};
nvLinks.forEach(function (e) {
  const t = e.getAttribute("href");
  // Only in-page anchors get scroll-spy; cross-page links (e.g. /changelog)
  // stay out of the map so they never claim an "on" state.
  "#" === t.charAt(0) && (nvMap[t.slice(1)] = e);
});
const nvIO = new IntersectionObserver(
  function (e) {
    e.forEach(function (e) {
      if (!e.isIntersecting) return;
      nvLinks.forEach(function (e) {
        e.classList.remove("on");
      });
      const t = nvMap[e.target.id];
      t && t.classList.add("on");
    });
  },
  { rootMargin: "-15% 0px -70% 0px" },
);
Object.keys(nvMap).forEach(function (e) {
  const t = document.getElementById(e);
  t && nvIO.observe(t);
});
const topbar = document.querySelector(".topbar"),
  NAV_IDLE_MS = 1200;
let navIdleTimer = null,
  navHovering = !1;
function scheduleNavIdle() {
  clearTimeout(navIdleTimer),
    navHovering ||
      (navIdleTimer = setTimeout(function () {
        topbar.classList.remove("visible"), topbar.setAttribute("aria-hidden", "true");
      }, 1200));
}
function showNav() {
  topbar.classList.add("visible"), topbar.setAttribute("aria-hidden", "false"), scheduleNavIdle();
}
window.addEventListener("scroll", showNav, { passive: !0 }),
  topbar.addEventListener("mouseenter", function () {
    (navHovering = !0),
      clearTimeout(navIdleTimer),
      topbar.classList.add("visible"),
      topbar.setAttribute("aria-hidden", "false");
  }),
  topbar.addEventListener("mouseleave", function () {
    (navHovering = !1), scheduleNavIdle();
  }),
  closeBtn.addEventListener("click", close),
  panelWash.addEventListener("click", close),
  document.addEventListener("keydown", function (e) {
    if ("Escape" === e.key) return void close();
    const t = (e.target && e.target.tagName) || "";
    if (
      "TEXTAREA" !== t &&
      "INPUT" !== t &&
      e.shiftKey &&
      ("ArrowDown" === e.key || "ArrowUp" === e.key) &&
      document.body.classList.contains("panel-open") &&
      !document.body.classList.contains("cpanel-open") &&
      currentKind
    ) {
      e.preventDefault();
      const t = lists[currentKind].els.length;
      let n = currentIndex + ("ArrowDown" === e.key ? 1 : -1);
      n < 0 && (n = t - 1), n >= t && (n = 0), openAt(currentKind, n);
    }
  }),
  document.addEventListener("click", function (e) {
    document.body.classList.contains("panel-open") &&
      (panel.contains(e.target) ||
        cpanel.contains(e.target) ||
        e.target.closest(".people .row") ||
        e.target.closest("[data-ref]") ||
        e.target.closest("[data-course]") ||
        e.target.closest("[data-reading]") ||
        e.target.closest(".phase-head") ||
        e.target.closest(".c-add") ||
        e.target.closest(".c-link") ||
        close());
  });
const cpanel = document.getElementById("cpanel"),
  cContent = document.getElementById("cpanelContent"),
  cClose = document.getElementById("cpanelClose"),
  STORAGE_KEY = "plan-comments-v2";
let comments = {},
  activeCommentId = null;
function loadComments() {
  const raw = readStored(STORAGE_KEY);
  if (raw) {
    try {
      comments = JSON.parse(raw);
    } catch (e) {
      // Corrupt payload: start clean rather than leaving the panel wedged.
      comments = {};
    }
  }
  currentPhaseId && refreshPanelComments();
}
function persistComments() {
  writeStored(STORAGE_KEY, JSON.stringify(comments));
}
function refreshPanelComments() {
  content.querySelectorAll(".item[data-c]").forEach(function (e) {
    const t = e.dataset.c,
      n = e.querySelector(".c-link");
    if ((n && n.remove(), comments[t])) {
      const n = document.createElement("span");
      n.className = "c-link";
      const a = document.createElement("a");
      (a.href = "#"), (a.textContent = comments[t]), n.appendChild(a), e.appendChild(n);
    }
  }),
    content.querySelectorAll(".note-row[data-c]").forEach(function (e) {
      const t = e.dataset.c;
      e.innerHTML = comments[t]
        ? '<a href="#" class="note-open">' + esc(comments[t]) + "</a>"
        : '<a href="#" class="note-open note-empty">add a note</a>';
    });
}
function itemTextFor(e) {
  const t = content.querySelector('.item[data-c="' + e + '"]');
  return t ? t.childNodes[0].textContent.trim() : e === currentNoteCid ? currentNoteLabel : "";
}
function renderCommentRead(e) {
  (cContent.innerHTML =
    '<div class="p-stagger"><h3>Comment</h3><p class="ctx">' +
    esc(itemTextFor(e)) +
    '</p></div><p class="ctext p-stagger">' +
    esc(comments[e]) +
    '</p><div class="actions p-stagger"><button class="txtbtn" id="cEdit">Edit</button><button class="txtbtn quiet" id="cRemove">Remove</button></div>'),
    document.getElementById("cEdit").addEventListener("click", function () {
      renderCommentEdit(e);
    }),
    document.getElementById("cRemove").addEventListener("click", function () {
      delete comments[e], persistComments(), refreshPanelComments(), closeComment();
    });
}
function renderCommentEdit(e) {
  cContent.innerHTML =
    '<div class="p-stagger"><h3>Comment</h3><p class="ctx">' +
    esc(itemTextFor(e)) +
    '</p></div><div class="p-stagger"><textarea id="cText" placeholder="Write here"></textarea></div><div class="actions p-stagger"><button class="txtbtn" id="cSave">Save</button></div>';
  const t = document.getElementById("cText");
  (t.value = comments[e] || ""),
    setTimeout(function () {
      t.focus();
    }, 260),
    document.getElementById("cSave").addEventListener("click", function () {
      const n = t.value.trim();
      n ? (comments[e] = n) : delete comments[e],
        persistComments(),
        refreshPanelComments(),
        comments[e] ? renderCommentRead(e) : closeComment();
    }),
    t.addEventListener("keydown", function (e) {
      (e.metaKey || e.ctrlKey) && "Enter" === e.key && document.getElementById("cSave").click();
    });
}
function openComment(e) {
  (activeCommentId = e),
    comments[e] ? renderCommentRead(e) : renderCommentEdit(e),
    document.body.classList.add("cpanel-open"),
    cpanel.setAttribute("aria-hidden", "false"),
    (cpanel.scrollTop = 0);
}
function closeComment() {
  document.body.classList.remove("cpanel-open"),
    cpanel.setAttribute("aria-hidden", "true"),
    (activeCommentId = null);
}
content.addEventListener("click", function (e) {
  const t = e.target.closest(".c-add"),
    n = e.target.closest(".c-link"),
    a = e.target.closest(".note-open");
  if (!t && !n && !a) return;
  let o;
  if ((e.preventDefault(), e.stopPropagation(), a)) {
    const t = e.target.closest("[data-c]");
    o = t ? t.dataset.c : null;
  } else {
    const t = e.target.closest(".item[data-c]");
    o = t ? t.dataset.c : null;
  }
  o && (activeCommentId !== o ? openComment(o) : closeComment());
}),
  cClose.addEventListener("click", closeComment),
  document.addEventListener(
    "keydown",
    function (e) {
      "Escape" === e.key &&
        document.body.classList.contains("cpanel-open") &&
        (e.stopImmediatePropagation(), closeComment());
    },
    !0,
  );
const aboutWash = document.getElementById("aboutWash"),
  aboutModal = document.getElementById("aboutModal"),
  aboutTrigger = document.getElementById("aboutTrigger"),
  aboutClose = document.getElementById("aboutClose");
function openAbout() {
  close(),
    closeComment(),
    closeAvatar(),
    closeMail(),
    document.body.classList.add("about-open"),
    aboutWash.setAttribute("aria-hidden", "false"),
    aboutModal.setAttribute("aria-hidden", "false");
}
function closeAbout() {
  document.body.classList.remove("about-open"),
    aboutWash.setAttribute("aria-hidden", "true"),
    aboutModal.setAttribute("aria-hidden", "true");
}
aboutTrigger.addEventListener("click", function () {
  document.body.classList.contains("about-open") ? closeAbout() : openAbout();
}),
  aboutClose.addEventListener("click", closeAbout),
  aboutWash.addEventListener("click", closeAbout),
  document.addEventListener(
    "keydown",
    function (e) {
      "Escape" === e.key &&
        document.body.classList.contains("about-open") &&
        (e.stopImmediatePropagation(), closeAbout());
    },
    !0,
  );
const avatarWash = document.getElementById("avatarWash"),
  avatarViewer = document.getElementById("avatarViewer"),
  avatarTrigger = document.getElementById("avatarTrigger"),
  avatarClose = document.getElementById("avatarClose");
function openAvatar() {
  close(),
    closeComment(),
    closeAbout(),
    closeMail(),
    document.body.classList.add("avatar-open"),
    avatarWash.setAttribute("aria-hidden", "false"),
    avatarViewer.setAttribute("aria-hidden", "false");
}
function closeAvatar() {
  document.body.classList.remove("avatar-open"),
    avatarWash.setAttribute("aria-hidden", "true"),
    avatarViewer.setAttribute("aria-hidden", "true");
}
(document.getElementById("avatarBig").src = avatarTrigger.querySelector("img").src),
  avatarTrigger.addEventListener("click", function () {
    document.body.classList.contains("avatar-open") ? closeAvatar() : openAvatar();
  }),
  avatarClose.addEventListener("click", closeAvatar),
  avatarWash.addEventListener("click", closeAvatar),
  document.addEventListener(
    "keydown",
    function (e) {
      "Escape" === e.key &&
        document.body.classList.contains("avatar-open") &&
        (e.stopImmediatePropagation(), closeAvatar());
    },
    !0,
  );
const MAIL_TO = "oktavio@gowdesign.com",
  MAIL_SUBJECT = "Hey Oktavio",
  mailWash = document.getElementById("mailWash"),
  mailModal = document.getElementById("mailModal"),
  mailTrigger = document.getElementById("mailTrigger"),
  mailText = document.getElementById("mailText"),
  mailSend = document.getElementById("mailSend");
function autoGrow() {
  (mailText.style.height = "auto"),
    (mailText.style.height = Math.min(mailText.scrollHeight, 240) + "px");
}
function syncMailHref() {
  const e = "" === mailText.value.trim() ? "close" : "send";
  mailSend.setAttribute("data-mode", e),
    mailSend.setAttribute("aria-label", "close" === e ? "Close" : "Send"),
    (mailSend.href =
      "mailto:" +
      MAIL_TO +
      "?subject=" +
      encodeURIComponent(MAIL_SUBJECT) +
      "&body=" +
      encodeURIComponent(mailText.value));
}
function openMail() {
  close(),
    closeComment(),
    closeAbout(),
    closeAvatar(),
    document.body.classList.add("mail-open"),
    mailWash.setAttribute("aria-hidden", "false"),
    mailModal.setAttribute("aria-hidden", "false"),
    syncMailHref(),
    autoGrow(),
    setTimeout(function () {
      mailText.focus();
    }, 260);
}
function closeMail() {
  document.body.classList.remove("mail-open"),
    mailWash.setAttribute("aria-hidden", "true"),
    mailModal.setAttribute("aria-hidden", "true");
}
mailTrigger.addEventListener("click", function () {
  document.body.classList.contains("mail-open") ? closeMail() : openMail();
}),
  mailWash.addEventListener("click", closeMail),
  mailText.addEventListener("input", function () {
    syncMailHref(), autoGrow();
  }),
  mailSend.addEventListener("click", function (e) {
    "close" === mailSend.getAttribute("data-mode") && e.preventDefault(), closeMail();
  }),
  mailText.addEventListener("keydown", function (e) {
    (e.metaKey || e.ctrlKey) &&
      "Enter" === e.key &&
      (e.preventDefault(), "send" === mailSend.getAttribute("data-mode") && mailSend.click());
  }),
  document.addEventListener(
    "keydown",
    function (e) {
      "Escape" === e.key &&
        document.body.classList.contains("mail-open") &&
        (e.stopImmediatePropagation(), closeMail());
    },
    !0,
  ),
  syncMailHref(),
  loadComments();
(function () {
  var wash = document.getElementById("cmdWash"),
    cmd = document.getElementById("cmd"),
    input = document.getElementById("cmdInput"),
    list = document.getElementById("cmdList"),
    modal = document.getElementById("cmdModal"),
    modalBody = document.getElementById("cmdModalBody"),
    modalClose = document.getElementById("cmdModalClose"),
    modalBack = document.getElementById("cmdModalBack"),
    escHint = document.getElementById("cmdEsc"),
    trigger = document.querySelector(".topbar__logo");

  // The hint badge shows the real toggle shortcut (opens when closed, closes
  // when open — see the keydown handler below), not a decorative fragment.
  // Mac gets the glyph; everyone else gets the word, since Ctrl has no glyph
  // convention on the web. `userAgentData.platform` is Chromium-only, so it
  // falls back to the deprecated-but-still-live `navigator.platform`, then to
  // a `userAgent` string match — never assume Mac by default. Named `escHint`,
  // not `esc`: this file already has a top-level `esc()` HTML-escaping helper,
  // and this IIFE calls it a lot — shadowing it with a same-named element
  // reference here silently breaks every `esc(...)` call below.
  //
  // The badge itself is `aria-hidden` — a bare `<span>` has no role that
  // reliably carries an `aria-label` to assistive tech (it's inert, never
  // focused, never visited by the accessible-name computation of anything
  // else). The instruction lives instead in `#cmdEscHint`, a `.sr-only`
  // sibling wired to the input via `aria-describedby` — that's the pairing
  // (interactive control + description) screen readers actually expose.
  if (escHint) {
    var platform =
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      navigator.userAgent ||
      "";
    var isMac = /Mac|iPhone|iPad|iPod/i.test(platform);
    escHint.textContent = isMac ? "⌘K" : "Ctrl K";
    var escHintDesc = document.getElementById("cmdEscHint");
    if (escHintDesc) {
      escHintDesc.textContent =
        "Press " + (isMac ? "Command K" : "Control K") + " to close";
    }
  }

  // One flat index over every collection already on the page. Built once: these
  // objects never change at runtime.
  var index = [];
  function add(group, map) {
    for (var k in map) {
      var e = map[k];
      index.push({ group: group, key: k, name: e.name, what: e.role || "", entry: e });
    }
  }
  add("People", people);
  add("Plan", phases);
  add("References", refs);
  add("Courses", courses);
  add("Reading", readings);

  var results = [],
    cursor = 0,
    // Where the list was when the detail opened, so going back lands on the
    // same row instead of snapping to the top.
    lastCursor = 0;

  function score(item, q) {
    var n = item.name.toLowerCase(),
      w = (item.what || "").toLowerCase();
    if (n === q) return 0;
    if (n.indexOf(q) === 0) return 1;
    if (n.indexOf(q) > -1) return 2;
    if (w.indexOf(q) > -1) return 3;
    return -1;
  }

  function render() {
    var q = input.value.trim().toLowerCase();
    results = [];
    if (!q) {
      results = index.slice();
    } else {
      var scored = [];
      for (var i = 0; i < index.length; i++) {
        var s = score(index[i], q);
        if (s > -1) scored.push({ s: s, i: i, item: index[i] });
      }
      scored.sort(function (a, b) {
        return a.s - b.s || a.i - b.i;
      });
      for (var j = 0; j < scored.length; j++) results.push(scored[j].item);
    }
    cursor = 0;
    if (!results.length) {
      list.innerHTML = '<p class="cmd__empty">No results</p>';
      return;
    }
    var html = "",
      last = null;
    for (var k = 0; k < results.length; k++) {
      var r = results[k];
      if (r.group !== last) {
        html += '<div class="cmd__group">' + r.group + "</div>";
        last = r.group;
      }
      html +=
        '<button class="cmd__item" role="option" data-i="' +
        k +
        '" aria-selected="' +
        (k === 0) +
        '">' +
        "<span>" +
        esc(r.name) +
        "</span>" +
        (r.what ? '<span class="what">' + esc(r.what) + "</span>" : "") +
        "</button>";
    }
    list.innerHTML = html;
  }

  function setCursor(i) {
    if (!results.length) return;
    var items = list.querySelectorAll(".cmd__item");
    if (!items.length) return;
    items[cursor].setAttribute("aria-selected", "false");
    cursor = Math.min(Math.max(i, 0), items.length - 1);
    items[cursor].setAttribute("aria-selected", "true");
    if (items[cursor].scrollIntoView) items[cursor].scrollIntoView({ block: "nearest" });
  }

  function moveCursor(delta) {
    if (!results.length) return;
    setCursor((cursor + delta + results.length) % results.length);
  }

  // Where focus returns on a complete dismissal — whatever had it before the
  // palette opened, not necessarily the trigger. Captured once per session
  // (see the isFreshOpen check in openCmd) so the "back from detail" hop and
  // the ⌘K "swap surfaces" hop don't clobber it with focus that's already
  // inside the palette. Can go stale between capture and use — see
  // isExposedFocusable — so it's re-validated at restore time, not trusted
  // just because it was once real.
  var opener = null;

  // openCmd() waits 60ms before focusing #cmdInput (see below for why). A
  // dismiss or a hop into detail can land inside that window; the pending
  // timer is cancelled the instant the list layer stops being the thing on
  // screen so it can't fire late and steal focus back onto a control that's
  // gone dark. Belt-and-suspenders with the isExposedFocusable guard inside
  // the callback itself, in case some future caller closes the list without
  // going through closeCmd().
  var pendingFocusTimer = null;
  function cancelPendingFocus() {
    if (pendingFocusTimer !== null) {
      clearTimeout(pendingFocusTimer);
      pendingFocusTimer = null;
    }
  }

  // The confirmed bug: a control kept focus after its subtree went
  // aria-hidden, which assistive tech treats as focus vanishing into the
  // void. Blur before hiding, every time — callers that know where focus
  // belongs next (returnFocus, or the layer that's about to take over) move
  // it there in the same tick, before anything repaints.
  function blurIfInside(root) {
    if (root.contains(document.activeElement)) document.activeElement.blur();
  }

  // True only for an element that's reachable right now: connected, not
  // behind an aria-hidden or inert ancestor — every surface in this file
  // (panel, comment, about, avatar, mail, the palette itself) marks its own
  // container aria-hidden the instant it closes, so this doubles as "not
  // inside a surface that just closed" — and genuinely focusable, not just
  // present in the DOM. Checked at the moment focus is about to move, never
  // cached: the opener can go stale between capture and use (⌘K pressed
  // from inside the mail composer closes the mail modal as a side effect of
  // opening the palette — #mailText is still "opener", but by the time the
  // palette itself closes it's sitting inside an aria-hidden `.mail-modal`),
  // and the fallback trigger isn't exempt either (the topbar aria-hides
  // itself after 1.2s idle — see scheduleNavIdle above).
  function isExposedFocusable(el) {
    if (!el || el.nodeType !== 1 || typeof el.focus !== "function") return false;
    if (!document.contains(el)) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    if (el.closest("[inert]")) return false;
    if (el.hasAttribute("disabled")) return false;
    var tag = el.tagName;
    var naturallyFocusable =
      tag === "BUTTON" ||
      tag === "INPUT" ||
      tag === "SELECT" ||
      tag === "TEXTAREA" ||
      (tag === "A" && el.hasAttribute("href"));
    var tabIndexAttr = el.getAttribute("tabindex");
    var hasTabIndex = tabIndexAttr !== null && parseInt(tabIndexAttr, 10) >= 0;
    return naturallyFocusable || hasTabIndex;
  }

  function returnFocus() {
    var target = opener;
    opener = null;
    if (!isExposedFocusable(target)) target = trigger;
    if (!isExposedFocusable(target)) target = null;
    if (target) target.focus();
    // Neither the opener nor the trigger is reachable right now — blurIfInside
    // already moved focus off the closing surface above; there's nowhere
    // safer to send it, so it stays cleared rather than forcing a hidden
    // element to take focus just to have *a* target.
  }

  // keepQuery is the "back from detail" path: same query, same selected row.
  function openCmd(keepQuery) {
    var isFreshOpen =
      !document.body.classList.contains("cmd-open") &&
      !document.body.classList.contains("cmd-detail-open");
    if (isFreshOpen) opener = document.activeElement;
    cancelPendingFocus();
    close();
    closeComment();
    closeAbout();
    closeAvatar();
    closeMail();
    // Also tears down the detail layer, so ⌘K on top of an open detail swaps
    // surfaces instead of stacking them.
    document.body.classList.remove("cmd-detail-open");
    blurIfInside(modal);
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.add("cmd-open");
    wash.setAttribute("aria-hidden", "false");
    cmd.setAttribute("aria-hidden", "false");
    if (!keepQuery) input.value = "";
    render();
    // render() rebuilds the list and resets the cursor, so restoring comes after.
    if (keepQuery) setCursor(lastCursor);
    pendingFocusTimer = setTimeout(function () {
      pendingFocusTimer = null;
      // A dismiss or a hop into detail can land inside this delay — only
      // claim focus if #cmdInput is still genuinely the thing to focus.
      if (isExposedFocusable(input)) input.focus();
    }, 60);
  }
  // restore=false is the "hop into detail" case (openDetail() calls this to
  // tear the list down first) — the detail layer takes focus itself right
  // after, so returning it to the opener here would just be a flash to
  // undo. Every other caller is a genuine complete dismissal: Meta+K/Ctrl+K
  // toggle-close and Escape from the list both hit the default.
  function closeCmd(restore) {
    cancelPendingFocus();
    document.body.classList.remove("cmd-open");
    blurIfInside(cmd);
    wash.setAttribute("aria-hidden", "true");
    cmd.setAttribute("aria-hidden", "true");
    if (restore !== false) returnFocus();
  }
  function closeCmdDetail() {
    cancelPendingFocus();
    document.body.classList.remove("cmd-detail-open");
    blurIfInside(modal);
    wash.setAttribute("aria-hidden", "true");
    modal.setAttribute("aria-hidden", "true");
    returnFocus();
  }
  // Back to the results. The wash stays up the whole time — both states share
  // the same rule in the CSS, so hiding and re-showing it would flash.
  function backToCmd() {
    openCmd(true);
  }

  // Opening a result in a modal reuses the exact markup the side panel builds,
  // so the two surfaces can never drift apart.
  function openDetail(item) {
    var e = item.entry;
    var html =
      '<div class="p-stagger"><h3>' +
      esc(e.name) +
      '</h3><p class="role">' +
      e.role +
      "</p></div>" +
      '<p class="bio p-stagger">' +
      e.bio +
      "</p>";
    if (e.items) {
      html += '<span class="label p-stagger">In practice</span><div class="p-stagger">';
      for (var i = 0; i < e.items.length; i++) html += '<p class="item">' + e.items[i] + "</p>";
      html += "</div>";
    }
    html += '<span class="label p-stagger">Links</span><div class="p-stagger">';
    for (var j = 0; j < e.links.length; j++) {
      var l = e.links[j];
      html +=
        '<div class="row"><span class="who">' +
        favicon(l[1]) +
        '<a href="' +
        l[1] +
        '" target="_blank" rel="noopener">' +
        l[0] +
        "</a></span></div>";
    }
    html += "</div>";
    modalBody.innerHTML = html;
    // Taken from the item, not the global cursor: a click opens a row the
    // keyboard cursor was never on.
    lastCursor = results.indexOf(item);
    // false: this tears the list down to swap surfaces, not to dismiss —
    // focus moves into the detail layer below, not back to the opener.
    closeCmd(false);
    document.body.classList.add("cmd-detail-open");
    wash.setAttribute("aria-hidden", "false");
    modal.setAttribute("aria-hidden", "false");
    modal.scrollTop = 0;
    modalClose.focus();
  }

  input.addEventListener("input", render);

  input.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      moveCursor(1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      moveCursor(-1);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (results[cursor]) openDetail(results[cursor]);
    }
  });

  list.addEventListener("click", function (ev) {
    var b = ev.target.closest(".cmd__item");
    if (b) openDetail(results[+b.dataset.i]);
  });

  // The logo is the trigger. It was an anchor to "#", which would jump the page
  // out from under the dialog, so the default is suppressed.
  if (trigger) {
    trigger.classList.add("cmd-trigger");
    trigger.addEventListener("click", function (ev) {
      ev.preventDefault();
      openCmd();
    });
  }

  wash.addEventListener("click", function () {
    document.body.classList.contains("cmd-detail-open") ? backToCmd() : closeCmd();
  });
  modalBack.addEventListener("click", backToCmd);
  // The × is the only gesture that dismisses the whole stack at once.
  modalClose.addEventListener("click", closeCmdDetail);

  document.addEventListener(
    "keydown",
    function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && (ev.key === "k" || ev.key === "K")) {
        ev.preventDefault();
        document.body.classList.contains("cmd-open") ? closeCmd() : openCmd();
        return;
      }
      if (ev.key !== "Escape") return;
      // Innermost surface first, so Escape peels one layer at a time.
      if (document.body.classList.contains("cmd-detail-open")) {
        ev.stopImmediatePropagation();
        backToCmd();
      } else if (document.body.classList.contains("cmd-open")) {
        ev.stopImmediatePropagation();
        closeCmd();
      }
    },
    true,
  );
})();
