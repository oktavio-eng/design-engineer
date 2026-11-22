/* ---------------------------------------------------------------------------
   The portfolio's GitHub graph data — a year of daily contribution counts
   that contrib.mjs draws.

   Until 22/11/2026 a GitHub Action rewrote data/contributions.json and pushed
   a commit to main every day, and every push to main is a full Vercel deploy
   (~100 MB of site, counted against the account's deployment storage). Now
   the Worker refreshes the data itself on a Cron Trigger (wrangler.jsonc →
   triggers.crons), keeps the last good copy in D1 (`contributions`, migration
   0003) and serves it at /data/contributions.json, which vercel.json rewrites
   to — the same pattern as content.js. data/contributions.json stays in the
   repo as the seed for local dev, tests, and the fallback below.

   Source: https://github.com/users/<user>/contributions — the public HTML
   fragment GitHub embeds on profile pages. No token, so no secret to keep.
   It is not a documented API, so the parser refuses anything short of a
   year and the previous copy stays in place. Counts come from each cell's
   tooltip ("No contributions on …" / "3 contributions on …"); GitHub's own
   level (0–4) is kept as `level`, but contrib.mjs recomputes levels from the
   counts so the ramp is consistent with our data.
--------------------------------------------------------------------------- */

export const CONTRIBUTIONS_USER = 'oktavio-eng';
const MIN_DAYS = 300;

export function parseContributions(html, user = CONTRIBUTIONS_USER, today = new Date()) {
  // One <td> per day carries data-date, data-level and an id; a <tool-tip for="id">
  // elsewhere carries the human count. Join the two by id.
  const days = new Map();
  for (const match of html.matchAll(/<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"[^>]*data-level="(\d)"/g)) {
    days.set(match[2], { date: match[1], level: Number(match[3]), count: 0 });
  }
  for (const match of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const day = days.get(match[1]);
    if (!day) continue;
    const number = match[2].trim().match(/^([\d,]+) contribution/);
    day.count = number ? Number(number[1].replace(/,/g, '')) : 0;
  }
  const list = [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (list.length < MIN_DAYS) throw new Error(`Parsed only ${list.length} days; GitHub's markup probably changed.`);
  const total = list.reduce((sum, d) => sum + d.count, 0);
  return { user, fetchedAt: today.toISOString().slice(0, 10), total, days: list };
}

export async function fetchContributions(user = CONTRIBUTIONS_USER, fetcher = fetch) {
  const response = await fetcher(`https://github.com/users/${user}/contributions`, {
    headers: { 'user-agent': 'oktavio-studio contributions refresh (+https://oktavio.vercel.app)' },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${user}`);
  return parseContributions(await response.text(), user);
}

// Cron entry point. A failed fetch throws (so it shows up in the Worker's
// cron logs) and leaves the stored copy untouched.
export async function refreshContributions(db, fetcher = fetch) {
  const payload = await fetchContributions(CONTRIBUTIONS_USER, fetcher);
  await db.prepare('INSERT INTO contributions (id, fetched_at, data) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET fetched_at = excluded.fetched_at, data = excluded.data')
    .bind(payload.fetchedAt, JSON.stringify(payload)).run();
  return payload;
}

export async function storedContributions(db) {
  const row = await db.prepare('SELECT data FROM contributions WHERE id = 1').first();
  return row ? row.data : null;
}
