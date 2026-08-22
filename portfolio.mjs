/* ---------------------------------------------------------------------------
   / (index.html, the portfolio home) — renders the page from window.PORTFOLIO_CONTENT (portfolio-
   content.js) and owns the one surface that's new here: the photo lightbox.

   What it does NOT own: opening a project's detail. Clicking a client /
   personal / life row opens the same modal the ⌘K palette uses (cmd.mjs
   listens for `[data-open="group:key"]` clicks and shows its detail card
   directly, no back button) — one surface for the same content, whichever
   way you reach it. Writing rows are plain links; the contribution graph is
   contrib.mjs fed by /data/contributions.json.

   Sections start `hidden` in the markup and are revealed only once they have
   something to show: a collection with no publishable entries, or a data
   file that fails to load, leaves no empty heading behind (AGENTS.md rule 4,
   applied to sections rather than icons).

   Drafts: entries flagged `draft: true` in portfolio-content.js are the
   placeholders for real client work. They render only on localhost or with
   `?draft` in the URL, so the published page never shows a template.

   Projects is the one row list with a favicon (opt-in via renderList's
   `favicon` opt, from `entry.links[0][1]` — see rowMarkup) and a show-more
   overflow past `threshold` rows (the `.extras`/`.extras-inner`/`.row.extra`
   contract wiki.html hand-authors for people/courses/references, built here
   from data instead — see wireSeeMore).
--------------------------------------------------------------------------- */
import { renderContributions } from "/contrib.mjs";

const content = window.PORTFOLIO_CONTENT || {};

export const showDrafts =
  /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || new URLSearchParams(location.search).has("draft");

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reveal(section) {
  if (section) section.hidden = false;
}

// favicons.js is a classic script (loaded before this module, see
// index.html) that owns the <img> builder and the fallback cascade (Google
// -> DuckDuckGo -> origin -> remove). Global on purpose so the inline
// `onerror="favFallback(this)"` in the markup string can find it — same
// wrapper cmd.mjs uses.
function favicon(url) {
  return typeof window.favicon === "function" ? window.favicon(url) : "";
}

// ---- Rows: clients / projects / personal / life --------------------------
// `opts.favicon`: prefix `.who` with the row's favicon, from
// `entry.links[0][1]` — opt-in per group (only "projects" today), so
// clients/personal/life keep their plain rows. `opts.extra`: this row lives
// inside `.extras` (the show-more overflow) — same `.row.extra` contract
// wiki.html/script.js's wireSeeMore already animates.
function rowMarkup(group, key, entry, opts) {
  opts = opts || {};
  const icon = opts.favicon && entry.links && entry.links[0] ? favicon(entry.links[0][1]) : "";
  return (
    '<button class="row row-btn' + (entry.draft ? " row--draft" : "") + (opts.extra ? " extra" : "") +
    '" type="button" data-open="' + group + ":" + key + '" aria-haspopup="dialog">' +
    '<span class="who">' + icon + esc(entry.name) + "</span>" +
    (entry.role ? '<span class="what">' + esc(entry.role) + "</span>" : "") +
    "</button>"
  );
}

// `opts.threshold`: past this many entries, the rest render inside
// `.extras`/`.extras-inner` (id `<group>Extras`) — the same show-more markup
// wiki.html hand-authors for people/courses/references, built here instead
// since this list is data-driven. Pairs with wireSeeMore(group) below.
export function renderList(root, group, opts) {
  opts = opts || {};
  const host = root.querySelector('[data-list="' + group + '"]');
  const map = content[group] || {};
  if (!host) return 0;
  const keys = Object.keys(map).filter((key) => showDrafts || !map[key].draft);
  const cut = opts.threshold && keys.length > opts.threshold ? opts.threshold : keys.length;
  let html = keys.slice(0, cut).map((key) => rowMarkup(group, key, map[key], opts)).join("");
  const rest = keys.slice(cut);
  if (rest.length) {
    html +=
      '<div class="extras" id="' + group + 'Extras"><div class="extras-inner">' +
      rest.map((key) => rowMarkup(group, key, map[key], Object.assign({}, opts, { extra: true }))).join("") +
      "</div></div>";
  }
  host.innerHTML = html;
  const count = keys.length;
  if (count) reveal(host.closest("section"));
  return count;
}

