import { COLLECTIONS, validateEntry } from './schema.mjs';
import { escapeHTML as esc, plainText, icon, brand, statusBadge, contentRow, createFields, blankEntry } from './ui.mjs';

import { setupTooltips } from './tooltips.mjs';
import { sidebar, setupSidebar } from './sidebar.mjs';
import { typefaceButton, setupTypeface } from './typeface.mjs';
import { mountInbox } from './inbox.mjs';

const root = document.querySelector('#admin-root');
const status = document.querySelector('#admin-status');
setupTooltips(document);
let session, store, active = 'all', query = '', filter = 'all', editor, dirty = false;
const labelFor = id => COLLECTIONS.find(c => c.id === id)?.label || id;
const notify = text => {
  const message = document.createElement('span'); message.textContent = text;
  const close = document.createElement('button'); close.type = 'button'; close.className = 'admin-icon-button'; close.setAttribute('aria-label', 'Fechar aviso'); close.innerHTML = icon('close');
  close.addEventListener('click', () => status.replaceChildren());
  status.replaceChildren(message, close);
};
async function api(route, options = {}, retried = false) {
  const response = await fetch('/api/admin/' + route, { ...options, headers: { 'Content-Type': 'application/json', ...(session ? { 'X-CSRF-Token': session.csrf } : {}), ...options.headers } });
  const result = await response.json().catch(() => ({ error: 'O servidor não respondeu. Tente novamente.' }));
  if (!response.ok) {
    if (response.status === 401 && route !== 'login') { session = null; if (!editor) login(result.error); }
    // Behind Cloudflare Access the CSRF token derives from the JWT, which the
    // edge re-mints during a long session: refresh it once and retry the write.
    if (response.status === 403 && session && !retried && route !== 'session' && /Sessão inválida/.test(result.error || '')) {
      try { session = await api('session'); return api(route, options, true); } catch (_) {}
    }
    throw Object.assign(new Error(result.error || 'Não foi possível concluir.'), { status: response.status });
  }
  return result;
}
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function login(message = '') {
  disposeInbox?.(); disposeTypeface?.(); disposeTypeface = null;
  if (!LOCAL_HOSTS.includes(location.hostname)) {
    // Published Studio: identity comes from Cloudflare Access, never a password.
    // A 401 here means the Access session ended; reloading the page hands the
    // user to the team's login and back.
    root.innerHTML = `<main class="admin-login" id="admin-main"><a class="admin-brand" href="/">${brand()}</a><div class="admin-login-card"><span class="admin-login-icon">${icon('lock')}</span><h1>Sua sessão terminou.</h1><p>Entre de novo pelo Cloudflare Access para voltar ao studio.</p><p id="login-error" class="admin-error" role="alert">${esc(message)}</p><button class="admin-button admin-primary" type="button" id="access-login">Entrar pelo Cloudflare Access ${icon('arrow')}</button></div><a class="admin-back-link" href="/">Voltar ao portfólio ${icon('external')}</a></main>`;
    root.querySelector('#access-login').addEventListener('click', () => location.reload());
    return;
  }
  root.innerHTML = `<main class="admin-login" id="admin-main"><a class="admin-brand" href="/">${brand()}</a><div class="admin-login-card"><span class="admin-login-icon">${icon('lock')}</span><h1>Seu trabalho, bem cuidado.</h1><p>Entre no studio para organizar seu portfólio<br class="admin-desktop"> e tudo que inspira o seu trabalho.</p><form id="login-form"><div class="admin-field"><label for="username">Usuário</label><input id="username" name="username" autocomplete="username" value="admin" required></div><div class="admin-field"><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" aria-describedby="login-error" required></div><p id="login-error" class="admin-error" role="alert">${esc(message)}</p><button class="admin-button admin-primary" type="submit">Entrar no studio ${icon('arrow')}</button></form><span class="admin-environment">${icon('lock')} Ambiente de teste local</span></div><a class="admin-back-link" href="/">Voltar ao portfólio ${icon('external')}</a></main>`;
  root.querySelector('#login-form').addEventListener('submit', async e => {
    e.preventDefault(); const button = e.target.querySelector('button[type=submit]'); button.disabled = true;
    try { session = await api('login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) }); await start(); }
    catch (error) { const hint = root.querySelector('#login-error'); if (hint) hint.textContent = error.message; const password = root.querySelector('#password'); password?.setAttribute('aria-invalid', 'true'); password?.focus(); }
    finally { button.disabled = false; }
  });
  root.querySelector('#password').addEventListener('input', e => { e.target.removeAttribute('aria-invalid'); root.querySelector('#login-error').textContent = ''; });
}

async function start() {
  store = await api('content');
  shell(); renderList();
}
let disposeSidebar, disposeInbox, disposeTypeface;
function shell() {
  disposeSidebar?.(); disposeInbox?.(); disposeTypeface?.();
  root.innerHTML = `<div class="admin-shell">${sidebar()}<div class="admin-workspace"><header class="admin-topbar"><span class="admin-breadcrumb">Studio <span>/</span> <span id="breadcrumb-current">Conteúdos</span></span><div class="admin-toolbar-actions"><span class="admin-environment"><span class="admin-dot"></span><span id="environment-label">${session.mode === 'local' ? 'Ambiente local' : 'Cloudflare D1'}</span></span>${typefaceButton('admin-mobile-typeface')}<button class="admin-icon-button admin-mobile-logout" data-logout aria-label="Sair do studio">${icon("logout")}</button><button class="admin-icon-button" id="theme-toggle" aria-label="Alternar tema">${icon('sun')}</button><a class="admin-button admin-quiet" href="/" target="_blank" rel="noopener">Ver portfólio ${icon('external')}</a></div></header><main class="admin-main" id="admin-main"><div id="message-inbox" class="admin-inbox-host" hidden></div><div class="admin-heading"><div><h1 id="collection-title">Todos os conteúdos</h1><p id="collection-description">Um lugar para cuidar do que você compartilha.</p></div><button class="admin-button admin-primary" id="new-content">${icon('plus')} Novo conteúdo</button></div><div class="admin-overview" id="overview"></div><div class="admin-list-header"><div class="admin-filters" aria-label="Visibilidade"><button data-filter="all" aria-pressed="true">Todos</button><button data-filter="visible" aria-pressed="false">Visíveis</button><button data-filter="draft" aria-pressed="false">Rascunhos</button></div><label class="admin-search">${icon('search')}<input id="content-search" type="search" placeholder="Buscar conteúdo…" aria-label="Buscar conteúdo"><kbd>⌘ K</kbd></label></div><div class="admin-result-count" role="status" id="result-count"></div><div class="admin-content-list" id="content-list"></div><footer class="admin-list-footer"><span>Feito com o mesmo cuidado do seu portfólio.</span><a href="/api/admin/export" download class="admin-text-button">${icon('download')} Exportar backup</a></footer></main></div></div>`;
  disposeSidebar = setupSidebar(root);
  disposeTypeface = setupTypeface(root);
  root.querySelectorAll('[data-collection]').forEach(button => button.addEventListener('click', () => { active = button.dataset.collection; query = ''; root.querySelector('#content-search').value = ''; renderList(); }));
  root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderList(); }));
  root.querySelector('#content-search').addEventListener('input', e => { query = e.target.value; renderList(); });
  root.querySelector('#new-content').addEventListener('click', () => edit(COLLECTIONS.some(c => c.id === active) ? active : 'projects'));
  root.querySelector('#content-list').addEventListener('click', e => {
    const row = e.target.closest('[data-edit]'); if (row) edit(...row.dataset.edit.split(':'));
    const restore = e.target.closest('[data-restore]'); if (restore) restoreItem(restore.dataset.restore);
  });
  root.querySelector('#theme-toggle').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.toggleAttribute('data-theme', dark); if (dark) document.documentElement.dataset.theme = 'dark';
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (_) {}
  });
  root.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', async () => {
    try { const result = await api('logout', { method: 'POST', body: '{}' }); session = null; if (result.redirect) location.assign(result.redirect); else login(); notify('Você saiu do studio.'); }
    catch (error) { notify(error.message); }
  }));
}

