import axe from "axe-core";
import { expect } from "storybook/test";

function debtMarker(node) {
  return node.html.match(/data-a11y-debt="([^"]+)"/)?.[1] ?? `unmarked(${node.html})`;
}

/**
 * Keeps production accessibility debt explicit without allowing a whole story
 * to pass when axe discovers a new violation.
 */
export async function expectOnlyA11yDebt(root, expected) {
  const { violations } = await axe.run(root, { resultTypes: ["violations"] });
  const actual = violations
    .flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}:${debtMarker(node)}`),
    )
    .sort();

  await expect(actual).toEqual([...expected].sort());
}