// Ported from script.js (wireSeeMore, ~line 311) — that file only loads on
// pages with static see-more markup already in the document; here the rows
// (and the `.extras` wrapper itself) are built by renderList() above, so the
// button is hidden outright when there's nothing to reveal. Same classes,
// same behavior otherwise: toggle .expanded + aria-expanded + the button's
// own text.
export function wireSeeMore(sectionId) {
  const section = document.getElementById(sectionId),
    seeMore = document.getElementById(sectionId + "SeeMore"),
    extras = section && section.querySelector(".extras"),
    extrasInner = section && section.querySelector(".extras-inner");
  if (!section || !seeMore) return;
  if (!extras) {
    seeMore.hidden = true;
    return;
  }
  extras.addEventListener("transitionend", function (e) {
    if (e.propertyName === "grid-template-rows" && section.classList.contains("expanded")) {
      extrasInner.style.overflow = "visible";
    }
  });
  seeMore.addEventListener("click", function () {
    extrasInner.style.overflow = "hidden";
    const expanded = section.classList.toggle("expanded");
    seeMore.textContent = expanded ? "show less" : "show more";
    seeMore.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
}

// ---- Writing: the doc-icon list -------------------------------------------
function docIcon() {
  return (
    '<span class="doc-icon" aria-hidden="true"><span class="doc-icon__page">' +
    '<span class="doc-icon__line"></span><span class="doc-icon__line"></span><span class="doc-icon__line"></span>' +
    '<span class="doc-icon__line"></span><span class="doc-icon__line"></span></span></span>'
  );
}

export function renderWriting(root) {
  const host = root.querySelector("[data-writing]");
  const map = content.writing || {};
  if (!host) return 0;
  // Buttons, not links: a piece opens in the shared modal (cmd.mjs,
  // `data-open`), and the modal carries the link to read it.
  host.innerHTML = Object.keys(map)
    .filter((key) => showDrafts || !map[key].draft)
    .map((key) => {
      const post = map[key];
      return (
        '<button class="doc-item doc-item--btn" type="button" data-open="writing:' + key + '" aria-haspopup="dialog">' +
        docIcon() +
        '<span class="doc-item__text"><span class="doc-item__title">' + esc(post.name) + "</span>" +
        (post.bio ? '<span class="doc-item__desc">' + esc(post.bio) + "</span>" : "") +
        "</span></button>"
      );
    })
    .join("");
  const count = host.children.length;
  if (count) reveal(host.closest("section"));
  return count;
}

// ---- Contributions ---------------------------------------------------------
export async function renderGraph(root, url = "/data/contributions.json") {
  const shell = root.querySelector("[data-contrib]");
  if (!shell) return null;
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    if (!Array.isArray(data.days) || data.days.length < 300) throw new Error("short year");
    const result = renderContributions(shell, data.days);
    reveal(shell.closest("section"));
    return result;
  } catch (error) {
    // No data, no graph — the section stays hidden rather than showing an
    // empty card. The daily Action (contributions.yml) is what fills the file.
    return null;
  }
}

// ---- Gallery + lightbox ----------------------------------------------------
export function renderGallery(root) {
  const host = root.querySelector("[data-gallery]");
  const photos = content.gallery || [];
  if (!host) return 0;
  host.innerHTML = photos
    .map((photo, i) => {
      // Marks and other non-photographic images (SVG, or a strongly
      // non-square aspect) sit inside the frame instead of filling it.
      const contain = /\.svg(\?|$)/i.test(photo.src) || (photo.width && photo.height && Math.max(photo.width, photo.height) / Math.min(photo.width, photo.height) > 1.6);
      return (
        '<button class="gallery__item" type="button" data-cursor="ring" data-index="' + i + '" aria-label="' + esc(photo.alt || photo.caption || "Photo") + '"' +
        ' data-lightbox-src="' + esc(photo.src) + '" data-lightbox-alt="' + esc(photo.alt || "") + '" data-lightbox-caption="' + esc(photo.caption || "") + '">' +
        '<span class="gallery__frame"><img class="gallery__img' + (contain ? " gallery__img--contain" : "") + '" src="' + esc(photo.src) + '" alt=""' +
        (photo.width ? ' width="' + photo.width + '"' : "") + (photo.height ? ' height="' + photo.height + '"' : "") +
        ' loading="lazy" decoding="async"></span></button>'
      );
    })
    .join("");
  // A photo that fails to load takes its cell with it — never a gray box.
  host.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      const item = img.closest(".gallery__item");
      if (item) item.remove();
      if (!host.children.length) host.closest("section").hidden = true;
    });
  });
  if (photos.length) reveal(host.closest("section"));
  return photos.length;
}

