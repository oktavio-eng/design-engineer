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
--------------------------------------------------------------------------- */
(function () {
  var MAIL_TO = "oktavio@gowstudio.pro";
  var MAIL_SUBJECT = "Hey Oktavio";

  document.body.insertAdjacentHTML(
    "beforeend",
    '<div class="mail-wash" id="mailWash" aria-hidden="true"></div>' +
      '<div class="mail-modal" id="mailModal" role="dialog" aria-modal="true" aria-label="Send a message" aria-hidden="true" inert>' +
      '<div class="composer">' +
      '<textarea class="composer__input" id="mailText" placeholder="Hey Oktavio!" rows="4"></textarea>' +
      '<div class="composer__actions">' +
      '<span class="composer__to">' + MAIL_TO + "</span> " +
      '<a class="composer__send" id="mailSend" data-mode="close" href="mailto:' + MAIL_TO + '" target="_blank" rel="noopener" aria-label="Close">' +
      '<svg class="icon-send" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12 19.5V5.5"/><path d="M5.25 12.25 12 5.5l6.75 6.75"/></svg> ' +
      '<svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M17.5 6.5 6.5 17.5"/><path d="M6.5 6.5 17.5 17.5"/></svg>' +
      "</a></div></div></div>",
  );

  var mailWash = document.getElementById("mailWash"),
    mailModal = document.getElementById("mailModal"),
    mailTrigger = document.getElementById("mailTrigger"),
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
  function openMail() {
    document.dispatchEvent(new CustomEvent("mail:beforeopen"));
    document.body.classList.add("mail-open");
    mailWash.setAttribute("aria-hidden", "false");
    mailModal.setAttribute("aria-hidden", "false");
    mailModal.inert = false;
    syncMailHref();
    autoGrow();
    setTimeout(function () {
      mailText.focus();
    }, 260);
  }
  function closeMail() {
    document.body.classList.remove("mail-open");
    mailWash.setAttribute("aria-hidden", "true");
    mailModal.setAttribute("aria-hidden", "true");
    mailModal.inert = true;
  }
  window.openMail = openMail;
  window.closeMail = closeMail;

  if (mailTrigger) {
    mailTrigger.addEventListener("click", function () {
      document.body.classList.contains("mail-open") ? closeMail() : openMail();
    });
  }
  mailWash.addEventListener("click", closeMail);
  mailText.addEventListener("input", function () {
    syncMailHref();
    autoGrow();
  });
  mailSend.addEventListener("click", function (e) {
    if ("close" === mailSend.getAttribute("data-mode")) e.preventDefault();
    closeMail();
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
