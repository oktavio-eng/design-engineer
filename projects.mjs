/* ---------------------------------------------------------------------------
   Projects: carrossel e detalhe compartilhados pela home e pelo protótipo.

   O que ele faz:
     1. monta a seção Projects como carrossel de cards (frame 124:1280);
     2. abre o detalhe do projeto numa superfície nova (frame 133:248),
        que pode ser drawer estilo Vaul ou modal centralizado;
     3. renderiza a galeria de fotos do projeto dentro do detalhe.

   O conteúdo vem de
   `window.PORTFOLIO_CONTENT` — o mesmo objeto que `portfolio.mjs` e `cmd.mjs`
   consomem, servido por `/portfolio-content.js` (que em produção é reescrito
   pro Worker, ou seja, vem do D1 do Studio). Campos usados:

     summary  → a descrição curta do card. Já existe no schema do Studio
                ("Resumo na home", hoje só preenchido em Writing). Sem ele o
                card cai pro `role`, que todo projeto tem.
     preview  → a imagem principal do detalhe ("Imagem de capa" no Studio).
     gallery  → [{src, alt, caption, width?, height?, layout?}]. Sem ele, a galeria é
                montada a partir das capas dos `subprojects`, que é o que a
                Escola da Bel já tem hoje; sem nenhum dos dois, o bloco
                simplesmente não aparece (regra 4 do AGENTS.md: nada de
                moldura vazia).

   Assim a home funciona com os dados que já estão no ar, e melhora
   sozinha conforme o Studio for preenchido.
--------------------------------------------------------------------------- */

import { bindDragCarousel } from '/carousel.mjs';
import { suppliedProjectMedia } from "/project-media.mjs";

const content = window.PORTFOLIO_CONTENT || {};
const root = document.documentElement;

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function favicon(url) {
  return typeof window.favicon === "function" ? window.favicon(url) : "";
}

// Mesma regra de `portfolio.mjs`: rascunho só aparece em localhost ou com
// ?draft. Vale aqui também, senão o protótipo mentiria sobre o que o site
// mostra.
const showDrafts =
  /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || new URLSearchParams(location.search).has("draft");

// Verified local covers for entries whose Studio preview is absent/outdated.
const coverFallbacks = {
  "cloudfaster-academy": "/assets/projects/cloudfaster-academy.png",
  dascia: "/assets/projects/dascia/cover.jpg",
  "finq-edu": "/assets/projects/finq-edu.jpg",
};

/* ===========================================================================
   1. Os três eixos em aberto, como atributos em <html>.
   Cada um é uma decisão que o Figma não fecha e que se decide melhor
   olhando. Persistem em localStorage pra sobreviver ao reload — sem isso,
   comparar duas variantes vira um exercício de memória.
   =========================================================================== */
const AXES = {
  carousel: { key: "proto:carousel", values: ["bleed", "column"], fallback: "bleed" },
  surface: { key: "proto:surface", values: ["drawer", "modal"], fallback: "drawer" },
  hover: { key: "proto:hover", values: ["ring", "fill"], fallback: "ring" },
};

function readAxis(name) {
  const axis = AXES[name];
  let stored = null;
  try {
    stored = localStorage.getItem(axis.key);
  } catch (e) {
    // Modo privado / storage bloqueado: cai no padrão, como todo o resto do
    // site faz (ver "Persistência" em docs/patterns.md).
  }
  return axis.values.includes(stored) ? stored : axis.fallback;
}

function applyAxis(name, value) {
  root.setAttribute("data-proto-" + name, value);
  try {
    localStorage.setItem(AXES[name].key, value);
  } catch (e) {}
}

const isPrototype = Boolean(document.querySelector("[data-proto-panel]"));
for (const name of Object.keys(AXES)) {
  root.setAttribute("data-proto-" + name, isPrototype ? readAxis(name) : AXES[name].fallback);
}

