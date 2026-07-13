# Cardmarket Hardening Implementation Plan

This fork should remain a browser extension first. The long-term ManaBox CSV
Manager and Playwright application should integrate through explicit contracts
after the standalone extension is reliable.

## Commit Plan

1. Baseline tests and architecture note.
   - Add this plan and the architecture note.
   - Add a non-mutating lint command.
   - Add a unit-test runner and Cardmarket DOM fixtures.
   - Record existing install, compile, lint, Chrome build, Firefox build, and
     test results.

2. Remove stale DOM memoization.
   - Replace memoized website-row lookup with a live scanner.
   - Return typed `CardmarketPageRow` descriptors.
   - Keep raw DOM elements out of matching state and persisted state.

3. Add Cardmarket page-context parser.
   - Parse game, expansion ID, expansion name, rarity, page, sort, and URL.
   - Represent valid, absent, and malformed expansion IDs separately.
   - Prevent missing `idExpansion` from becoming zero.

4. Add live row scanner.
   - Centralize selectors.
   - Extract product URLs and product IDs.
   - Detect missing required table structure.
   - Add DOM fixture tests.

5. Add page-change observation.
   - Detect URL changes, history changes, pagination, filtering, sorting, and
     table replacement.
   - Debounce rescans and rematches.
   - Preserve imported batch data and compatible manual selections.

6. Add structured match statuses and reasons.
   - Replace `enabled` with `ImportRowResult`.
   - Show status badges, matched names, product IDs, and reason filters.
   - Stop using opacity as the only disabled signal.

7. Improve numeric parsing.
   - Add explicit quantity and price parsers.
   - Distinguish missing, invalid, negative, zero, and valid values.
   - Add validation summary before matching.

8. Improve CSV delimiter support.
   - Support comma and semicolon files, BOM, quoted values, empty optional
     columns, and normalized headers.
   - Add tests for comma, semicolon, BOM, and quoted-card-name cases.

9. Add staged matching.
   - Match by product ID, exact normalized name, exact name plus metadata,
     controlled aliases, then fuzzy review suggestions.
   - Never fill low-confidence fuzzy matches automatically.

10. Add product-ID extraction and matching.
    - Add optional Cardmarket product ID, Scryfall ID, set code, set name, and
      collector number mappings.
    - Preserve Scryfall IDs without remote lookup.
    - Display product IDs in diagnostics and reports.

11. Add safe form adapter.
    - Verify controls, write values, dispatch browser events, wait for cloned
      rows, confirm values, and return structured `FillResult` objects.
    - Continue safe rows when one row fails.
    - Do not automatically submit listings.

12. Add persistent imported sessions and future app boundary notes.
    - Persist imported filename, timestamp, normalized records, mapping,
      selection state, fill statuses, batch ID, and last page context.
    - Version the session schema.
    - Keep persisted data free of credentials and account details.
    - Document the future ManaBox CSV Manager boundary here:
      - The separate Playwright app should own desktop-side orchestration,
        file preparation, and optional browser automation outside this
        extension.
      - The extension should own Cardmarket page inspection, matching,
        visible-row validation, safe form population, dry-run previews, and
        structured results.
      - Playwright should not bypass the extension's matching and safety model.
      - The future app should send versioned listing batches and receive
        versioned result messages.
      - This project should not expose a broad unauthenticated localhost command
        interface.
      - Automatic Cardmarket form submission remains out of scope.

13. Add page-oriented workflow.
    - Show total, visible, ready, filled, another-page, failed, and remaining
      counts.
    - Add select-ready, fill-ready, mark-page-complete, hide-completed,
      retry-failed, export-failure-report, and clear-completed actions.

14. Add dry-run.
    - Use the same preview data for dry-run and normal fill.
    - Make no form mutations in dry-run mode.

15. Add result reporting.
    - Report requested, filled, already-filled, skipped, not-found, ambiguous,
      wrong-expansion, invalid-value, and form-control failures.
    - Export JSON and CSV reports.

16. Add message-contract types.
    - Define versioned listing batch and result contracts.
    - Add validation schemas and a mocked adapter.
    - Keep transport separate from domain models.

17. Documentation and regression tests.
    - Update README and add CONTRIBUTING if absent.
    - Document CSV formats, matching, multi-page imports, sessions, statuses,
      dry-run, manual review, known limitations, and DOM compatibility reports.

## Baseline Commands

Run after dependency installation and after every behavior-changing commit:

- `yarn compile`
- `yarn lint:check`
- `yarn test`
- `yarn build`
- `yarn build:firefox`

Use `yarn lint` only when intentionally applying ESLint fixes.

