# Architecture Notes

This note describes the current Cardmarket Bulk Import architecture before the
automation hardening work begins. It is intentionally descriptive rather than
aspirational, so future commits can show exactly which responsibilities moved.

## Entry Points

- `src/entrypoints/injectedButton.content/index.tsx` mounts the React UI after
  `div#BulkAccordion` on Cardmarket bulk listing pages.
- `src/entrypoints/injectedButton.content/App.tsx` owns the modal flow and keeps
  imported rows in local React state.
- `src/entrypoints/background/index.ts` serves background messages. MTG set data
  is loaded through the background because the content script does not fetch it
  directly.
- `src/entrypoints/popup` contains extension information pages and does not
  participate in the listing workflow.

## CSV Parsing

- `src/utils/csv.ts` reads an uploaded file with `FileReader`.
- The parsed text is passed to `csv-parse` with `columns: true` and
  `skipEmptyLines: true`.
- `getCsvColumns` returns the CSV headers for the column mapping UI.
- Parsed records are returned as `Record<string, unknown>[]`.
- Parsing is memoized by file object.

Current limitations:

- Delimiter handling is implicit.
- UTF-8 BOM and header whitespace are not normalized explicitly.
- Numeric values are parsed later by game managers, not by the CSV layer.

## Column Mapping and Import Flow

- `ImportCsvForm` asks the active game manager for extra columns and validation.
- Common mapped columns are name, language, condition, signed, comment, quantity,
  and price.
- MTG adds set and foil columns.
- After mapping, `gameManager.parseCsv` turns raw CSV records into parsed rows.
- The modal switches from import mode to `SelectRowsForm` once parsed rows exist.

Current state ownership:

- Imported rows live only in `App` component state.
- Closing/reopening the modal or refreshing the page loses the batch.
- Selection state lives inside `SelectRowsForm`.

## Game Manager Architecture

- `getCurrentManager` chooses a manager from the Cardmarket URL path.
- `/en/Magic/Stock/ListingMethods/BulkListing` uses `MtgGameManager`.
- All other supported Cardmarket bulk listing pages use `GenericGameManager`.
- `GenericGameManager` contains shared CSV parsing, name matching, common field
  parsing, row duplication, and form filling.
- `MtgGameManager` extends the generic manager with set validation and foil
  handling.

Generic functionality:

- CSV record iteration.
- Common field mapping.
- Language and condition matching.
- Name-to-visible-row matching.
- Quantity, price, signed, comment, and condition form population.
- Duplicate row creation when a visible row already has quantity.

MTG-specific functionality:

- MTGJSON set matching.
- Expansion comparison against Cardmarket `idExpansion`.
- Foil parsing and form population.

## Matching

- `GenericGameManager.matchName` queries website product links through
  `getWebsiteRows`.
- It first tries exact normalized comparison against the displayed name and a
  nearby translated name.
- If no exact match is found, it returns the last row whose normalized name
  contains the imported name.
- The parsed row stores `name.value`, `name.matchedName`, and `enabled`.

Current limitations:

- Matching is tied directly to DOM anchors.
- Ambiguous matches are not represented.
- Fuzzy or partial matches can become fillable without explicit review.
- Product IDs are not supported.
- `enabled` cannot explain why a row is not ready.

## Cardmarket Row Location

- Cardmarket product anchors are selected by
  `td div.col-product.text-start a`.
- `getWebsiteRows` is memoized, so it can return stale anchors after pagination,
  filtering, sorting, or table replacement.
- Form controls are queried relative to the row during filling with selectors in
  `game-manager/utils/html.ts`.

Current selector ownership:

- Product link selector and form control selectors live in
  `game-manager/utils/html.ts`.
- MTG foil selector lives in `managers/mtg.ts`.
- Copy-row button lookup is inline in `GenericGameManager.fillRow`.

## Form Population

- `fillPage` finds the matched website anchor from the cached website rows.
- It walks from the anchor up to the table row and calls `fillRow`.
- `fillRow` queries controls from the row, duplicates the row if quantity is
  already present, then writes language, condition, signed, comment, quantity,
  and price.
- `MtgGameManager.fillRow` calls the generic implementation and then writes foil.

Current limitations:

- Missing controls can throw.
- Browser input/change events are not dispatched consistently.
- Written values are not confirmed.
- Row cloning assumes `previousSibling` is the cloned row.
- Fill reporting is only a count.
- The extension never submits the Cardmarket form, and that should remain true.

## Baseline Risks Confirmed

- Detached DOM rows can be reused because row lookup is memoized.
- Missing `idExpansion` is converted to numeric zero.
- Invalid quantity or price values are silently converted to zero.
- Disabled rows do not have structured reasons.
- Manual review is encouraged by docs, but not modeled in data.

