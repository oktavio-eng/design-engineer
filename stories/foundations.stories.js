const colorTokens = ["--bg", "--ink", "--muted", "--faint", "--line", "--white", "--glass-bg"];
const typeSizes = ["--fs-11", "--fs-12", "--fs-13", "--fs-14", "--fs-15", "--fs-16"];
const typeWeights = ["--fw-regular", "--fw-medium", "--fw-semibold"];
const fontFamilies = ["--font-sans", "--font-mono", "--font-pixel"];
const spacingTokens = ["--space-4", "--space-8", "--space-12", "--space-16", "--space-24", "--space-40", "--space-64", "--space-96"];
const radiusTokens = ["--radius-3", "--radius-6", "--radius-12", "--radius-16", "--radius-24", "--radius-32", "--radius-full"];
const motionTokens = ["--ease", "--ease-out", "--ease-pop", "--duration-120", "--duration-250", "--duration-400", "--duration-640"];

function tokenValue(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function shell(title, description, content) {
  const root = document.createElement("div");
  root.className = "sb-inventory";
  root.innerHTML = `
    <div class="sb-inventory__content">
      <header class="sb-inventory__header">
        <h1>${title}</h1>
        <p>${description}</p>
      </header>
      ${content}
    </div>
  `;
  return root;
}

function tokenRows(tokens, sample) {
  return tokens
    .map(
      (token) => `
        <div class="sb-token-row">
          <code class="sb-token-name">${token}</code>
          ${sample(token)}
          <code class="sb-token-value">${tokenValue(token)}</code>
        </div>
      `,
    )
    .join("");
}

export default {
  title: "Foundations",
};

export const Colors = {
  render: () =>
    shell(
      "Colors",
      "Semantic OKLCH tokens from styles/tokens/colors.css. Change the Theme toolbar control to inspect the same mappings in light and dark mode.",
      `<div class="sb-token-list">${tokenRows(
        colorTokens,
        (token) => `<span class="sb-color-chip" style="background: var(${token})"></span>`,
      )}</div>`,
    ),
};

export const Typography = {
  render: () =>
    shell(
      "Typography",
      "Geist uses the existing size and weight tokens. The Flat type toolbar control redeclares these tokens through styles/experiments/flat-type.css.",
      `
        <section class="sb-inventory__section">
          <h2>Size scale</h2>
          <div class="sb-token-list">
            ${tokenRows(
              typeSizes,
              (token) => `<span class="sb-type-sample" style="font-size: var(${token})">Design Engineer</span>`,
            )}
          </div>
        </section>
        <section class="sb-inventory__section">
          <h2>Weight scale</h2>
          <div class="sb-token-list">
            ${tokenRows(
              typeWeights,
              (token) => `<span class="sb-type-sample" style="font-weight: var(${token})">Public proof over credentials</span>`,
            )}
          </div>
        </section>
        <section class="sb-inventory__section">
          <h2>Font family</h2>
          <p class="sb-pattern-note">--font-sans, --font-mono and --font-pixel from styles/tokens/typography.css, each set as an inline font-family so the difference is visible even though no component consumes --font-mono/--font-pixel yet.</p>
          <div class="sb-token-list">
            ${tokenRows(
              fontFamilies,
              (token) => `<span class="sb-type-sample" style="font-family: var(${token}); font-size: var(--fs-16)">Design Engineer 0123</span>`,
            )}
          </div>
        </section>
      `,
    ),
};

export const SpacingRadiusAndMotion = {
  name: "Spacing · Radius · Motion",
  render: () =>
    shell(
      "Spacing, radius and motion",
      "A compact inventory of the scales already consumed by main.css. Motion is documented rather than replayed so the inventory respects reduced-motion without introducing a second animation system.",
      `
        <section class="sb-inventory__section">
          <h2>Spacing</h2>
          <div class="sb-token-list">
            ${tokenRows(
              spacingTokens,
              (token) => `<span class="sb-scale-sample" style="width: var(${token})"></span>`,
            )}
          </div>
        </section>
        <section class="sb-inventory__section">
          <h2>Radius</h2>
          <div class="sb-radius-list">
            ${radiusTokens
              .map(
                (token) => `
                  <span class="sb-radius-sample" style="border-radius: var(${token})">
                    <code>${token.replace("--radius-", "")}</code>
                  </span>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="sb-inventory__section">
          <h2>Motion</h2>
          <div class="sb-token-list">
            ${tokenRows(motionTokens, () => `<span class="sb-type-sample">Existing token</span>`)}
          </div>
        </section>
      `,
    ),
};
