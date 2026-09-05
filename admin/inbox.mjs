import { escapeHTML as esc, icon } from './ui.mjs';

const quantity = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const fullDate = value => new Date(value).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
export function relativeTime(value, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} d`;
  return new Date(value).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}
const avatar = email => `<span class="admin-inbox-avatar" aria-hidden="true">${esc(Array.from(email)[0]?.toLocaleUpperCase('pt-BR') || '@')}</span>`;
const iconButton = (action, label, glyph) => `<button type="button" class="admin-icon-button" data-inbox-action="${action}" aria-label="${label}">${icon(glyph)}</button>`;

/** The same controller renders the live inbox and its isolated Storybook states. */
export function mountInbox(host, { api, notify = () => {} }) {
  host.innerHTML = `<div class="admin-inbox" data-reading="false">
    <section class="admin-inbox-list-pane" aria-labelledby="inbox-title">
      <header class="admin-inbox-header"><div><h1 id="inbox-title">Mensagens</h1><p id="inbox-summary" role="status">Carregando…</p></div><div class="admin-inbox-actions">${iconButton('read-all', 'Marcar todas como lidas', 'mailRead')}${iconButton('refresh', 'Atualizar mensagens', 'refresh')}</div></header>
      <div class="admin-inbox-tools"><div class="admin-filters" aria-label="Filtrar mensagens"><button type="button" data-inbox-view="inbox" aria-pressed="true">Entrada</button><button type="button" data-inbox-view="unread" aria-pressed="false">Não lidas</button><button type="button" data-inbox-view="archived" aria-pressed="false">Arquivadas</button></div>
      <label class="admin-search">${icon('search')}<input type="search" id="inbox-search" aria-label="Buscar mensagens" placeholder="Buscar mensagens…" maxlength="500" autocomplete="off"><kbd>⌘ K</kbd></label></div>
      <div class="admin-inbox-results"><ul class="admin-inbox-list" aria-label="Mensagens recebidas"></ul><div class="admin-inbox-feedback"></div><button type="button" class="admin-button admin-quiet admin-inbox-more" data-inbox-action="more" hidden>Carregar mais</button></div>
    </section>
    <section class="admin-inbox-reader" aria-label="Leitura da mensagem"></section>
  </div>`;
  const inbox = host.querySelector('.admin-inbox'), list = host.querySelector('.admin-inbox-list');
  const reader = host.querySelector('.admin-inbox-reader'), search = host.querySelector('input');
  const summary = host.querySelector('#inbox-summary'), feedback = host.querySelector('.admin-inbox-feedback');
  let messages = [], selected = null, view = 'inbox', query = '', unread = 0, total = 0, nextCursor = null;
  let loading = false, busy = false, disposed = false, request, searchTimer, error = '';
  let activeAppend = false, pendingLoad = null;
  let readerSignature = '';
  const focused = () => host.contains(document.activeElement) ? document.activeElement : null;
  const focusRow = id => (Array.from(list.querySelectorAll('button')).find(button => button.dataset.messageId === id) || list.querySelector('button') || search).focus({ preventScroll: true });

  function renderList() {
    const focusId = focused()?.dataset.messageId;
    summary.textContent = loading && !messages.length ? 'Carregando…' : quantity(unread, 'mensagem não lida', 'mensagens não lidas');
    host.querySelectorAll('[data-inbox-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.inboxView === view)));
    list.setAttribute('aria-busy', String(loading));
    list.innerHTML = messages.map(message => `<li><button type="button" class="admin-inbox-row" data-cuelume-hover="tick" data-message-id="${esc(message.id)}" aria-pressed="${selected?.id === message.id}" aria-label="${esc(message.email)} · ${message.read_at ? 'Lida' : 'Não lida'} · ${esc(fullDate(message.created_at))}">
      ${avatar(message.email)}<span class="admin-inbox-copy"><span class="admin-inbox-sender">${!message.read_at ? '<span class="admin-inbox-unread" aria-hidden="true"></span>' : ''}<span>${esc(message.email)}</span></span><span class="admin-inbox-preview">${esc(message.message)}</span></span><time datetime="${esc(message.created_at)}">${esc(relativeTime(message.created_at))}</time>
    </button></li>`).join('');
    const emptyTitle = query ? 'Nenhuma mensagem encontrada.' : view === 'archived' ? 'Nenhuma mensagem arquivada.' : view === 'unread' ? 'Tudo em dia.' : 'Sua caixa está tranquila.';
    const emptyText = query ? 'Tente outro e-mail ou trecho da mensagem.' : view === 'archived' ? 'O que você arquivar fica aqui, sem se perder.' : view === 'unread' ? 'Você leu todas as mensagens recebidas.' : 'As conversas do formulário do portfólio chegam aqui.';
    feedback.innerHTML = error ? `<div class="admin-inbox-list-empty"><p role="alert">${esc(error)}</p><button type="button" class="admin-button admin-quiet" data-inbox-action="refresh">Tentar novamente</button></div>` : !messages.length ? `<div class="admin-inbox-list-empty">${icon(loading ? 'clock' : 'inbox')}<p>${loading ? 'Buscando suas mensagens…' : emptyTitle}</p>${loading ? '' : `<span>${emptyText}</span>`}</div>` : '';
    const more = host.querySelector('[data-inbox-action="more"]'); more.hidden = !nextCursor; more.textContent = loading ? 'Carregando…' : `Carregar mais · ${messages.length} de ${total}`;
    syncDisabled();
    if (focusId) focusRow(focusId);
  }
  function renderReader() {
    const signature = JSON.stringify(selected ? [selected.id, selected.read_at, selected.archived_at] : ['idle', unread]);
    if (signature === readerSignature) return;
    readerSignature = signature;
    const focusId = reader.contains(focused()) ? focused()?.id : null;
    const focusAction = reader.contains(focused()) ? focused()?.dataset.inboxAction : null;
    const entering = reader.dataset.messageId !== selected?.id;
    reader.dataset.messageId = selected?.id || '';
    inbox.dataset.reading = String(Boolean(selected));
    if (!selected) {
      reader.innerHTML = `<div class="admin-inbox-idle"><span class="admin-inbox-illustration" aria-hidden="true">${icon('inbox')}</span><h2>${unread ? quantity(unread, 'mensagem para ler', 'mensagens para ler') : 'Um espaço para conversar.'}</h2><p>${unread ? 'Selecione uma mensagem para abrir a conversa.' : 'Escolha uma mensagem ao lado para ler com calma.'}</p></div>`;
      return;
    }
    const message = selected;
    reader.innerHTML = `<div class="admin-inbox-reader-toolbar">${iconButton('back', 'Voltar à caixa de entrada', 'back')}<span class="admin-inbox-source">Formulário de contato</span><div class="admin-inbox-actions">${iconButton('toggle-read', message.read_at ? 'Marcar como não lida' : 'Marcar como lida', message.read_at ? 'mail' : 'mailRead')}${iconButton(message.archived_at ? 'restore' : 'archive', message.archived_at ? 'Mover para entrada' : 'Arquivar mensagem', message.archived_at ? 'inbox' : 'archive')}</div></div>
      <article class="admin-inbox-message${entering ? ' admin-inbox-enter' : ''}"><div class="admin-inbox-message-header">${avatar(message.email)}<div><h2 tabindex="-1" id="inbox-sender">${esc(message.email)}</h2><time datetime="${esc(message.created_at)}">${esc(fullDate(message.created_at))}</time></div></div><p class="admin-inbox-origin">Enviada por ${esc(message.page || '/')}${message.archived_at ? '<span class="admin-inbox-tag">Arquivada</span>' : ''}</p><p class="admin-inbox-body">${esc(message.message)}</p><a class="admin-button admin-inbox-reply" href="mailto:${esc(encodeURIComponent(message.email))}?subject=${encodeURIComponent('Re: Contato pelo portfólio')}">${icon('mail')} Responder por e-mail ${icon('external')}</a></article>`;
    syncDisabled();
    if (focusAction) reader.querySelector(`[data-inbox-action="${focusAction}"]`)?.focus({ preventScroll: true });
    else if (focusId) reader.querySelector(`#${focusId}`)?.focus({ preventScroll: true });
  }
  function syncDisabled() {
    host.querySelectorAll('[data-inbox-action]').forEach(button => {
      const action = button.dataset.inboxAction;
      button.disabled = action !== 'back' && (busy || (loading && ['more', 'refresh'].includes(action)) || (action === 'read-all' && (!unread || view === 'archived')));
    });
  }
  async function load(append = false) {
    if (disposed) return;
    // Reads started during a write must observe its committed result. A new
    // filter/search replaces a queued next page, never the other way around.
    if (busy) {
      pendingLoad = pendingLoad === false ? false : append;
      loading = true; error = ''; renderList(); return;
    }
    activeAppend = append;
    request?.abort(); const controller = new AbortController(); request = controller;
    const params = new URLSearchParams({ view, q: query });
    if (append && nextCursor) { params.set('before', nextCursor.before); params.set('id', nextCursor.id); }
    loading = true; error = ''; renderList();
    try {
      const result = await api(`messages?${params}`, { signal: controller.signal });
      if (disposed || controller.signal.aborted) return;
      messages = append ? Array.from(new Map([...messages, ...result.messages].map(message => [message.id, message])).values()) : result.messages;
      unread = result.unreadCount; total = result.total; nextCursor = result.nextCursor;
      if (selected) selected = messages.find(message => message.id === selected.id) || selected;
    } catch (cause) {
      if (disposed || controller.signal.aborted) return;
      error = cause.message;
    } finally {
      if (!disposed && !controller.signal.aborted) { loading = false; renderList(); renderReader(); }
    }
  }
  async function change(action, message = selected) {
    if (busy || disposed) return;
    if (loading) pendingLoad = activeAppend;
    clearTimeout(searchTimer);
    request?.abort(); loading = false; busy = true; syncDisabled();
    const id = message?.id;
    try {
      const result = await api('messages', { method: 'POST', body: JSON.stringify({ action, ...(id ? { id } : {}) }) });
      if (disposed) return;
      unread = result.unreadCount;
      if (action === 'read-all') {
        messages = messages.map(entry => ({ ...entry, read_at: entry.read_at || new Date().toISOString() }));
        if (selected && !selected.archived_at) selected = { ...selected, read_at: selected.read_at || new Date().toISOString() };
      } else messages = messages.map(entry => entry.id === id ? result.message : entry);
      if (selected?.id === id && result.message) selected = result.message;
      const closes = ['archive', 'restore', 'unread'].includes(action);
      const closesReader = closes && selected?.id === id;
      if (closesReader) selected = null;
      const kept = messages.filter(entry => (view === 'archived' ? entry.archived_at : !entry.archived_at) && (view !== 'unread' || !entry.read_at));
      total -= messages.length - kept.length; messages = kept;
      if (action === 'read-all' && view === 'unread') { total = 0; nextCursor = null; }
      renderList(); renderReader();
      if (closesReader) focusRow(id);
      if (closes) notify(({ archive: 'Mensagem arquivada.', restore: 'Mensagem movida para a entrada.', unread: 'Mensagem marcada como não lida.' })[action]);
      if (action === 'read-all') notify('Todas as mensagens da entrada foram marcadas como lidas.');
    } catch (cause) { if (!disposed) notify(cause.message); }
    finally {
      busy = false;
      if (!disposed) {
        if (pendingLoad !== null) {
          const append = pendingLoad; pendingLoad = null;
          void load(append);
        } else syncDisabled();
      }
    }
  }
  function back() {
    const id = selected?.id; selected = null; renderReader(); renderList(); focusRow(id);
  }
  function onClick(event) {
    const row = event.target.closest('.admin-inbox-row[data-message-id]');
    if (row) {
      if (busy) return;
      selected = messages.find(message => message.id === row.dataset.messageId);
      renderList(); renderReader(); reader.scrollTop = 0;
      reader.querySelector('h2')?.focus({ preventScroll: true });
      if (!selected.read_at) void change('read', selected);
      return;
    }
    const tab = event.target.closest('[data-inbox-view]');
    if (tab) {
      clearTimeout(searchTimer);
      view = tab.dataset.inboxView; selected = null; messages = []; nextCursor = null;
      renderReader(); void load(); return;
    }
    const action = event.target.closest('[data-inbox-action]')?.dataset.inboxAction;
    if (action === 'back') back();
    else if (action === 'refresh') void load();
    else if (action === 'more') void load(true);
    else if (action === 'toggle-read' && selected) void change(selected.read_at ? 'unread' : 'read');
    else if (['archive', 'restore', 'read-all'].includes(action)) void change(action);
  }
  function onInput() {
    clearTimeout(searchTimer); request?.abort(); query = search.value; selected = null; nextCursor = null; messages = [];
    activeAppend = false;
    renderReader(); loading = true; renderList();
    if (busy) pendingLoad = false;
    else searchTimer = setTimeout(() => { void load(); }, 200);
  }
  function onKey(event) {
    if (event.key === 'Escape' && selected && !event.defaultPrevented) { event.preventDefault(); back(); }
  }
  host.addEventListener('click', onClick); host.addEventListener('keydown', onKey); search.addEventListener('input', onInput);
  renderReader(); void load();
  return () => { disposed = true; request?.abort(); clearTimeout(searchTimer); host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); search.removeEventListener('input', onInput); };
}