function initPanel() {
  const panel = document.querySelector("[data-proto-panel]");
  if (!panel) return;
  function paint() {
    panel.querySelectorAll("[data-axis]").forEach((button) => {
      const on = root.getAttribute("data-proto-" + button.dataset.axis) === button.dataset.value;
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  // Recolher/expandir, persistido: comparar duas variantes leva tempo, e o
  // painel não pode ficar por cima do que está sendo julgado.
  const toggle = panel.querySelector("[data-proto-toggle]");
  function setOpen(open) {
    panel.classList.toggle("proto-panel--closed", !open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    try {
      localStorage.setItem("proto:panel", open ? "open" : "closed");
    } catch (e) {}
  }
  let stored = null;
  try {
    stored = localStorage.getItem("proto:panel");
  } catch (e) {}
  setOpen(stored !== "closed");
  if (toggle) toggle.addEventListener("click", () => setOpen(panel.classList.contains("proto-panel--closed")));

  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-axis]");
    if (!button) return;
    applyAxis(button.dataset.axis, button.dataset.value);
    paint();
    // Trocar de eixo com o carrossel no meio do caminho deixa o estado das
    // setas mentindo; recalcula na hora.
    syncArrows();
  });
  paint();
}

/* ===========================================================================
   2. O carrossel.
   =========================================================================== */

// A seta pixelada do frame (componente `Arrow Pixelate`, 110:325): cinco
// quadrados de 2px numa caixa de 14×16, apontando pra direita. `currentColor`
// em vez de fill fixo — é o botão que decide se está --ink ou --faint.
function pixelArrow() {
  const squares = [
    [5, 3],
    [7, 5],
    [9, 7],
    [7, 9],
    [5, 11],
  ];
  return (
    '<svg viewBox="0 0 14 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    squares.map(([x, y]) => '<rect x="' + x + '" y="' + y + '" width="2" height="2"/>').join("") +
    "</svg>"
  );
}

// User-supplied marks load directly, including entries without a saved icon.
// External brand domains keep the shared favicon cascade.
function cardMark(entry, key) {
  const source = entry.faviconFrom || suppliedProjectMedia[key]?.faviconFrom || entry.links?.[0]?.[1];
  const local = typeof source === "string" && /^\/assets\/projects\/[a-z0-9/_-]+\.(?:webp|png|jpe?g|svg)$/i.test(source);
  const icon = local
    ? '<img class="fav" src="' + esc(source) + '" alt="" loading="lazy" onerror="this.remove()">'
    : source ? favicon(source) : "";
  return '<span class="pcard__mark' + (local ? " pcard__mark--artwork" : "") + '" aria-hidden="true">' + icon + "</span>";
}

function cardMarkup(key, entry) {
  return (
    '<button class="pcard" type="button" data-proto-open="' + esc(key) + '" aria-haspopup="dialog"' +
    ' data-cuelume-hover="tick" data-cursor="none">' +
    '<span class="pcard__top">' +
    '<svg class="pcard__expand" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M10 3H13V6"/><path d="M9 7L13 3"/><path d="M6 13H3V10"/><path d="M7 9L3 13"/>' +
    "</svg>" +
    "</span>" +
    cardMark(entry, key) +
    '<span class="pcard__text">' +
    '<span class="pcard__title">' + esc(entry.name) + "</span>" +
    // `summary` é o texto do frame ("Interface craft for EdTech with academic
    // clean style"), um registro diferente do `role` ("UX/UI + Design
    // System"). Enquanto o Studio não tiver o campo preenchido, o `role`
    // segura a linha — o card nunca fica com uma linha só.
    '<span class="pcard__desc">' + esc(entry.summary || entry.role || "") + "</span>" +
    "</span>" +
    "</button>"
  );
}

let track = null;
let clearCarousel = () => {};
let prevButton = null;
let nextButton = null;

// O estado das setas nasce do scroll real da trilha, não de um índice
// próprio: arrastar com o dedo, rolar no trackpad ou dar Tab pro próximo
// card mexem no scroll sem passar pelas setas, e um índice paralelo
// dessincronizaria na primeira dessas.
function syncArrows() {
  if (!track || !prevButton || !nextButton) return;
  const max = track.scrollWidth - track.clientWidth;
  // 1px de tolerância: scrollLeft é fracionário em telas com zoom/DPR
  // não-inteiro e nunca encosta exatamente no máximo.
  prevButton.disabled = track.scrollLeft <= 1;
  nextButton.disabled = track.scrollLeft >= max - 1;
}

// O passo sai do layout real (card + gap), não de um número repetido aqui:
// se a largura do card mudar no CSS, a seta acompanha sozinha. Ler a custom
// property não serviria — `getPropertyValue` devolve o `calc(...)` como
// texto, sem resolver.
function step(direction) {
  if (!track) return;
  const card = track.querySelector(".pcard");
  const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
  const distance = card ? card.offsetWidth + gap : 282;
  track.scrollBy({ left: direction * distance, behavior: "smooth" });
}

export function renderProjects(host) {
  if (!host) return 0;
  const map = content.projects || {};
  const keys = Object.keys(map).filter((key) => showDrafts || !map[key].draft);
  if (!keys.length) return 0;

  clearCarousel();
  host.innerHTML =
    '<div class="pjt__head">' +
    "<h2>Projects</h2>" +
    '<div class="pjt__arrows">' +
    '<button class="pjt__arrow pjt__arrow--prev" type="button" aria-label="Previous projects" data-proto-prev disabled>' + pixelArrow() + "</button>" +
    '<button class="pjt__arrow pjt__arrow--next" type="button" aria-label="Next projects" data-proto-next>' + pixelArrow() + "</button>" +
    "</div>" +
    "</div>" +
    '<div class="pjt__track" data-proto-track>' +
    keys.map((key) => cardMarkup(key, map[key])).join("") +
    "</div>";

  track = host.querySelector("[data-proto-track]");
  clearCarousel = bindDragCarousel(track);
  prevButton = host.querySelector("[data-proto-prev]");
  nextButton = host.querySelector("[data-proto-next]");
  prevButton.addEventListener("click", () => step(-1));
  nextButton.addEventListener("click", () => step(1));
  track.addEventListener("scroll", syncArrows, { passive: true });
  // A largura muda com o eixo `bleed`/`column` e com o resize da janela; as
  // setas têm que reavaliar nos dois casos.
  if (typeof ResizeObserver === "function") new ResizeObserver(syncArrows).observe(track);
  syncArrows();
  host.hidden = false;
  return keys.length;
}

/* ===========================================================================
   3. O detalhe do projeto.
   =========================================================================== */

// O ritmo do frame: duas meias, uma inteira, duas meias, uma inteira. Em vez
// de fixar seis posições, a regra é "a cada três imagens, a terceira é
// inteira" — e uma foto sobrando no fim vira inteira também, senão fica uma
// meia órfã ocupando metade da linha.
function isWide(index, total) {
  // Órfã = a última foto quando ela seria a PRIMEIRA de um par (index % 3 === 0)
  // e não existe segunda. Uma última foto com `index % 3 === 1` tem par e
  // continua meia.
  return index % 3 === 2 || (index === total - 1 && index % 3 === 0);
}

// A galeria: o campo `gallery` do Studio quando existe; senão as capas dos
// `subprojects` (a Escola da Bel já tem cinco), que é conteúdo real e não
// placeholder. Sem nenhum dos dois o bloco não é renderizado.
function galleryPhotos(entry) {
  if (Array.isArray(entry.gallery) && entry.gallery.length) {
    return entry.gallery.filter((photo) => photo && photo.src);
  }
  if (Array.isArray(entry.subprojects)) {
    return entry.subprojects
      .filter((sub) => sub && sub.preview)
      .map((sub) => ({ src: sub.preview, alt: sub.name, caption: sub.name, layout: "cover" }));
  }
  return [];
}

const suppliedPhotos = new Map(Object.values(suppliedProjectMedia)
  .flatMap(media => (media.gallery || []).map(photo => [photo.src, photo])));

let galleryRenderCount = 0;

export function galleryMarkup(entry) {
  const photos = galleryPhotos(entry).map(photo => ({ ...suppliedPhotos.get(photo.src), ...photo }));
  if (!photos.length) return "";
  const galleryID = "pgal-" + (++galleryRenderCount);
  let imageCount = 0;
  function imageButton(photo, wide = false) {
    const captionID = galleryID + "-caption-" + imageCount++;
    const alt = photo.alt || photo.caption || "";
    const mobile = photo.layout === "mobile";
    const dimensions = Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0
      ? ' width="' + photo.width + '" height="' + photo.height + '"' : "";
    return '<button class="pgal__item' + (mobile ? " pgal__item--mobile" : wide ? " pgal__item--wide" : "") +
      (photo.layout === "full" ? " pgal__item--full" : "") +
      (photo.caption ? " pgal__item--captioned" : "") + '" type="button"' +
      ' data-cursor="ring" aria-label="' + esc(alt || "Enlarge image") + '"' +
      (photo.caption ? ' aria-describedby="' + captionID + '"' : "") +
      ' data-lightbox-src="' + esc(photo.src) + '"' +
      ' data-lightbox-alt="' + esc(alt) + '"' +
      ' data-lightbox-caption="' + esc(photo.caption || "") + '">' +
      '<img class="pgal__img' + (photo.layout === "cover" ? ' pgal__img--cover' : '') + '" data-cursor="ring" src="' + esc(photo.src) + '" alt=""' + dimensions +
      ' loading="lazy" decoding="async" onerror="this.parentElement.remove()">' +
      (photo.caption ? '<span class="pgal__caption" id="' + captionID + '">' + esc(photo.caption) + '</span>' : "") +
      '</button>';
  }
  let html = '<div class="pgal">';
  for (let index = 0; index < photos.length;) {
    const mobile = photos[index].layout === "mobile";
    const run = [];
    while (index < photos.length && (photos[index].layout === "mobile") === mobile) run.push(photos[index++]);
    if (mobile) html += '<div class="pgal__mobile-row">' + run.map(photo => imageButton(photo)).join("") + '</div>';
    else html += run.map((photo, i) => imageButton(photo, photo.layout === "wide" || photo.layout === "full" || isWide(i, run.length))).join("");
  }
  return html + '</div>';
}

// Keep captions below the visual row, including when three columns become two.
export function arrangeMobileCaptions(root) {
  const cleanups = [];
  for (const grid of root.querySelectorAll(".pgal__mobile-row")) {
    const cards = [...grid.querySelectorAll(":scope > .pgal__item")];
    const captions = new Map(cards.map(card => [card, card.querySelector(".pgal__caption")]));
    let columns = 0;
    let active = true;
    const sync = () => {
      if (!active) return;
      const next = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      if (columns === next) return;
      columns = next;
      const focused = grid.contains(document.activeElement) ? document.activeElement : null;
      const visible = cards.filter(card => grid.contains(card));
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < visible.length; i += columns) {
        const row = visible.slice(i, i + columns);
        const notes = document.createElement("div");
        notes.className = "pgal__mobile-captions";
        for (const card of row) {
          fragment.append(card);
          const caption = captions.get(card);
          if (caption) notes.append(caption);
        }
        if (notes.children.length) fragment.append(notes);
      }
      grid.replaceChildren(fragment);
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    };
    const onError = event => {
      const card = event.target.closest?.(".pgal__item");
      if (!card) return;
      captions.get(card)?.remove();
      queueMicrotask(() => { columns = 0; sync(); });
    };
    grid.addEventListener("error", onError, true);
    sync();
    const observer = new ResizeObserver(() => {
      if (!grid.isConnected) { observer.disconnect(); return; }
      sync();
    });
    observer.observe(grid);
    cleanups.push(() => { active = false; observer.disconnect(); grid.removeEventListener("error", onError, true); });
  }
  return () => cleanups.forEach(cleanup => cleanup());
}

