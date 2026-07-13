# Baseline Results

Baseline captured on 2026-07-13 before behavior-changing Cardmarket automation
work.

## Environment

- Shell Node version: `v24.16.0`
- Declared Node engine: `24.17.0`
- Declared package manager: `yarn@4.17.0`
- `yarn` was not directly available on PATH; commands were run through
  `corepack yarn`.

## Dependency Installation

Command:

```text
corepack yarn install
```

Initial result:

- Failed during `wxt prepare`.
- WXT resolved Vite `8.0.16` while `@vitejs/plugin-react` attempted to import
  `vite/internal`.
- Error: `Package subpath './internal' is not defined by "exports"`.

Baseline stabilization added:

- `vite@7.3.6`
- `vitest@4.0.16`
- `jsdom@28.0.0`
- Yarn resolutions for `vite@7.3.6` and `@vitejs/plugin-react@5.2.0`

Final result:

- Installation completed with warnings.
- Remaining warning: Bootstrap requests peer dependency `@popperjs/core`.

## Commands Run

```text
corepack yarn compile
corepack yarn lint:check
corepack yarn test
corepack yarn build
corepack yarn build:firefox
```

Results:

- `compile`: passed
- `lint:check`: passed
- `test`: passed, 1 test file and 2 tests
- `build`: passed for Chrome MV3
- `build:firefox`: passed for Firefox MV2

Firefox build warning:

- Firefox requires `data_collection_permissions` for new extensions from
  2025-11-03. Existing extensions are currently exempt according to the WXT
  warning.

## Confirmed Baseline Bugs

- Website row lookup is memoized and can reuse stale DOM anchors after
  pagination, filtering, sorting, or table replacement.
- Missing `idExpansion` can be converted to numeric zero.
- Invalid or missing quantity and price values can be silently converted to zero.
- Disabled rows have no structured reason.
- Fill attempts report only a count, not per-row structured results.

