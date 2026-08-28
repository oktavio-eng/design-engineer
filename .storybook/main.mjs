/** @type {import('@storybook/html-vite').StorybookConfig} */
const config = {
  stories: ["../stories/**/*.stories.js"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/html-vite",
    options: {},
  },
  staticDirs: [
    {
      from: "../styles",
      to: "/styles",
    },
    {
      // main.css @imports /vendor/lenis/lenis.css (see scroll.mjs)
      from: "../vendor",
      to: "/vendor",
    },
  ],
};

export default config;
