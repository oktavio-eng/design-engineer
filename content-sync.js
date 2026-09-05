/* Runs before script.js snapshots the wiki's rows.
 * Unedited rows keep their authored summaries and existing disclosure layout. */
(function () {
  if (!window.CMS_BASE || !window.SITE_CONTENT) return;
  /* Phase items are authored HTML (glossary spans) that now arrives from the
   * Studio through the Worker instead of a reviewed PR. Keep only the tags and
   * attributes the wiki actually uses; everything else is dropped, text kept. */
  const SAFE_TAGS = { SPAN: ['class', 'tabindex'], A: ['href', 'target', 'rel', 'class'], EM: [], STRONG: [], CODE: [], BR: [] };
  function safeFragment(html) {
    const doc = new DOMParser().parseFromString('<body>' + String(html) + '</body>', 'text/html');
    const walk = node => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType !== 1) { if (child.nodeType !== 3) child.remove(); continue; }
        if (/^(SCRIPT|STYLE|TEMPLATE|IFRAME|OBJECT|EMBED)$/.test(child.tagName)) { child.remove(); continue; }
        const allowed = SAFE_TAGS[child.tagName];
        if (!allowed) { child.replaceWith(...Array.from(child.childNodes)); walk(node); return; }
        for (const attr of Array.from(child.attributes)) {
          if (!allowed.includes(attr.name)) child.removeAttribute(attr.name);
          else if (attr.name === 'href' && !/^https?:\/\//i.test(attr.value.trim())) child.removeAttribute('href');
        }
        if (child.tagName === 'A' && child.hasAttribute('href')) { child.target = '_blank'; child.rel = 'noopener'; }
        walk(child);
      }
    };
    walk(doc.body);
    const frag = document.createDocumentFragment(); frag.append(...Array.from(doc.body.childNodes)); return frag;
  }
  // Key-order-independent comparison: a Studio re-save that changes nothing
  // must not count as an edit, or the authored row would be rewritten.
  const canon = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  function keyboardRow(row) {
    row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-haspopup', 'dialog');
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); } });
  }
  const groups = { people: 'person', refs: 'ref', courses: 'course', readings: 'reading', phases: 'phase' };
  for (const [group, attr] of Object.entries(groups)) {
    const entries = window.SITE_CONTENT[group], baseline = window.CMS_BASE[group];
    const rows = Array.from(document.querySelectorAll('[data-' + attr + ']'));
    const section = rows[0]?.closest('section');
    if (!section) continue;
    for (const row of rows) {
      const key = row.dataset[attr], entry = entries[key];
      if (!entry) { row.remove(); continue; }
      if (canon(entry) === canon(baseline[key])) continue;
      const name = row.querySelector(group === 'phases' ? 'h3' : '.who');
      if (name) {
        const image = name.querySelector('img')?.cloneNode(true);
        name.textContent = '';
        const link = entry.links?.[0]?.[1];
        if (link && group !== 'phases') {
          const anchor = document.createElement('a'); anchor.href = link; anchor.target = '_blank'; anchor.rel = 'noopener'; anchor.textContent = entry.name; name.append(anchor);
        } else { name.textContent = entry.name; if (group !== 'phases') keyboardRow(row); }
        if (image) name.prepend(image);
      }
      const role = row.querySelector('.what');
      if (role) role.textContent = entry.role || '';
      if (group === 'phases' && entry.items) {
        const list = row.querySelector('ul');
        list?.replaceChildren(...entry.items.map(text => { const li = document.createElement('li'); li.append(safeFragment(text)); return li; }));
      }
    }
    for (const [key, entry] of Object.entries(entries)) {
      if (rows.some(row => row.dataset[attr] === key)) continue;
      const row = document.createElement(group === 'phases' ? 'div' : 'button');
      row.className = group === 'phases' ? 'phase' : 'row row-btn';
      if (group !== 'phases') { row.type = 'button'; row.setAttribute('aria-haspopup', 'dialog'); }
      row.dataset[attr] = key; row.dataset.cuelumeHover = 'tick'; row.dataset.cuelumeToggle = 'bloom';
      const name = document.createElement(group === 'phases' ? 'h3' : 'span'); name.className = 'who'; name.textContent = entry.name;
      const role = document.createElement('span'); role.className = 'what'; role.textContent = entry.role || '';
      if (group === 'phases') {
        const head = document.createElement('div'); head.className = 'phase-head'; keyboardRow(head);
        const number = document.createElement('span'); number.className = 'phase-num'; number.textContent = String(Object.keys(entries).indexOf(key) + 1).padStart(2, '0');
        head.append(number, name);
        const list = document.createElement('ul');
        for (const text of entry.items || []) { const li = document.createElement('li'); li.append(safeFragment(text)); list.append(li); }
        row.append(head, list);
      } else row.append(name, role);
      const host = group === 'phases' ? section.querySelector('.phases') : section;
      host.insertBefore(row, group === 'phases' ? null : section.querySelector('.extras, .see-more'));
    }
    section.hidden = !Object.keys(entries).length;
    const extras = section.querySelector('.extras');
    if (extras && !extras.querySelector('.row')) { extras.remove(); const button = section.querySelector('.see-more'); if (button) button.hidden = true; }
  }
})();