function caseSectionsMarkup(entry) {
  return (entry.sections || []).map(section =>
    '<section class="pdrawer__section pdrawer__decision">' +
    (section.label ? '<h3 class="label">' + esc(section.label) + '</h3>' : "") +
    (section.text ? '<p class="pdrawer__item">' + esc(section.text) + '</p>' : "") +
    (section.list || []).map(text => '<p class="pdrawer__item">' + esc(text) + '</p>').join("") +
    '</section>'
  ).join("");
}

function detailMarkup(entry, key) {
  let html = "";
  // Imagem principal (frame 133:247). Como toda imagem externa do site, ela
  // se remove sozinha se não carregar em vez de deixar um retângulo cinza —
  // o `onerror` precisa ser atributo porque a marcação entra por innerHTML.
  const preview = entry.preview === "https://cloudfaster.academy/assets/og-image.png"
    ? coverFallbacks[key] : entry.preview || coverFallbacks[key];
  if (preview) {
    html += '<img class="pdrawer__shot" src="' + esc(preview) + '" alt="" loading="lazy" onerror="this.remove()">';
  }
  html += '<div class="pdrawer__body">';
  html +=
    '<div class="pdrawer__head">' +
    '<h2 class="pdrawer__title">' + esc(entry.name) + "</h2>" +
    (entry.role ? '<p class="pdrawer__role">' + entry.role + "</p>" : "") +
    (entry.links?.length
      ? '<div class="pdrawer__links">' + entry.links.map((link) =>
          '<a class="pdrawer__link" href="' + esc(link[1]) + '" target="_blank" rel="noopener" data-cursor="merge">' +
          favicon(link[1]) + '<span>' + esc(link[0]) + '</span></a>',
        ).join('') + '</div>'
      : '') +
    (Array.isArray(entry.bio)
      ? entry.bio.map((p) => '<p class="pdrawer__bio">' + p + "</p>").join("")
      : entry.bio ? '<p class="pdrawer__bio">' + entry.bio + "</p>" : "") +
    "</div>";

  html += caseSectionsMarkup(entry);

  const gallery = galleryMarkup(entry);
  if (gallery) html += gallery;

  if (entry.items && entry.items.length) {
    html +=
      '<div class="pdrawer__section">' +
      '<span class="label">In practice</span>' +
      '<div class="pdrawer__items">' +
      entry.items.map((item) => '<p class="pdrawer__item">' + item + "</p>").join("") +
      "</div></div>";
  }
  if (entry.subprojects?.length) {
    html +=
      '<div class="pdrawer__section">' +
      '<span class="label">Landing pages</span>' +
      '<div class="pdrawer__landings">' +
      entry.subprojects.map((sub) =>
        '<a class="subproject" href="' + esc(sub.url) + '" target="_blank" rel="noopener" data-cursor="merge">' +
        '<span class="subproject__name inline-link">' + esc(sub.name) + '</span>' +
        (sub.description ? '<p class="subproject__desc">' + esc(sub.description) + '</p>' : '') +
        '</a>',
      ).join('') +
      '</div></div>';
  }
  html += "</div>";
  return html;
}

