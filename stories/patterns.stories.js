function patternShell(title, description, content) {
  const root = document.createElement("div");
  root.className = "sb-inventory";
  root.innerHTML = `
    <div class="sb-inventory__content sb-pattern">
      <header class="sb-inventory__header">
        <h1>${title}</h1>
        <p>${description}</p>
      </header>
      ${content}
    </div>
  `;
  return root;
}

export default {
  title: "Patterns",
};

export const Rows = {
  render: () =>
    patternShell(
      "Rows",
      "The repeated .row pattern used for people, courses, readings and references. Hover an item to inspect the existing neighborhood-focus behavior.",
      `
        <section>
          <h2>People</h2>
          <div class="row">
            <span class="who"><a href="#">Rauno Freiberg</a></span>
            <span class="what">Staff Design Engineer, Vercel</span>
          </div>
          <div class="row">
            <span class="who"><a href="#">Emil Kowalski</a></span>
            <span class="what">Design Engineer, Linear · Vaul, Sonner</span>
          </div>
          <div class="row">
            <span class="who"><a href="#">Jakub Krehel</a></span>
            <span class="what">Founding Design Engineer, Interfere</span>
          </div>
        </section>
        <section>
          <h2>Course status</h2>
          <div class="row">
            <span class="who"><a href="#">Interface Craft</a></span>
            <span class="what">Josh Puckett</span>
            <span class="status">Bought</span>
          </div>
          <div class="row">
            <span class="who"><a href="#">Animations.dev</a></span>
            <span class="what">Emil Kowalski · motion</span>
            <span class="status">Evaluate</span>
          </div>
        </section>
      `,
    ),
};

export const PhaseAndGlossary = {
  name: "Phase · Glossary",
  render: () =>
    patternShell(
      "Phase and glossary",
      "The .phase planning pattern with the existing keyboard-focusable .gloss tooltip. Hover list items or focus the underlined term with the keyboard.",
      `
        <div class="phases">
          <div class="phase">
            <div class="phase-head">
              <span class="phase-num">01</span>
              <h3>Foundation, now</h3>
            </div>
            <ul>
              <li>Study interaction and interface craft references.</li>
              <li>
                Practice modern CSS with
                <span class="gloss" tabindex="0">OKLCH<span class="gloss-tip">Perceptually uniform color space, more predictable than RGB/HSL for building palettes and adjusting tones.</span></span>.
              </li>
              <li>Keep the public proof grounded in working code.</li>
            </ul>
          </div>
          <div class="phase">
            <div class="phase-head">
              <span class="phase-num">02</span>
              <h3>Public proof</h3>
            </div>
            <ul>
              <li>Open one project and document the decisions.</li>
              <li>Keep the interface typographic and precise.</li>
              <li>Publish the work where peers can inspect it.</li>
            </ul>
          </div>
        </div>
      `,
    ),
};
