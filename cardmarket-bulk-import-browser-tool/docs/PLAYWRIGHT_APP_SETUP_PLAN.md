# Playwright Companion App Setup Plan

This is a proposed setup plan for a Playwright-based companion tool that can
live in this repository while the extension is being hardened. The intention is
to keep it easy to inspect beside the extension code now, then extract it into
a separate ManaBox CSV Manager project later.

The browser extension remains the authority for Cardmarket page inspection,
matching, dry-run previews, safe visible-row filling, and structured result
reporting. Playwright should orchestrate the browser and prepare inputs; it
should not bypass the extension's safety checks.

## Non-Goals

- Do not submit Cardmarket listings automatically.
- Do not store Cardmarket credentials.
- Do not scrape market data or live prices.
- Do not resolve Scryfall data remotely in this phase.
- Do not expose a broad unauthenticated localhost control API.
- Do not duplicate the extension's matching or form-filling logic in
  Playwright.

## Proposed Repo Layout

Keep the first draft isolated from the extension source:

```text
tools/
  playwright-companion/
    README.md
    package.json
    playwright.config.ts
    src/
      index.ts
      config.ts
      extensionLoader.ts
      browserSession.ts
      batchLoader.ts
      cardmarketNavigator.ts
      extensionBridge.ts
      resultWriter.ts
      types.ts
    fixtures/
      example-listing-batch.json
    reports/
      .gitkeep
```

This shape lets the tool reference the extension build output during local
development while still being removable as a standalone app later.

## Shared Contracts First

Before Playwright sends anything to a page, define versioned shared contracts in
the extension project:

```text
src/shared/listingBatchMessages.ts
src/shared/listingBatchSchemas.ts
```

Initial models should mirror the implementation plan:

- `ListingBatchMessage`
- `ListingBatchResultMessage`
- `ListingRecord`
- `CardmarketPageContext`
- `FillResult`

Add runtime validation with the same schema in both the extension and companion
tool. The companion app should only send validated batches, and the extension
should reject invalid messages with structured errors.

## Milestone 1: Local Tool Scaffold

Actions:

1. Add `tools/playwright-companion/package.json`.
2. Add Playwright and TypeScript dependencies scoped to that tool.
3. Add scripts:
   - `dev`
   - `check`
   - `run:dry`
   - `run:batch`
4. Add a tool-local `tsconfig.json`.
5. Add a small CLI argument parser for:
   - batch file path
   - Cardmarket bulk listing URL
   - browser profile directory
   - extension build directory
   - dry-run flag
   - headed/headless mode

Recommended default: headed mode. The user should be able to see and manually
review the browser.

## Milestone 2: Extension Build and Loading

Actions:

1. Build the extension with `corepack yarn build`.
2. Point the companion app at `.output/chrome-mv3`.
3. Launch Chromium with a persistent user data directory.
4. Load the unpacked extension using Chromium extension launch arguments.
5. Verify the extension appears on matching Cardmarket bulk listing pages.
6. Fail early if the extension build directory does not exist.

The companion tool should not assume the user is logged in. It should open the
browser and let the user authenticate manually using the persistent browser
profile.

## Milestone 3: Navigation and Page Readiness

Actions:

1. Navigate to a user-provided Cardmarket Bulk Listing URL.
2. Wait for the bulk listing container, currently `div#BulkAccordion`.
3. Wait for the extension's injected UI mount point.
4. Detect unsupported pages and report a clear error.
5. Collect non-sensitive page diagnostics:
   - current URL
   - page title
   - whether the extension UI is mounted
   - whether the bulk listing table is present

Do not collect cookies, account details, auth headers, payment data, or seller
personal information.

## Milestone 4: Batch Loading

Actions:

1. Accept a versioned JSON batch file generated from the ManaBox CSV Manager
   shape.
2. Validate it before browser interaction.
3. Preserve optional fields:
   - Cardmarket product ID
   - Scryfall ID
   - set code
   - set name
   - collector number
4. Refuse to continue when the batch protocol version is unsupported.
5. Produce a local validation report before opening Cardmarket.

In this repo, use fixtures under `tools/playwright-companion/fixtures/` until
the real ManaBox export exists.

## Milestone 5: Extension Bridge

Preferred early approach:

1. Use a mocked adapter first.
2. Exercise the extension UI manually or through a narrow test-only bridge.
3. Move to versioned extension runtime messaging only after the extension has
   stable session persistence and dry-run/result reporting.

Possible later transports:

- extension runtime messaging
- native messaging
- local WebSocket
- localhost HTTP

For this phase, avoid localhost command servers. If one is ever introduced, it
must be narrow, authenticated, user-approved, and unable to submit listings.

## Milestone 6: Dry-Run First Workflow

The first useful Playwright workflow should be dry-run only:

1. Load the extension.
2. Navigate to the supplied Cardmarket page.
3. Send or stage the listing batch.
4. Ask the extension for a dry-run preview.
5. Save the preview result to `tools/playwright-companion/reports/`.
6. Leave the browser open for manual review.

No form fields should be mutated in this milestone.

## Milestone 7: Assisted Fill Workflow

Only after extension dry-run and structured fill results are complete:

1. Load a validated batch.
2. Confirm the current page context matches the expected batch context or warn.
3. Ask the extension to fill only ready records visible on the current page.
4. Save `ListingBatchResultMessage` as JSON.
5. Leave the form open for user review and manual submission.

The companion app may navigate between pages later, but automatic page
navigation should stay separate from automatic form submission.

## Milestone 8: Extraction Path

When the companion app moves out of this repository:

1. Publish or copy shared contracts into a small shared package.
2. Keep extension-side message handlers versioned.
3. Move `tools/playwright-companion` to the ManaBox CSV Manager repository.
4. Replace fixture batch loading with real ManaBox exports.
5. Keep this repository's docs as the extension integration reference.

## Proposed First Commit For The Tool

The first implementation commit should only add the scaffold:

- `tools/playwright-companion/package.json`
- `tools/playwright-companion/README.md`
- `tools/playwright-companion/src/index.ts`
- `tools/playwright-companion/src/config.ts`
- `tools/playwright-companion/fixtures/example-listing-batch.json`

It should not add browser automation beyond argument parsing and validation.

## Validation Commands

Keep extension validation unchanged:

```text
corepack yarn compile
corepack yarn lint:check
corepack yarn test
corepack yarn build
corepack yarn build:firefox
```

Add companion-tool validation once scaffolded:

```text
corepack yarn --cwd tools/playwright-companion check
corepack yarn --cwd tools/playwright-companion run:dry -- --help
```