/* --- a superfície --------------------------------------------------------
   Drawer e modal compartilham marcação e estado; o que muda é CSS. O gesto
   de arrastar só é armado no modo drawer.
--------------------------------------------------------------------------- */
// `pretty` is advisory and can still leave a one-word final line. Keep the
// final pair together without changing source copy or rebuilding inline HTML.
function keepFinalWordsTogether(body) {
  const doc = body.ownerDocument;
  for (const block of body.querySelectorAll('h2, h3, p, .pgal__caption, .subproject__name')) {
    const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let tail = null;
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim()) tail = walker.currentNode;
    }
    const match = tail?.textContent.match(/\S+\s+\S+\s*$/u);
    if (!match) continue;
    const pair = doc.createElement('span');
    pair.className = 'pdrawer__final-words';
    const range = doc.createRange();
    range.setStart(tail, match.index);
    range.setEnd(tail, tail.length);
    range.surroundContents(pair);
  }
}

export function initDetail(doc = document) {
  const wash = doc.querySelector("[data-proto-wash]");
  const sheet = doc.querySelector("[data-proto-sheet]");
  const body = doc.querySelector("[data-proto-sheet-body]");
  const grip = doc.querySelector("[data-proto-grip]");
  const close = doc.querySelector("[data-proto-close]");
  if (!wash || !sheet || !body) return null;
  wash.dataset.cursorHint = 'close';

  let opener = null;
  let open = false;
  let clearGallery = () => {};

  // A página atrás sai da ordem de foco enquanto o detalhe está de pé. O
  // `.cmd-modal` do site não faz isso (a folha é pequena e o conteúdo atrás
  // é curto); aqui a folha cobre quase tudo e tem links dentro, então deixar
  // o Tab escapar pra trás seria perder o usuário. Não é `body`: um `inert`
  // ali levaria a própria folha junto.
  const behind = [doc.querySelector("main"), doc.querySelector(".topbar")].filter(Boolean);

  function show(key, collection = "projects") {
    const entry = (content[collection] || {})[key];
    if (!entry) return;
    clearGallery();
    body.innerHTML = detailMarkup(entry, key);
    keepFinalWordsTogether(body);
    clearGallery = arrangeMobileCaptions(body);
    sheet.setAttribute("aria-label", entry.name);
    sheet.scrollTop = 0;
    open = true;
    sheet.inert = false;
    sheet.setAttribute("aria-hidden", "false");
    wash.setAttribute("aria-hidden", "false");
    document.body.classList.add("pdrawer-open");
    behind.forEach((el) => (el.inert = true));
    // No modo drawer quem recebe o foco é a alça (é o controle de fechar);
    // no modo modal, o botão. `offsetParent` é null pro que o CSS escondeu.
    (close && close.offsetParent !== null ? close : grip || sheet).focus();
  }

  function hide() {
    if (!open) return;
    clearGallery();
    open = false;
    document.body.classList.remove("pdrawer-open");
    behind.forEach((el) => (el.inert = false));
    if (sheet.contains(document.activeElement)) document.activeElement.blur();
    sheet.inert = true;
    sheet.setAttribute("aria-hidden", "true");
    wash.setAttribute("aria-hidden", "true");
    sheet.style.transform = "";
    const target = opener;
    opener = null;
    if (target && target.isConnected) target.focus();
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-proto-open]");
    if (!trigger) return;
    opener = trigger;
    show(trigger.dataset.protoOpen, trigger.dataset.protoCollection || "projects");
  });
  wash.addEventListener("click", hide);
  if (close) close.addEventListener("click", hide);
  if (grip) grip.addEventListener("click", (event) => {
    if (event.detail === 0) hide(); // Keyboard activation; pointer keeps drag.
  });

  // Escape em fase de bolha: o lightbox da galeria escuta em captura e para
  // ali (portfolio.mjs), então uma foto aberta fecha primeiro e o detalhe
  // continua de pé. É a mesma hierarquia que o site já usa.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) hide();
    if (event.key === "Tab" && open && sheet.contains(document.activeElement)) {
      const focusable = [...sheet.querySelectorAll('button, a[href], input, textarea, select, [tabindex="0"]')]
        .filter((el) => !el.disabled && el.getClientRects().length);
      const target = event.shiftKey ? focusable.at(-1) : focusable[0];
      const boundary = event.shiftKey ? focusable[0] : focusable.at(-1);
      if (document.activeElement === boundary) {
        event.preventDefault();
        target?.focus();
      }
    }
  });
  // ⌘K por cima do detalhe troca de superfície em vez de empilhar — mesmo
  // contrato que o lightbox segue.
  document.addEventListener("cmd:beforeopen", hide);
  document.addEventListener("mail:beforeopen", hide);

  /* Arrastar pra fechar (só no modo drawer). Sem biblioteca: pointer events
     cobrem dedo, caneta e mouse com um código só. Três regras que fazem a
     diferença entre "arrasta" e "parece o Vaul":
       1. só começa se o conteúdo estiver no topo, senão o gesto de rolar a
          lista viraria um gesto de fechar;
       2. só puxa pra baixo (`Math.max(0, …)`) — puxar pra cima uma folha
          que já está no limite é elástico em iOS e errado aqui;
       3. solta olhando distância OU velocidade: um flick curto e rápido
          fecha, um arrasto longo e lento também, e um arrasto longo que
          volta não fecha. */
  let dragging = false;
  let startY = 0;
  let startTime = 0;
  let delta = 0;

  function canDrag() {
    return root.getAttribute("data-proto-surface") === "drawer";
  }

  function onDown(event) {
    if (dragging || !open || !canDrag() || event.button > 0) return;
    // Fora da alça o gesto só arma em área morta e com o conteúdo no topo:
    // capturar o ponteiro em cima de um link ou de uma foto da galeria
    // engoliria o clique dela, e arrastar no meio de uma lista rolada seria
    // ambíguo com o gesto de rolar.
    if (!event.target.closest("[data-proto-grip]")) {
      if (sheet.scrollTop > 0 || event.target.closest("a, button, input, textarea, select")) return;
    }
    dragging = true;
    startY = event.clientY;
    startTime = event.timeStamp;
    delta = 0;
    sheet.classList.add("is-dragging");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onMove(event) {
    if (!dragging) return;
    delta = Math.max(0, event.clientY - startY);
    sheet.style.transform = "translate(-50%, " + delta + "px)";
  }

  function onUp(event) {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove("is-dragging");
    sheet.style.transform = "";
    const elapsed = Math.max(1, event.timeStamp - startTime);
    const velocity = delta / elapsed; // px por ms
    if (delta > 120 || velocity > 0.5) hide();
    delta = 0;
  }

  for (const target of [grip, sheet].filter(Boolean)) {
    target.addEventListener("pointerdown", onDown);
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  return { open: show, close: hide, isOpen: () => open };
}

/* ===========================================================================
   Boot.
   =========================================================================== */
if (typeof document !== "undefined") {
  const host = document.querySelector("[data-proto-projects]");
  if (host) {
    renderProjects(host);
    initDetail(document);
    initPanel();
  }
}
