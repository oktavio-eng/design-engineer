import { COLLECTIONS } from './schema.mjs';
import { brand, icon } from './ui.mjs';
import { typefaceControl } from './typeface.mjs';

const navItem = (id, label, glyph) => `<button type="button" class="admin-nav-item" data-cuelume-hover="tick" data-collection="${id}" aria-label="${label}">${icon(glyph)}<span>${label}</span></button>`;
const navGroup = (id, label, items) => `<div class="admin-nav-group" data-nav-group="${id}"><button type="button" class="admin-group-toggle" aria-expanded="true" aria-controls="admin-group-${id}">${label}${icon('chevron')}</button><div class="admin-group-items" id="admin-group-${id}">${items}</div></div>`;
export const sidebar = () => `<aside class="admin-sidebar">
  <div class="admin-sidebar-header"><a class="admin-brand" href="/admin">${brand()}</a><button type="button" class="admin-icon-button admin-sidebar-toggle" aria-label="Recolher sidebar" aria-expanded="true" aria-controls="admin-navigation" data-cuelume-hover="tick">${icon('sidebar')}</button></div>
  <nav id="admin-navigation" aria-label="Coleções de conteúdo">
    ${navItem('all', 'Todos os conteúdos', 'grid')}
    ${[['portfolio', 'Portfólio'], ['library', 'Biblioteca']].map(([id, label]) => navGroup(id, label, COLLECTIONS.filter(c => c.group === label).map(c => navItem(c.id, c.label, c.icon)).join(''))).join('')}
    ${navGroup('studio', 'Studio', navItem('messages', 'Mensagens', 'inbox') + navItem('trash', 'Lixeira', 'trash'))}
  </nav>
  ${typefaceControl()}
  <div class="admin-sidebar-footer"><span class="admin-avatar">O</span><span>Oktavio<span class="admin-brand-sub">Administrador</span></span><button class="admin-icon-button" data-logout aria-label="Sair do studio">${icon('logout')}</button></div>
</aside>`;

/** Desktop rail, mobile navigation and group disclosures keep independent preferences. */
export function setupSidebar(root, storage) {
  try { storage ??= window.localStorage; } catch (_) {}
  const shell = root.querySelector('.admin-shell');
  const toggle = root.querySelector('.admin-sidebar-toggle');
  const nav = root.querySelector('#admin-navigation');
  const mobile = window.matchMedia('(max-width: 760px)');
  const key = () => mobile.matches ? 'studio.sidebar.mobileCollapsed' : 'studio.sidebar.collapsed';
  const read = key => { try { return storage?.getItem(key) === 'true'; } catch (_) { return false; } };
  const write = (key, value) => { try { storage?.setItem(key, String(value)); } catch (_) {} };
  const groups = [...nav.querySelectorAll('[data-nav-group]')].map(group => ({
    button: group.querySelector('.admin-group-toggle'),
    items: group.querySelector('.admin-group-items'),
    key: `studio.sidebar.group.${group.dataset.navGroup}`,
  }));
  let collapsed;
  function renderGroups() {
    for (const group of groups) {
      // Every collection remains available in the compact icon rail.
      const closed = !(collapsed && !mobile.matches) && read(group.key);
      group.items.hidden = closed;
      group.button.setAttribute('aria-expanded', String(!closed));
    }
  }
  function render() {
    shell.dataset.sidebarCollapsed = String(collapsed);
    nav.inert = mobile.matches && collapsed;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expandir sidebar' : 'Recolher sidebar');
    renderGroups();
  }
  function restore() { collapsed = read(key()); render(); }
  toggle.addEventListener('click', () => { collapsed = !collapsed; write(key(), collapsed); render(); });
  for (const group of groups) group.button.addEventListener('click', () => { write(group.key, !read(group.key)); renderGroups(); });
  mobile.addEventListener('change', restore);
  restore();
  return () => mobile.removeEventListener('change', restore);
}
