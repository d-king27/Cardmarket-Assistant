# MVP Guide

## What The App Does

ManaBox CSV Manager imports ManaBox CSV exports into a local browser database. You can review, filter, edit, remove, copy, split, and export collections without creating an account or sending full card records to a hosted backend.

The current MVP is designed around collection preparation, especially turning a large ManaBox export into smaller Cardmarket-friendly CSV collections.

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

Required fields are:

- `Name`
- `Set code`
- `Collector number`
- `Quantity`

Collector numbers are always kept as strings.

Unknown columns are reported during import and preserved internally where practical, but the current table and export flow focus on the standard ManaBox columns plus:

- `Target price`
- `Notes`

## Collections

The app supports multiple local collections.

- The first import creates `Main collection`.
- Later imports always create a new collection.
- Collections can be created manually.
- Existing collections can be cloned.
- Collections can be deleted from the side menu.
- The active collection can be exported as CSV.

When there are no collections, the app only shows the import box.

## Local Data

Inventory data is stored locally in IndexedDB through Dexie.

Stored locally:

- imported cards
- collection names
- import metadata
- target prices
- notes
- edit timestamps
- Steward AI audit entries

The app does not use cloud storage.

## Export

Use `Export CSV` to download the active collection. The exported filename is based on the collection name.

Steward-created collections can also be downloaded directly from the Steward AI sidebar after a plan is applied.

## Validation

The parser and validator handle:

- UTF-8 and UTF-8 BOM files
- trimmed headers and ordinary field values
- quoted names containing commas
- integer quantity parsing
- nullable decimal purchase prices
- safe `true` / `false` parsing
- missing required headers
- malformed CSV rows without dropping the whole import
- duplicate warnings based on Scryfall ID, finish, condition, and language, with a set-code/collector-number fallback

Invalid rows remain visible so they can be inspected and corrected.

## Known Limitations

- Steward execution currently focuses on the primary collection-splitting workflow.
- Unknown imported columns are not included in the current table UI.
- Duplicate rows are flagged for manual review but are not merged automatically.
- Editing is focused on common inventory fields: quantity, condition, language, purchase price, currency, target price, and notes.
- Filters are not restored after reload.
- Collection selection is local to the current browser session.
- There are no live price lookups, Scryfall calls, Cardmarket calls, scraping, or browser-extension integrations.