async function renderList() {
  disposeInbox?.(); disposeInbox = null;
  const isInbox = active === 'messages';
  root.querySelector('.admin-workspace').dataset.view = isInbox ? 'messages' : 'content';
  const inboxHost = root.querySelector('#message-inbox'); inboxHost.hidden = !isInbox;
  const total = Object.values(store.collections).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
  const drafts = Object.values(store.collections).flatMap(Object.values).filter(e => e.draft).length;
  root.querySelectorAll('[data-collection]').forEach(node => { if (node.dataset.collection === active) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
  root.querySelectorAll('[data-filter]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.filter === filter)));
  const meta = COLLECTIONS.find(c => c.id === active);
  const title = meta?.label || ({ all: 'Todos os conteúdos', trash: 'Lixeira', messages: 'Mensagens' })[active];
  root.querySelector('#collection-title').textContent = title;
  root.querySelector('#breadcrumb-current').textContent = title;
  root.querySelector('#collection-description').textContent = meta?.description || ({ all: 'Um lugar para cuidar do que você compartilha.', trash: 'Nada se perde por um clique. Restaure quando precisar.', messages: 'Conversas que começaram no seu portfólio.' })[active];
  root.querySelector('#new-content').hidden = ['trash', 'messages'].includes(active);
  root.querySelector('.admin-filters').hidden = ['trash', 'messages'].includes(active);
  const overview = root.querySelector('#overview'); overview.hidden = active !== 'all';
  overview.innerHTML = `<div><span>${icon('layers')} Conteúdos</span><strong>${total}<small>em ${COLLECTIONS.length} coleções</small></strong></div><div><span>${icon('check')} Visíveis</span><strong>${total - drafts}<small>no portfólio e na biblioteca</small></strong></div><div><span>${icon('file')} Rascunhos</span><strong>${drafts}<small>ideias em desenvolvimento</small></strong></div>`;
  const list = root.querySelector('#content-list');
  if (isInbox) {
    disposeInbox = mountInbox(inboxHost, { api, notify });
    return;
  }
  if (active === 'trash') {
    const rows = store.trash.filter(item => JSON.stringify(item.entry).toLowerCase().includes(query.toLowerCase()));
    list.innerHTML = rows.map(item => `<div class="admin-content-row admin-trash-row"><span class="admin-item-icon">${icon('trash')}</span><span class="admin-item-copy"><span class="admin-item-title">${esc(plainText(item.entry.name || item.entry.title || item.entry.alt))}</span><span class="admin-item-description">${esc(labelFor(item.collection))} · Excluído em ${new Date(item.deletedAt).toLocaleDateString('pt-BR')}</span></span><button class="admin-button" data-restore="${esc(item.id)}">Restaurar</button></div>`).join('') || '<div class="admin-empty">Tudo no seu lugar.<p>Os conteúdos excluídos ficam aqui e podem ser restaurados.</p></div>';
    root.querySelector('#result-count').textContent = `${rows.length} conteúdos na lixeira`; return;
  }
  const rows = COLLECTIONS.filter(c => active === 'all' || c.id === active).flatMap(c => Object.entries(store.collections[c.id]).map(([key, entry]) => ({ collection: c, key, entry }))).filter(({ entry }) => (filter === 'all' || (filter === 'draft' ? entry.draft : !entry.draft)) && plainText(JSON.stringify(entry)).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  list.innerHTML = `<div class="admin-table-labels"><span>Conteúdo</span><span>Coleção</span><span>Visibilidade</span></div>` + (rows.map(({ collection, key, entry }) => contentRow(collection.id, key, entry, collection.label)).join('') || `<div class="admin-empty">${query ? 'Nenhum conteúdo encontrado.' : 'Um espaço para a próxima ideia.'}<p>${query ? 'Tente outro termo ou altere o filtro.' : 'Adicione um conteúdo para começar esta coleção.'}</p></div>`);
  root.querySelector('#result-count').textContent = `${rows.length} ${rows.length === 1 ? 'conteúdo' : 'conteúdos'}`;
}
async function mutate(payload) {
  store = await api('content', { method: 'POST', body: JSON.stringify({ ...payload, revision: store.revision }) });
  renderList();
}
async function restoreItem(id) {
  const item = store.trash.find(t => t.id === id);
  try { await mutate({ action: 'restore', collection: item.collection, key: item.key, trashId: item.id }); notify('Conteúdo restaurado.'); }
  catch (error) { notify(error.message); }
}

function liftCursor() {
  const cursor = document.querySelector('.ipad-cursor');
  if (!cursor || !cursor.showPopover) return;
  cursor.setAttribute('popover', 'manual');
  if (cursor.matches(':popover-open')) cursor.hidePopover();
  cursor.showPopover();
}
function dialogShell(title, wide = false) {
  const dialog = document.createElement('dialog'); dialog.className = `admin-dialog${wide ? ' admin-editor-dialog' : ''}`; dialog.setAttribute('aria-label', title); document.body.append(dialog); return dialog;
}
function askDiscard(continuation) {
  if (!dirty) return continuation();
  const dialog = dialogShell('Descartar alterações?');
  dialog.innerHTML = `<div class="admin-confirm"><h2>Descartar alterações?</h2><p>Você tem edições que ainda não foram salvas.</p><div class="admin-dialog-actions"><button class="admin-button" data-cancel>Continuar editando</button><button class="admin-button admin-primary" data-discard>Descartar</button></div></div>`;
  dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
  dialog.querySelector('[data-discard]').onclick = () => { dirty = false; dialog.close(); continuation(); };
  dialog.addEventListener('close', () => dialog.remove()); dialog.showModal(); liftCursor();
}
function edit(collection, key) {
  const opener = document.activeElement;
  let entry = structuredClone(key ? store.collections[collection][key] : blankEntry(collection));
  let original = JSON.stringify(entry), busy = false;
  const dialog = dialogShell(key ? 'Editar conteúdo' : 'Novo conteúdo', true); editor = dialog; dirty = false;
  dialog.innerHTML = `<form class="admin-editor-form"><header class="admin-editor-header"><div><span class="admin-eyebrow">${key ? 'EDITAR CONTEÚDO' : 'NOVA IDEIA'}</span><h2 id="editor-title">${esc(plainText(entry.name || entry.title || entry.caption || 'Novo conteúdo'))}</h2></div><button class="admin-icon-button" type="button" data-close aria-label="Fechar editor">${icon('close')}</button></header><div class="admin-editor-layout"><div class="admin-editor-fields"><div class="admin-editor-meta"><div class="admin-field"><label for="editor-collection">Coleção</label><select id="editor-collection" ${key ? 'disabled' : ''}>${COLLECTIONS.map(c => `<option value="${c.id}" ${c.id === collection ? 'selected' : ''}>${c.label}</option>`).join('')}</select></div><div class="admin-field"><label for="entry-key">Identificador</label><input id="entry-key" value="${esc(key || '')}" ${key ? 'readonly' : ''} placeholder="meu-projeto" required pattern="[a-z0-9][a-z0-9-]{0,79}" aria-describedby="key-help"><span id="key-help" class="admin-help">Nome único, sem espaços ou acentos.</span></div></div><div id="entry-fields"></div><details class="admin-additional"><summary>Adicionar campos</summary><div class="admin-extra-options">${['items', 'sections', 'subprojects', 'preview', 'faviconFrom'].map(field => `<button type="button" class="admin-button" data-add-field="${field}">${({ items: 'Destaques', sections: 'Seções', subprojects: 'Subprojetos', preview: 'Imagem de capa', faviconFrom: 'Site do ícone' })[field]}</button>`).join('')}</div></details></div><aside class="admin-preview"><div class="admin-preview-heading"><span>${icon('file')} Prévia do conteúdo</span><span class="admin-eyebrow">AO VIVO</span></div><div id="entry-preview"></div><p class="admin-preview-note">Confira os textos aqui. Depois de salvar, abra o portfólio para ver o modal completo.</p></aside></div><footer class="admin-editor-footer"><div class="admin-visibility"><label for="entry-draft">Visibilidade</label><select id="entry-draft"><option value="false">Visível no site</option><option value="true">Rascunho</option></select></div><span id="save-state">Sem alterações</span><button type="button" class="admin-icon-button" data-delete aria-label="Mover para a lixeira" ${key ? '' : 'hidden'}>${icon('trash')}</button><button class="admin-button admin-primary" type="submit">Salvar alterações ${icon('check')}</button></footer><p class="admin-editor-error admin-error" id="editor-error" role="alert"></p></form>`;
  const form = dialog.querySelector('form'), fields = dialog.querySelector('#entry-fields'), preview = dialog.querySelector('#entry-preview');
  const change = () => {
    dirty = JSON.stringify(entry) !== original || (!key && dialog.querySelector('#entry-key').value !== '');
    dialog.querySelector('#save-state').textContent = dirty ? 'Alterações não salvas' : 'Sem alterações';
    dialog.querySelector('#editor-title').textContent = plainText(entry.name || entry.title || entry.caption || 'Novo conteúdo');
    preview.replaceChildren();
    const render = (tag, text, cls) => { const node = document.createElement(tag); if (cls) node.className = cls; node.textContent = plainText(text); preview.append(node); };
    render('h3', entry.name || entry.title || entry.caption || 'O título aparece aqui');
    render('p', entry.role || entry.category || labelFor(collection), 'admin-preview-subtitle');
    for (const paragraph of Array.isArray(entry.bio) ? entry.bio : [entry.bio || entry.description || entry.alt || 'A descrição do seu conteúdo aparece aqui.']) render('p', paragraph);
    for (const text of entry.items || []) render('p', '— ' + text);
    if (entry.prompt) render('pre', entry.prompt);
    if (entry.links?.length) { render('h4', 'Links'); for (const [name, url] of entry.links) render('p', `${name || 'Link'} ↗`, 'admin-preview-link'); }
    dialog.querySelector('#editor-error').textContent = '';
  };
  const paintFields = () => { fields.replaceChildren(createFields(entry, (field, value) => { entry[field] = value; change(); })); change(); };
  paintFields(); dialog.querySelector('#entry-draft').value = String(!!entry.draft);
  dialog.querySelector('#entry-draft').onchange = e => { entry.draft = e.target.value === 'true'; change(); };
  dialog.querySelector('#entry-key').oninput = change;
  dialog.querySelector('#editor-collection').onchange = e => { const next = e.target.value; e.target.value = collection; askDiscard(() => { dialog.close(); edit(next); }); };
  dialog.querySelectorAll('[data-add-field]').forEach(button => button.onclick = () => { const field = button.dataset.addField; if (!Object.hasOwn(entry, field)) { entry[field] = ['preview', 'faviconFrom'].includes(field) ? '' : []; paintFields(); } });
  const close = () => { if (!busy) askDiscard(() => dialog.close()); };
  dialog.querySelector('[data-close]').onclick = close;
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dialog.addEventListener('close', () => { dialog.remove(); if (editor === dialog) { editor = null; dirty = false; } if (opener?.isConnected) opener.focus(); else root.querySelector('#new-content')?.focus(); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return;
    const save = form.querySelector('[type=submit]');
    try {
      validateEntry(collection, entry); busy = true; save.disabled = true;
      await mutate({ action: 'save', collection, key: key || dialog.querySelector('#entry-key').value, entry, create: !key });
      dirty = false; dialog.close(); notify('Conteúdo salvo. A prévia do site já está atualizada.');
    } catch (error) { dialog.querySelector('#editor-error').textContent = error.message; }
    finally { busy = false; save.disabled = false; }
  });
  dialog.querySelector('[data-delete]').onclick = async () => {
    if (busy) return;
    askDiscard(async () => { try { busy = true; await mutate({ action: 'delete', collection, key }); dirty = false; dialog.close(); notify('Conteúdo movido para a lixeira. Você pode restaurá-lo a qualquer momento.'); } catch (error) { dialog.querySelector('#editor-error').textContent = error.message; } finally { busy = false; } });
  };
  dialog.showModal(); liftCursor(); dialog.querySelector('#entry-key:not([readonly]), #field-name, #field-title, #field-src')?.focus();
}

window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && session && !editor) { e.preventDefault(); root.querySelector(active === 'messages' ? '#inbox-search' : '#content-search')?.focus(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && editor) { e.preventDefault(); editor.querySelector('form')?.requestSubmit(); }
});
try { session = await api('session'); await start(); }
catch (error) { if (session || error.status !== 401) login(error.message); } // a 401 from api() has already rendered login(); anything else must not leave the loading placeholder
