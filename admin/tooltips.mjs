/** Shares the contribution card's surface, delay, easing and warm traversal. */
export function setupTooltips(scope = document) {
  const doc = scope.ownerDocument || scope;
  const tip = doc.createElement('div');
  tip.className = 'contrib__tip admin-tooltip'; tip.id = 'admin-tooltip';
  tip.setAttribute('role', 'tooltip'); tip.setAttribute('popover', 'manual');
  tip.dataset.open = 'false'; doc.body.append(tip);
  const ms = token => parseFloat(getComputedStyle(doc.documentElement).getPropertyValue(token)) || 0;
  let current, timer, closeTimer, warmTimer, warm = false;
  const target = node => {
    const button = node instanceof Element ? node.closest('.admin-icon-button, .admin-shell[data-sidebar-collapsed="true"] .admin-nav-item, .admin-shell[data-sidebar-collapsed="true"] .admin-typeface-trigger') : null;
    return button?.getAttribute('aria-label') && !button.disabled ? button : null;
  };
  function hide() {
    clearTimeout(timer); clearTimeout(closeTimer);
    tip.dataset.open = 'false'; current?.removeAttribute('aria-describedby'); current = null;
    closeTimer = setTimeout(() => { if (tip.matches(':popover-open')) tip.hidePopover(); }, ms('--tip-out'));
    clearTimeout(warmTimer); warmTimer = setTimeout(() => { warm = false; }, ms('--tip-warm'));
  }
  function show(button, instant) {
    if (!button.isConnected || !button.getClientRects().length) return hide();
    tip.textContent = button.getAttribute('aria-label');
    if (!tip.matches(':popover-open')) tip.showPopover();
    const r = button.getBoundingClientRect(), width = tip.offsetWidth, height = tip.offsetHeight, gap = 8;
    const top = r.top - height - gap >= gap;
    tip.dataset.side = top ? 'top' : 'bottom';
    tip.style.top = `${top ? r.top - height - gap : r.bottom + gap}px`;
    tip.style.left = `${Math.max(gap, Math.min(r.left + r.width / 2 - width / 2, innerWidth - width - gap))}px`;
    tip.classList.toggle('contrib__tip--instant', instant);
    void tip.offsetWidth;
    button.setAttribute('aria-describedby', tip.id); tip.dataset.open = 'true'; warm = true;
    clearTimeout(warmTimer);
  }
  function enter(button, immediate = false) {
    if (current === button) return;
    hide(); clearTimeout(closeTimer);
    current = button;
    if (immediate || warm) show(button, true);
    else timer = setTimeout(() => { if (current === button) show(button, false); }, ms('--tip-delay'));
  }
  scope.addEventListener('pointerover', e => { if (e.pointerType !== 'touch') { const button = target(e.target); if (button) enter(button); } });
  scope.addEventListener('pointerout', e => {
    if (current?.contains(e.target) && !current.contains(e.relatedTarget) && e.relatedTarget !== tip) {
      clearTimeout(timer); closeTimer = setTimeout(hide, ms('--tip-out'));
    }
  });
  tip.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  tip.addEventListener('pointerleave', hide);
  scope.addEventListener('focusin', e => { const button = target(e.target); if (button?.matches(':focus-visible')) enter(button, true); });
  scope.addEventListener('focusout', hide);
  scope.addEventListener('pointerdown', hide);
  scope.addEventListener('keydown', e => { if (e.key === 'Escape' && tip.dataset.open === 'true') { e.preventDefault(); e.stopPropagation(); hide(); } }, true);
  doc.addEventListener('scroll', hide, { capture: true, passive: true });
  window.addEventListener('resize', hide);
}
