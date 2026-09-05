export const COLLECTIONS = [
  { id: 'projects', label: 'Projetos', group: 'Portfólio', icon: 'grid', description: 'Trabalhos que contam a sua trajetória.' },
  { id: 'writing', label: 'Artigos', group: 'Portfólio', icon: 'file', description: 'Ideias e aprendizados publicados na home.' },
  { id: 'personal', label: 'Pessoais', group: 'Portfólio', icon: 'spark', description: 'Experimentos e projetos feitos por você.' },
  { id: 'life', label: 'Vida', group: 'Portfólio', icon: 'sun', description: 'Um pouco de quem está por trás do trabalho.' },
  { id: 'gallery', label: 'Galeria', group: 'Portfólio', icon: 'image', description: 'Imagens e suas histórias.' },
  { id: 'people', label: 'Pessoas', group: 'Biblioteca', icon: 'people', description: 'As pessoas que inspiram o seu trabalho.' },
  { id: 'refs', label: 'Referências', group: 'Biblioteca', icon: 'bookmark', description: 'Uma biblioteca do que vale revisitar.' },
  { id: 'courses', label: 'Cursos', group: 'Biblioteca', icon: 'book', description: 'Materiais para continuar aprendendo.' },
  { id: 'readings', label: 'Leituras', group: 'Biblioteca', icon: 'file', description: 'Textos que ajudam a formar seu olhar.' },
  { id: 'phases', label: 'Plano', group: 'Biblioteca', icon: 'layers', description: 'As etapas da sua transição de carreira.' },
  { id: 'prompts', label: 'Prompts', group: 'Biblioteca', icon: 'code', description: 'Instruções usadas em trabalho real.' },
];

const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
export function safeURL(value) {
  if (typeof value !== 'string' || /[\s<>"'`\\\u0000-\u001f]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
export function validateEntry(collection, entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid('Conteúdo inválido.');
  const title = collection === 'gallery' ? entry.alt : collection === 'prompts' ? entry.title : entry.name;
  if (typeof title !== 'string' || !title.trim() || title.length > 300) invalid('Preencha um título de até 300 caracteres.');
  if (entry.draft !== undefined && typeof entry.draft !== 'boolean') invalid('Visibilidade inválida.');
  function walk(value, key = '', depth = 0) {
    if (depth > 12) invalid('O conteúdo tem níveis demais.');
    if (['links', 'items', 'tags', 'list', 'sections', 'subprojects', 'entries', 'people'].includes(key) && !Array.isArray(value)) invalid('Esse campo precisa ser uma lista.');
    if (typeof value === 'string') {
      if (value.length > 100_000) invalid('Um dos textos é muito longo.');
      // Existing inline glossary markup is supported. Arbitrary HTML is not.
      // A prompt body is rendered as text nodes on both sides (prompts.mjs
      // highlightPrompt, the Studio <pre>), so `<` is plain content there.
      if (key !== 'prompt') {
        if (value.replace(/<[^>]*>/g, '').includes('<')) invalid('A formatação contém uma tag incompleta.');
        for (const tag of value.match(/<[^>]*>/g) || []) {
          if (!/^<\/?(?:b|strong|em|i|code|p|br|span)\s*>$/i.test(tag) && !/^<span class=(?:"(?:gloss|gloss-tip)"|'(?:gloss|gloss-tip)')(?: tabindex=(?:"0"|'0'))?\s*>$/.test(tag)) invalid('Use texto simples ou a formatação de glossário existente; esse HTML não é permitido.');
        }
      }
      if (['src', 'preview', 'faviconFrom', 'url', 'href'].includes(key) && value && !safeURL(value)) invalid('Use um link http(s) ou um caminho local começando com /.');
    } else if (Array.isArray(value)) {
      if (value.length > 500) invalid('Há itens demais neste campo.');
      if (key === 'links') for (const link of value) if (!Array.isArray(link) || link.length !== 2 || typeof link[0] !== 'string' || !safeURL(link[1])) invalid('Cada link precisa de um nome e uma URL válida.');
      if (['items', 'tags', 'list'].includes(key) && value.some(v => typeof v !== 'string')) invalid('Essa lista deve conter apenas textos.');
      value.forEach(v => walk(v, '', depth + 1));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(k)) invalid('Campo inválido.');
        walk(v, k, depth + 1);
      }
    } else if (value !== null && !['number', 'boolean'].includes(typeof value)) invalid('Valor inválido.');
  }
  walk(entry);
  for (const field of ['name', 'role', 'summary', 'preview', 'faviconFrom', 'title', 'description', 'category', 'prompt', 'alt', 'src', 'caption']) if (entry[field] !== undefined && typeof entry[field] !== 'string') invalid(`O campo ${field} precisa ser texto.`);
  if (entry.bio !== undefined && typeof entry.bio !== 'string' && !(Array.isArray(entry.bio) && entry.bio.every(v => typeof v === 'string'))) invalid('Descrição inválida.');
  for (const key of ['links', 'items', 'sections', 'subprojects', 'tags']) if (entry[key] !== undefined && !Array.isArray(entry[key])) invalid(`O campo ${key} precisa ser uma lista.`);
  if (collection === 'prompts' && (!entry.prompt?.trim() || !entry.category?.trim() || !Array.isArray(entry.tags))) invalid('Preencha o texto, a categoria e as tags do prompt.');
  if (collection === 'gallery' && (!safeURL(entry.src) || !Number.isInteger(entry.width) || entry.width < 1 || !Number.isInteger(entry.height) || entry.height < 1)) invalid('Preencha a imagem e suas dimensões em pixels.');
  function objectList(items, fields, name) {
    if (!items) return;
    if (!Array.isArray(items) || items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) invalid(`${name} precisa conter objetos válidos.`);
    for (const item of items) {
      for (const field of fields) if (item[field] !== undefined && typeof item[field] !== 'string') invalid(`O campo ${field} precisa ser texto.`);
      for (const field of ['list', 'items']) if (item[field] !== undefined && (!Array.isArray(item[field]) || item[field].some(text => typeof text !== 'string'))) invalid('A lista deve conter textos.');
    }
  }
  objectList(entry.subprojects, ['name', 'url', 'preview', 'description'], 'Subprojetos');
  objectList(entry.sections, ['label', 'text'], 'Seções');
  for (const section of entry.sections || []) {
    objectList(section.entries, ['name', 'role', 'what'], 'Conteúdos da seção');
    objectList(section.people, ['ref', 'name', 'role'], 'Pessoas da seção');
    for (const person of section.people || []) {
      if (!person.ref && !person.name) invalid('Informe uma pessoa ou seu identificador.');
      if (person.bio !== undefined && typeof person.bio !== 'string' && !(Array.isArray(person.bio) && person.bio.every(v => typeof v === 'string'))) invalid('Descrição da pessoa inválida.');
    }
  }
  return entry;
}
