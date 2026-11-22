#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Refreshes the local seed data/contributions.json by hand.

   Production no longer reads this file: since 22/11/2026 the Worker refreshes
   the graph on a daily Cron Trigger and serves /data/contributions.json from
   D1 (see cloudflare/contributions.mjs, which also holds the parser used
   here). The file in the repo is what local dev, the tests and the Worker's
   fallback read, so refreshing it now and then is enough. On a failed fetch
   or a short year the script exits non-zero and leaves the file alone.

   Run: node scripts/fetch-contributions.mjs [user]   (default: oktavio-eng)
--------------------------------------------------------------------------- */
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRIBUTIONS_USER, fetchContributions } from "../cloudflare/contributions.mjs";

const user = process.argv[2] || CONTRIBUTIONS_USER;
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/contributions.json");

let payload;
try {
  payload = await fetchContributions(user);
} catch (error) {
  console.error(error.message + " Keeping the previous file.");
  process.exit(1);
}

let previous = null;
try {
  previous = JSON.parse(await readFile(out, "utf8"));
} catch {}
if (previous && JSON.stringify(previous.days) === JSON.stringify(payload.days)) {
  console.log(`No change: ${payload.total} contributions, ${payload.days.length} days.`);
  process.exit(0);
}
await writeFile(out, JSON.stringify(payload, null, 0) + "\n");
console.log(`Wrote ${payload.days.length} days, ${payload.total} contributions in the last year, to ${path.relative(process.cwd(), out)}.`);
