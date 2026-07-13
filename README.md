# ManaBox CSV Manager

ManaBox CSV Manager is a local-first Phase 1 inventory tool for ManaBox CSV exports. It imports a CSV, validates and normalises the records, stores collections in the browser, and lets you search/filter/sort/edit/remove cards.

This phase deliberately avoids AI, scraping, Cardmarket automation, pricing APIs, authentication, analytics, and remote storage.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

## Test

```bash
npm test
```

## Production Build

```bash
npm run build
```

## Supported ManaBox Columns

The importer expects the standard ManaBox headers:

```text
Name
Set code
Set name
Collector number
Foil
Rarity
Quantity
ManaBox ID
Scryfall ID
Purchase price
Misprint
Altered
Condition
Language
Purchase price currency
Added
```

Required fields are `Name`, `Set code`, `Collector number`, and `Quantity`. Collector numbers are always kept as strings.

Unknown columns are reported during import and preserved on the internal record where practical, but Phase 1 only exports the standard ManaBox columns plus:

```text
Target price
Notes
```

## Local Data

Inventory data is stored locally in IndexedDB through Dexie. Imported records, target prices, notes, edit timestamps, collection names, and import metadata remain in the current browser profile. No user data is sent to a server.

You can create, switch, copy, and delete collections from the collapsible collection side menu. When there are no collections yet, the app only shows the import box. The first import creates `Main collection` automatically. Later imports always create a new collection instead of overwriting the active one. Removing records is permanent in this MVP. The app asks for confirmation before removing selected records, clearing a collection, or deleting a collection.

## Validation

The parser and validator handle:

- UTF-8 and UTF-8 BOM files
- Trimmed headers and ordinary field values
- Quoted names containing commas
- Integer quantity parsing
- Nullable decimal purchase prices
- Safe `true` / `false` parsing
- Missing required headers
- Malformed CSV rows without dropping the whole import
- Duplicate warnings based on Scryfall ID, finish, condition, and language, with a set-code/collector-number fallback

Invalid rows remain visible so they can be inspected and corrected.

## Known Limitations

- CSV export has been intentionally removed from the UI for now and will be reimplemented later.
- Unknown imported columns are not included in the current table UI.
- Duplicate rows are only flagged for manual review; they are not merged.
- Editing is focused on common inventory fields: quantity, condition, language, purchase price, currency, target price, and notes.
- Filters are not restored after reload.
- Collection selection is local to the current session.
- There are no live price lookups, Scryfall calls, Cardmarket calls, or browser-extension integrations.

## CSV Steward Next Steps

- Add richer import review for unknown columns and malformed rows.
- Add optional duplicate merge tools.
- Add saved filter presets.
- Add export profiles for downstream workflows.
- Add Cardmarket-focused preparation fields without automating Cardmarket itself.
