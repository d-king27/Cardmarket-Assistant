# Cardmarket CSV Queue Companion

A local queue and processing-plan tool for CSV files used with the Cardmarket
Bulk Import browser extension.

Cloudflare blocks browsers launched directly by Playwright on Cardmarket, so the
primary workflow no longer launches or controls Chrome. Use normal Chrome with
the unpacked extension installed manually. Login, Cloudflare, Cardmarket
navigation, extension actions, `FILL PAGE!`, review, and final submission remain
under the operator's control.

The companion owns the desktop-side queue:

- Scan a directory of prebuilt CSV files before opening Cardmarket.
- Validate that every CSV represents one set and one rarity.
- Order files deterministically by filename.
- Create a durable JSON processing plan.
- Present files one at a time like an automated test run.
- Record pass, fail, skip, attempt count, timestamps, and operator notes.
- Preserve results when unchanged files are rescanned.

It does not create, split, price, match, fill, or submit card listings.

## Setup

```powershell
cd "C:\Users\Dan\Documents\Codex\cardmarket-playwright-tool"
npm install
```

Install the unpacked extension in normal Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select:

   ```text
   C:\Users\Dan\Documents\Codex\cardmarket-bulk-import_BrowserExtend\.output\chrome-mv3
   ```

Use normal Chrome for Cardmarket. Do not use the old Playwright-created profile.

## CSV inbox

The default drop directory is:

```text
inbox\
```

Place prebuilt `.csv` files directly in that folder. Subdirectories are not
scanned. Files are processed in natural filename order, so numeric prefixes are
recommended:

```text
inbox\
  001__DFT__rare.csv
  002__DFT__uncommon.csv
  003__RVR__uncommon.csv
```

Each CSV must contain:

- `Name`
- `Quantity` or `Amount`
- One set tag
- One rarity tag
- At least one data row

Set metadata can come from a single-valued `Set code`, `Set name`, `Set`, or
`Expansion` column. Rarity can come from a single-valued `Rarity` column.

When those columns are intentionally absent, use this filename convention:

```text
ORDER__SET__RARITY.csv
```

For example, `001__DFT__rare.csv`. Explicit tags such as
`001__set-DFT__rarity-rare.csv` are also accepted. If filename tags conflict
with CSV columns, the file is marked `invalid`.

A CSV containing multiple set codes, set names, or rarities is invalid. Invalid
files remain visible in the plan with an error note; they are never silently
ignored.

## 1. Build the processing plan

Before opening Cardmarket, run:

```powershell
npm run plan
```

This scans `inbox/` and writes:

```text
reports\processing-plan.json
```

Use another directory or plan path when needed:

```powershell
npm run plan -- `
  --input-dir "C:\path\to\ready-csvs" `
  --plan ".\reports\my-processing-plan.json"
```

The console output is intentionally test-like:

```text
· 01 PENDING   001__DFT__rare.csv — DFT | rare | 12 rows
· 02 PENDING   002__DFT__uncommon.csv — DFT | uncommon | 28 rows
✗ 03 INVALID   bad.csv — CSV contains multiple rarity values: rare, uncommon

Total 3 | Pending 2 | Running 0 | Passed 0 | Failed 0 | Skipped 0 | Invalid 1
```

Rescanning preserves the history of files whose filename and content fingerprint
are unchanged. Changing a file creates a new pending queue item. A previously
interrupted `running` item is safely recovered to `pending`.

## 2. Review plan status

```powershell
npm run status
```

For a custom plan:

```powershell
npm run status -- --plan ".\reports\my-processing-plan.json"
```

This command is read-only.

## 3. Run the operator queue

Open normal Chrome yourself, sign into Cardmarket, and confirm the extension is
installed. Then start the queue:

```powershell
npm run queue
```

For each pending item, the tool prints the filename, full path, set, rarity, and
row count. In normal Chrome you then:

1. Navigate to **Bulk List Cards**.
2. Select the displayed set and rarity.
3. Apply the Cardmarket filter.
4. Import the displayed CSV using the extension.
5. Review the extension's selected rows and `FILL PAGE!` result.
6. Review and submit the Cardmarket form only when you choose.
7. Return to the terminal and mark the item `pass`, `fail`, `skip`, or `quit`.
8. Add an optional note.

The plan is saved before and after every item. Quitting pauses the queue without
losing progress. Failed items are excluded on the next run unless explicitly
retried:

```powershell
npm run queue -- --retry-failed
```

Success means the operator explicitly confirmed success; the tool does not infer
submission status from the page.

## Attached Chrome demo

The `demo` command attaches to a normal Chrome instance that you start with a
remote-debugging port. It uses the first pending CSV in the processing plan to:

1. select the exact expansion;
2. select the exact rarity;
3. sort by collector number when available;
4. click Filter;
5. upload a safe staged copy through the installed extension;
6. stop at the extension preview without clicking `FILL PAGE!`.

Start Chrome with an isolated data directory:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\Users\Dan\cardmarket-demo-profile"
```

In that Chrome window, install or enable the extension, complete Cardmarket
login and any Cloudflare check yourself, then open the Bulk List Cards page.
Run:

```powershell
npm run plan
npm run demo
```

Chrome remains open at the preview for screenshots and manual review. The demo
never clicks `FILL PAGE!` or submits a listing.

## Commands

```powershell
npm run check
npm test
npm run build
npm run plan -- --help
```

## Safety boundaries

- Normal Chrome handles login and Cloudflare.
- The companion never reads cookies, authentication headers, passwords, payment
  data, account data, or Chrome profile files.
- The companion does not launch Cardmarket or bypass Cloudflare.
- No localhost HTTP or WebSocket command server is exposed.
- No CSV is automatically treated as successful.
- `FILL PAGE!` and final Cardmarket submission remain manual.
- Generated plans and dropped CSVs are ignored by Git.

## Attached-session limitation

Attached automation may still trigger a Cloudflare response. The command does
not attempt to bypass it: stop the run, complete any browser check manually,
and retry only after Cardmarket is usable normally in that Chrome window.
