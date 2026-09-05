import { expect, userEvent, within, waitFor, fireEvent } from 'storybook/test';
import { contentRow, createFields } from '../admin/ui.mjs';
import { sidebar, setupSidebar } from '../admin/sidebar.mjs';
import { setupTypeface } from '../admin/typeface.mjs';
import { mountInbox } from '../admin/inbox.mjs';

export default { title: 'Studio/Content', parameters: { layout: 'padded' } };
export const ContentStates = {
  render() {
    const root = document.createElement('div'); root.className = 'admin-page';
    root.innerHTML = `<main class="admin-main"><h1>Conteúdos do studio</h1>${contentRow('projects', 'project', { name: 'Caderno de Erros', role: 'UX/UI + Identity + Website' }, 'Projetos')}${contentRow('projects', 'draft', { name: 'Próxima ideia', role: 'Em desenvolvimento', draft: true }, 'Projetos')}</main>`;
    return root;
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /Caderno de Erros.*Visível/ })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Próxima ideia.*Rascunho/ })).toBeVisible();
  },
};
export const StructuredEditor = {
  render() {
    const root = document.createElement('div'); root.className = 'admin-page';
    root.innerHTML = '<main class="admin-main"><h1>Editar referência</h1><form></form></main>';
    const data = { name: 'Uma referência', bio: 'O que vale revisitar.', links: [['Site', 'https://example.com']] };
    root.querySelector('form').append(createFields(data, (key, value) => { data[key] = value; }));
    return root;
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const add = canvas.getByRole('button', { name: 'Adicionar links' });
    await userEvent.click(add);
    const fields = canvas.getAllByRole('textbox', { name: 'URL', exact: true });
    await expect(fields).toHaveLength(2);
    await userEvent.type(fields[1], 'example.org');
    await userEvent.click(canvas.getByRole('button', { name: 'Remover links 2' }));
    await expect(add).toHaveFocus();
    await expect(canvas.getAllByRole('textbox', { name: 'URL', exact: true })).toHaveLength(1);
  },
};

