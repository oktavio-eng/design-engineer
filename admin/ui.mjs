export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const plainText = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
const paths = {
  inbox: '<path d="m4 5-2 9v4a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-4l-2-9a3 3 0 0 0-3-2H7a3 3 0 0 0-3 2Z"/><path d="M2 14h5l2 3h6l2-3h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m4 7 8 6 8-6"/>',
  mailRead: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0 1 9 6 9-6"/>',
  archive: '<rect x="3" y="3" width="18" height="5" rx="2"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M9 4v16m6-11-3 3 3 3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  book: '<path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  external: '<path d="M13 4h7v7M20 4 10 14M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  logout: '<path d="M9 3H4v18h5M10 12h11m-4-4 4 4-4 4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
export const brand = () => `<span class="admin-brand-mark" aria-hidden="true"><svg width="44" height="56" viewBox="0 0 44 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22.2308 41.1974C33.2757 41.1974 42.2294 44.2682 42.2296 48.0565C42.2296 51.8448 33.2759 54.9158 22.2308 54.9158C11.1857 54.9158 2.23175 51.8448 2.23175 48.0565C2.23194 44.2682 11.1858 41.1974 22.2308 41.1974Z" fill="currentColor"/>
      <path d="M26.01 1.13301C26.8922 0.942593 27.8093 1.19536 28.4739 1.76271C29.0102 2.26793 29.2628 2.93249 29.1696 3.59316V3.58922L27.5607 15.87L25.0656 37.7187L22.4774 38.3834L24.8753 17.0747L18.6882 17.5177L18.2452 20.6425C18.183 21.2759 17.74 21.7459 17.1727 21.781L2.77784 23.1063C1.98892 23.1374 1.29326 22.5389 1.35544 21.8433L2.33482 12.0887C2.36591 11.6145 2.74666 11.2375 3.25188 11.1093L7.44915 10.0366C7.51132 10.0366 7.60837 10.0366 7.67053 10.0055L9.46996 9.53149L14.6466 8.23739C14.9614 8.1441 15.214 7.82525 15.214 7.47939C15.2139 7.44827 15.1827 7.38607 15.1827 7.32006C15.0583 6.94315 14.6775 6.69045 14.2656 6.78371L9.62534 7.98473L9.78467 6.1853C9.84687 5.23706 10.6049 4.44806 11.6464 4.22654L26.01 1.13301Z" fill="currentColor"/>
    </svg></span><span>GOW Design<span class="admin-brand-sub">Studio</span></span>`;
export const statusBadge = draft => `<span class="admin-badge${draft ? ' is-draft' : ''}"><span aria-hidden="true">${draft ? '◌' : '•'}</span> ${draft ? 'Rascunho' : 'Visível'}</span>`;
export const contentRow = (collection, key, entry, collectionLabel) => `<button type="button" class="admin-content-row" data-cuelume-hover="tick" data-cuelume-toggle="bloom" data-edit="${escapeHTML(collection)}:${escapeHTML(key)}">
  <span class="admin-item-icon">${icon(collection === 'people' ? 'people' : collection === 'gallery' ? 'image' : 'file')}</span>
  <span class="admin-item-copy"><span class="admin-item-title">${escapeHTML(plainText(entry.name || entry.title || entry.caption || entry.alt))}</span><span class="admin-item-description">${escapeHTML(plainText(entry.role || entry.summary || entry.description || entry.alt || collectionLabel))}</span></span>
  <span class="admin-row-collection">${escapeHTML(collectionLabel)}</span>${statusBadge(entry.draft)}<span class="admin-row-arrow">${icon('arrow')}</span>
</button>`;

const LABELS = { name: 'Título', title: 'Título', role: 'Subtítulo', summary: 'Resumo na home', bio: 'Descrição do modal', items: 'Destaques', links: 'Links', preview: 'Imagem de capa', faviconFrom: 'Site do ícone', subprojects: 'Subprojetos', sections: 'Seções do modal', label: 'Nome da seção', text: 'Texto', list: 'Lista', entries: 'Conteúdos', people: 'Pessoas vinculadas', ref: 'Identificador da pessoa', what: 'Descrição curta', url: 'URL', href: 'URL', src: 'Imagem', alt: 'Descrição da imagem', caption: 'Legenda', width: 'Largura em pixels', height: 'Altura em pixels', description: 'Descrição', category: 'Categoria', tags: 'Tags', prompt: 'Texto do prompt' };
const MULTILINE = new Set(['bio', 'prompt', 'text', 'description', 'what']);
const TEMPLATES = { links: ['', 'https://'], items: '', tags: '', bio: '', list: '', sections: { label: '', text: '', list: [], entries: [], people: [] }, subprojects: { name: '', url: 'https://', preview: '', description: '' }, entries: { name: '', role: '', what: '', links: [] }, people: { ref: '' } };
export function blankEntry(collection) {
  if (collection === 'gallery') return { src: '', alt: '', caption: '', width: 1200, height: 800, draft: true };
  if (collection === 'prompts') return { title: '', description: '', category: '', tags: [], prompt: '', draft: true };
  return { name: '', role: '', ...(collection === 'writing' ? { summary: '' } : {}), bio: '', links: [], items: [], draft: true };
}

/** Recursive native form: preserves structured paragraphs, links, nested people,
 * sections and subprojects without forcing authors to edit JSON. */
export function createFields(value, onChange, parts = []) {
  const host = document.createElement('div'); host.className = 'admin-fields';
  for (const [key, current] of Object.entries(value)) {
    if (['draft', 'slug'].includes(key)) continue;
    const trail = [...parts, key], id = 'field-' + trail.join('-');
    const label = LABELS[key] || key;
    if (Array.isArray(current)) {
      const box = document.createElement('fieldset'); box.className = 'admin-repeater';
      const legend = document.createElement('legend'); legend.textContent = label; box.append(legend);
      const list = document.createElement('div'); box.append(list);
      const paint = () => {
        list.replaceChildren();
        current.forEach((item, index) => {
          const row = document.createElement('div'); row.className = 'admin-repeat-item';
          let field;
          if (key === 'links') {
            field = createFields({ label: item[0], url: item[1] }, (fieldKey, next) => { item[fieldKey === 'label' ? 0 : 1] = next; onChange(key, current); }, [...trail, index]);
          } else if (item && typeof item === 'object') field = createFields(item, (k, next) => { item[k] = next; onChange(key, current); }, [...trail, index]);
          else {
            field = document.createElement(key === 'tags' ? 'input' : 'textarea');
            field.setAttribute('aria-label', `${label} ${index + 1}`); field.value = item; field.rows = 2;
            field.addEventListener('input', () => { current[index] = field.value; onChange(key, current); });
          }
          const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'admin-icon-button'; remove.setAttribute('aria-label', `Remover ${label.toLocaleLowerCase('pt-BR')} ${index + 1}`); remove.innerHTML = icon('close');
          remove.addEventListener('click', () => { current.splice(index, 1); onChange(key, current); paint(); add.focus(); });
          row.append(field, remove); list.append(row);
        });
      };
      const add = document.createElement('button'); add.type = 'button'; add.className = 'admin-text-button'; add.innerHTML = `${icon('plus')} Adicionar ${escapeHTML(label.toLocaleLowerCase('pt-BR'))}`;
      add.addEventListener('click', () => { current.push(structuredClone(TEMPLATES[key] ?? '')); onChange(key, current); paint(); list.lastElementChild?.querySelector('input, textarea')?.focus(); });
      box.append(add); paint(); host.append(box);
    } else if (current && typeof current === 'object') {
      host.append(createFields(current, (k, next) => { current[k] = next; onChange(key, current); }, trail));
    } else {
      const wrap = document.createElement('div'); wrap.className = 'admin-field';
      const title = document.createElement('label'); title.htmlFor = id; title.textContent = label;
      const field = document.createElement(MULTILINE.has(key) ? 'textarea' : 'input'); field.id = id; field.name = key;
      if (field.tagName === 'TEXTAREA') field.rows = key === 'prompt' ? 16 : 4;
      else field.type = typeof current === 'number' ? 'number' : typeof current === 'boolean' ? 'checkbox' : 'text';
      if (field.type === 'number') field.min = '1';
      if (field.type === 'checkbox') field.checked = current; else field.value = current ?? '';
      if (['name', 'title', 'alt'].includes(key) && parts.length === 0) field.required = true;
      field.addEventListener('input', () => onChange(key, field.type === 'number' ? Number(field.value) : field.type === 'checkbox' ? field.checked : field.value));
      wrap.append(title, field); host.append(wrap);
    }
  }
  return host;
}
