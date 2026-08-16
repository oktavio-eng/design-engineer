#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Refreshes data/contributions.json — a year of daily GitHub contribution
   counts for the portfolio's `.contrib` graph (contrib.mjs draws it).

   Source: https://github.com/users/<user>/contributions — the public HTML
   fragment GitHub itself embeds on profile pages. It needs no token, which is
   the whole reason it's used instead of the GraphQL contributionsCollection:
   the site has no server and no secrets to keep. It is not a documented API,
   so this script is defensive: if the fetch fails or the markup no longer
   parses to a full year, it exits non-zero and leaves the previous file
   alone (the Action treats that as "nothing to commit"). Counts come from
   each cell's tooltip ("No contributions on …" / "3 contributions on …");
   GitHub's own level (0–4) is kept as `level` for reference, but contrib.mjs
   recomputes levels from the counts so the ramp is consistent with our data.

   Run: node scripts/fetch-contributions.mjs [user]   (default: oktavio-eng)
   Scheduled by .github/workflows/contributions.yml once a day.
--------------------------------------------------------------------------- */
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const user = process.argv[2] || "oktavio-eng";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/contributions.json");

const response = await fetch(`https://github.com/users/${user}/contributions`, {
  headers: { "user-agent": "design-engineer-site contributions refresh (+https://design-engineer-phi.vercel.app)" },
});
if (!response.ok) {
  console.error(`GitHub returned ${response.status} for ${user}`);
  process.exit(1);
}
const html = await response.text();

// One <td> per day carries data-date, data-level and an id; a <tool-tip for="id">
// elsewhere carries the human count. Join the two by id.
const days = new Map();
for (const match of html.matchAll(/<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"[^>]*data-level="(\d)"/g)) {
  days.set(match[2], { date: match[1], level: Number(match[3]), count: 0 });
}
for (const match of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
  const day = days.get(match[1]);
  if (!day) continue;
  const text = match[2].trim();
  const number = text.match(/^([\d,]+) contribution/);
  day.count = number ? Number(number[1].replace(/,/g, "")) : 0;
}

const list = [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
if (list.length < 300) {
  console.error(`Parsed only ${list.length} days — GitHub's markup probably changed; keeping the previous file.`);
  process.exit(1);
}

const total = list.reduce((sum, d) => sum + d.count, 0);
const payload = { user, fetchedAt: new Date().toISOString().slice(0, 10), total, days: list };

let previous = null;
try {
  previous = JSON.parse(await readFile(out, "utf8"));
} catch {}
if (previous && JSON.stringify(previous.days) === JSON.stringify(list)) {
  console.log(`No change: ${total} contributions, ${list.length} days.`);
  process.exit(0);
}
await writeFile(out, JSON.stringify(payload, null, 0) + "\n");
console.log(`Wrote ${list.length} days, ${total} contributions in the last year, to ${path.relative(process.cwd(), out)}.`);
