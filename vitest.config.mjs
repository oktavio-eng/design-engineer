import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launchOptions = existsSync(macChrome) ? { executablePath: macChrome } : {};

export default defineConfig({
  optimizeDeps: {
    include: ["axe-core"],
  },
  test: {
    projects: [
      {
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
            storybookScript: "npm run storybook -- --no-open",
          }),
        ],
        test: {
          name: "storybook",
          // One story file at a time. Browser mode runs each file in its own
          // iframe and, by default, several at once — and a sibling iframe
          // taking window focus makes `:focus-visible` stop matching in ours
          // while `document.activeElement` still says the element is focused.
          // `Phase · Glossary` (tooltip keyed on :focus-visible) failed on CI
          // exactly that way on 28/08/2026 (PR #77 post-mortem in
          // docs/storybook-and-tests.md). Six files, ~13s: serial costs ~4s.
          // Top-level on purpose: `browser.fileParallelism` is deprecated in
          // Vitest 4 and defers to this one.
          fileParallelism: false,
          browser: {
            enabled: true,
            provider: playwright({ launchOptions }),
            headless: true,
            api: { host: "127.0.0.1" },
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
