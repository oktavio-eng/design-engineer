import { existsSync } from "node:fs";
import { chromium } from "playwright";

const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export function launchChromium(options = {}) {
  return chromium.launch({
    headless: true,
    ...(existsSync(macChrome) ? { executablePath: macChrome } : {}),
    ...options,
  });
}
