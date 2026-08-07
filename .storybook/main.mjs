/** @type {import('@storybook/html-vite').StorybookConfig} */
const config = {
  stories: ["../stories/**/*.stories.js"],
  framework: {
    name: "@storybook/html-vite",
    options: {},
  },
  staticDirs: [
    {
      from: "../styles",
      to: "/styles",
    },
  ],
};

export default config;
