/* ---------------------------------------------------------------------------
   Favicons for external reference links — shared by script.js (homepage rows
   and the side panel) and cmd.mjs (the ⌘K detail on every page). Classic
   script, loaded with `defer` before both.

   Fallback cascade: Google favicon service -> DuckDuckGo -> the origin's own
   /favicon.ico -> remove the <img> entirely. Never leave a broken icon or a
   reserved gap: when every source fails the element goes away and the text
   flows to the edge.

   Because this file is `defer`red, an <img onerror> in the HTML can fire
   before favFallback exists. `sweepFavicons()` below re-runs the cascade on
   any icon that already failed by the time the script executes.
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

/* Builds the <img> for a link. Global on purpose: script.js calls it bare and
   cmd.mjs reads it off `window`. The inline onerror is the one inline handler
   the site keeps — it has to be an attribute so the fallback survives the
   markup being built as an HTML string and inserted via innerHTML. */
/* Sites the favicon services can't see (27/08/2026: simile.com ships no
   /favicon.ico, only <link rel="icon" href="/brand/favicon.svg">, so Google
   and DuckDuckGo both 404). The real file goes first; if it ever fails the
   same cascade above still runs. wiki.html's row for the same domain uses
   the same URL by hand.

   Why the cascade can't catch these on its own (28/08/2026, FinQ Edu): for
   a domain it can't fetch, Google's service answers 404 *with a 16x16 globe
   PNG in the body*, and DuckDuckGo does the same with its own placeholder.
   An <img> renders any decodable body regardless of status, so `onerror`
   never fires and the globe just sits there looking like a favicon. There
   is no status code to read from an <img>, and sniffing "is it 16x16?"
   would misfire on real 16px icons — so a domain that shows the globe gets
   pinned here by hand to the file its own <link rel="icon"> points at.
   FinQ: finqedu.com.br itself no longer answers (the row's faviconFrom in
   portfolio-content.js keeps the brand domain as the key), and the two
   Webflow subdomains serve their icons from Webflow's CDN. */
const ICON_SOURCES = {
  "simile.com": "https://www.simile.com/brand/favicon.svg",
  "finqedu.com.br": "https://cdn.prod.website-files.com/67433c17156afcafa41a804f/6743460b06a920f998bed41d_fav-finq.png",
  "finqedu.webflow.io": "https://cdn.prod.website-files.com/67433c17156afcafa41a804f/6743460b06a920f998bed41d_fav-finq.png",
  "dev-finqedu.webflow.io": "https://cdn.prod.website-files.com/67fa3b5335fadc68fbc167da/68025b52149680be41d86f5b_fav.png",
};
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
    '" onerror="favFallback(this)" src="' +
    (ICON_SOURCES[t] || "https://www.google.com/s2/favicons?sz=64&domain=" + t) +
    '" alt="" loading="lazy">'
  );
}
