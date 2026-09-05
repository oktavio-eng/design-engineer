const fail = (status, message) => Object.assign(new Error(message), { status });
const columns = 'id, created_at, email, message, page, read_at, archived_at';

export async function listMessages(db, params) {
  const view = params.get('view') || 'inbox', query = (params.get('q') || '').trim();
  if (!['inbox', 'unread', 'archived'].includes(view) || query.length > 500) throw fail(400, 'Confira os filtros da caixa de entrada.');
  const where = [view === 'archived' ? 'archived_at IS NOT NULL' : 'archived_at IS NULL'];
  if (view === 'unread') where.push('read_at IS NULL');
  const values = [];
  if (query) { where.push('(instr(lower(email), lower(?)) > 0 OR instr(lower(message), lower(?)) > 0)'); values.push(query, query); }
  const countWhere = where.join(' AND '), countValues = [...values];
  const before = params.get('before'), id = params.get('id');
  if (before || id) {
    if (!before || !id || before.length > 40 || id.length > 100 || !Number.isFinite(Date.parse(before))) throw fail(400, 'Recarregue a caixa de entrada.');
    where.push('(created_at < ? OR (created_at = ? AND id < ?))'); values.push(before, before, id);
  }
  const [page, count, unread] = await db.batch([
    db.prepare(`SELECT ${columns} FROM messages WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT 51`).bind(...values),
    db.prepare(`SELECT count(*) AS total FROM messages WHERE ${countWhere}`).bind(...countValues),
    db.prepare('SELECT count(*) AS total FROM messages WHERE archived_at IS NULL AND read_at IS NULL'),
  ]);
  const messages = page.results.slice(0, 50), last = messages.at(-1);
  return { messages, total: count.results[0].total, unreadCount: unread.results[0].total, nextCursor: page.results.length > 50 ? { before: last.created_at, id: last.id } : null };
}

export async function updateMessage(db, input) {
  const { action, id } = input;
  if (action === 'read-all') {
    await db.prepare("UPDATE messages SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE read_at IS NULL AND archived_at IS NULL").run();
    return { ok: true, unreadCount: (await db.prepare('SELECT count(*) AS total FROM messages WHERE read_at IS NULL AND archived_at IS NULL').first()).total };
  }
  const updates = {
    read: "read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
    unread: 'read_at = NULL',
    archive: "archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
    restore: 'archived_at = NULL',
  };
  if (!Object.hasOwn(updates, action) || typeof id !== 'string' || !id || id.length > 100) throw fail(400, 'Escolha uma mensagem e uma ação válida.');
  const message = await db.prepare(`UPDATE messages SET ${updates[action]} WHERE id = ? RETURNING ${columns}`).bind(id).first();
  if (!message) throw fail(404, 'Esta mensagem não foi encontrada. Atualize a caixa de entrada.');
  return { message, unreadCount: (await db.prepare('SELECT count(*) AS total FROM messages WHERE read_at IS NULL AND archived_at IS NULL').first()).total };
}
