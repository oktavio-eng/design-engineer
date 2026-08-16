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
