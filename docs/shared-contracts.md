# Shared Contracts

## Purpose

`packages/cardmarket-contracts` owns the runtime schemas and TypeScript types
used at boundaries between the Cardmarket Assistant applications.

```text
data tool -> queue manifest and CSVs -> Playwright companion -> browser extension
```

Each consumer validates data at its own boundary. Sharing TypeScript types alone
is not sufficient because queue files and browser messages are runtime data.

## Contract Families

### Queue protocol

`CARDMARKET_QUEUE_VERSION` versions the job manifest created by the data tool.
The shared package defines:

- publish request and preparation settings;
- source-card and issue records;
- preview and batch metadata;
- job and batch status values;
- the persisted queue manifest.

The data tool keeps inventory-to-queue adapters locally because inventory is an
application model, not an integration contract.

### Listing protocol

`LISTING_PROTOCOL_VERSION` versions messages between the Playwright companion
and the extension. `PROTOCOL_VERSION` remains as a compatibility alias.

The shared package defines:

- `ListingRecord`;
- `ListingBatchMessage`;
- `CardmarketPageContext`;
- `FillResult`;
- `ListingBatchResultMessage`.

The Playwright companion imports these schemas through its existing
`src/types.ts` facade. The extension exposes them from
`src/shared/contracts.ts`, ready for the runtime message handler milestone.

## Queue Consumer Boundary

The Playwright companion reads `<monorepo>/.runtime/jobs` directly. Before a
batch is listed as actionable it verifies:

- the job directory and manifest are regular, non-symlinked paths;
- the directory name matches the manifest job ID;
- the manifest validates against the shared queue version;
- batch IDs, sequences, and filenames are unique;
- manifest filenames cannot escape the job's `csv` directory;
- no undeclared CSV files exist;
- each CSV's SHA-256 fingerprint, row count, quantity total, set, and rarity
  match its manifest entry.

Atomic `.staging-*` directories are ignored. An invalid job remains visible in
`npm run jobs` but contributes no files to the processing plan.

If `CARDMARKET_RUNTIME_DIR` is set, use an absolute path so the data tool and
companion resolve the same directory regardless of their working directories.

## Local Package Links

The data and Playwright tools use npm `file:` dependencies. The extension uses a
Yarn `portal:` dependency because it is managed by Yarn 4.

After cloning the monorepo, install in this order:

```powershell
cd packages/cardmarket-contracts
npm install
npm run build

cd ../../cardmarket-data-tool
npm install

cd ../cardmarket-playwright-tool
npm install

cd ../cardmarket-bulk-import-browser-tool
corepack yarn install
```

The package exports compiled ESM and declarations from its ignored `dist`
directory. Its `prepare` lifecycle builds that output during `npm install`; the
explicit build command above also makes the setup order clear.

## Versioning Rules

Keep the current version for additive optional fields. Increment the relevant
protocol version for:

- removing or renaming a field;
- making an optional field required;
- changing a field's meaning or representation;
- narrowing accepted values;
- changing message or manifest structure.

A breaking change must update the shared package and all consumers in one
monorepo commit. Tests must demonstrate supported-version acceptance and
unsupported-version rejection.

## Validation

Run:

```powershell
cd packages/cardmarket-contracts
npm run build
npm run check
npm test

cd ../../cardmarket-data-tool
npm test
npm run build
npm run lint

cd ../cardmarket-playwright-tool
npm test
npm run check
npm run build

cd ../cardmarket-bulk-import-browser-tool
corepack yarn test
corepack yarn compile
corepack yarn build
corepack yarn lint:check
```

The data tool currently uses Zod 3 internally while the shared package uses Zod
4. A schema composed with shared schemas must use the exported `contractZod`
instance; mixing Zod major versions inside one schema causes runtime failures.
