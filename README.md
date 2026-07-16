# Cardmarket Playwright Companion

A standalone desktop-side companion for the Cardmarket Bulk Import browser
extension. It launches Chromium with an unpacked extension, opens a supplied
Cardmarket bulk-listing page, validates a versioned listing batch, and writes
non-sensitive diagnostics.

The extension remains responsible for page inspection, matching, previews,
safe visible-row filling, and structured results. This project does not
duplicate that logic.

## Requirements

- Node.js 20 or newer
- An unpacked Chrome Manifest V3 build of the browser extension
- A Cardmarket bulk-listing URL

Install the project and Playwright's Chromium build:

```powershell
npm install
npx playwright install chromium
```

## Commands

```powershell
npm run check
npm run build
npm run run:dry -- --help
```

Run the screenshot-aligned dry-run workflow for one expansion:

```powershell
npm run run:dry -- `
  --batch fixtures/example-manabox-export.csv `
  --url "https://www.cardmarket.com/en/Magic/Stock" `
  --extension "C:\path\to\extension\.output\chrome-mv3" `
  --profile "C:\path\to\cardmarket-playwright-profile" `
  --set "DFT" `
  --headed
```

`run:dry` supplies `--dry-run` automatically. The other required arguments
are:

- `--batch <path>`: ManaBox CSV export or versioned listing batch JSON.
- `--url <url>`: HTTPS URL on `cardmarket.com` or one of its subdomains.
- `--extension <path>`: unpacked extension directory containing
  `manifest.json`.
- `--profile <path>`: persistent Chromium user-data directory. Keep this
  outside the repository because it may contain authenticated browser state.
- `--set <code-or-name>`: set code or exact set name. It is required when the
  CSV contains more than one expansion.
- `--headed`: show the browser and wait for the user to close it.
- `--dry-run`: select the only currently supported workflow.

The bulk URL above is illustrative; supply the actual `Bulk List Cards` URL.

## Current workflow

1. Parse and validate all CLI input.
2. Load a ManaBox CSV or validate a JSON batch against protocol version `1`.
3. Verify the unpacked extension directory and Manifest V3 manifest.
4. Select one CSV set using `--set`, or automatically select it when the input
   contains only one set.
5. Create a safe per-set CSV containing only name, language, condition, set
   code, foil state, and quantity.
6. Launch a persistent Chromium context with the extension loaded.
7. Open `Bulk List Cards`, resolve the expansion dropdown by exact set name or
   code, choose `Collectors Number` sorting when available, and click `FILTER`.
8. Wait for `div#BulkAccordion`, the results table, and the extension's
   `IMPORT CSV...` control.
9. Upload the safe per-set CSV and configure the extension's column mapping.
10. Click `SELECT ROWS`, capture the preview summary, and stop without clicking
    `FILL PAGE!`.
11. Save a JSON report under `reports/`.

In headed mode the browser remains open for manual inspection and login until
the user closes it. A real Cardmarket login is not needed for type checking,
building, or displaying CLI help.

## Safety boundaries

- The app never submits Cardmarket listings.
- The app does not implement matching or form filling. The extension preview
  decides which rendered rows are eligible.
- The app does not read or save cookies, authentication headers, payment
  details, account information, or seller information.
- The persistent browser profile is user-selected and is not inspected by the
  app.
- There is no localhost HTTP, WebSocket, or other command server.
- All future extension communication must remain behind the narrow
  `ExtensionBridge` adapter.

Generated reports contain the batch filename, record identifiers, URL, page
title, presence checks, and import-preview diagnostics. Treat them as local working
files; report JSON and browser-profile directories are ignored by Git.

Safe per-set CSVs are written under `reports/staged/` and ignored by Git.
`Purchase price` is never mapped to Cardmarket's price field, and collector
numbers are never mapped into public listing comments.

## ManaBox CSV mapping

The CSV loader expects the headers in `fixtures/example-manabox-export.csv`.
It maps name, quantity, set identifiers, collector number, finish, rarity,
ManaBox/Scryfall IDs, condition, language, purchase metadata, alteration flags,
and the added timestamp into a protocol-v1 `ListingBatchMessage`.

Purchase price is retained as provenance in `purchasePrice`; it is deliberately
not treated as the Cardmarket listing `price`. CSV files are converted in
memory—the source file is never rewritten.

## Expansion matching and the 100-row page limit

Set selection is deterministic: exact normalized set name first, then an exact
set-code token in the dropdown label. The tool refuses to guess when neither is
unambiguous. `ExpansionReasoner` is a narrow optional adapter for a future AI
fallback; any implementation may only choose from the options actually present
in the dropdown.

The current run previews one expansion on the currently rendered Cardmarket
page. An extension result such as `0 selected of 0 (14 total)` is recorded as
`no-current-page-matches`, not treated as a broken table. This can occur when
the desired cards are on a later page of a set with more than 100 articles.

The next pagination milestone should walk Cardmarket pages and ask the extension
for a preview on each page. Playwright should not reproduce the extension's
card-matching rules or assume that arbitrary 100-row CSV chunks correspond to
Cardmarket's rendered pages.

## Extension integration and extraction

The UI bridge is intentionally narrow and uses the labels visible in the
screenshots. The next integration step is to publish stable extension mount
selectors and structured preview/result contracts, then replace screenshot-led
UI parsing with versioned extension messaging.

Automatic filling must remain out of scope until the extension exposes stable
dry-run and result contracts. Submission remains manual even after filling is
introduced.
