import { icon } from './ui.mjs';

/**
 * Studio typeface — three discrete positions on one slider, after Codex's
 * reasoning-effort control: a compact popover with the current family named
 * above a rounded track with markers and a round thumb. Sans and Mono are the
 * real variable files (any weight in 100..900); Pixel keeps its native single
 * 400 and its own `ELSH` shape (Square = 1, set in admin.css), so it is the one
 * accepted exception to the Studio's Medium floor. The choice lives on the
 * root element as `data-typeface` (restored early by admin/theme.js) and in
 * localStorage as `studio.typeface`.
 */
export const TYPEFACES = [
  { id: 'sans', name: 'Geist Sans', note: 'A mesma do portfólio.' },
  { id: 'mono', name: 'Geist Mono', note: 'Monoespaçada, largura fixa.' },
  { id: 'pixel', name: 'Geist Pixel', note: 'Bitmap, no desenho e peso originais.' },
];
export const TYPEFACE_KEY = 'studio.typeface';
const POPOVER_ID = 'admin-typeface-popover';
const label = face => `Fonte do Studio: ${face.name}`;

/** Sidebar control: the trigger names the current family; the popover is shared with the mobile trigger. */
export const typefaceControl = () => `<div class="admin-typeface"><button type="button" class="admin-typeface-trigger" data-typeface-trigger data-cuelume-hover="tick" popovertarget="${POPOVER_ID}" aria-controls="${POPOVER_ID}" aria-expanded="false" aria-label="${label(TYPEFACES[0])}">${icon('type')}<span data-typeface-label>${TYPEFACES[0].name}</span>${icon('chevron')}</button>
  <div class="admin-typeface-popover" id="${POPOVER_ID}" popover role="dialog" aria-label="Fonte do Studio" data-face="sans"><p class="admin-typeface-name" data-typeface-name>${TYPEFACES[0].name}</p><p class="admin-typeface-note" data-typeface-note>${TYPEFACES[0].note}</p><div class="admin-typeface-slider"><span class="admin-typeface-ticks" aria-hidden="true"><i></i><i></i><i></i></span><input class="admin-typeface-range" type="range" min="0" max="${TYPEFACES.length - 1}" step="1" value="0" aria-label="Família tipográfica do Studio" aria-valuetext="${TYPEFACES[0].name}"></div><div class="admin-typeface-legend" aria-hidden="true">${TYPEFACES.map(face => `<span>${face.name.replace('Geist ', '')}</span>`).join('')}</div></div></div>`;
/** Icon-only trigger for the topbar on phones, where the sidebar footer is hidden. */
export const typefaceButton = className => `<button type="button" class="admin-icon-button ${className}" data-typeface-trigger popovertarget="${POPOVER_ID}" aria-controls="${POPOVER_ID}" aria-expanded="false" aria-label="${label(TYPEFACES[0])}">${icon('type')}</button>`;

export const readTypeface = storage => {
  try { const value = storage.getItem(TYPEFACE_KEY); return TYPEFACES.some(face => face.id === value) ? value : 'sans'; } catch (_) { return 'sans'; }
};

/** Wires every trigger and the shared popover inside `root`; returns a cleanup. */
export function setupTypeface(root, { storage, target } = {}) {
  try { storage ??= window.localStorage; } catch (_) {}
  target ??= document.documentElement;
  const popover = root.querySelector('#' + POPOVER_ID);
  if (!popover) return () => {};
  const triggers = [...root.querySelectorAll('[data-typeface-trigger]')];
  const range = popover.querySelector('.admin-typeface-range');
  let opener = null;
  function apply(id, persist = false) {
    const index = Math.max(0, TYPEFACES.findIndex(face => face.id === id));
    const face = TYPEFACES[index];
    target.dataset.typeface = face.id;
    popover.dataset.face = face.id;
    range.value = String(index); range.setAttribute('aria-valuetext', face.name);
    popover.querySelector('[data-typeface-name]').textContent = face.name;
    popover.querySelector('[data-typeface-note]').textContent = face.note;
    for (const trigger of triggers) {
      trigger.setAttribute('aria-label', label(face));
      const text = trigger.querySelector('[data-typeface-label]'); if (text) text.textContent = face.name;
    }
    if (persist) { try { storage?.setItem(TYPEFACE_KEY, face.id); } catch (_) {} }
  }
  function place() {
    const anchor = opener ?? triggers[0];
    if (!anchor) return;
    // Runs from `beforetoggle`, while the popover is still display:none: force
    // a box for one synchronous measurement so the first frame already lands
    // at the right spot (positioning from `toggle`, a queued task, painted one
    // frame at the previous opener's position — the mobile trigger inherited
    // the sidebar's slot). Nothing paints in between.
    const inline = popover.style.display; popover.style.display = 'block';
    const width = popover.offsetWidth, height = popover.offsetHeight;
    popover.style.display = inline;
    const r = anchor.getBoundingClientRect(), gap = 8;
    // Opens away from the nearer edge: up from the sidebar's foot, down from
    // the phone topbar — unless that side has no room.
    const fitsAbove = r.top - height - gap >= gap, fitsBelow = r.bottom + height + gap <= innerHeight - gap;
    const above = r.top + r.height / 2 > innerHeight / 2 ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
    popover.dataset.side = above ? 'top' : 'bottom';
    popover.style.top = `${above ? r.top - height - gap : r.bottom + gap}px`;
    const left = r.left + r.width / 2 > innerWidth / 2 ? r.right - width : r.left;
    popover.style.left = `${Math.max(gap, Math.min(left, innerWidth - width - gap))}px`;
  }
  const onBeforeToggle = event => {
    if (event.newState !== 'open') return;
    opener = triggers.find(trigger => trigger.contains(document.activeElement)) ?? opener ?? triggers[0];
    place();
  };
  const onToggle = event => {
    const open = event.newState === 'open';
    // Keyboard users land on the slider; Escape hands focus back to the opener.
    if (open && !popover.contains(document.activeElement)) range.focus({ preventScroll: true });
    for (const trigger of triggers) trigger.setAttribute('aria-expanded', String(open));
  };
  const hide = () => { if (popover.matches(':popover-open')) popover.hidePopover(); };
  const onInput = () => apply(TYPEFACES[Number(range.value)]?.id, true);
  const onTriggerFocus = event => { opener = event.currentTarget; };
  popover.addEventListener('beforetoggle', onBeforeToggle);
  popover.addEventListener('toggle', onToggle);
  range.addEventListener('input', onInput);
  for (const trigger of triggers) trigger.addEventListener('pointerdown', onTriggerFocus);
  for (const trigger of triggers) trigger.addEventListener('focus', onTriggerFocus);
  window.addEventListener('resize', hide);
  apply(readTypeface(storage));
  return () => {
    hide();
    popover.removeEventListener('beforetoggle', onBeforeToggle);
    popover.removeEventListener('toggle', onToggle);
    range.removeEventListener('input', onInput);
    window.removeEventListener('resize', hide);
  };
}
