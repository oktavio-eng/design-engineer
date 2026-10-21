/* Shared mouse drag for horizontal carousels. Touch/trackpad scrolling stays
   native. The marker also opts into the global dot + Drag cursor treatment. */
const bindings = new WeakMap();
export function bindDragCarousel(track) {
  if (bindings.has(track)) return bindings.get(track);
  const controller = new AbortController();
  const on = (node, type, listener, options = {}) => node.addEventListener(type, listener, { ...options, signal: controller.signal });
  track.setAttribute('data-drag-carousel', '');
  const win = track.ownerDocument.defaultView;
  let gesture = null;
  let suppressClick = false;

  function finish(event) {
    if (!gesture || (event.pointerId != null && event.pointerId !== gesture.id)) return;
    const { id, dragging } = gesture;
    gesture = null;
    if (track.hasPointerCapture(id)) track.releasePointerCapture(id);
    track.removeAttribute('data-dragging');
    if (dragging) {
      // Restoring snap lets the browser settle to a card using its real
      // scroll-padding, including the full-bleed rail's asymmetric inset.
      suppressClick = true;
    }
  }
  on(track, 'pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
    suppressClick = false;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, scroll: track.scrollLeft, dragging: false };
  });
  on(win, 'pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) { gesture = null; return; }
      if (Math.abs(dx) < 6) return;
      gesture.dragging = true;
      track.setAttribute('data-dragging', '');
      track.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    track.scrollLeft = gesture.scroll - dx;
  }, { passive: false });
  on(win, 'pointerup', finish, { capture: true });
  on(win, 'pointercancel', finish, { capture: true });
  on(win, 'blur', finish);
  on(track, 'lostpointercapture', finish);
  on(track, 'dragstart', event => event.preventDefault());
  on(track, 'click', event => {
    if (!suppressClick || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, { capture: true });
  const cleanup = () => {
    finish({});
    controller.abort();
    track.removeAttribute('data-drag-carousel');
    bindings.delete(track);
  };
  bindings.set(track, cleanup);
  return cleanup;
}
