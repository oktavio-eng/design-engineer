# PR #18 validation evidence

This directory records the reproducible gate for the Storybook safety-net branch. The reviewed PNG references live in `tests/visual/baselines/`; CI publishes the built Storybook and current visual captures as seven-day artifacts.

Run from the repository root:

```sh
npm ci
npm run build-storybook
npm run test:ui
```

The product-real smoke serves the repository over loopback HTTP and does not mutate product files. Visual references are updated only with `UPDATE_VISUAL_BASELINES=1 npm run test:visual`, followed by manual PNG inspection and a normal comparison run.

See `results.json` for the exact base, tested code HEAD, matrix and exit codes from the final local gate. The evidence-only commit that contains `results.json` necessarily comes after `testedHead`; no executable or workflow file changes in that final evidence commit.
