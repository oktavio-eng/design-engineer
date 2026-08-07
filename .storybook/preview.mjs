import "./inventory.css";

const THEME_KEY = "storybook-theme";
const FLAT_TYPE_KEY = "storybook-flat-type";
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function writeStored(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (error) {}
}

function applyTheme(theme) {
  const resolvedTheme = theme === "system" ? (themeMedia.matches ? "dark" : "light") : theme;

  if (resolvedTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");

  writeStored(THEME_KEY, theme === "system" ? null : resolvedTheme);
}

function applyFlatType(state) {
  const stylesheet = document.getElementById("storybook-flat-type");
  if (stylesheet) stylesheet.disabled = state !== "on";
  writeStored(FLAT_TYPE_KEY, state === "on" ? "on" : null);
}

function followSystemTheme(event) {
  if (readStored(THEME_KEY)) return;
  if (event.matches) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

if (themeMedia.addEventListener) themeMedia.addEventListener("change", followSystemTheme);
else if (themeMedia.addListener) themeMedia.addListener(followSystemTheme);

/** @type {import('@storybook/html-vite').Preview} */
const preview = {
  globalTypes: {
    theme: {
      description: "Color theme used by the existing site tokens",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "system", title: "System" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
    flatType: {
      description: "Optional flat typography experiment",
      toolbar: {
        title: "Flat type",
        icon: "paragraph",
        items: [
          { value: "off", title: "Flat type off" },
          { value: "on", title: "Flat type on" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "system",
    flatType: "off",
  },
  decorators: [
    (Story, context) => {
      applyTheme(context.globals.theme);
      applyFlatType(context.globals.flatType);
      return Story();
    },
  ],
  parameters: {
    layout: "fullscreen",
    controls: {
      disable: true,
    },
  },
};

export default preview;
