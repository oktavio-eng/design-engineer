/* ---------------------------------------------------------------------------
   Mail composer — the envelope button in the topbar and the sheet it opens.

   Shared by every page (wiki, home, changelog, prompts) since 16/08/2026; it
   used to be a wiki-only block in script.js with its markup in wiki.html.
   Like cmd.mjs, this file owns its own markup: `#mailWash` + `#mailModal`
   are created here and appended to <body>, so no page carries a copy. The
   page only needs a `#mailTrigger` button in the topbar (no trigger → the
   file does nothing but define the globals).

   Classic script (not a module) on purpose: script.js is classic and calls
   `closeMail()` when one of its own surfaces opens, so the two functions are
   exposed on `window`. Load order: after favicons.js/content.js, before
   script.js. The page and the composer talk by events, same contract as
   ⌘K's `cmd:beforeopen`:
   - before opening, this dispatches `mail:beforeopen` on document; the wiki
     answers by folding panel/comment/about/avatar so surfaces swap instead
     of stacking;
   - it listens to `cmd:beforeopen` and closes itself when ⌘K takes over.
   The Escape handler is registered on the capture phase like the wiki's other
   overlays, and stops propagation only while `body.mail-open` is set.
   The dialog is `inert` while closed (same `aria-hidden` + `inert` pair as
   the ⌘K dialogs) so its textarea is never a hidden Tab stop — the wiki-only
   version lacked this and axe flagged it once the composer reached /prompts.

   Sending: this used to be a bare `mailto:` link, which depends on the
   visitor's browser/OS having a mail client registered — without one, the
   click just navigates the tab to `mailto:...` and leaves it on a blank
   about:blank (reported 23/08/2026). It now POSTs to Web3Forms instead
   (api.web3forms.com/submit, keyed to oktavio@gowstudio.pro) so the send
   never navigates the page at all. The `href` stays a `mailto:` fallback —
   pure convenience if JS fails to load, not the primary path.

   On success `data-mode` goes to "sent" — a third crossfade state next to
   "close"/"send" on the same icon-swap system (`.composer__send svg`,
   opacity+scale+blur, `--duration-200`/`--ease`) — and the sheet holds for
   SENT_HOLD_MS before auto-closing, so the confirmation is actually seen.
   Typing again or closing manually cancels that timer (see `sentTimer`) so
   a second message never gets cut off mid-draft by the old timeout.

   Two steps, one modal (added 23/08/2026 — without this, "who actually
   messaged me" only got answered if the visitor thought to sign their name
   inside the message itself): `#stepEmail` asks for a reply address first,
   `#stepMessage` is the composer as before. `showStep()` toggles between
   them with a quick exit-then-enter (native `hidden`, not `inert` —
   nothing needs to stay tabbable underneath) so the two never overlap;
   sharing `.composer__input`'s rows="4" box on both steps means there's
   barely any height delta to hide in the first place. The email step is
   skippable on purpose — clicking the arrow with it empty still advances;
   `sendMail()` only adds `email` to the payload when non-blank.

   Email validation (29/08/2026): the email step is no longer skippable. The
   arrow and Enter both go through `advance()`, which runs `validateEmail()`
   — blank or malformed (WHATWG's input[type=email] pattern, plus at least
   one dot in the domain so "name@gmail" doesn't pass) shows `#mailReplyHint`
   under the field (`role="alert"`, the textarea gets `aria-invalid`), gives
   the step a short horizontal shake (`.is-invalid`, off under reduced
   motion) and keeps focus where it is. Typing clears it. `sendMail()`
   re-checks before posting, and if the address has somehow gone bad it
   returns to the email step with the hint instead of sending.

   Storage (29/08/2026): each send also inserts a row into a Supabase
   `messages` table (plain REST, `POST /rest/v1/messages` with the anon key,
   no SDK — the site has no bundler) so there's an archive beyond the inbox.
   Web3Forms and Supabase run in parallel via `Promise.allSettled`; the
   sheet shows "sent" when at least one landed (the inbox is the primary
   channel, the table is the copy — losing one shouldn't hide the message
   the other delivered), and only when both fail does `#mailTextHint` say so
   — before this, a failed send was a console.error and nothing else. With
   `SUPABASE_URL`/`SUPABASE_ANON_KEY` blank the insert is skipped entirely.
   Table, RLS and setup: supabase/schema.sql + docs/messages.md.
--------------------------------------------------------------------------- */
(function () {
  var MAIL_TO = "oktavio@gowstudio.pro";
  var MAIL_SUBJECT = "Hey Oktavio";
  var WEB3FORMS_KEY = "81ee78a2-91c0-4dcb-8afa-926da9bafccc";
  // Supabase project URL + anon (public) key. Both blank until the project
  // exists — paste them from Project Settings → API. The anon key is meant to
  // ship to the browser; what it can do is bounded by the RLS policy in
  // supabase/schema.sql (insert only, never read).
  var SUPABASE_URL = "";
  var SUPABASE_ANON_KEY = "";
  var SUPABASE_TABLE = "messages";
  // WHATWG's input[type=email] pattern with one change: the domain needs at
  // least one dot. Mirrored by the CHECK constraint in supabase/schema.sql.
  var EMAIL_RE =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  var HINT_EMPTY = "Add your email so I can reply.";
  var HINT_INVALID = "That email doesn\u2019t look right.";
  var HINT_FAILED = "Couldn\u2019t send \u2014 try again.";
  var SENT_HOLD_MS = 1300;
  var STEP_EXIT_MS = 150;
  var STEP_ORDER = { email: 0, message: 1 };
  var sending = false;
  var sentTimer = null;
  var currentStep = "email";

  document.body.insertAdjacentHTML(
    "beforeend",
    '<div class="mail-wash" id="mailWash" aria-hidden="true"></div>' +
      '<div class="mail-modal" id="mailModal" role="dialog" aria-modal="true" aria-label="Send a message" aria-hidden="true" inert>' +
      '<div class="composer">' +
      '<div class="composer__stage" id="composerStage">' +
      '<div class="composer__step composer__step--email" id="stepEmail">' +
      '<textarea class="composer__input" id="mailReply" placeholder="Your email" aria-label="Your email" rows="4" inputmode="email" autocomplete="email" aria-describedby="mailReplyHint"></textarea>' +
      '<p class="composer__hint" id="mailReplyHint" role="alert" hidden></p>' +
      '<div class="composer__actions composer__actions--end">' +
      '<button class="composer__send" id="mailNext" type="button" aria-label="Next">' +
      '<svg class="icon-next" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/></svg>' +
      "</button></div></div>" +
      '<div class="composer__step composer__step--message" id="stepMessage" hidden>' +
      '<textarea class="composer__input" id="mailText" placeholder="Hey Oktavio!" aria-label="Message" rows="4" aria-describedby="mailTextHint"></textarea>' +
      '<p class="composer__hint" id="mailTextHint" role="alert" hidden></p>' +
      '<div class="composer__actions">' +
      '<span class="composer__from">' +
      '<button class="composer__back" id="mailBack" type="button" aria-label="Edit email"><svg viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"/></svg></button>' +
      '<span class="composer__to">' + MAIL_TO + "</span></span> " +
      '<a class="composer__send" id="mailSend" data-mode="close" href="mailto:' + MAIL_TO + '" target="_blank" rel="noopener" aria-label="Close">' +
      '<svg class="icon-send" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z"/></svg> ' +
      '<svg class="icon-close" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>' +
      '<svg class="icon-sent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 13 10 16.5 17.5 8"/></svg>' +
      "</a></div></div></div></div></div>",
  );

  var mailWash = document.getElementById("mailWash"),
    mailModal = document.getElementById("mailModal"),
    mailTrigger = document.getElementById("mailTrigger"),
    composerStage = document.getElementById("composerStage"),
    stepEmail = document.getElementById("stepEmail"),
    stepMessage = document.getElementById("stepMessage"),
    mailReply = document.getElementById("mailReply"),
    mailReplyHint = document.getElementById("mailReplyHint"),
    mailTextHint = document.getElementById("mailTextHint"),
    mailNext = document.getElementById("mailNext"),
    mailBack = document.getElementById("mailBack"),
    mailText = document.getElementById("mailText"),
    mailSend = document.getElementById("mailSend");

  function autoGrow() {
    mailText.style.height = "auto";
    mailText.style.height = Math.min(mailText.scrollHeight, 240) + "px";
  }
  function syncMailHref() {
    var mode = "" === mailText.value.trim() ? "close" : "send";
    mailSend.setAttribute("data-mode", mode);
    mailSend.setAttribute("aria-label", "close" === mode ? "Close" : "Send");
    mailSend.href =
      "mailto:" +
      MAIL_TO +
      "?subject=" +
      encodeURIComponent(MAIL_SUBJECT) +
      "&body=" +
      encodeURIComponent(mailText.value);
  }
  function isValidEmail(value) {
    return EMAIL_RE.test(value);
  }
  function showHint(hintEl, text) {
    hintEl.textContent = text;
    hintEl.hidden = false;
  }
  function clearHint(hintEl) {
    if (hintEl.hidden) return;
    hintEl.hidden = true;
    hintEl.textContent = "";
  }
  function shake(stepEl) {
    stepEl.classList.remove("is-invalid");
    // Restart the animation even if the class was just removed this frame.
    void stepEl.offsetWidth;
    stepEl.classList.add("is-invalid");
  }
  // Returns true when the reply address can be used; otherwise marks the
  // field, explains why under it and shakes the step. Focus stays put.
  function validateEmail() {
    var value = mailReply.value.trim();
    var problem = "" === value ? HINT_EMPTY : isValidEmail(value) ? "" : HINT_INVALID;
    if (!problem) {
      mailReply.removeAttribute("aria-invalid");
      clearHint(mailReplyHint);
      return true;
    }
    mailReply.setAttribute("aria-invalid", "true");
    showHint(mailReplyHint, problem);
    shake(stepEmail);
    return false;
  }
  function advance() {
    if (!validateEmail()) {
      mailReply.focus();
      return;
    }
    showStep("message", true);
  }
  function showStep(step, animate) {
    var showEl = "email" === step ? stepEmail : stepMessage;
    var hideEl = "email" === step ? stepMessage : stepEmail;
    var direction = STEP_ORDER[step] > STEP_ORDER[currentStep] ? 1 : -1;
    currentStep = step;
    if (!animate) {
      hideEl.hidden = true;
      hideEl.classList.remove("is-leaving", "is-entering");
      showEl.hidden = false;
      showEl.classList.remove("is-leaving", "is-entering");
      return;
    }
    composerStage.style.setProperty("--step-dir", direction);
    hideEl.classList.add("is-leaving");
    setTimeout(function () {
      hideEl.hidden = true;
      hideEl.classList.remove("is-leaving");
      showEl.hidden = false;
      showEl.classList.add("is-entering");
      requestAnimationFrame(function () {
        showEl.classList.remove("is-entering");
      });
      if ("message" === step) {
        autoGrow();
        mailText.focus();
      } else {
        mailReply.focus();
      }
    }, STEP_EXIT_MS);
  }
  function openMail() {
    document.dispatchEvent(new CustomEvent("mail:beforeopen"));
    document.body.classList.add("mail-open");
    mailWash.setAttribute("aria-hidden", "false");
    mailModal.setAttribute("aria-hidden", "false");
    mailModal.inert = false;
    showStep(currentStep, false);
    syncMailHref();
    autoGrow();
    setTimeout(function () {
      ("email" === currentStep ? mailReply : mailText).focus();
    }, 260);
  }
  function closeMail() {
    if (sentTimer) {
      clearTimeout(sentTimer);
      sentTimer = null;
    }
    document.body.classList.remove("mail-open");
    mailWash.setAttribute("aria-hidden", "true");
    mailModal.setAttribute("aria-hidden", "true");
    mailModal.inert = true;
  }
  function sendViaWeb3Forms(email, body) {
    return fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: MAIL_SUBJECT,
        from_name: "Oktavio Design",
        email: email,
        message: body,
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.success) throw new Error("Web3Forms: " + JSON.stringify(data));
        return "web3forms";
      });
  }
  function saveToSupabase(email, body) {
    return fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + SUPABASE_TABLE, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ email: email, message: body, page: location.pathname }),
    }).then(function (res) {
      if (!res.ok) throw new Error("Supabase: HTTP " + res.status);
      return "supabase";
    });
  }
  function sendMail() {
    if (sending) return;
    if (!validateEmail()) {
      showStep("email", true);
      return;
    }
    sending = true;
    clearHint(mailTextHint);
    var body = mailText.value;
    var replyEmail = mailReply.value.trim();
    var jobs = [sendViaWeb3Forms(replyEmail, body)];
    if (SUPABASE_URL && SUPABASE_ANON_KEY) jobs.push(saveToSupabase(replyEmail, body));
    Promise.allSettled(jobs).then(function (results) {
      sending = false;
      var delivered = false;
      results.forEach(function (r) {
        if ("fulfilled" === r.status) delivered = true;
        else console.error("Mail send failed", r.reason);
      });
      if (!delivered) {
        showHint(mailTextHint, HINT_FAILED);
        shake(stepMessage);
        return;
      }
      mailText.value = "";
      mailSend.setAttribute("data-mode", "sent");
      mailSend.setAttribute("aria-label", "Sent");
      sentTimer = setTimeout(function () {
        sentTimer = null;
        closeMail();
        syncMailHref();
      }, SENT_HOLD_MS);
    });
  }
  window.openMail = openMail;
  window.closeMail = closeMail;

  if (mailTrigger) {
    mailTrigger.addEventListener("click", function () {
      document.body.classList.contains("mail-open") ? closeMail() : openMail();
    });
  }
  mailWash.addEventListener("click", closeMail);
  mailNext.addEventListener("click", advance);
  mailBack.addEventListener("click", function () {
    showStep("email", true);
  });
  mailReply.addEventListener("keydown", function (e) {
    if ("Enter" === e.key) {
      e.preventDefault();
      advance();
    }
  });
  mailReply.addEventListener("input", function () {
    mailReply.removeAttribute("aria-invalid");
    clearHint(mailReplyHint);
  });
  stepEmail.addEventListener("animationend", function () {
    stepEmail.classList.remove("is-invalid");
  });
  stepMessage.addEventListener("animationend", function () {
    stepMessage.classList.remove("is-invalid");
  });
  mailText.addEventListener("input", function () {
    if (sentTimer) {
      clearTimeout(sentTimer);
      sentTimer = null;
    }
    clearHint(mailTextHint);
    syncMailHref();
    autoGrow();
  });
  mailSend.addEventListener("click", function (e) {
    e.preventDefault();
    if ("send" === mailSend.getAttribute("data-mode")) sendMail();
    else closeMail();
  });
  mailText.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && "Enter" === e.key) {
      e.preventDefault();
      if ("send" === mailSend.getAttribute("data-mode")) mailSend.click();
    }
  });
  document.addEventListener(
    "keydown",
    function (e) {
      if ("Escape" === e.key && document.body.classList.contains("mail-open")) {
        e.stopImmediatePropagation();
        closeMail();
      }
    },
    true,
  );
  document.addEventListener("cmd:beforeopen", closeMail);
  syncMailHref();
})();
