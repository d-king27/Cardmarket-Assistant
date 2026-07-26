# Cardmarket Queue Guide

## Purpose

The Cardmarket queue publisher turns a local collection into deterministic,
reviewable CSV batches without using AI. It is the filesystem handoff between
the data tool and the later Playwright-assisted browser workflow.

Queue preparation does not modify or duplicate the source collection.

## Preparing A Queue

1. Import or select a collection.
2. Add a positive `Target price` to every record that should be listed.
3. Select `Prepare Cardmarket queue`.
4. Choose the scope:
   - entire collection;
   - current filtered records;
   - selected records.
5. Choose a maximum row count from 1 to 100. The default is 75.
6. Review blocking issues, warnings, and proposed filenames.
7. Correct blocked rows or explicitly exclude them from this job.
8. Select `Publish queue job`.

The same cards and settings always produce the same batch order and filenames.

## Blocking Rules

A record cannot be queued when it has:

- no card name;
- an invalid or non-positive quantity;
- no set code or set name;
- a missing or unsupported rarity;
- a missing, zero, negative, or malformed target price;
- an unsupported finish;
- an existing inventory validation error.

Etched cards are currently blocked because the browser extension only
represents normal and foil finishes safely.

Purchase price is never substituted for target price. Missing target prices can
never become zero-price listings.

Warnings do not block publishing. They cover data such as missing language,
missing condition, possible duplicates, and set identities that will require
later Cardmarket verification.

## Queue Storage

The local Node server writes jobs beneath:

```text
<monorepo>/.runtime/jobs/<job-id>/
  manifest.json
  csv/
  results/
```

The `.runtime` directory is ignored by Git. Set `CARDMARKET_RUNTIME_DIR` to
override its location.

Jobs are written into a temporary directory and renamed only after every CSV
and the manifest have been written successfully. Published jobs are immutable;
preparing corrected records creates a new job.

The server binds to `127.0.0.1` and does not accept user-provided filesystem
paths.

## CSV Contents

Every CSV contains one set and one rarity. It includes standard ManaBox fields
plus:

- `Price`
- `Target price`
- `Notes`

Both price columns use the approved local target price. `Price` is the canonical
listing-price column for the later extension workflow.

## Manifest

The versioned manifest records:

- source collection;
- preparation settings;
- source, queued, and excluded counts;
- batch filenames and identifiers;
- set, rarity, rows, and total quantity;
- SHA-256 file fingerprints;
- excluded-row reasons;
- warnings;
- initial pending status for each batch.

Later milestones will update processing results without changing the immutable
source CSV files.
