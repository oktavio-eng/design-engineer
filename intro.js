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

   Lives in its own file (loaded `defer`, before script.js / portfolio.mjs) so
   the wiki and the home play the same greeting; the page opts in by shipping
   `.intro-playing` on <html>, the `<noscript>` guard and the `#intro` markup
   (see wiki.html / index.html). A page without `#intro` is a no-op here.
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
    // localStorage helpers in script.js (readStored/writeStored): persistence here
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
