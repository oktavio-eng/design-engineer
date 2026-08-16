/* ---------------------------------------------------------------------------
   Contribution graph — fills a `.contrib` shell from a year of daily counts.

   Markup contract (see the `.contrib*` block in styles/main.css):

     <div class="contrib">
       <div class="contrib__card">
         <div class="contrib__grid" aria-hidden="true"></div>
         <div class="contrib__meta">
           <span data-contrib-total></span>
           <span class="contrib__legend">Less … More</span>
         </div>
       </div>
     </div>

   `days` is an array of {date, count} in calendar order, oldest first, up to
   371 entries (53 weeks × 7). Cells flow by column, so the array is padded
   at the front to start on a Sunday the way GitHub's own graph does. Levels
   follow GitHub's rule of thumb — quartiles of the non-zero days — so one
   heavy day doesn't wash out the rest of the year.

   Where the data comes from is a separate decision (a JSON file the repo
   refreshes with a scheduled GitHub Action is the plan — the site has no
   server, and GitHub's contribution calendar isn't reachable from a browser
   without a token). This module only knows how to draw an array.
--------------------------------------------------------------------------- */

const WEEKS = 53;
const DAYS = WEEKS * 7;

export function levelFor(count, thresholds) {
  if (!count) return 0;
  if (count <= thresholds[0]) return 1;
  if (count <= thresholds[1]) return 2;
  if (count <= thresholds[2]) return 3;
  return 4;
}

// Quartile cut points over the non-zero counts. With no activity at all every
// threshold is 0 and levelFor() still returns 0 for every cell.
export function thresholdsFor(days) {
  const counts = days
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  if (!counts.length) return [0, 0, 0];
  const at = (q) => counts[Math.min(counts.length - 1, Math.floor(q * counts.length))];
  return [at(0.25), at(0.5), at(0.75)];
}

function formatTotal(total) {
  return total.toLocaleString("en-US");
}

export function renderContributions(root, days, options = {}) {
  const grid = root.querySelector(".contrib__grid");
  const totalEl = root.querySelector("[data-contrib-total]");
  if (!grid) return null;

  const window = days.slice(-DAYS);
  // Pad the front so the first column starts on Sunday (row 0), like GitHub.
  const first = window[0] ? new Date(window[0].date + "T00:00:00") : new Date();
  const lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (const day of window) cells.push(day);

  const thresholds = thresholdsFor(window);
  const fragment = document.createDocumentFragment();
  for (const day of cells) {
    const cell = document.createElement("span");
    cell.className = "contrib__cell";
    if (day) {
      cell.dataset.level = String(levelFor(day.count, thresholds));
      cell.title = `${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date}`;
    } else {
      cell.style.visibility = "hidden";
    }
    fragment.appendChild(cell);
  }
  grid.replaceChildren(fragment);

  const total = window.reduce((sum, d) => sum + d.count, 0);
  if (totalEl) {
    totalEl.textContent = options.label
      ? options.label(total)
      : `${formatTotal(total)} contribution${total === 1 ? "" : "s"} in the last year`;
  }
  return { total, thresholds };
}
