// User-provided Pixel Office screenshots, kept with the static deployment.
export const pixelOfficeGallery = [
  {
    "src": "/assets/projects/pixel-office/01-office.png",
    "alt": "Pixel Office with teammates in the shared workspace",
    "caption": "Pixel Office with teammates in the shared workspace"
  },
  {
    "src": "/assets/projects/pixel-office/02-people.png",
    "alt": "Workspace sidebar with channels and teammates",
    "caption": "Workspace sidebar with channels and teammates"
  },
  {
    "src": "/assets/projects/pixel-office/03-calendar.png",
    "alt": "Weekly calendar with connected schedules",
    "caption": "Weekly calendar with connected schedules"
  },
  {
    "src": "/assets/projects/pixel-office/04-board.png",
    "alt": "Team board with tasks grouped by workflow stage",
    "caption": "Team board with tasks grouped by workflow stage"
  },
  {
    "src": "/assets/projects/pixel-office/05-ranking.png",
    "alt": "Weekly ranking of completed team tasks",
    "caption": "Weekly ranking of completed team tasks"
  },
  {
    "src": "/assets/projects/pixel-office/06-finances.png",
    "alt": "Personal finances with categories and cash flow",
    "caption": "Personal finances with categories and cash flow"
  },
  {
    "src": "/assets/projects/pixel-office/07-timer.png",
    "alt": "Focus timer linked to the current project",
    "caption": "Focus timer linked to the current project"
  },
  {
    "src": "/assets/projects/pixel-office/08-timeline.png",
    "alt": "Time tracking timeline with editable entries",
    "caption": "Time tracking timeline with editable entries"
  },
  {
    "src": "/assets/projects/pixel-office/09-weather.png",
    "alt": "Weather panel with hourly and weekly forecasts",
    "caption": "Weather panel with hourly and weekly forecasts"
  },
  {
    "src": "/assets/projects/pixel-office/10-chat.png",
    "alt": "Direct conversations within the workspace",
    "caption": "Direct conversations within the workspace"
  },
  {
    "src": "/assets/projects/pixel-office/11-changelog.png",
    "alt": "Product changelog inside the shared office",
    "caption": "Product changelog inside the shared office"
  },
  {
    "src": "/assets/projects/pixel-office/12-usage.png",
    "alt": "Usage dashboard for connected coding agents",
    "caption": "Usage dashboard for connected coding agents"
  }
];

// Match the project URL so this supplement preserves the live Studio key.
export function applyProjectMedia(content) {
  for (const entry of Object.values(content.personal || {})) {
    if (!entry.links?.some(([, url]) => /^https:\/\/gow-pixel-office\.vercel\.app(?:\/|$)/.test(url))) continue;
    if (!entry.gallery?.length) entry.gallery = pixelOfficeGallery;
    if (!entry.preview) entry.preview = pixelOfficeGallery[0].src;
  }
}