export function initLightbox(root) {
  const wash = root.querySelector("[data-lightbox-wash]");
  const box = root.querySelector("[data-lightbox]");
  const img = root.querySelector("[data-lightbox-img]");
  // `data-lightbox-text`, not `-caption`: the thumbnails carry
  // `data-lightbox-caption` as *input* (what to show), and this is the
  // figcaption that shows it — same word on both would match a thumbnail.
  const caption = root.querySelector("[data-lightbox-text]");
  const close = root.querySelector("[data-lightbox-close]");
  if (!wash || !box || !img || !close) return null;

  let opener = null;
  let open = false;

  function openLightbox(trigger) {
    opener = trigger;
    img.src = trigger.dataset.lightboxSrc;
    img.alt = trigger.dataset.lightboxAlt || "";
    if (caption) caption.textContent = trigger.dataset.lightboxCaption || "";
    box.setAttribute("aria-label", trigger.dataset.lightboxCaption || trigger.dataset.lightboxAlt || "Photo");
    open = true;
    box.inert = false;
    box.setAttribute("aria-hidden", "false");
    wash.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    close.focus();
  }

  function closeLightbox() {
    if (!open) return;
    open = false;
    document.body.classList.remove("lightbox-open");
    if (box.contains(document.activeElement)) document.activeElement.blur();
    box.inert = true;
    box.setAttribute("aria-hidden", "true");
    wash.setAttribute("aria-hidden", "true");
    const target = opener;
    opener = null;
    if (target && target.isConnected && !target.closest('[aria-hidden="true"], [inert]')) target.focus();
  }

  root.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lightbox-src]");
    if (trigger && root.contains(trigger)) openLightbox(trigger);
  });
  wash.addEventListener("click", closeLightbox);
  close.addEventListener("click", closeLightbox);
  // Capture phase, before the palette's own Escape handler: the lightbox is
  // the innermost layer whenever it's up, so it goes first and stops there.
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || !open) return;
      event.stopImmediatePropagation();
      closeLightbox();
    },
    true,
  );
  // ⌘K on top of the lightbox swaps surfaces instead of stacking — same
  // contract the homepage and /prompts follow.
  document.addEventListener("cmd:beforeopen", closeLightbox);
  // A failed load closes the box rather than leaving an empty frame.
  img.addEventListener("error", closeLightbox);

  return { open: openLightbox, close: closeLightbox, isOpen: () => open };
}

export function initPortfolioPage(root) {
  const counts = {
    clients: renderList(root, "clients"),
    projects: renderList(root, "projects", { favicon: true, threshold: 3 }),
    personal: renderList(root, "personal"),
    life: renderList(root, "life"),
    writing: renderWriting(root),
    gallery: renderGallery(root),
  };
  wireSeeMore("projects");
  const lightbox = initLightbox(document);
  const graph = renderGraph(root);
  return { counts, lightbox, graph };
}

if (typeof document !== "undefined") {
  const pageRoot = document.querySelector("[data-portfolio-root]");
  if (pageRoot) initPortfolioPage(pageRoot);
}