export const CollapsibleSidebar = {
  parameters: { layout: 'fullscreen' },
  render() {
    const root = document.createElement('div'); root.className = 'admin-page';
    root.innerHTML = `<div class="admin-shell">${sidebar()}<main class="admin-workspace"><div class="admin-main"><h1>Seu studio</h1></div></main></div>`;
    const values = new Map();
    setupSidebar(root, { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
    return root;
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Portfólio', exact: true }));
    await expect(canvas.queryByRole('button', { name: 'Projetos', exact: true })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Portfólio', exact: true }));
    await userEvent.click(canvas.getByRole('button', { name: 'Recolher sidebar' }));
    await expect(canvas.getByRole('button', { name: 'Expandir sidebar' })).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(canvas.getByRole('button', { name: 'Expandir sidebar' }));
    await expect(canvas.getByRole('button', { name: 'Recolher sidebar' })).toHaveFocus();
    await expect(canvas.getByRole('button', { name: 'Projetos', exact: true })).toBeVisible();
  },
};

// Studio typeface (05/09/2026): the three-stop slider above the user block —
// Geist Sans / Mono / Pixel — driving the whole shell, with the Medium floor
// (body 500, headings 600) and Pixel's native-400 exception visible in the
// sample content. Real modules, story-scoped storage and target: the choice
// lands on this root's `data-typeface` instead of <html>, and nothing leaks
// into the next story.
export const TypefaceSwitcher = {
  parameters: { layout: 'fullscreen' },
  render() {
    const root = document.createElement('div'); root.className = 'admin-page';
    root.innerHTML = `<div class="admin-shell">${sidebar()}<main class="admin-workspace"><div class="admin-main"><div class="admin-heading"><div><h1>Seu studio</h1><p>Um lugar para cuidar do que você compartilha.</p></div><button type="button" class="admin-button admin-primary">Novo conteúdo</button></div><div class="admin-overview"><div><span>Conteúdos</span><strong>89<small>em 11 coleções</small></strong></div><div><span>Visíveis</span><strong>89<small>no portfólio e na biblioteca</small></strong></div><div><span>Rascunhos</span><strong>0<small>ideias em desenvolvimento</small></strong></div></div><div class="admin-content-list">${contentRow('projects', 'project', { name: 'Caderno de Erros', role: 'UX/UI + Identity + Website' }, 'Projetos')}${contentRow('projects', 'draft', { name: 'Próxima ideia', role: 'Em desenvolvimento', draft: true }, 'Projetos')}</div></div></main></div>`;
    const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    setupSidebar(root, storage);
    setupTypeface(root, { storage, target: root });
    return root;
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement), root = canvasElement.querySelector('.admin-page');
    const weight = selector => getComputedStyle(root.querySelector(selector)).fontWeight;
    await expect(weight('.admin-heading p')).toBe('500');
    await expect(weight('h1')).toBe('600');
    const trigger = canvas.getByRole('button', { name: 'Fonte do Studio: Geist Sans' });
    await userEvent.click(trigger);
    const slider = canvas.getByRole('slider', { name: 'Família tipográfica do Studio' });
    await waitFor(() => expect(slider).toHaveFocus());
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // storybook/test's userEvent is synthetic: a dispatched ArrowRight does not
    // step a native range, so the play moves the value and fires `input` the
    // way the browser would. The real keyboard path (arrows, Home/End, Escape
    // handing focus back) runs under Playwright in tests/admin/dashboard.test.mjs.
    const slide = async value => { slider.value = String(value); await fireEvent.input(slider); };
    await slide(1);
    await waitFor(() => expect(root).toHaveAttribute('data-typeface', 'mono'));
    await expect(slider).toHaveAttribute('aria-valuetext', 'Geist Mono');
    await expect(canvas.getByRole('button', { name: 'Fonte do Studio: Geist Mono' })).toBeVisible();
    await slide(2);
    await waitFor(() => expect(root).toHaveAttribute('data-typeface', 'pixel'));
    // Pixel keeps its single native weight: no synthesized Medium/Semibold.
    await expect(weight('.admin-heading p')).toBe('400');
    await expect(weight('h1')).toBe('400');
    await slide(0);
    await waitFor(() => expect(root).toHaveAttribute('data-typeface', 'sans'));
    await userEvent.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    await expect(trigger).toHaveFocus();
    root.dataset.playDone = 'true';
  },
};

export const MessageInbox = {
  parameters: { layout: 'fullscreen' },
  render() {
    const root = document.createElement('div'); root.className = 'admin-page';
    root.innerHTML = '<main style="margin:0;max-width:none;padding:24px;height:100dvh;background:var(--white)"><div class="admin-inbox-host"></div></main>';
    let messages = [
      { id: 'one', email: 'ana@example.com', message: 'Olá, Otavio!\n\nGostaria de conversar sobre um projeto de produto digital. Podemos marcar uma conversa nesta semana?', page: '/', created_at: '2026-08-04T19:20:00Z', read_at: null, archived_at: null },
      { id: 'two', email: 'bruno@example.com', message: 'As referências da wiki me ajudaram muito. Obrigado por compartilhar!', page: '/wiki', created_at: '2026-08-03T14:00:00Z', read_at: '2026-08-03T15:00:00Z', archived_at: null },
    ];
    let holdRead = false, releaseRead;
    root.holdInboxRead = () => { holdRead = true; };
    root.releaseInboxRead = () => releaseRead?.();
    mountInbox(root.querySelector('.admin-inbox-host'), { async api(route, options = {}) {
      if (options.method === 'POST') {
        const { action, id } = JSON.parse(options.body), entry = messages.find(message => message.id === id);
        if (action === 'read-all') messages.forEach(message => { if (!message.archived_at) message.read_at = '2026-09-05T00:00:00Z'; });
        else if (action === 'read' || action === 'unread') entry.read_at = action === 'read' ? '2026-09-05T00:00:00Z' : null;
        else entry.archived_at = action === 'archive' ? '2026-09-05T00:00:00Z' : null;
        return { message: structuredClone(entry), unreadCount: messages.filter(message => !message.read_at && !message.archived_at).length };
      }
      const params = new URL(route, 'https://fixture.test').searchParams, view = params.get('view'), query = params.get('q') || '';
      const rows = messages.filter(message => (view === 'archived' ? message.archived_at : !message.archived_at) && (view !== 'unread' || !message.read_at) && `${message.email} ${message.message}`.includes(query));
      const result = { messages: structuredClone(rows), total: rows.length, unreadCount: messages.filter(message => !message.read_at && !message.archived_at).length, nextCursor: null };
      if (holdRead) {
        holdRead = false;
        await new Promise(resolve => { releaseRead = resolve; });
      }
      return result;
    } });
    return root;
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const sender = await canvas.findByRole('button', { name: /ana@example.com · Não lida/ });
    sender.focus(); await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'ana@example.com' })).toHaveFocus());
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Arquivar mensagem' })).toBeEnabled());
    await userEvent.click(canvas.getByRole('button', { name: 'Arquivar mensagem' }));
    await waitFor(() => expect(canvas.queryByRole('heading', { name: 'ana@example.com' })).toBeNull());
    await userEvent.click(canvas.getByRole('button', { name: 'Arquivadas', exact: true }));
    await userEvent.click(await canvas.findByRole('button', { name: /ana@example.com · Lida/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Mover para entrada' }));
    await waitFor(() => expect(canvas.getByText('Nenhuma mensagem arquivada.')).toBeVisible());
    await userEvent.click(canvas.getByRole('button', { name: 'Entrada', exact: true }));
    await userEvent.click(await canvas.findByRole('button', { name: /ana@example.com · Lida/ }));
    // A refresh response captured before the write must not revive a read
    // state after marking the message unread. The controller resumes the GET.
    const root = canvasElement.querySelector('.admin-page');
    root.holdInboxRead();
    await userEvent.click(canvas.getByRole('button', { name: 'Atualizar mensagens' }));
    await expect(canvas.getByRole('list', { name: 'Mensagens recebidas' })).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Marcar como não lida', exact: true }));
    await waitFor(() => expect(canvas.getByRole('list', { name: 'Mensagens recebidas' })).toHaveAttribute('aria-busy', 'false'));
    root.releaseInboxRead();
    await expect(await canvas.findByRole('button', { name: /ana@example.com · Não lida/ })).toBeVisible();
    // Restore the established end state used by the visual baselines.
    await userEvent.click(canvas.getByRole('button', { name: /ana@example.com · Não lida/ }));
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Marcar como não lida', exact: true })).toBeEnabled());
    root.dataset.playDone = 'true';
  },
};
